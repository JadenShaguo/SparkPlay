import type { AssetRef, GenerationMode, PlayableManifest, PlayablePlan } from "@/types/domain";
import { escapeHtml, validateHtml } from "@/lib/validation";

interface GeneratePlayableInput {
  prompt: string;
  mode: GenerationMode | "remix";
  assets?: AssetRef[];
  baseHtml?: string;
  remixOf?: {
    projectId: string;
    versionId: string;
  };
}

export interface GeneratedPlayable {
  html: string;
  manifest: PlayableManifest;
  repaired: boolean;
}

export function generatePlayable(input: GeneratePlayableInput): GeneratedPlayable {
  const category = classifyPrompt(input.prompt);
  const title = titleFromPrompt(input.prompt, category);
  const asset = input.assets?.find((item) => item.kind === "image");
  const context = {
    title,
    prompt: input.prompt,
    safePrompt: escapeHtml(input.prompt),
    assetDataUrl: asset?.dataUrl,
    assetName: asset?.name
  };

  const html =
    category === "quiz"
      ? quizHtml(context)
      : category === "memory"
        ? memoryHtml(context)
        : category === "runner"
          ? runnerHtml(context)
          : category === "survival"
            ? survivalHtml(context)
            : toyHtml(context);

  const validation = validateHtml(html);
  const repairedHtml = validation.valid ? html : repairHtml(html, context.title);
  const repaired = !validation.valid;

  return {
    html: repairedHtml,
    manifest: {
      title,
      description: summarizePrompt(input.prompt),
      category,
      tags: tagsForCategory(category),
      controls: controlsForCategory(category),
      plan: planForCategory(category, title),
      assetRefs: input.assets ?? [],
      sourcePrompt: input.prompt,
      remixOf: input.remixOf,
      safetyStatus: "approved"
    },
    repaired
  };
}

function classifyPrompt(prompt: string): string {
  const text = prompt.toLowerCase();
  if (/测试|人格|quiz|问答|题/.test(text)) return "quiz";
  if (/翻牌|记忆|memory|match/.test(text)) return "memory";
  if (/跑酷|躲避|runner|jump|障碍/.test(text)) return "runner";
  if (/生存|选择|剧情|多结局|survival|冒险/.test(text)) return "survival";
  return "toy";
}

function titleFromPrompt(prompt: string, category: string): string {
  const cleaned = prompt.replace(/[。.!！?？\n]/g, " ").trim();
  if (cleaned.length > 0) return cleaned.slice(0, 18);
  const fallback: Record<string, string> = {
    quiz: "趣味人格测试",
    memory: "记忆翻牌",
    runner: "极速跑酷",
    survival: "生存模拟器",
    toy: "互动玩具"
  };
  return fallback[category] ?? "Playable";
}

function summarizePrompt(prompt: string): string {
  return prompt.length > 80 ? `${prompt.slice(0, 80)}...` : prompt;
}

function tagsForCategory(category: string): string[] {
  const tags: Record<string, string[]> = {
    quiz: ["测验", "结果页", "分享"],
    memory: ["翻牌", "计时", "轻量"],
    runner: ["跑酷", "反应", "挑战"],
    survival: ["选择", "剧情", "多结局"],
    toy: ["互动", "触摸", "玩具"]
  };
  return tags[category] ?? ["playable"];
}

function controlsForCategory(category: string): string[] {
  if (category === "runner") return ["点击或空格跳跃", "重新开始"];
  if (category === "memory") return ["点击翻牌", "重新开始"];
  if (category === "survival") return ["点击选项推进", "查看结局"];
  return ["点击交互", "重新开始"];
}

