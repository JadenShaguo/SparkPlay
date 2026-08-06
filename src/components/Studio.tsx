"use client";

import {
  BookOpen,
  Boxes,
  Check,
  Clock3,
  Code2,
  Copy,
  ExternalLink,
  Gamepad2,
  GitFork,
  Image as ImageIcon,
  Library,
  Play,
  Plus,
  RefreshCcw,
  RotateCcw,
  Share2,
  ShieldCheck,
  Sparkles,
  UserCircle
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AssetRef, GenerationMode, GenerationRun, PlayableVersion, Project, Template } from "@/types/domain";

interface StudioProps {
  templates: Template[];
}

type Tab = "create" | "library" | "templates" | "account";

interface GameTab {
  id: string;
  project: Project;
  version: PlayableVersion;
  html: string;
}

interface ProjectResponse {
  project: Project;
  versions: PlayableVersion[];
  currentVersion: PlayableVersion | null;
  html: string;
}

interface ProjectsResponse {
  projects: Project[];
  stats: {
    projectCount: number;
    versionCount: number;
    shareCount: number;
    remixCount: number;
  };
}

export function Studio({ templates }: StudioProps) {
  const [tab, setTab] = useState<Tab>("create");
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<GenerationMode>("direct");
  const [project, setProject] = useState<Project | null>(null);
  const [versions, setVersions] = useState<PlayableVersion[]>([]);
  const [currentVersion, setCurrentVersion] = useState<PlayableVersion | null>(null);
  const [html, setHtml] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<ProjectsResponse["stats"]>({
    projectCount: 0,
    versionCount: 0,
    shareCount: 0,
    remixCount: 0
  });
  const [assets, setAssets] = useState<AssetRef[]>([]);
  const [remixPrompt, setRemixPrompt] = useState("");
  const [importHtml, setImportHtml] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("准备创作");
  const [lastRun, setLastRun] = useState<GenerationRun | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [controlWidth, setControlWidth] = useState(348);
  const [gameTabs, setGameTabs] = useState<GameTab[]>([]);
  const [activeGameTabId, setActiveGameTabId] = useState<string | null>(null);

  const activeProjectId = project?.id;

  const refreshProjects = useCallback(async () => {
    const response = await fetch("/api/projects", { cache: "no-store" });
    const data = (await response.json()) as ProjectsResponse;
    setProjects(data.projects);
    setStats(data.stats);
  }, []);

  const loadProject = useCallback(async (projectId: string) => {
    const response = await fetch(`/api/projects/${projectId}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as ProjectResponse;
    setProject(data.project);
    setVersions(data.versions);
    setCurrentVersion(data.currentVersion);
    setHtml(data.html);
    setShareUrl("");
    setActiveGameTabId(null);
    setTab("create");
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refreshProjects();
      const params = new URLSearchParams(window.location.search);
      const projectId = params.get("project");
      if (projectId) {
        void loadProject(projectId);
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadProject, refreshProjects]);

  const canGenerate = prompt.trim().length >= 2;
  const currentRegeneratePrompt = prompt.trim() || currentVersion?.manifest.sourcePrompt || "";
  const canRegenerate = currentRegeneratePrompt.trim().length >= 2;
  const canRemix = Boolean(project && currentVersion && remixPrompt.trim().length >= 2);
  const currentSharePath = useMemo(() => {
    if (!shareUrl) return "";
    return typeof window === "undefined" ? shareUrl : `${window.location.origin}${shareUrl}`;
  }, [shareUrl]);

  async function readFiles(files: FileList | null) {
    if (!files?.length) return;
    const nextAssets = await Promise.all(
      Array.from(files).slice(0, 4).map(
        (file) =>
          new Promise<AssetRef>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                id: crypto.randomUUID(),
                kind: file.type.startsWith("audio/") ? "audio" : "image",
                name: file.name,
                mimeType: file.type,
                dataUrl: String(reader.result),
                bytes: file.size
              });
            reader.onerror = reject;
            reader.readAsDataURL(file);
          })
      )
    );
    setAssets(nextAssets);
  }

  async function generate(promptOverride?: string) {
    const generationPrompt = (promptOverride ?? prompt).trim();
    if (generationPrompt.length < 2) {
      setStatus("请输入生成指令");
      return;
    }
    const previousPreview = snapshotPreview();
    setBusy(true);
    setStatus("生成中");
    clearPreviewForPendingRun();
    try {
      const response = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: generationPrompt, mode, assets })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "生成失败");
      applyGenerationResult(data);
      setStatus("已生成可试玩版本");
      await refreshProjects();
    } catch (error) {
      restorePreview(previousPreview);
      setStatus(error instanceof Error ? error.message : "生成失败");
    } finally {
      setBusy(false);
    }
  }

  async function remix() {
    if (!project) return;
    const nextRemixPrompt = remixPrompt.trim();
    if (nextRemixPrompt.length < 2) {
      setStatus("请输入 Remix 修改指令");
      return;
    }
    const previousPreview = snapshotPreview();
    setBusy(true);
    setStatus("Remix 中");
    clearPreviewForPendingRun();
    try {
      const response = await fetch(`/api/projects/${project.id}/remix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: nextRemixPrompt, versionId: currentVersion?.id, assets })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Remix 失败");
      applyGenerationResult(data);
      setStatus("Remix 已生成新版本");
      await refreshProjects();
    } catch (error) {
      restorePreview(previousPreview);
      setStatus(error instanceof Error ? error.message : "Remix 失败");
    } finally {
      setBusy(false);
    }
  }

  async function rollback(versionId: string) {
    if (!project) return;
    const previousPreview = snapshotPreview();
    setBusy(true);
    setStatus("回滚中");
    clearPreviewForPendingRun();
    try {
      const response = await fetch(`/api/projects/${project.id}/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "回滚失败");
      applyProjectVersion(data);
      setStatus("已创建回滚版本");
      await refreshProjects();
    } catch (error) {
      restorePreview(previousPreview);
      setStatus(error instanceof Error ? error.message : "回滚失败");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!project || !currentVersion) return;
    setBusy(true);
    setStatus("创建分享链接");
    try {
      const response = await fetch("/api/share-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, versionId: currentVersion.id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "创建分享失败");
      setShareUrl(data.url);
      setStatus("分享链接已固定到当前版本");
      await refreshProjects();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "创建分享失败");
    } finally {
      setBusy(false);
    }
  }

  async function importExternalHtml() {
    const previousPreview = snapshotPreview();
    setBusy(true);
    setStatus("导入 HTML");
    clearPreviewForPendingRun();
    try {
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project?.id,
          title: "导入作品",
          html: importHtml
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "导入失败");
      applyProjectVersion(data);
      setStatus("HTML 已导入");
      await refreshProjects();
    } catch (error) {
      restorePreview(previousPreview);
      setStatus(error instanceof Error ? error.message : "导入失败");
    } finally {
      setBusy(false);
    }
  }

  async function regenerateCurrentPrompt() {
    await generate(currentRegeneratePrompt);
  }

  function applyGenerationResult(data: {
    project: Project;
    version: PlayableVersion;
    run: GenerationRun;
    html: string;
  }) {
    setProject(data.project);
    setCurrentVersion(data.version);
    setVersions((prev) => [data.version, ...prev.filter((item) => item.id !== data.version.id)]);
    setHtml(data.html);
    setLastRun(data.run);
    setShareUrl("");
    setActiveGameTabId(null);
  }

  function applyProjectVersion(data: { project: Project; version: PlayableVersion; html: string }) {
    setProject(data.project);
    setCurrentVersion(data.version);
    setVersions((prev) => [data.version, ...prev.filter((item) => item.id !== data.version.id)]);
    setHtml(data.html);
    setShareUrl("");
    setActiveGameTabId(null);
  }

  function snapshotPreview() {
    return {
      project,
      versions,
      currentVersion,
      html,
      shareUrl,
      lastRun
    };
  }

  function clearPreviewForPendingRun() {
    setHtml("");
    setCurrentVersion(null);
    setShareUrl("");
    setLastRun(null);
    setActiveGameTabId(null);
  }

  function restorePreview(snapshot: ReturnType<typeof snapshotPreview>) {
    setProject(snapshot.project);
    setVersions(snapshot.versions);
    setCurrentVersion(snapshot.currentVersion);
    setHtml(snapshot.html);
    setShareUrl(snapshot.shareUrl);
    setLastRun(snapshot.lastRun);
  }

  function openCurrentInGameTab() {
    if (!project || !currentVersion || !html) return;
    const tabId = `${project.id}:${currentVersion.id}`;
    const tab: GameTab = {
      id: tabId,
      project,
      version: currentVersion,
      html
    };
    setGameTabs((prev) => [tab, ...prev.filter((item) => item.id !== tabId)].slice(0, 6));
    setActiveGameTabId(tabId);
    setStatus("已在顶部标签页打开");
  }

  function switchGameTab(tab: GameTab) {
    setProject(tab.project);
    setCurrentVersion(tab.version);
    setHtml(tab.html);
    setActiveGameTabId(tab.id);
    setShareUrl("");
    setTab("create");
  }

  function newProject() {
    setProject(null);
    setVersions([]);
    setCurrentVersion(null);
    setHtml("");
    setShareUrl("");
    setLastRun(null);
    setActiveGameTabId(null);
    setStatus("准备创作");
    setTab("create");
  }

  function startResize(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = controlWidth;
    const handleMove = (moveEvent: PointerEvent) => {
      const nextWidth = Math.min(640, Math.max(320, startWidth + moveEvent.clientX - startX));
      setControlWidth(nextWidth);
    };
    const handleUp = () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      document.body.classList.remove("is-resizing-panel");
    };
    document.body.classList.add("is-resizing-panel");
    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
  }

  return (
    <main className="app-shell" style={{ "--control-width": `${controlWidth}px` } as React.CSSProperties}>
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark">
            <span>A</span>
          </div>
          <div>
            <strong>SparkPlay</strong>
            <span>用一句话生成能玩的互动内容</span>
          </div>
        </div>
        <nav className="nav-list" aria-label="Primary">
          <NavButton active={tab === "create"} icon={<Gamepad2 size={16} />} label="生成作品" onClick={() => setTab("create")} />
          <NavButton active={tab === "library"} icon={<Library size={16} />} label="作品库" onClick={() => setTab("library")} />
          <NavButton active={tab === "templates"} icon={<Boxes size={16} />} label="模板" onClick={() => setTab("templates")} />
          <NavButton active={tab === "account"} icon={<UserCircle size={16} />} label="账户" onClick={() => setTab("account")} />
        </nav>
        <div className="header-actions">
          <span className="mini-pill">{modeLabel(mode)}</span>
          <button className="new-project-button" type="button" onClick={newProject}>
            <Plus size={15} />
            新建项目
          </button>
          <div className="status-strip">
            <ShieldCheck size={15} />
            <span>{status}</span>
          </div>
        </div>
      </header>

      <section className="workspace">
        {gameTabs.length > 0 && (
          <div className="game-tab-strip" aria-label="游戏标签页">
            {gameTabs.map((item) => (
              <button
                key={item.id}
                className={activeGameTabId === item.id ? "game-tab active" : "game-tab"}
                type="button"
                onClick={() => switchGameTab(item)}
              >
                <Gamepad2 size={14} />
                <span>{item.version.manifest.title}</span>
              </button>
            ))}
          </div>
        )}
        <header className="topbar">
          <div>
            <p className="eyebrow">互动小游戏工作台</p>
            <h1>{project?.title ?? "新建作品"}</h1>
          </div>
          <div className="metric-row">
            <Metric label="作品" value={stats.projectCount} />
            <Metric label="版本" value={stats.versionCount} />
            <Metric label="分享" value={stats.shareCount} />
          </div>
        </header>

        {tab === "create" && (
          <section className="studio-grid">
            <div className="control-surface">
              <section className="surface-band">
                <button className="panel-tab" type="button">
                  新建作品
                </button>
                <div className="section-title">
                  <Sparkles size={18} />
                  <h2>新建作品</h2>
                </div>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="描述你想要生成的互动内容、玩法目标和视觉风格"
                  rows={6}
                />
                <label className="upload-target">
                  <ImageIcon size={18} />
                  <span>
                    <strong>{assets.length ? `${assets.length} 个素材已选择` : "拖拽图片到这里，或点击上传"}</strong>
                    <small>支持 PNG, JPG, GIF, WebP, SVG, MP3, WAV</small>
                  </span>
                  <input accept="image/*,audio/*" multiple type="file" onChange={(event) => readFiles(event.target.files)} />
                </label>
                <div className="mode-grid">
                  {(["direct", "plan_once", "clarify_plan_once", "staged"] as GenerationMode[]).map((item) => (
                    <button
                      key={item}
                      className={mode === item ? "mode selected" : "mode"}
                      type="button"
                      onClick={() => setMode(item)}
                    >
                      {modeLabel(item)}
                    </button>
                  ))}
                </div>
                <button className="primary-action" type="button" disabled={busy || !canGenerate} onClick={() => generate()}>
                  <Play size={18} />
                  {busy ? "生成中..." : "开始生成"}
                </button>
              </section>

              <section className="surface-band">
                <div className="section-title">
                  <Code2 size={18} />
                  <h2>导入已有 HTML</h2>
                </div>
                <p className="section-help">把其他工具生成的单文件 H5 放进来，继续预览、Remix、回滚和分享。</p>
                <textarea value={importHtml} onChange={(event) => setImportHtml(event.target.value)} rows={4} />
                <button className="plain-action" type="button" disabled={busy || importHtml.length < 20} onClick={importExternalHtml}>
                  导入为版本
                </button>
              </section>
            </div>
            <button
              aria-label="拖拽调整左侧操作区宽度"
              className="panel-resizer"
              type="button"
              onPointerDown={startResize}
            />

            <div className="preview-surface">
              <div className="preview-toolbar">
                <div>
                  <p className="eyebrow">实时预览</p>
                  <strong>{currentVersion?.manifest.title ?? "等待生成"}</strong>
                </div>
                <div className="inline-actions">
                  <button className="icon-button" type="button" disabled={!currentVersion || busy} onClick={share} title="分享">
                    <Share2 size={18} />
                  </button>
                  {shareUrl && (
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => navigator.clipboard.writeText(currentSharePath)}
                      title="复制链接"
                    >
                      <Copy size={18} />
                    </button>
                  )}
                </div>
              </div>
              <div className="preview-frame">
                <div className="preview-workbench">
                  <div className="phone-column">
                    <div className="phone-stage">
                      <div className="device-frame">
                        <div className="device-speaker" />
                        <div className="device-screen">
                          {html ? <iframe title="SparkPlay preview" srcDoc={html} sandbox="allow-scripts" /> : <EmptyPreview busy={busy} />}
                        </div>
                      </div>
                    </div>
                    <div className="phone-actions">
                      <button className="phone-action-button" type="button" disabled={busy || !canRegenerate} onClick={regenerateCurrentPrompt}>
                        <RefreshCcw size={17} />
                        重新生成
                      </button>
                      <button className="phone-action-button" type="button" disabled={!currentVersion || !html} onClick={openCurrentInGameTab}>
                        <ExternalLink size={17} />
                        新标签页打开
                      </button>
                    </div>
                    <div className="remix-bar">
                      <input
                        value={remixPrompt}
                        onChange={(event) => setRemixPrompt(event.target.value)}
                        placeholder="输入修改指令，如“把背景换成星空”"
                      />
                      <button type="button" disabled={!canRemix || busy} onClick={remix}>
                        Remix
                      </button>
                    </div>
                  </div>
                  <GenerationProcessPanel
                    busy={busy}
                    status={status}
                    currentVersion={currentVersion}
                    lastRun={lastRun}
                    versions={versions}
                    onRollback={rollback}
                  />
                </div>
              </div>
              {shareUrl && (
                <a className="share-link" href={shareUrl} target="_blank" rel="noreferrer">
                  {currentSharePath}
                </a>
              )}
            </div>
          </section>
        )}

        {tab === "library" && (
          <section className="content-list">
            {projects.map((item) => (
              <article className="library-item" key={item.id}>
                <div>
                  <p className="eyebrow">{item.visibility}</p>
                  <h2>{item.title}</h2>
                  <span>{item.description}</span>
                </div>
                <button type="button" onClick={() => loadProject(item.id)}>
                  打开
                </button>
              </article>
            ))}
          </section>
        )}

        {tab === "templates" && (
          <section className="template-grid">
            {templates.map((template) => (
              <article className="template-item" key={template.id}>
                <p className="eyebrow">{template.category}</p>
                <h2>{template.title}</h2>
                <p>{template.prompt}</p>
                <div className="tag-row">
                  {template.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPrompt(template.prompt);
                    setMode(template.recommendedMode);
                    setTab("create");
                  }}
                >
                  使用模板
                </button>
              </article>
            ))}
          </section>
        )}

        {tab === "account" && (
          <section className="account-grid">
            <Metric label="作品数" value={stats.projectCount} />
            <Metric label="版本数" value={stats.versionCount} />
            <Metric label="分享数" value={stats.shareCount} />
            <Metric label="Remix" value={stats.remixCount} />
            <div className="account-note">
              <BookOpen size={18} />
              <span>本地 adapter 正在使用 `/data` 保存项目、版本、分享链接和 HTML artifact。</span>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

function NavButton({
  active,
  icon,
  label,
  onClick
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={active ? "nav-button active" : "nav-button"} type="button" onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <strong>{Intl.NumberFormat("zh-CN").format(value)}</strong>
      <span>{label}</span>
    </div>
  );
}

function EmptyPreview({ busy }: { busy: boolean }) {
  return (
    <div className="empty-preview">
      {busy ? <div className="loader-ring" /> : <Clock3 size={28} />}
      <span>{busy ? "AI 正在创作..." : "等待创作"}</span>
      <small>{busy ? "AI 正在生成..." : "输入 prompt 生成第一个互动内容"}</small>
    </div>
  );
}

function GenerationProcessPanel({
  busy,
  status,
  currentVersion,
  lastRun,
  versions,
  onRollback
}: {
  busy: boolean;
  status: string;
  currentVersion: PlayableVersion | null;
  lastRun: GenerationRun | null;
  versions: PlayableVersion[];
  onRollback: (versionId: string) => void;
}) {
  const latestVersions = versions.slice(0, 5);

  return (
    <aside className="generation-process" aria-label="生成过程">
      <div className="section-title">
        <Sparkles size={18} />
        <h2>生成过程</h2>
      </div>
      <ol className="process-list">
        <ProcessStep done active={false} title="接收指令" detail="读取 prompt、模式和素材" />
        <ProcessStep done={Boolean(currentVersion || lastRun)} active={busy} title="生成小游戏" detail={busy ? "模型正在生成 HTML" : status} />
        <ProcessStep done={Boolean(currentVersion?.validationReport.valid)} active={false} title="安全校验" detail={currentVersion?.validationReport.valid ? "HTML 校验通过" : "等待新版本"} />
        <ProcessStep done={Boolean(currentVersion)} active={false} title="写入版本" detail={currentVersion ? currentVersion.id : "生成后创建不可变版本"} />
        <ProcessStep done={Boolean(currentVersion)} active={false} title="预览就绪" detail={currentVersion ? "手机预览已更新" : "等待预览"} />
      </ol>
      {lastRun && (
        <div className="process-metrics">
          <Metric label="耗时 ms" value={lastRun.durationMs ?? 0} />
          <Metric label="HTML 大小" value={lastRun.htmlBytes ?? 0} />
        </div>
      )}
      <div className="process-history">
        <strong>最近版本</strong>
        {latestVersions.length === 0 ? (
          <span>暂无版本</span>
        ) : (
          latestVersions.map((version) => (
            <div className="process-version" key={version.id}>
              <button type="button" disabled={busy} onClick={() => onRollback(version.id)} title="回滚到此版本">
                <RotateCcw size={14} />
              </button>
              <div>
                <span>{version.sourceKind}</span>
                <small>{new Date(version.createdAt).toLocaleTimeString()}</small>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

function ProcessStep({
  done,
  active,
  title,
  detail
}: {
  done: boolean;
  active: boolean;
  title: string;
  detail: string;
}) {
  return (
    <li className={active ? "process-step active" : done ? "process-step done" : "process-step"}>
      <span className="process-dot">{done ? <Check size={13} /> : active ? <span /> : null}</span>
      <div>
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
    </li>
  );
}

function modeLabel(mode: GenerationMode) {
  const labels: Record<GenerationMode, string> = {
    direct: "直接生成",
    plan_once: "先计划",
    clarify_plan_once: "追问后计划",
    staged: "分阶段",
    import: "导入"
  };
  return labels[mode];
}
