"use client";

import {
  BookOpen,
  Boxes,
  Check,
  Clock3,
  Code2,
  Compass,
  Copy,
  ExternalLink,
  Gamepad2,
  Github,
  GitFork,
  Image as ImageIcon,
  Library,
  LogOut,
  Play,
  Plus,
  RefreshCcw,
  RotateCcw,
  Share2,
  ShieldCheck,
  Sparkles,
  UserCircle
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AssetRef, GenerationMode, GenerationRun, PlayableVersion, Project, Template, User } from "@/types/domain";

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
  currentVersionThumbnailUrl?: string;
  html: string;
}

interface ProjectListItem extends Project {
  currentVersionThumbnailUrl?: string;
}

interface ProjectsResponse {
  projects: ProjectListItem[];
  stats: {
    projectCount: number;
    versionCount: number;
    shareCount: number;
    remixCount: number;
  };
}

interface GenerationEnqueueResponse {
  runId: string;
  status: GenerationRun["status"];
  run: GenerationRun;
}

interface GenerationResultResponse {
  run: GenerationRun;
  project: Project | null;
  version: PlayableVersion | null;
  html: string;
}

interface MeResponse {
  user: User;
  authenticated: boolean;
  guest: boolean;
}

interface LocalGitHubConfigResponse {
  writable: boolean;
  configured: boolean;
  appUrl: string;
  needs: {
    appUrl: boolean;
    authSecret: boolean;
    githubClientId: boolean;
    githubClientSecret: boolean;
  };
}

const activeRunStorageKey = "sparkplay.activeRunId";

