import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/http";
import { runGeneration } from "@/lib/workflows";

export const dynamic = "force-dynamic";

const assetSchema = z.object({
  id: z.string(),
  kind: z.enum(["image", "audio"]),
  name: z.string(),
  mimeType: z.string(),
  dataUrl: z.string(),
  bytes: z.number()
});

const requestSchema = z.object({
  prompt: z.string().min(2),
  mode: z.enum(["direct", "plan_once", "clarify_plan_once", "staged"]).default("direct"),
  projectId: z.string().optional(),
  assets: z.array(assetSchema).default([])
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const result = await runGeneration(body);
    return jsonOk({
      project: result.project,
      version: result.version,
      run: result.run,
      html: result.html
    });
  } catch (error) {
    return jsonError(error);
  }
}
