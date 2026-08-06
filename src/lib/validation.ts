import type { ValidationReport } from "@/types/domain";

const blockedPatterns = [
  { pattern: /<script[^>]+src=/i, message: "禁止引用外部脚本" },
  { pattern: /<link[^>]+rel=["']?stylesheet/i, message: "禁止引用外部样式" },
  { pattern: /@import/i, message: "禁止 CSS @import" },
  { pattern: /\bfetch\s*\(/i, message: "禁止运行时网络请求 fetch" },
  { pattern: /\bXMLHttpRequest\b/i, message: "禁止运行时网络请求 XMLHttpRequest" },
  { pattern: /\bWebSocket\b/i, message: "禁止 WebSocket" },
  { pattern: /\bnavigator\.sendBeacon\b/i, message: "禁止 sendBeacon" }
];

export function validateHtml(html: string): ValidationReport {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!/<!doctype html>|<html[\s>]/i.test(html)) {
    issues.push("HTML 必须包含 doctype 或 html 根节点");
  }
  if (!/<head[\s>]/i.test(html) || !/<body[\s>]/i.test(html)) {
    issues.push("HTML 必须包含 head 和 body");
  }
  if (!/name=["']viewport["']/i.test(html)) {
    issues.push("移动端 playable 必须包含 viewport");
  }
  if (!/<script[\s>]/i.test(html)) {
    issues.push("Playable 必须包含内联交互脚本");
  }
  if (!/(click|pointer|touch|keydown|mousedown|drag)/i.test(html)) {
    warnings.push("未明显检测到点击、触摸或键盘交互");
  }
  if (Buffer.byteLength(html, "utf8") > 500 * 1024) {
    issues.push("HTML 超过 500KB");
  }

  for (const blocked of blockedPatterns) {
    if (blocked.pattern.test(html)) {
      issues.push(blocked.message);
    }
  }

  for (const script of extractInlineScripts(html)) {
    try {
      new Function(script);
    } catch (error) {
      issues.push(`内联 JavaScript 语法错误：${error instanceof Error ? error.message : "unknown"}`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    warnings
  };
}

export function extractInlineScripts(html: string): string[] {
  const scripts: string[] = [];
  const re = /<script(?![^>]+src=)[^>]*>([\s\S]*?)<\/script>/gi;
  let match = re.exec(html);
  while (match) {
    scripts.push(match[1] ?? "");
    match = re.exec(html);
  }
  return scripts;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
