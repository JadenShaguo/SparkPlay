import { execFileSync } from "node:child_process";

const allowedFiles = new Set([".env.example"]);
const blockedPathPatterns = [/^\.env(?!\.example$)/, /(^|\/)\.env(?!\.example$)/];
const internalGatewayPattern = new RegExp(
  `\\b(?:${["staging-" + "llm-gateway", "search." + "miui." + "srv"]
    .map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})\\b`,
  "gi"
);

const secretPatterns = [
  { name: "OpenAI-style API key", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { name: "Bearer token", pattern: /Authorization\s*:\s*Bearer\s+[A-Za-z0-9._-]{12,}/gi },
  { name: "Private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: "Codex bearer token config", pattern: /experimental_bearer_token\s*=\s*"(?!<|your-|replace-|sk-xxx)[^"]+"/gi },
  { name: "Internal gateway hostname", pattern: internalGatewayPattern },
  { name: "Concrete SparkPlay LLM API key", pattern: /^SPARKPLAY_LLM_API_KEY=(?!$|your-|replace-|sk-xxx|<).+/gim }
];

const stagedFiles = execGit(["diff", "--cached", "--name-only", "--diff-filter=ACMR"])
  .split(/\r?\n/)
  .map((item) => item.trim())
  .filter(Boolean);

const findings = [];

for (const file of stagedFiles) {
  if (allowedFiles.has(file)) continue;
  if (blockedPathPatterns.some((pattern) => pattern.test(file))) {
    findings.push({ file, reason: "真实环境变量文件不应进入 git" });
    continue;
  }

  const content = readStagedFile(file);
  if (content == null || looksBinary(content)) continue;

  for (const rule of secretPatterns) {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(content)) {
      findings.push({ file, reason: rule.name });
    }
  }
}

if (findings.length > 0) {
  console.error("Secret scan failed. 请移除或改为占位符后再提交：");
  for (const finding of findings) {
    console.error(`- ${finding.file}: ${finding.reason}`);
  }
  process.exit(1);
}

console.log(`Secret scan passed. 已扫描 ${stagedFiles.length} 个 staged 文件。`);

function execGit(args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

function readStagedFile(file) {
  try {
    return execGit(["show", `:${file}`]);
  } catch {
    return null;
  }
}

function looksBinary(content) {
  return content.includes("\u0000");
}