function planForCategory(category: string, title: string): PlayablePlan {
  const common = {
    title,
    visualStyle: "移动端优先、卡片式信息层级、清晰按钮反馈"
  };
  if (category === "runner") {
    return {
      ...common,
      coreLoop: "点击或按空格跳跃，躲避不断出现的障碍，持续刷新分数。",
      goal: "尽可能长时间躲避障碍并获得更高分。",
      controls: ["点击或空格跳跃", "重新开始"],
      scoring: "存活时间转化为分数，速度随分数提升。",
      states: ["ready", "running", "gameOver"],
      endCondition: "角色碰到障碍后结束并显示得分。",
      restartBehavior: "点击开始 / 重新开始按钮重置角色、障碍、分数和速度。"
    };
  }
  if (category === "memory") {
    return {
      ...common,
      coreLoop: "点击翻开卡牌，记住图案并寻找成对匹配。",
      goal: "用尽可能少的步数完成全部配对。",
      controls: ["点击翻牌", "重新开始"],
      scoring: "记录翻牌步数和已匹配进度。",
      states: ["ready", "flipping", "matched", "completed"],
      endCondition: "所有卡牌匹配完成后结束。",
      restartBehavior: "点击重新开始会重新洗牌并清空步数。"
    };
  }
  if (category === "quiz") {
    return {
      ...common,
      coreLoop: "逐题点击选项，根据选择累积分数并推进结果。",
      goal: "完成全部题目并获得个性化结果。",
      controls: ["点击选项", "再测一次"],
      scoring: "不同选项累积分数，最终映射到结果标签。",
      states: ["questioning", "scoring", "completed"],
      endCondition: "所有问题回答完后展示测试结果。",
      restartBehavior: "点击再测一次会回到第一题并清空分数。"
    };
  }
  if (category === "survival") {
    return {
      ...common,
      coreLoop: "阅读剧情事件，点击选项改变体力和体温状态。",
      goal: "在多轮选择后抵达安全点或触发结局。",
      controls: ["点击选项推进", "重新开始"],
      scoring: "体力、体温和天数共同表示生存状态。",
      states: ["story", "choice", "survived", "failed"],
      endCondition: "体力/体温耗尽或完成全部事件后结束。",
      restartBehavior: "点击重新开始会重置天数、体力和体温。"
    };
  }
  return {
    ...common,
    coreLoop: "点击主按钮触发视觉变化、连击计数和状态升级。",
    goal: "持续点击达到爆发状态并完成互动挑战。",
    controls: ["点击交互", "重置"],
    scoring: "连击次数和状态文案反馈玩家进度。",
    states: ["idle", "warming", "burst", "completed"],
    endCondition: "连击达到目标后触发完成事件。",
    restartBehavior: "点击重置会清空连击并恢复初始状态。"
  };
}

