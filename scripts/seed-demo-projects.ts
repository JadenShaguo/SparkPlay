import type { PlayableManifest, PlayablePlan, Project } from "../src/types/domain";
import {
  attachVersionQuality,
  completeRun,
  createRun,
  createShareLink,
  ensureUser,
  getProjectVersions,
  listProjects,
  persistGeneratedVersion,
  setProjectVisibility,
  writeThumbnail
} from "../src/lib/store";
import { escapeHtml, validateHtml } from "../src/lib/validation";

const demoUserId = "user_demo";
const visualSeedTag = "visual-demo-v2";

interface DemoPlayable {
  title: string;
  description: string;
  prompt: string;
  category: string;
  tags: string[];
  controls: string[];
  palette: {
    bg: string;
    ink: string;
    primary: string;
    secondary: string;
    accent: string;
  };
  motif: "cards" | "stars" | "runner" | "quiz" | "survival" | "balloons" | "treasure" | "rhythm";
  visibility: Project["visibility"];
  opens: number;
  remixClicks: number;
  plan: PlayablePlan;
}

const demoPlayables: DemoPlayable[] = [
  {
    title: "星港记忆翻牌",
    description: "4x4 记忆翻牌，霓虹卡片、步数统计、匹配进度和完成反馈一屏完成。",
    prompt: "做一个4x4记忆翻牌游戏，要有步数、匹配数和重新开始",
    category: "memory",
    tags: ["翻牌", "记忆", "移动端", visualSeedTag],
    controls: ["点击翻牌", "重新开始"],
    palette: { bg: "#07111f", ink: "#f7fbff", primary: "#38d5ff", secondary: "#9b7cff", accent: "#ffd166" },
    motif: "cards",
    visibility: "public",
    opens: 428,
    remixClicks: 54,
    plan: plan("星港记忆翻牌", "点击翻开卡牌，寻找相同星港符号，用更少步数完成全部配对。", "完成全部 8 组匹配。")
  },
  {
    title: "十秒摘星挑战",
    description: "限时 10 秒点击流星，连续命中会提升倍数，结束后显示评级卡片。",
    prompt: "做一个10秒点星星挑战，点击星星加分，结束后显示评级",
    category: "arcade",
    tags: ["限时", "点击", "评级", visualSeedTag],
    controls: ["点击星星", "重新开始"],
    palette: { bg: "#10081f", ink: "#fff7ff", primary: "#ffcf5a", secondary: "#ff5faa", accent: "#6ee7ff" },
    motif: "stars",
    visibility: "public",
    opens: 396,
    remixClicks: 41,
    plan: plan("十秒摘星挑战", "在 10 秒内点击不断移动的星星，连击越高分数越高。", "倒计时结束后展示分数评级。")
  },
  {
    title: "电光跑酷",
    description: "点击跳跃躲避障碍，速度会随分数提升，适合快速试玩和反复挑战。",
    prompt: "做一个点击跳跃躲避障碍的跑酷小游戏，速度越来越快",
    category: "runner",
    tags: ["跑酷", "反应", "挑战", visualSeedTag],
    controls: ["点击跳跃", "空格跳跃", "重新开始"],
    palette: { bg: "#071b17", ink: "#f2fff9", primary: "#57f29c", secondary: "#3ab7ff", accent: "#ff7a59" },
    motif: "runner",
    visibility: "public",
    opens: 512,
    remixClicks: 76,
    plan: plan("电光跑酷", "点击或空格跳跃，躲开不断刷新的障碍，存活越久速度越快。", "碰到障碍后结算最高分。")
  },
  {
    title: "赛博人格切片",
    description: "三题选择生成结果卡片，用强对比赛博视觉包装一个可分享的小测试。",
    prompt: "做一个赛博风人格测试，回答三道题后生成结果卡片",
    category: "quiz",
    tags: ["人格测试", "结果卡", "赛博", visualSeedTag],
    controls: ["点击选项", "再测一次"],
    palette: { bg: "#0e0615", ink: "#fff9ff", primary: "#f15cff", secondary: "#54f2dc", accent: "#ffe45e" },
    motif: "quiz",
    visibility: "public",
    opens: 477,
    remixClicks: 63,
    plan: plan("赛博人格切片", "回答三道风格问题，系统按选择生成一张人格结果卡。", "完成全部问题后展示结果。")
  },
  {
    title: "孤岛余温",
    description: "选择式荒岛生存，体力、体温和天数会随选择变化，最后进入不同结局。",
    prompt: "做一个荒岛生存选择小游戏，每次选择会改变体力和体温",
    category: "survival",
    tags: ["生存", "选择", "多结局", visualSeedTag],
    controls: ["点击选项推进", "重新开始"],
    palette: { bg: "#102016", ink: "#fbfff6", primary: "#77d66f", secondary: "#f5b84b", accent: "#60c7e8" },
    motif: "survival",
    visibility: "public",
    opens: 342,
    remixClicks: 28,
    plan: plan("孤岛余温", "在多轮事件中选择行动，维持体力和体温直到救援到来。", "资源耗尽失败，撑过全部事件成功。")
  },
  {
    title: "糖果气球派对",
    description: "点击彩色气球得分，气球会弹跳变色并给出即时反馈。",
    prompt: "做一个点击气球得分小游戏，气球会变色并给即时反馈",
    category: "toy",
    tags: ["气球", "点击", "反馈", visualSeedTag],
    controls: ["点击气球", "重新开始"],
    palette: { bg: "#141128", ink: "#fffafd", primary: "#ff6fae", secondary: "#72f0c5", accent: "#ffd36e" },
    motif: "balloons",
    visibility: "unlisted",
    opens: 135,
    remixClicks: 13,
    plan: plan("糖果气球派对", "点击不断浮动的气球，获得分数、连击和颜色反馈。", "达到目标分数后触发派对完成态。")
  },
  {
    title: "像素宝箱暴击",
    description: "连续点击宝箱积累连击，奖励文案和光效会越来越夸张。",
    prompt: "做一个像素风宝箱连点玩具，连击越高奖励越夸张",
    category: "toy",
    tags: ["像素", "连击", "宝箱", visualSeedTag],
    controls: ["点击宝箱", "重置"],
    palette: { bg: "#18120a", ink: "#fff8e8", primary: "#ffb13b", secondary: "#7be36f", accent: "#e86bff" },
    motif: "treasure",
    visibility: "private",
    opens: 0,
    remixClicks: 0,
    plan: plan("像素宝箱暴击", "不断点击宝箱提升连击，解锁更夸张的奖励反馈。", "连击达到 30 后进入暴击完成态。")
  },
  {
    title: "霓虹节拍舞台",
    description: "根据节拍点击按钮，舞台灯光会跟随命中质量切换。",
    prompt: "做一个音乐节奏点击玩具，根据节拍点亮舞台灯光",
    category: "rhythm",
    tags: ["节奏", "灯光", "舞台", visualSeedTag],
    controls: ["跟随节拍点击", "重新开始"],
    palette: { bg: "#080a18", ink: "#f7f8ff", primary: "#7f7cff", secondary: "#4de4ff", accent: "#ffdf5e" },
    motif: "rhythm",
    visibility: "private",
    opens: 0,
    remixClicks: 0,
    plan: plan("霓虹节拍舞台", "跟随节拍点击，命中越准舞台灯光越亮。", "完成 16 拍后展示命中评级。")
  }
];

