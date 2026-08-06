import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import type { AssetRef, GenerationMode, PlayableManifest } from "@/types/domain";
import type { GeneratedPlayable } from "@/lib/playable-generator";
import { validateHtml } from "@/lib/validation";

interface LlmGenerateInput {
  prompt: string;
  mode: GenerationMode | "remix";
  assets?: AssetRef[];
  baseHtml?: string;
  remixOf?: PlayableManifest["remixOf"];
}

interface ResponsesApiPayload {
  model: string;
  input: Array<{
    role: "system" | "user";
    content: string;
  }>;
  store: boolean;
  reasoning?: {
    effort: string;
  };
  max_output_tokens?: number;
  text?: {
    format: {
      type: "json_schema";
      name: string;
      strict: boolean;
      schema: Record<string, unknown>;
    };
  };
}

interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  effort: string;
  timeoutMs: number;
  maxOutputTokens: number;
}

export function hasLlmGatewayConfig(): boolean {
  return Boolean(
    process.env.SPARKPLAY_LLM_CONFIG_SOURCE === "codex" ||
      process.env.SPARKPLAY_LLM_API_KEY ||
      process.env.OPENAI_API_KEY
  );
}

export async function generateWithLlmGateway(input: LlmGenerateInput): Promise<GeneratedPlayable | null> {
  if (!hasLlmGatewayConfig()) return null;

  const config = resolveProviderConfig();
  if (!config) return null;

  const payload = buildResponsesPayload(input, config.model, config.effort, config.maxOutputTokens);
  let response = await postResponses(config, payload);
  if (!response.ok && response.status === 504 && config.effort !== "medium") {
    response = await postResponses(config, buildResponsesPayload(input, config.model, "medium", config.maxOutputTokens));
  }

  if (!response.ok) {
    const message = await response.text();
    if (response.status === 504) {
      throw new Error(
        `模型网关 504：上游生成超时。当前请求已使用 ${Math.round(config.timeoutMs / 1000)} 秒服务端等待，并已尝试降低 reasoning effort。建议稍后重试，或把 SPARKPLAY_LLM_REASONING_EFFORT 改成 medium。`
      );
    }
    throw new Error(`模型网关请求失败：${response.status} ${message.slice(0, 200)}`);
  }

  const json = (await response.json()) as unknown;
  const parsed = parseResponsesJson(json);
  const report = validateHtml(parsed.html);
  if (!report.valid) {
    throw new Error(`模型返回 HTML 未通过校验：${report.issues.join("；")}`);
  }

  return {
    html: parsed.html,
    repaired: false,
    manifest: {
      title: parsed.manifest.title,
      description: parsed.manifest.description,
      category: parsed.manifest.category,
      tags: parsed.manifest.tags,
      controls: parsed.manifest.controls,
      assetRefs: input.assets ?? [],
      sourcePrompt: input.prompt,
      remixOf: input.remixOf,
      safetyStatus: "approved"
    }
  };
}

function buildResponsesPayload(
  input: LlmGenerateInput,
  model: string,
  effort: string,
  maxOutputTokens: number
): ResponsesApiPayload {
  return {
    model,
    store: false,
    reasoning: { effort },
    max_output_tokens: maxOutputTokens,
    input: [
      {
        role: "system",
        content:
          "You generate safe, self-contained mobile-first HTML5 playable mini games. Return only JSON that matches the schema. The HTML must be a complete document with inline CSS and inline JavaScript. Do not use external scripts, external CSS, fetch, XMLHttpRequest, WebSocket, sendBeacon, or @import. The game must include a clear goal, interaction, feedback, score/progress/state, end state, and restart."
      },
      {
        role: "user",
        content: buildUserPrompt(input)
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "playable_generation",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["html", "manifest"],
          properties: {
            html: { type: "string" },
            manifest: {
              type: "object",
              additionalProperties: false,
              required: ["title", "description", "category", "tags", "controls"],
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                category: { type: "string" },
                tags: {
                  type: "array",
                  items: { type: "string" }
                },
                controls: {
                  type: "array",
                  items: { type: "string" }
                }
              }
            }
          }
        }
      }
    }
  };
}