function shell(title: string, body: string, script: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root{font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17201a;background:#f6f4ee}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:linear-gradient(180deg,#f8f7f2 0%,#e9f1ed 100%);overflow:hidden}
    .phone{width:min(420px,100vw);height:min(760px,100vh);background:#fcfbf6;border:1px solid rgba(23,32,26,.14);box-shadow:0 24px 80px rgba(40,54,45,.22);display:flex;flex-direction:column;position:relative;overflow:hidden}
    header{padding:22px 22px 12px;border-bottom:1px solid rgba(23,32,26,.1);background:#fcfbf6}
    h1{margin:0;font-size:24px;line-height:1.15;letter-spacing:0;color:#17201a}.sub{margin:8px 0 0;color:#607064;font-size:13px;line-height:1.4}
    main{flex:1;padding:18px;display:flex;flex-direction:column;gap:14px;overflow:auto}.panel{border:1px solid rgba(23,32,26,.12);background:#fff;border-radius:8px;padding:14px}
    button{appearance:none;border:0;border-radius:8px;background:#1f6b4a;color:white;font-weight:700;padding:12px 14px;min-height:44px;cursor:pointer;box-shadow:0 8px 20px rgba(31,107,74,.2)}
    button.secondary{background:#f0b44c;color:#2f2410}button.ghost{background:#eef2ef;color:#26352c;box-shadow:none}
    .row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.stat{flex:1;min-width:92px;background:#eef2ef;border-radius:8px;padding:10px;text-align:center}.stat strong{display:block;font-size:22px}.muted{color:#607064}.result{font-size:18px;line-height:1.45}.asset{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;border:1px solid rgba(23,32,26,.12)}
  </style>
</head>
<body>
  <div class="phone">
    ${body}
  </div>
  <script>
(function(){
  let started=false,completed=false;
  window.sparkplayPlayStart=function(){if(started)return;started=true;window.parent?.postMessage({type:"sparkplay:playStart"},"*")};
  window.sparkplayPlayComplete=function(){if(completed)return;completed=true;window.parent?.postMessage({type:"sparkplay:playComplete"},"*")};
  window.addEventListener("pointerdown",window.sparkplayPlayStart,{once:true});
  window.addEventListener("keydown",window.sparkplayPlayStart,{once:true});
  window.addEventListener("touchstart",window.sparkplayPlayStart,{once:true});
})();
${script}
  </script>
</body>
</html>`;
}

function assetMarkup(ctx: { assetDataUrl?: string; assetName?: string }): string {
  if (!ctx.assetDataUrl) return "";
  return `<img class="asset" src="${ctx.assetDataUrl}" alt="${escapeHtml(ctx.assetName ?? "uploaded asset")}" />`;
}

function quizHtml(ctx: { title: string; safePrompt: string; assetDataUrl?: string; assetName?: string }): string {
  return shell(
    ctx.title,
    `<header><h1>${escapeHtml(ctx.title)}</h1><p class="sub">${ctx.safePrompt}</p></header><main>${assetMarkup(ctx)}<section class="panel"><p id="question" class="result"></p><div id="choices" class="row"></div></section><section class="panel"><div class="row"><div class="stat"><strong id="step">1/5</strong><span>进度</span></div><div class="stat"><strong id="score">0</strong><span>分数</span></div></div></section><button id="restart" class="ghost">重新开始</button></main>`,
    `const questions=[["周末你更想做什么？",["立刻出门","研究新东西","约朋友整活","安静充电"]],["看到新热点你会？",["马上复刻","先观察","做成梗图","发给朋友"]],["朋友求助时你是？",["行动派","分析派","气氛组","陪伴型"]],["游戏里你最在意？",["爽感","策略","笑点","画面"]],["你的分享风格？",["炫耀战绩","认真安利","整活逗笑","只发精选"]]];
let index=0,score=0;const q=document.getElementById("question"),choices=document.getElementById("choices"),step=document.getElementById("step"),scoreEl=document.getElementById("score");
function render(){if(index>=questions.length){window.sparkplayPlayComplete?.();const labels=["灵感引爆器","冷静策划师","群聊发动机","审美收藏家"];q.textContent="你的结果："+labels[score%labels.length]+"。适合把日常灵感 Remix 成能玩的小游戏。";choices.innerHTML="<button onclick='restart()'>再测一次</button>";step.textContent="完成";return}q.textContent=questions[index][0];step.textContent=(index+1)+"/"+questions.length;scoreEl.textContent=score;choices.innerHTML="";questions[index][1].forEach((c,i)=>{const b=document.createElement("button");b.textContent=c;b.onclick=()=>{score+=i+1;index++;navigator.vibrate?.(18);render()};choices.appendChild(b)})}
function restart(){index=0;score=0;render()}document.getElementById("restart").onclick=restart;render();`
  );
}

function memoryHtml(ctx: { title: string; safePrompt: string; assetDataUrl?: string; assetName?: string }): string {
  return shell(
    ctx.title,
    `<header><h1>${escapeHtml(ctx.title)}</h1><p class="sub">${ctx.safePrompt}</p></header><main>${assetMarkup(ctx)}<section class="panel"><div class="row"><div class="stat"><strong id="moves">0</strong><span>步数</span></div><div class="stat"><strong id="matched">0/8</strong><span>匹配</span></div></div></section><section id="board" class="panel" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px"></section><button id="restart" class="ghost">重新开始</button></main>`,
    `const icons=["星","月","火","水","木","金","土","云"];let cards=[],open=[],matched=0,moves=0;const board=document.getElementById("board");
function shuffle(a){return a.map(v=>[Math.random(),v]).sort((x,y)=>x[0]-y[0]).map(x=>x[1])}
function restart(){cards=shuffle([...icons,...icons]).map((v,i)=>({id:i,v,done:false,open:false}));open=[];matched=0;moves=0;render()}
function tap(i){const c=cards[i];if(c.done||c.open||open.length===2)return;c.open=true;open.push(c);if(open.length===2){moves++;setTimeout(()=>{if(open[0].v===open[1].v){open[0].done=open[1].done=true;matched++;navigator.vibrate?.(25)}else{open[0].open=open[1].open=false}open=[];render()},450)}render()}
function render(){document.getElementById("moves").textContent=moves;document.getElementById("matched").textContent=matched+"/8";board.innerHTML="";cards.forEach((c,i)=>{const b=document.createElement("button");b.style.cssText="aspect-ratio:1/1;font-size:24px;background:"+(c.open||c.done?"#f0b44c":"#1f6b4a");b.textContent=c.open||c.done?c.v:"?";b.onclick=()=>tap(i);board.appendChild(b)});if(matched===8){window.sparkplayPlayComplete?.();setTimeout(()=>alert("全部匹配成功，用了 "+moves+" 步"),80)}}document.getElementById("restart").onclick=restart;restart();`
  );
}

function runnerHtml(ctx: { title: string; safePrompt: string; assetDataUrl?: string; assetName?: string }): string {
  return shell(
    ctx.title,
    `<header><h1>${escapeHtml(ctx.title)}</h1><p class="sub">${ctx.safePrompt}</p></header><main>${assetMarkup(ctx)}<section class="panel"><div class="row"><div class="stat"><strong id="score">0</strong><span>分数</span></div><div class="stat"><strong id="speed">1x</strong><span>速度</span></div></div></section><canvas id="game" width="360" height="280" class="panel" style="padding:0;width:100%;touch-action:manipulation"></canvas><button id="restart">开始 / 重新开始</button></main>`,
    `const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");let y=220,vy=0,obs=[],score=0,running=false,last=0,speed=1;
function reset(){y=220;vy=0;obs=[];score=0;speed=1;running=true;last=performance.now();requestAnimationFrame(loop)}
function jump(){if(!running)reset();if(y>=220){vy=-13;navigator.vibrate?.(12)}}function loop(t){if(!running)return;const dt=Math.min(32,t-last);last=t;score+=dt/100;speed=1+score/600;if(Math.random()<0.018*speed)obs.push({x:380,w:24+Math.random()*22,h:28+Math.random()*45});vy+=0.65;y=Math.min(220,y+vy);obs.forEach(o=>o.x-=4.2*speed);obs=obs.filter(o=>o.x>-60);const hit=obs.some(o=>o.x<76&&o.x+o.w>42&&220-o.h<y+28&&220>y);draw();if(hit){running=false;window.sparkplayPlayComplete?.();ctx.fillStyle="#17201a";ctx.font="700 24px sans-serif";ctx.fillText("得分 "+Math.floor(score),120,130);return}requestAnimationFrame(loop)}
function draw(){ctx.clearRect(0,0,360,280);ctx.fillStyle="#dfe9e3";ctx.fillRect(0,248,360,32);ctx.fillStyle="#1f6b4a";ctx.fillRect(42,y,34,34);ctx.fillStyle="#f0b44c";obs.forEach(o=>ctx.fillRect(o.x,248-o.h,o.w,o.h));document.getElementById("score").textContent=Math.floor(score);document.getElementById("speed").textContent=speed.toFixed(1)+"x"}
canvas.addEventListener("pointerdown",jump);document.addEventListener("keydown",e=>{if(e.code==="Space")jump()});document.getElementById("restart").onclick=reset;draw();`
  );
}

function survivalHtml(ctx: { title: string; safePrompt: string; assetDataUrl?: string; assetName?: string }): string {
  return shell(
    ctx.title,
    `<header><h1>${escapeHtml(ctx.title)}</h1><p class="sub">${ctx.safePrompt}</p></header><main>${assetMarkup(ctx)}<section class="panel"><div class="row"><div class="stat"><strong id="day">1</strong><span>天数</span></div><div class="stat"><strong id="hp">100</strong><span>体力</span></div><div class="stat"><strong id="warm">100</strong><span>体温</span></div></div></section><section class="panel"><p id="story" class="result"></p><div id="choices" class="row"></div></section><button id="restart" class="ghost">重新开始</button></main>`,
    `let day=1,hp=100,warm=100;const events=[["清晨起雾，路线不清。",["原地等雾散","沿溪谷前进","爬上高点观察"]],["风雪加大，队友开始动摇。",["扎营休整","继续赶路","分配热饮"]],["补给不足，但远处有废弃木屋。",["搜索木屋","节省食物","发出求救信号"]],["夜里气温骤降。",["点火取暖","抱团休息","连夜下撤"]]];
function apply(i){hp-=8+i*7;warm-=i===0?4:12;day++;navigator.vibrate?.(20);render()}
function render(){document.getElementById("day").textContent=day;document.getElementById("hp").textContent=hp;document.getElementById("warm").textContent=warm;const story=document.getElementById("story"),choices=document.getElementById("choices");choices.innerHTML="";if(hp<=0||warm<=0){window.sparkplayPlayComplete?.();story.textContent="你没能撑过这次穿越。结局：等待救援。";choices.innerHTML="<button onclick='restart()'>重新挑战</button>";return}if(day>events.length){window.sparkplayPlayComplete?.();story.textContent="你成功抵达安全点。评级："+(hp+warm>140?"稳健领队":"极限幸存者");choices.innerHTML="<button onclick='restart()'>再来一次</button>";return}const e=events[day-1];story.textContent=e[0];e[1].forEach((c,i)=>{const b=document.createElement("button");b.textContent=c;b.onclick=()=>apply(i);choices.appendChild(b)})}
function restart(){day=1;hp=100;warm=100;render()}document.getElementById("restart").onclick=restart;render();`
  );
}

function toyHtml(ctx: { title: string; safePrompt: string; assetDataUrl?: string; assetName?: string }): string {
  return shell(
    ctx.title,
    `<header><h1>${escapeHtml(ctx.title)}</h1><p class="sub">${ctx.safePrompt}</p></header><main>${assetMarkup(ctx)}<section class="panel"><div class="row"><div class="stat"><strong id="count">0</strong><span>连击</span></div><div class="stat"><strong id="mood">冷静</strong><span>状态</span></div></div></section><section id="pad" class="panel" style="flex:1;display:grid;place-items:center;min-height:260px"><button id="main" style="width:170px;height:170px;border-radius:50%;font-size:20px">点击</button></section><button id="restart" class="ghost">重置</button></main>`,
    `let count=0;const moods=["冷静","升温","上头","爆发"];const main=document.getElementById("main"),pad=document.getElementById("pad");
function tap(){count++;document.getElementById("count").textContent=count;document.getElementById("mood").textContent=moods[Math.min(3,Math.floor(count/5))];main.style.transform="scale("+(1+Math.min(.3,count/40))+")";pad.style.background="hsl("+(130+count*24)%360+" 55% 92%)";if(count>=15)window.sparkplayPlayComplete?.();navigator.vibrate?.([10,20,10])}
function restart(){count=0;main.style.transform="scale(1)";pad.style.background="#fff";document.getElementById("count").textContent="0";document.getElementById("mood").textContent="冷静"}main.onclick=tap;document.getElementById("restart").onclick=restart;`
  );
}

function repairHtml(html: string, title: string): string {
  if (validateHtml(html).valid) return html;
  return shell(
    title,
    `<header><h1>${escapeHtml(title)}</h1><p class="sub">生成结果已自动修复为可试玩版本。</p></header><main><section class="panel"><p class="result">点击按钮收集分数，达到 10 分获胜。</p><div class="stat"><strong id="score">0</strong><span>分数</span></div></section><button id="hit">点击得分</button><button id="restart" class="ghost">重新开始</button></main>`,
    `let score=0;function render(){document.getElementById("score").textContent=score;if(score>=10){window.sparkplayPlayComplete?.();alert("胜利")}}document.getElementById("hit").onclick=()=>{score++;navigator.vibrate?.(10);render()};document.getElementById("restart").onclick=()=>{score=0;render()};render();`
  );
}