async function main() {
  await ensureUser({
    id: demoUserId,
    name: "SparkPlay Studio",
    avatarColor: "#7f7cff"
  });

  const existingProjects = await listProjects(demoUserId);
  let created = 0;
  let upgraded = 0;
  let skipped = 0;

  for (const demo of demoPlayables) {
    const existing = findExistingProject(existingProjects, demo);
    const existingCurrent = existing
      ? (await getProjectVersions(existing.id)).find((version) => version.id === existing.currentVersionId)
      : undefined;
    const alreadyVisual = existingCurrent?.manifest.tags.includes(visualSeedTag);

    if (existing && existingCurrent && alreadyVisual) {
      await ensureVisibilityAndShare(existing, existingCurrent.id, demo);
      skipped += 1;
      continue;
    }

    const playable = buildDemoPlayable(demo);
    const validationReport = validateHtml(playable.html);
    const run = await createRun({
      projectId: existing?.id ?? "pending",
      mode: "direct",
      prompt: demo.prompt,
      status: "running"
    });
    const persisted = await persistGeneratedVersion({
      projectId: existing?.id,
      ownerId: demoUserId,
      title: demo.title,
      description: demo.description,
      html: playable.html,
      prompt: demo.prompt,
      manifest: playable.manifest,
      validationReport,
      runId: run.id,
      parentVersionIds: existingCurrent ? [existingCurrent.id] : [],
      sourceKind: "generate",
      moderationReasons: []
    });
    const thumbnailKey = await writeThumbnail(persisted.version.id, playable.thumbnail, "svg");
    await attachVersionQuality({
      projectId: persisted.project.id,
      versionId: persisted.version.id,
      thumbnailKey,
      smokeReport: {
        status: "skipped",
        issues: [],
        warnings: ["精品 demo seed 使用设计缩略图"],
        durationMs: 0,
        checkedAt: new Date().toISOString(),
        viewport: {
          width: 390,
          height: 844
        },
        consoleErrors: []
      }
    });
    await completeRun(run.id, {
      status: validationReport.valid ? "success" : "failed",
      htmlBytes: Buffer.byteLength(playable.html, "utf8"),
      validationFailures: validationReport.issues.length,
      repairCount: 0,
      outputTokens: 0
    });
    await ensureVisibilityAndShare(persisted.project, persisted.version.id, demo);
    if (existing) upgraded += 1;
    else created += 1;
  }

  console.log(`Demo seed complete. Created ${created}, upgraded ${upgraded}, skipped ${skipped}.`);
}