export function Studio({ templates }: StudioProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("create");
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<GenerationMode>("direct");
  const [project, setProject] = useState<Project | null>(null);
  const [versions, setVersions] = useState<PlayableVersion[]>([]);
  const [currentVersion, setCurrentVersion] = useState<PlayableVersion | null>(null);
  const [html, setHtml] = useState("");
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
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
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [guest, setGuest] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ name: "", avatarColor: "#7f7cff" });
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);
  const [libraryError, setLibraryError] = useState("");
  const [githubConfigOpen, setGithubConfigOpen] = useState(false);
  const [githubConfigSaving, setGithubConfigSaving] = useState(false);
  const [githubConfigMessage, setGithubConfigMessage] = useState("");
  const [githubConfigConfigured, setGithubConfigConfigured] = useState(false);
  const [githubConfigForm, setGithubConfigForm] = useState({
    appUrl: "http://localhost:3000",
    authSecret: "",
    githubClientId: "",
    githubClientSecret: ""
  });
  const resumeAttemptedRef = useRef(false);

  const activeProjectId = project?.id;

  const refreshProjects = useCallback(async () => {
    const response = await fetch("/api/projects", { cache: "no-store" });
    const data = (await response.json()) as ProjectsResponse;
    setProjects(data.projects);
    setStats(data.stats);
  }, []);

  const loadProject = useCallback(async (projectId: string) => {
    setLoadingProjectId(projectId);
    setLibraryError("");
    setStatus("正在打开作品");
    try {
      const response = await fetch(`/api/projects/${projectId}`, { cache: "no-store" });
      const data = (await response.json()) as ProjectResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "打开作品失败");
      setProject(data.project);
      setVersions(data.versions);
      setCurrentVersion(data.currentVersion);
      setHtml(data.html);
      setShareUrl("");
      setActiveGameTabId(null);
      setStatus(`已打开：${data.project.title}`);
      setTab("create");
    } catch (error) {
      const message = error instanceof Error ? error.message : "打开作品失败";
      setLibraryError(message);
      setStatus(message);
    } finally {
      setLoadingProjectId(null);
    }
  }, []);

  const applyGenerationResult = useCallback((data: {
    project: Project;
    version: PlayableVersion;
    run: GenerationRun;
    html: string;
  }) => {
    setProject(data.project);
    setCurrentVersion(data.version);
    setVersions((prev) => [data.version, ...prev.filter((item) => item.id !== data.version.id)]);
    setHtml(data.html);
    setLastRun(data.run);
    setShareUrl("");
    setActiveGameTabId(null);
  }, []);

  const pollGenerationResult = useCallback(async (runId: string): Promise<{
    project: Project;
    version: PlayableVersion;
    run: GenerationRun;
    html: string;
  }> => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 180_000) {
      const response = await fetch(`/api/generations/${runId}`, { cache: "no-store" });
      const data = (await response.json()) as GenerationResultResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "查询生成任务失败");
      setLastRun(data.run);
      setStatus(statusLabel(data.run.status));
      if (data.run.status === "failed") {
        throw new Error(data.run.error ?? "生成任务失败");
      }
      if (data.run.status === "success") {
        if (!data.project || !data.version || !data.html) {
          throw new Error("生成任务完成，但没有找到版本结果");
        }
        return {
          project: data.project,
          version: data.version,
          run: data.run,
          html: data.html
        };
      }
      await sleep(900);
    }
    throw new Error("生成任务等待超时，请稍后在作品库中查看");
  }, []);

  const resumeActiveRun = useCallback(async (runId: string) => {
    setBusy(true);
    setStatus("正在恢复未完成生成任务");
    try {
      const result = await pollGenerationResult(runId);
      applyGenerationResult(result);
      clearStoredActiveRunId();
      setStatus("已恢复生成结果");
      await refreshProjects();
    } catch (error) {
      clearStoredActiveRunId();
      setStatus(error instanceof Error ? error.message : "恢复生成任务失败");
    } finally {
      setBusy(false);
    }
  }, [applyGenerationResult, pollGenerationResult, refreshProjects]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetch("/api/me", { cache: "no-store" })
        .then((response) => response.json() as Promise<MeResponse>)
        .then((data) => {
          setCurrentUser(data.user);
          setAuthenticated(data.authenticated);
          setGuest(data.guest);
          setProfileDraft({ name: data.user.name, avatarColor: data.user.avatarColor });
          return refreshProjects();
        })
        .catch(() => undefined);
      const params = new URLSearchParams(window.location.search);
      const projectId = params.get("project");
      if (projectId) {
        void loadProject(projectId);
      }
      const activeRunId = readStoredActiveRunId();
      if (activeRunId && !resumeAttemptedRef.current) {
        resumeAttemptedRef.current = true;
        void resumeActiveRun(activeRunId);
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadProject, refreshProjects, resumeActiveRun]);

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
      const queued = data as GenerationEnqueueResponse;
      setLastRun(queued.run);
      setStatus(statusLabel(queued.run.status));
      writeStoredActiveRunId(queued.runId);
      const result = await pollGenerationResult(queued.runId);
      applyGenerationResult(result);
      clearStoredActiveRunId();
      setStatus("已生成可试玩版本");
      await refreshProjects();
    } catch (error) {
      clearStoredActiveRunId();
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
      const queued = data as GenerationEnqueueResponse;
      setLastRun(queued.run);
      setStatus(statusLabel(queued.run.status));
      writeStoredActiveRunId(queued.runId);
      const result = await pollGenerationResult(queued.runId);
      applyGenerationResult(result);
      clearStoredActiveRunId();
      setStatus("Remix 已生成新版本");
      await refreshProjects();
    } catch (error) {
      clearStoredActiveRunId();
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

  async function startGithubLogin() {
    setGithubConfigMessage("");
    try {
      const response = await fetch("/api/local-config/github-oauth", { cache: "no-store" });
      const data = (await response.json()) as LocalGitHubConfigResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "读取 GitHub 登录配置失败");
      setGithubConfigConfigured(data.configured);
      setGithubConfigForm((prev) => ({
        ...prev,
        appUrl: data.appUrl || window.location.origin,
        authSecret: prev.authSecret || createBrowserSecret()
      }));
      setGithubConfigOpen(true);
      if (data.configured) {
        setGithubConfigMessage("本地已经检测到 GitHub 登录配置，可以直接使用已有配置登录，也可以重新填写后覆盖。");
      } else if (!data.writable) {
        setGithubConfigMessage("当前环境不允许页面写入本地配置，请手动编辑 .env.local。");
      }
    } catch (error) {
      setGithubConfigForm((prev) => ({
        ...prev,
        appUrl: window.location.origin,
        authSecret: prev.authSecret || createBrowserSecret()
      }));
      setGithubConfigOpen(true);
      setGithubConfigConfigured(false);
      setGithubConfigMessage(error instanceof Error ? error.message : "读取 GitHub 登录配置失败");
    }
  }

  async function saveGithubConfigAndLogin() {
    setGithubConfigSaving(true);
    setGithubConfigMessage("正在写入本地 .env.local");
    try {
      const response = await fetch("/api/local-config/github-oauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(githubConfigForm)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "保存 GitHub 登录配置失败");
      setGithubConfigMessage("配置已写入 .env.local，正在打开 GitHub 登录。若仍失败，请重启 npm run dev。");
      window.setTimeout(() => {
        router.push("/api/auth/github/start?returnTo=/");
      }, 450);
    } catch (error) {
      setGithubConfigMessage(error instanceof Error ? error.message : "保存 GitHub 登录配置失败");
    } finally {
      setGithubConfigSaving(false);
    }
  }

  async function saveProfile() {
    setStatus("正在保存资料");
    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileDraft)
      });
      const data = (await response.json()) as MeResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "保存资料失败");
      setCurrentUser(data.user);
      setAuthenticated(data.authenticated);
      setGuest(data.guest);
      setProfileDraft({ name: data.user.name, avatarColor: data.user.avatarColor });
      setStatus("资料已保存");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "保存资料失败");
    }
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
          <Link className="discover-link" href="/discover">
            <Compass size={15} />
            发现
          </Link>
          <button className="new-project-button" type="button" onClick={newProject}>
            <Plus size={15} />
            新建项目
          </button>
          <span className="mini-pill">模式：{modeLabel(mode)}</span>
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
            {libraryError && <div className="inline-error">{libraryError}</div>}
            {projects.map((item) => (
              <article className="library-item" key={item.id}>
                <div className="library-thumb" aria-hidden="true">
                  {item.currentVersionThumbnailUrl ? (
                    <span
                      className="library-thumb-image"
                      style={{ backgroundImage: `url(${item.currentVersionThumbnailUrl})` }}
                    />
                  ) : (
                    <ImageIcon size={22} />
                  )}
                </div>
                <div className="library-info">
                  <p className="eyebrow">{item.visibility}</p>
                  <h2>{item.title}</h2>
                  <span>{item.description}</span>
                </div>
                <button type="button" disabled={loadingProjectId === item.id} onClick={() => loadProject(item.id)}>
                  {loadingProjectId === item.id ? "打开中" : "打开"}
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
            <div className="account-profile">
              <div className="account-avatar" style={{ background: currentUser?.avatarColor ?? "#1f6b4a" }}>
                {(currentUser?.name ?? "C").slice(0, 1)}
              </div>
              <div>
                <p className="eyebrow">当前创作者</p>
                <h2>{currentUser?.name ?? "Creator Demo"}</h2>
                <p className="account-state">{authenticated ? "GitHub 已登录" : guest ? "游客模式，作品保存在本机游客账户" : "本地演示账户"}</p>
                <div className="account-actions">
                  <Link href={`/users/${currentUser?.id ?? "user_demo"}`}>查看公开主页</Link>
                  {authenticated ? (
                    <form action="/api/auth/logout" method="post">
                      <button type="submit">
                        <LogOut size={15} />
                        退出登录
                      </button>
                    </form>
                  ) : (
                    <button type="button" onClick={startGithubLogin}>
                      <Github size={15} />
                      使用 GitHub 登录
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="account-profile-editor">
              <label>
                <span>显示名称</span>
                <input
                  value={profileDraft.name}
                  onChange={(event) => setProfileDraft((prev) => ({ ...prev, name: event.target.value }))}
                  maxLength={40}
                />
              </label>
              <label>
                <span>头像颜色</span>
                <input
                  value={profileDraft.avatarColor}
                  onChange={(event) => setProfileDraft((prev) => ({ ...prev, avatarColor: event.target.value }))}
                  type="color"
                />
              </label>
              <button className="plain-action" type="button" onClick={saveProfile}>
                保存资料
              </button>
            </div>
            <div className="account-note">
              <BookOpen size={18} />
              <span>本地 adapter 正在使用 `/data` 保存项目、版本、分享链接和 HTML artifact。</span>
            </div>
          </section>
        )}
      </section>
      {githubConfigOpen && (
        <GitHubConfigModal
          form={githubConfigForm}
          configured={githubConfigConfigured}
          message={githubConfigMessage}
          saving={githubConfigSaving}
          onChange={setGithubConfigForm}
          onClose={() => setGithubConfigOpen(false)}
          onUseExistingConfig={() => router.push("/api/auth/github/start?returnTo=/")}
          onGenerateSecret={() => setGithubConfigForm((prev) => ({ ...prev, authSecret: createBrowserSecret() }))}
          onSubmit={saveGithubConfigAndLogin}
        />
      )}
    </main>
  );
}

function GitHubConfigModal({
  form,
  configured,
  message,
  saving,
  onChange,
  onClose,
  onUseExistingConfig,
  onGenerateSecret,
  onSubmit
}: {
  form: {
    appUrl: string;
    authSecret: string;
    githubClientId: string;
    githubClientSecret: string;
  };
  configured: boolean;
  message: string;
  saving: boolean;
  onChange: React.Dispatch<React.SetStateAction<{
    appUrl: string;
    authSecret: string;
    githubClientId: string;
    githubClientSecret: string;
  }>>;
  onClose: () => void;
  onUseExistingConfig: () => void;
  onGenerateSecret: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="config-modal" role="dialog" aria-modal="true" aria-labelledby="github-config-title">
        <header className="config-modal-header">
          <div>
            <p className="eyebrow">本地登录配置</p>
            <h2 id="github-config-title">配置 GitHub 登录</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭配置窗口">
            ×
          </button>
        </header>
        <p className="config-help">
          这些参数只会写入本机 `.env.local`，不会进入 Git。GitHub OAuth App 的回调地址填写
          <code>{`${form.appUrl.replace(/\/+$/, "")}/api/auth/github/callback`}</code>。
        </p>
        <form
          className="config-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label>
            <span>应用地址</span>
            <input
              value={form.appUrl}
              onChange={(event) => onChange((prev) => ({ ...prev, appUrl: event.target.value }))}
              placeholder="http://localhost:3000"
            />
            <small>本地开发通常使用当前页面地址，例如 http://localhost:3000。</small>
          </label>
          <label>
            <span>登录签名密钥 SPARKPLAY_AUTH_SECRET</span>
            <div className="input-row">
              <input
                value={form.authSecret}
                onChange={(event) => onChange((prev) => ({ ...prev, authSecret: event.target.value }))}
                placeholder="建议使用随机长字符串"
                type="password"
              />
              <button className="plain-action" type="button" onClick={onGenerateSecret}>
                生成
              </button>
            </div>
            <small>用于签名 SparkPlay 登录 Cookie，不是 GitHub 密钥。</small>
          </label>
          <label>
            <span>GitHub Client ID</span>
            <input
              value={form.githubClientId}
              onChange={(event) => onChange((prev) => ({ ...prev, githubClientId: event.target.value }))}
              placeholder="GitHub OAuth App 的 Client ID"
            />
            <small>GitHub Settings / Developer settings / OAuth Apps 中创建后获取。</small>
          </label>
          <label>
            <span>GitHub Client Secret</span>
            <input
              value={form.githubClientSecret}
              onChange={(event) => onChange((prev) => ({ ...prev, githubClientSecret: event.target.value }))}
              placeholder="GitHub OAuth App 的 Client Secret"
              type="password"
            />
            <small>只写入本地 `.env.local`，界面不会读取或回显已有 secret。</small>
          </label>
          {message && <div className="config-message">{message}</div>}
          <div className="config-actions">
            <button className="plain-action" type="button" onClick={onClose}>
              取消
            </button>
            {configured && (
              <button className="plain-action" type="button" onClick={onUseExistingConfig}>
                使用已有配置登录
              </button>
            )}
            <button className="secondary-action" type="submit" disabled={saving}>
              {saving ? "保存中" : "保存并继续登录"}
            </button>
          </div>
        </form>
      </section>
    </div>
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

function createBrowserSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
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
  const runStatus = lastRun?.status;
  const statusDetail = runStatus ? statusLabel(runStatus) : status;

  return (
    <aside className="generation-process" aria-label="生成过程">
      <div className="section-title">
        <Sparkles size={18} />
        <h2>生成过程</h2>
      </div>
      <ol className="process-list">
        <ProcessStep done active={false} title="接收指令" detail="读取 prompt、模式和素材" />
        <ProcessStep
          done={Boolean(currentVersion) || hasReachedRunStage(runStatus, "validating")}
          active={Boolean(runStatus && ["queued", "running", "planning", "generating"].includes(runStatus))}
          title="生成小游戏"
          detail={statusDetail}
        />
        <ProcessStep
          done={Boolean(currentVersion?.validationReport.valid) || hasReachedRunStage(runStatus, "persisting")}
          active={Boolean(runStatus && ["validating", "repairing", "smoking", "moderating"].includes(runStatus))}
          title="安全校验"
          detail={currentVersion?.validationReport.valid ? "HTML 校验通过" : statusDetail}
        />
        <ProcessStep
          done={Boolean(currentVersion)}
          active={runStatus === "persisting"}
          title="写入版本"
          detail={currentVersion ? currentVersion.id : statusDetail}
        />
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

function statusLabel(status: GenerationRun["status"]) {
  const labels: Record<GenerationRun["status"], string> = {
    queued: "任务已排队",
    running: "任务运行中",
    planning: "正在规划玩法",
    generating: "模型正在生成 HTML",
    validating: "正在校验 HTML",
    repairing: "正在尝试修复",
    smoking: "正在浏览器冒烟测试",
    moderating: "正在进行发布前检查",
    persisting: "正在写入版本",
    success: "生成完成",
    failed: "生成失败"
  };
  return labels[status];
}

function hasReachedRunStage(status: GenerationRun["status"] | undefined, stage: GenerationRun["status"]) {
  if (!status) return false;
  if (status === "failed") return false;
  const order: GenerationRun["status"][] = [
    "queued",
    "running",
    "planning",
    "generating",
    "validating",
    "repairing",
    "smoking",
    "moderating",
    "persisting",
    "success",
    "failed"
  ];
  return order.indexOf(status) >= order.indexOf(stage);
}

function readStoredActiveRunId() {
  return window.localStorage.getItem(activeRunStorageKey);
}

function writeStoredActiveRunId(runId: string) {
  window.localStorage.setItem(activeRunStorageKey, runId);
}

function clearStoredActiveRunId() {
  window.localStorage.removeItem(activeRunStorageKey);
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