async function postResponses(config: ProviderConfig, payload: ResponsesApiPayload): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    return await fetch(`${config.baseUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`模型网关请求超时：本地等待 ${Math.round(config.timeoutMs / 1000)} 秒后中断`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function resolveProviderConfig(): ProviderConfig | null {
  if (process.env.SPARKPLAY_LLM_CONFIG_SOURCE === "codex") {
    return readCodexProviderConfig();
  }

  const apiKey = process.env.SPARKPLAY_LLM_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  return {
    baseUrl: normalizeBaseUrl(
      process.env.SPARKPLAY_LLM_BASE_URL ??
        process.env.OPENAI_BASE_URL ??
        "https://api.openai.com/v1"
    ),
    apiKey,
    model: process.env.SPARKPLAY_LLM_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.5",
    effort: process.env.SPARKPLAY_LLM_REASONING_EFFORT ?? "high",
    timeoutMs: readPositiveInteger(process.env.SPARKPLAY_LLM_TIMEOUT_MS, 120000),
    maxOutputTokens: readPositiveInteger(process.env.SPARKPLAY_LLM_MAX_OUTPUT_TOKENS, 12000)
  };
}

function readCodexProviderConfig(): ProviderConfig {
  const configPath = process.env.SPARKPLAY_CODEX_CONFIG_PATH ?? path.join(homedir(), ".codex", "config.toml");
  let raw = "";
  try {
    raw = readFileSync(/* turbopackIgnore: true */ configPath, "utf8");
  } catch {
    throw new Error(`无法读取 Codex 配置文件：${configPath}`);
  }

  const providerName = readTomlString(raw, "model_provider") ?? "custom";
  const providerBlock = readTomlBlock(raw, `model_providers.${providerName}`);
  if (!providerBlock) {
    throw new Error(`Codex 配置中找不到 [model_providers.${providerName}]`);
  }

  const baseUrl = readTomlString(providerBlock, "base_url");
  const token = readTomlString(providerBlock, "experimental_bearer_token");
  if (!baseUrl || !token) {
    throw new Error("Codex provider 配置缺少 base_url 或 experimental_bearer_token");
  }

  return {
    baseUrl: normalizeBaseUrl(baseUrl),
    apiKey: token,
    model: process.env.SPARKPLAY_LLM_MODEL ?? readTomlString(raw, "model") ?? "gpt-5.5",
    effort: process.env.SPARKPLAY_LLM_REASONING_EFFORT ?? readTomlString(raw, "model_reasoning_effort") ?? "medium",
    timeoutMs: readPositiveInteger(process.env.SPARKPLAY_LLM_TIMEOUT_MS, 120000),
    maxOutputTokens: readPositiveInteger(process.env.SPARKPLAY_LLM_MAX_OUTPUT_TOKENS, 12000)
  };
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function readTomlString(source: string, key: string): string | null {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`^${escapedKey}\\s*=\\s*"([^"]*)"`, "m"));
  return match?.[1] ?? null;
}

function readTomlBlock(source: string, blockName: string): string | null {
  const lines = source.split(/\r?\n/);
  const header = `[${blockName}]`;
  const start = lines.findIndex((line) => line.trim() === header);
  if (start < 0) return null;

  const blockLines: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) break;
    blockLines.push(line);
  }
  return blockLines.join("\n");
}

function buildUserPrompt(input: LlmGenerateInput): string {
  const assetSummary =
    input.assets?.map((asset) => `${asset.kind}:${asset.name}:${asset.mimeType}`).join("\n") || "No uploaded assets.";
  return [
    `Mode: ${input.mode}`,
    `User prompt: ${input.prompt}`,
    `Uploaded assets:\n${assetSummary}`,
    input.baseHtml ? `Base HTML for remix:\n${input.baseHtml.slice(0, 180000)}` : "No base HTML.",
    "Generate a playable suitable for direct iframe preview and public share pages."
  ].join("\n\n");
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function parseResponsesJson(response: unknown): {
  html: string;
  manifest: {
    title: string;
    description: string;
    category: string;
    tags: string[];
    controls: string[];
  };
} {
  const outputText = extractOutputText(response);
  const parsed = JSON.parse(outputText) as {
    html?: unknown;
    manifest?: {
      title?: unknown;
      description?: unknown;
      category?: unknown;
      tags?: unknown;
      controls?: unknown;
    };
  };

  if (
    typeof parsed.html !== "string" ||
    typeof parsed.manifest?.title !== "string" ||
    typeof parsed.manifest.description !== "string" ||
    typeof parsed.manifest.category !== "string" ||
    !Array.isArray(parsed.manifest.tags) ||
    !Array.isArray(parsed.manifest.controls)
  ) {
    throw new Error("模型返回结构不符合 playable_generation schema");
  }

  return {
    html: parsed.html,
    manifest: {
      title: parsed.manifest.title,
      description: parsed.manifest.description,
      category: parsed.manifest.category,
      tags: parsed.manifest.tags.filter((item): item is string => typeof item === "string"),
      controls: parsed.manifest.controls.filter((item): item is string => typeof item === "string")
    }
  };
}

function extractOutputText(response: unknown): string {
  if (typeof response !== "object" || response === null) {
    throw new Error("模型网关返回不是 JSON 对象");
  }
  const record = response as Record<string, unknown>;

  if (typeof record.output_text === "string") return record.output_text;

  const output = record.output;
  if (Array.isArray(output)) {
    const textChunks: string[] = [];
    for (const item of output) {
      if (typeof item !== "object" || item === null) continue;
      const content = (item as Record<string, unknown>).content;
      if (!Array.isArray(content)) continue;
      for (const part of content) {
        if (typeof part !== "object" || part === null) continue;
        const partRecord = part as Record<string, unknown>;
        if (typeof partRecord.text === "string") textChunks.push(partRecord.text);
      }
    }
    if (textChunks.length > 0) return textChunks.join("");
  }

  throw new Error("无法从 Responses API 返回中提取 output_text");
}