function findExistingProject(projects: Project[], demo: DemoPlayable): Project | undefined {
  return projects.find((project) => project.description === demo.prompt || project.description === demo.description || project.title === demo.title);
}

async function ensureVisibilityAndShare(project: Project, versionId: string, demo: DemoPlayable) {
  if (demo.visibility !== "private") {
    const share = await createShareLink(project.id, versionId);
    await seedShareStats(share.slug, demo.opens, demo.remixClicks);
  }
  await setProjectVisibility(project.id, demo.visibility);
}

async function seedShareStats(slug: string, opens: number, remixClicks: number) {
  const { getDb, writeDb } = await import("../src/lib/store");
  const db = await getDb();
  const share = db.shareLinks.find((item) => item.slug === slug);
  if (!share) return;
  share.opens = Math.max(share.opens, opens);
  share.playStarts = Math.max(share.playStarts, Math.round(opens * 0.74));
  share.playCompletes = Math.max(share.playCompletes, Math.round(opens * 0.42));
  share.remixClicks = Math.max(share.remixClicks, remixClicks);
  await writeDb(db);
}

function buildDemoPlayable(demo: DemoPlayable): { html: string; manifest: PlayableManifest; thumbnail: string } {
  const html = renderHtml(demo);
  return {
    html,
    thumbnail: renderThumbnail(demo),
    manifest: {
      title: demo.title,
      description: demo.description,
      category: demo.category,
      tags: demo.tags,
      controls: demo.controls,
      plan: demo.plan,
      assetRefs: [],
      sourcePrompt: demo.prompt,
      safetyStatus: "approved"
    }
  };
}

function plan(title: string, coreLoop: string, endCondition: string): PlayablePlan {
  return {
    title,
    coreLoop,
    goal: endCondition,
    controls: ["点击交互", "重新开始"],
    scoring: "通过分数、进度或状态条反馈当前表现。",
    states: ["ready", "playing", "completed"],
    endCondition,
    restartBehavior: "点击重新开始后清空状态并回到第一轮。",
    visualStyle: "移动端优先、强色彩、清晰层级、即时动效反馈。"
  };
}

