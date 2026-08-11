import type { PlayableContractReport, PlayableManifest, PlayablePlan, ValidationReport } from "@/types/domain";

interface ContractInput {
  html: string;
  manifest: PlayableManifest;
}

export function ensurePlayablePlan(manifest: PlayableManifest): PlayablePlan {
  if (manifest.plan) return manifest.plan;
  const controls = manifest.controls.length > 0 ? manifest.controls : ["点击交互", "重新开始"];
  return {
    title: manifest.title,
    coreLoop: `${controls[0]}，观察即时反馈，推进分数或进度。`,
    goal: manifest.description || "完成一个明确的互动挑战。",
    controls,
    scoring: "通过分数、进度或状态变化反馈玩家表现。",
    states: ["ready", "playing", "completed"],
    endCondition: "达到目标、完成进度或触发结局后结束。",
    restartBehavior: "提供重新开始入口，重置分数、进度和状态。",
    visualStyle: manifest.tags.join("、") || manifest.category
  };
}

export function validatePlayableContract(input: ContractInput): PlayableContractReport {
  const plan = ensurePlayablePlan(input.manifest);
  const html = input.html.toLowerCase();
  const visibleText = stripTags(input.html).toLowerCase();
  const checks: PlayableContractReport["checks"] = [
    {
      key: "goal",
      passed: hasMeaningfulText(plan.goal) && hasAny(visibleText, ["目标", "完成", "获胜", "挑战", "结局", "得分", "匹配", "收集", "躲避"]),
      message: "作品需要有明确玩法目标"
    },
    {
      key: "interaction",
      passed: plan.controls.length > 0 && hasAny(html, ["onclick", "addeventlistener", "pointer", "touch", "keydown", "drag", "mousedown"]),
      message: "作品需要有明确交互入口"
    },
    {
      key: "feedback",
      passed: hasMeaningfulText(plan.coreLoop) && hasAny(html, ["textcontent", "innerhtml", "vibrate", "transform", "background", "alert", "filltext"]),
      message: "作品需要在交互后提供即时反馈"
    },
    {
      key: "state",
      passed: hasMeaningfulText(plan.scoring) && hasAny(html, ["score", "count", "step", "progress", "matched", "moves", "day", "hp", "warm", "分数", "进度", "状态", "步数"]),
      message: "作品需要有计分、进度或状态"
    },
    {
      key: "endState",
      passed: hasMeaningfulText(plan.endCondition) && hasAny(html, ["sparkplayplaycomplete", "完成", "胜利", "结局", "全部匹配", "得分", "alert"]),
      message: "作品需要有结束态"
    },
    {
      key: "restart",
      passed: hasMeaningfulText(plan.restartBehavior) && hasAny(html, ["restart", "重新开始", "重置", "再来一次", "再测一次"]),
      message: "作品需要能重新开始"
    }
  ];

  return {
    valid: checks.every((check) => check.passed),
    checks
  };
}

export function mergeContractReport(report: ValidationReport, contract: PlayableContractReport): ValidationReport {
  const failedMessages = contract.checks
    .filter((check) => !check.passed)
    .map((check) => check.message);
  return {
    ...report,
    valid: report.valid && contract.valid,
    issues: [...report.issues, ...failedMessages],
    contract
  };
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ");
}

function hasMeaningfulText(value: string): boolean {
  return value.trim().length >= 4;
}

function hasAny(value: string, candidates: string[]): boolean {
  return candidates.some((candidate) => value.includes(candidate.toLowerCase()));
}