function renderHtml(demo: DemoPlayable): string {
  const body = renderBody(demo);
  const script = renderScript(demo.motif);
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <title>${escapeHtml(demo.title)}</title>
  <style>${baseCss(demo)}</style>
</head>
<body>
  <main class="app ${demo.motif}">
    ${body}
  </main>
  <script>
(function(){
  var started=false;
  var completed=false;
  window.sparkplayStart=function(){if(started)return;started=true;window.parent&&window.parent.postMessage({type:"sparkplay:playStart"},"*")};
  window.sparkplayComplete=function(){if(completed)return;completed=true;window.parent&&window.parent.postMessage({type:"sparkplay:playComplete"},"*")};
  window.addEventListener("pointerdown",window.sparkplayStart,{once:true});
  window.addEventListener("keydown",window.sparkplayStart,{once:true});
})();
${script}
  </script>
</body>
</html>`;
}

function renderBody(demo: DemoPlayable): string {
  const title = escapeHtml(demo.title);
  const description = escapeHtml(demo.description);
  if (demo.motif === "cards") {
    return `<section class="hero"><p>Memory Deck</p><h1>${title}</h1><span>${description}</span></section>
<section class="stats"><div><strong id="moves">0</strong><span>步数</span></div><div><strong id="matched">0/8</strong><span>匹配</span></div></section>
<section class="board" id="board"></section>
<button class="reset" id="restart">重新洗牌</button>`;
  }
  if (demo.motif === "stars") {
    return `<section class="hero"><p>10s Challenge</p><h1>${title}</h1><span>${description}</span></section>
<section class="stats"><div><strong id="score">0</strong><span>分数</span></div><div><strong id="time">10.0</strong><span>秒</span></div><div><strong id="combo">x1</strong><span>连击</span></div></section>
<section class="playfield" id="field"><button class="target" id="star">STAR</button></section>
<button class="reset" id="restart">开始挑战</button>`;
  }
  if (demo.motif === "runner") {
    return `<section class="hero"><p>Speed Runner</p><h1>${title}</h1><span>${description}</span></section>
<section class="stats"><div><strong id="score">0</strong><span>分数</span></div><div><strong id="speed">1.0x</strong><span>速度</span></div></section>
<canvas class="runner-canvas" id="game" width="360" height="360"></canvas>
<button class="reset" id="restart">开始 / 重新开始</button>`;
  }
  if (demo.motif === "quiz") {
    return `<section class="hero"><p>Cyber Quiz</p><h1>${title}</h1><span>${description}</span></section>
<section class="question-card"><strong id="step">1/3</strong><h2 id="question"></h2><div class="choices" id="choices"></div></section>
<button class="reset subtle" id="restart">再测一次</button>`;
  }
  if (demo.motif === "survival") {
    return `<section class="hero"><p>Survival Story</p><h1>${title}</h1><span>${description}</span></section>
<section class="stats"><div><strong id="day">1</strong><span>天数</span></div><div><strong id="hp">100</strong><span>体力</span></div><div><strong id="warm">100</strong><span>体温</span></div></section>
<section class="question-card"><h2 id="story"></h2><div class="choices" id="choices"></div></section>
<button class="reset subtle" id="restart">重新开始</button>`;
  }
  if (demo.motif === "balloons") {
    return `<section class="hero"><p>Pop Party</p><h1>${title}</h1><span>${description}</span></section>
<section class="stats"><div><strong id="score">0</strong><span>分数</span></div><div><strong id="combo">0</strong><span>连击</span></div></section>
<section class="playfield balloons-field" id="field"></section>
<button class="reset" id="restart">重开派对</button>`;
  }
  if (demo.motif === "treasure") {
    return `<section class="hero"><p>Pixel Loot</p><h1>${title}</h1><span>${description}</span></section>
<section class="stats"><div><strong id="combo">0</strong><span>连击</span></div><div><strong id="tier">普通</strong><span>奖励</span></div></section>
<button class="treasure-box" id="chest" aria-label="点击宝箱"><span></span></button>
<section class="toast" id="toast">点击宝箱开启奖励</section>
<button class="reset subtle" id="restart">重置</button>`;
  }
  return `<section class="hero"><p>Beat Stage</p><h1>${title}</h1><span>${description}</span></section>
<section class="stats"><div><strong id="hit">0</strong><span>命中</span></div><div><strong id="beat">1/16</strong><span>节拍</span></div></section>
<section class="stage-lights" id="lights"><i></i><i></i><i></i><i></i><i></i></section>
<button class="beat-pad" id="pad">跟拍点击</button>
<button class="reset subtle" id="restart">重新开始</button>`;
}

function baseCss(demo: DemoPlayable): string {
  const { bg, ink, primary, secondary, accent } = demo.palette;
  return `
    :root{font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:${ink};background:${bg}}
    *{box-sizing:border-box}html,body{margin:0;min-height:100%;overflow:hidden;background:${bg};letter-spacing:0}
    body{display:grid;place-items:center;background:radial-gradient(circle at 20% 12%,${primary}44,transparent 28%),radial-gradient(circle at 92% 84%,${secondary}36,transparent 30%),linear-gradient(160deg,${bg},#030408)}
    button{font:inherit;border:0;color:${ink};cursor:pointer;-webkit-tap-highlight-color:transparent}
    .app{width:min(430px,100vw);height:min(844px,100vh);padding:18px;display:grid;grid-template-rows:auto auto 1fr auto;gap:14px;position:relative;overflow:hidden;background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.03));box-shadow:inset 0 0 0 1px rgba(255,255,255,.14)}
    .app:before{content:"";position:absolute;inset:-20%;background:linear-gradient(120deg,transparent,rgba(255,255,255,.08),transparent);transform:rotate(12deg);pointer-events:none}
    .hero,.stats,.question-card,.toast{position:relative;border:1px solid rgba(255,255,255,.16);border-radius:18px;background:rgba(255,255,255,.08);backdrop-filter:blur(14px);box-shadow:0 20px 70px rgba(0,0,0,.28)}
    .hero{padding:18px 18px 16px}.hero p{margin:0 0 8px;color:${accent};font-size:12px;font-weight:900;text-transform:uppercase}.hero h1{margin:0;font-size:30px;line-height:1.02}.hero span{display:block;margin-top:10px;color:rgba(255,255,255,.72);font-size:13px;line-height:1.5}
    .stats{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;padding:10px;gap:8px}.stats div{border-radius:14px;background:rgba(0,0,0,.24);padding:10px;text-align:center}.stats strong{display:block;font-size:24px}.stats span{font-size:12px;color:rgba(255,255,255,.64)}
    .reset,.choices button{min-height:48px;border-radius:16px;background:linear-gradient(135deg,${primary},${secondary});font-weight:900;box-shadow:0 14px 34px ${primary}33}.reset.subtle{background:rgba(255,255,255,.12);box-shadow:none}
    .board{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.card{border-radius:16px;display:grid;place-items:center;min-height:72px;background:linear-gradient(145deg,rgba(255,255,255,.16),rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px rgba(255,255,255,.14),0 10px 24px rgba(0,0,0,.22);font-size:24px;font-weight:900}.card.open{background:linear-gradient(145deg,${accent},${primary});color:#071018;transform:translateY(-2px)}
    .playfield{position:relative;min-height:330px;border-radius:22px;overflow:hidden;background:linear-gradient(180deg,rgba(255,255,255,.1),rgba(0,0,0,.18));border:1px solid rgba(255,255,255,.14)}.target{position:absolute;width:74px;height:74px;border-radius:999px;background:${accent};color:#111;font-weight:1000;box-shadow:0 0 0 12px ${accent}22,0 20px 48px ${accent}55}
    .runner-canvas{width:100%;height:100%;min-height:330px;border-radius:22px;background:linear-gradient(180deg,${secondary}22,rgba(0,0,0,.2));border:1px solid rgba(255,255,255,.16)}
    .question-card{padding:18px;display:grid;align-content:start;gap:16px}.question-card strong{color:${accent};font-size:13px}.question-card h2{margin:0;font-size:24px;line-height:1.25}.choices{display:grid;gap:10px}.choices button{width:100%;text-align:left;padding:0 16px;justify-content:flex-start}
    .balloon{position:absolute;width:74px;height:92px;border-radius:44px 44px 38px 38px;background:var(--balloon);box-shadow:inset -12px -16px 20px rgba(0,0,0,.18),0 18px 38px rgba(0,0,0,.25);font-weight:900}.balloon:after{content:"";position:absolute;left:32px;bottom:-12px;border:8px solid transparent;border-top-color:var(--balloon)}
    .treasure-box{place-self:center;width:210px;height:172px;border-radius:18px;background:linear-gradient(#ffcd66 0 42%,#b76824 42%);box-shadow:0 0 0 8px rgba(255,255,255,.08),0 28px 80px rgba(0,0,0,.34);position:relative}.treasure-box span{position:absolute;inset:42% 0 auto;height:16px;background:#432715}.treasure-box:after{content:"";position:absolute;left:88px;top:48px;width:34px;height:50px;border-radius:8px;background:${accent}}
    .toast{padding:16px;text-align:center;font-weight:900;color:${accent}}.stage-lights{display:flex;align-items:end;gap:10px;padding:20px;height:240px}.stage-lights i{flex:1;border-radius:18px 18px 8px 8px;background:linear-gradient(180deg,var(--light),transparent);height:60%;box-shadow:0 0 38px var(--light)}.stage-lights i:nth-child(1){--light:${primary}}.stage-lights i:nth-child(2){--light:${secondary};height:82%}.stage-lights i:nth-child(3){--light:${accent};height:68%}.stage-lights i:nth-child(4){--light:${primary};height:90%}.stage-lights i:nth-child(5){--light:${secondary};height:56%}.beat-pad{min-height:100px;border-radius:28px;background:radial-gradient(circle,${accent},${primary});color:#081018;font-size:24px;font-weight:1000;box-shadow:0 0 0 12px ${primary}20,0 28px 70px ${primary}3d}
  `;
}

function renderScript(motif: DemoPlayable["motif"]): string {
  if (motif === "cards") {
    return `var icons=["N","E","O","N","S","T","A","R"];var cards=[];var open=[];var matched=0;var moves=0;var board=document.getElementById("board");
function shuffle(a){return a.map(function(v){return [Math.random(),v]}).sort(function(a,b){return a[0]-b[0]}).map(function(v){return v[1]})}
function restart(){cards=shuffle(icons.concat(icons)).map(function(v,i){return {id:i,v:v,open:false,done:false}});open=[];matched=0;moves=0;render()}
function tap(i){var c=cards[i];if(c.open||c.done||open.length===2)return;c.open=true;open.push(c);if(open.length===2){moves+=1;setTimeout(function(){if(open[0].v===open[1].v&&open[0].id!==open[1].id){open[0].done=true;open[1].done=true;matched+=1}else{open[0].open=false;open[1].open=false}open=[];render()},420)}render()}
function render(){document.getElementById("moves").textContent=moves;document.getElementById("matched").textContent=matched+"/8";board.innerHTML="";cards.forEach(function(c,i){var b=document.createElement("button");b.className="card"+(c.open||c.done?" open":"");b.textContent=c.open||c.done?c.v:"SP";b.onclick=function(){tap(i)};board.appendChild(b)});if(matched===8){window.sparkplayComplete()}}document.getElementById("restart").onclick=restart;restart();`;
  }
  if (motif === "stars") {
    return `var score=0;var combo=1;var time=10;var timer=0;var running=false;var field=document.getElementById("field");var star=document.getElementById("star");
function move(){star.style.left=Math.floor(Math.random()*250)+"px";star.style.top=Math.floor(Math.random()*235)+"px"}
function start(){score=0;combo=1;time=10;running=true;move();clearInterval(timer);timer=setInterval(function(){time-=0.1;if(time<=0){time=0;running=false;clearInterval(timer);star.textContent=score>220?"S":"A";window.sparkplayComplete()}draw()},100);draw()}
function draw(){document.getElementById("score").textContent=score;document.getElementById("combo").textContent="x"+combo;document.getElementById("time").textContent=time.toFixed(1)}
star.onclick=function(){if(!running)start();score+=10*combo;combo=Math.min(9,combo+1);star.animate([{transform:"scale(1)"},{transform:"scale(1.22)"},{transform:"scale(1)"}],{duration:180});move();draw()};document.getElementById("restart").onclick=start;move();draw();`;
  }
  if (motif === "runner") {
    return `var canvas=document.getElementById("game");var g=canvas.getContext("2d");var y=258,vy=0,obs=[],score=0,speed=1,running=false,last=0;
function reset(){y=258;vy=0;obs=[];score=0;speed=1;running=true;last=performance.now();requestAnimationFrame(loop)}
function jump(){if(!running){reset();return}if(y>=258){vy=-14}}
function loop(t){if(!running)return;var dt=Math.min(32,t-last);last=t;score+=dt/90;speed=1+score/480;if(Math.random()<0.02*speed)obs.push({x:380,w:24+Math.random()*28,h:34+Math.random()*54});vy+=0.72;y=Math.min(258,y+vy);obs.forEach(function(o){o.x-=4.4*speed});obs=obs.filter(function(o){return o.x>-70});var hit=obs.some(function(o){return o.x<80&&o.x+o.w>40&&290-o.h<y+32});draw();if(hit){running=false;window.sparkplayComplete();g.fillStyle="#f7fff9";g.font="800 26px sans-serif";g.fillText("得分 "+Math.floor(score),112,176);return}requestAnimationFrame(loop)}
function draw(){g.clearRect(0,0,360,360);g.fillStyle="rgba(255,255,255,.08)";for(var i=0;i<8;i++){g.fillRect(i*52-(score%52),300,28,4)}g.fillStyle="#57f29c";g.fillRect(42,y,34,34);g.fillStyle="#ff7a59";obs.forEach(function(o){g.fillRect(o.x,290-o.h,o.w,o.h)});document.getElementById("score").textContent=Math.floor(score);document.getElementById("speed").textContent=speed.toFixed(1)+"x"}
canvas.onclick=jump;document.addEventListener("keydown",function(e){if(e.code==="Space")jump()});document.getElementById("restart").onclick=reset;draw();`;
  }
  if (motif === "quiz") {
    return `var questions=[["你的灵感通常出现在哪里？",["深夜屏幕前","朋友聊天里","路上的随机画面"]],["你更想 Remix 什么？",["玩法机制","视觉风格","结局文案"]],["发出去前最在意？",["能不能玩爽","有没有记忆点","别人会不会二创"]]];var idx=0;var score=0;
function render(){var q=document.getElementById("question");var c=document.getElementById("choices");document.getElementById("step").textContent=(idx+1)+"/3";c.innerHTML="";if(idx>=questions.length){var result=score>5?"赛博策展人":score>3?"玩法炼金师":"灵感点火者";q.textContent="你的结果："+result;c.innerHTML="<button onclick='restart()'>生成新切片</button>";window.sparkplayComplete();return}q.textContent=questions[idx][0];questions[idx][1].forEach(function(label,i){var b=document.createElement("button");b.textContent=label;b.onclick=function(){score+=i+1;idx+=1;render()};c.appendChild(b)})}
function restart(){idx=0;score=0;render()}document.getElementById("restart").onclick=restart;render();`;
  }
  if (motif === "survival") {
    return `var events=[["潮水上涨，补给箱卡在礁石边。",["冒险去拿","先搭避风处","观察潮汐"]],["夜里降温，远处有微弱灯光。",["点火回应","保存体力","沿海岸靠近"]],["第三天清晨，电台只剩一点电。",["发送坐标","继续搜索水源","制作醒目标记"]]];var day=1,hp=100,warm=100;
function choose(i){hp-=8+i*9;warm-=i===1?5:13;day+=1;render()}
function render(){document.getElementById("day").textContent=day;document.getElementById("hp").textContent=hp;document.getElementById("warm").textContent=warm;var story=document.getElementById("story");var choices=document.getElementById("choices");choices.innerHTML="";if(hp<=0||warm<=0){story.textContent="资源耗尽，你被迫等待救援。";choices.innerHTML="<button onclick='restart()'>再试一次</button>";window.sparkplayComplete();return}if(day>events.length){story.textContent="救援船看到了你的标记。结局："+(hp+warm>150?"稳定生还":"极限生还");choices.innerHTML="<button onclick='restart()'>开启新路线</button>";window.sparkplayComplete();return}story.textContent=events[day-1][0];events[day-1][1].forEach(function(label,i){var b=document.createElement("button");b.textContent=label;b.onclick=function(){choose(i)};choices.appendChild(b)})}
function restart(){day=1;hp=100;warm=100;render()}document.getElementById("restart").onclick=restart;render();`;
  }
  if (motif === "balloons") {
    return `var score=0,combo=0;var field=document.getElementById("field");var colors=["#ff6fae","#72f0c5","#ffd36e","#8f8cff","#6ee7ff"];
function spawn(){field.innerHTML="";for(var i=0;i<8;i++){var b=document.createElement("button");b.className="balloon";b.style.setProperty("--balloon",colors[i%colors.length]);b.style.left=Math.floor(Math.random()*270)+"px";b.style.top=Math.floor(Math.random()*220)+"px";b.textContent="+10";b.onclick=function(){score+=10+combo;combo+=1;draw();spawn();if(score>=220)window.sparkplayComplete()};field.appendChild(b)}}
function draw(){document.getElementById("score").textContent=score;document.getElementById("combo").textContent=combo}
function restart(){score=0;combo=0;draw();spawn()}document.getElementById("restart").onclick=restart;restart();`;
  }
  if (motif === "treasure") {
    return `var combo=0;var tiers=["普通","稀有","史诗","传说","暴击"];function draw(){var tier=tiers[Math.min(tiers.length-1,Math.floor(combo/7))];document.getElementById("combo").textContent=combo;document.getElementById("tier").textContent=tier;document.getElementById("toast").textContent=combo>=30?"暴击宝箱已开启":"获得 "+tier+" 奖励 x"+Math.max(1,combo);if(combo>=30)window.sparkplayComplete()}
document.getElementById("chest").onclick=function(){combo+=1;this.animate([{transform:"translateY(0)"},{transform:"translateY(-8px)"},{transform:"translateY(0)"}],{duration:160});draw()};function restart(){combo=0;draw()}document.getElementById("restart").onclick=restart;draw();`;
  }
  return `var beat=1,hit=0;var pad=document.getElementById("pad");function draw(){document.getElementById("hit").textContent=hit;document.getElementById("beat").textContent=beat+"/16";document.querySelectorAll(".stage-lights i").forEach(function(light,i){light.style.opacity=(i+beat)%3===0?1:.35})}
pad.onclick=function(){hit+=1;beat+=1;pad.animate([{transform:"scale(1)"},{transform:"scale(.94)"},{transform:"scale(1)"}],{duration:150});if(beat>16){pad.textContent=hit>12?"完美舞台":"完成演出";window.sparkplayComplete()}draw()};function restart(){beat=1;hit=0;pad.textContent="跟拍点击";draw()}document.getElementById("restart").onclick=restart;draw();`;
}

function renderThumbnail(demo: DemoPlayable): string {
  const { bg, ink, primary, secondary, accent } = demo.palette;
  const title = escapeHtml(demo.title);
  const category = escapeHtml(demo.category);
  const description = escapeHtml(demo.description);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="780" height="1200" viewBox="0 0 780 1200">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${primary}"/>
      <stop offset=".52" stop-color="${secondary}"/>
      <stop offset="1" stop-color="${accent}"/>
    </linearGradient>
    <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="28" stdDeviation="26" flood-color="#000" flood-opacity=".35"/>
    </filter>
  </defs>
  <rect width="780" height="1200" fill="${bg}"/>
  <circle cx="118" cy="156" r="180" fill="${primary}" opacity=".22"/>
  <circle cx="690" cy="1020" r="230" fill="${secondary}" opacity=".2"/>
  <rect x="86" y="88" width="608" height="1024" rx="54" fill="rgba(255,255,255,.09)" stroke="rgba(255,255,255,.22)" filter="url(#shadow)"/>
  <rect x="124" y="138" width="532" height="924" rx="36" fill="rgba(0,0,0,.18)" stroke="rgba(255,255,255,.18)"/>
  ${thumbnailMotif(demo)}
  <text x="152" y="786" font-family="Arial, sans-serif" font-size="28" font-weight="900" fill="${accent}">${category}</text>
  <text x="152" y="848" font-family="Arial, sans-serif" font-size="58" font-weight="900" fill="${ink}">${title}</text>
  <foreignObject x="152" y="890" width="476" height="120">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,sans-serif;font-size:28px;line-height:1.35;color:${ink};opacity:.76">${description}</div>
  </foreignObject>
  <rect x="152" y="1010" width="210" height="58" rx="29" fill="url(#g)"/>
  <text x="188" y="1049" font-family="Arial, sans-serif" font-size="24" font-weight="900" fill="#071018">SparkPlay</text>
</svg>`;
}

function thumbnailMotif(demo: DemoPlayable): string {
  const { primary, secondary, accent } = demo.palette;
  if (demo.motif === "cards") {
    return Array.from({ length: 8 }, (_, index) => {
      const x = 164 + (index % 4) * 112;
      const y = 270 + Math.floor(index / 4) * 136;
      return `<rect x="${x}" y="${y}" width="86" height="112" rx="18" fill="${index % 2 ? primary : secondary}" opacity=".9"/><text x="${x + 28}" y="${y + 70}" font-family="Arial" font-size="34" font-weight="900" fill="#071018">SP</text>`;
    }).join("");
  }
  if (demo.motif === "runner") {
    return `<path d="M142 560 C260 470 330 650 458 530 C528 466 586 488 642 536" fill="none" stroke="${primary}" stroke-width="24" stroke-linecap="round"/><rect x="238" y="500" width="72" height="72" rx="18" fill="${secondary}"/><rect x="500" y="488" width="56" height="116" rx="12" fill="${accent}"/>`;
  }
  if (demo.motif === "quiz") {
    return `<rect x="154" y="300" width="472" height="280" rx="32" fill="${primary}" opacity=".86"/><rect x="196" y="374" width="268" height="28" rx="14" fill="#fff" opacity=".72"/><rect x="196" y="442" width="346" height="34" rx="17" fill="${accent}"/><rect x="196" y="502" width="292" height="34" rx="17" fill="${secondary}"/>`;
  }
  if (demo.motif === "survival") {
    return `<path d="M150 610 L322 320 L458 610 Z" fill="${primary}" opacity=".86"/><path d="M304 610 L504 250 L644 610 Z" fill="${secondary}" opacity=".78"/><circle cx="560" cy="286" r="62" fill="${accent}"/>`;
  }
  if (demo.motif === "balloons") {
    return Array.from({ length: 9 }, (_, index) => {
      const x = 160 + (index % 3) * 148;
      const y = 250 + Math.floor(index / 3) * 120;
      const color = [primary, secondary, accent][index % 3];
      return `<ellipse cx="${x}" cy="${y}" rx="44" ry="58" fill="${color}" opacity=".92"/><path d="M${x} ${y + 58} C${x - 18} ${y + 88} ${x + 22} ${y + 102} ${x} ${y + 132}" fill="none" stroke="${color}" stroke-width="5" opacity=".72"/>`;
    }).join("");
  }
  if (demo.motif === "treasure") {
    return `<rect x="210" y="388" width="360" height="210" rx="28" fill="${primary}"/><rect x="210" y="476" width="360" height="122" rx="20" fill="${secondary}"/><rect x="352" y="448" width="76" height="92" rx="14" fill="${accent}"/><path d="M260 346 C300 250 480 250 520 346" fill="none" stroke="${primary}" stroke-width="38" stroke-linecap="round"/>`;
  }
  if (demo.motif === "rhythm") {
    return `<rect x="176" y="528" width="68" height="150" rx="26" fill="${primary}"/><rect x="278" y="408" width="68" height="270" rx="26" fill="${secondary}"/><rect x="380" y="474" width="68" height="204" rx="26" fill="${accent}"/><rect x="482" y="338" width="68" height="340" rx="26" fill="${primary}"/><circle cx="390" cy="302" r="78" fill="${accent}" opacity=".82"/>`;
  }
  return `<circle cx="390" cy="440" r="176" fill="${accent}" opacity=".84"/><path d="M352 358 L352 522 L492 440 Z" fill="#071018"/>`;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
