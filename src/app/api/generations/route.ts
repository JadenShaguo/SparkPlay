import { z } from "zod";
import { getOrCreateCurrentUser } from "@/lib/auth";
import { enqueueGeneration } from "@/lib/generation-queue";
import { jsonError, jsonOk } from "@/lib/http";

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
    const session = await getOrCreateCurrentUser(request);
    const run = await enqueueGeneration({ ...body, ownerId: session.user.id });
    const response = jsonOk({
      runId: run.id,
      status: run.status,
      run
    });
    if (session.setCookie) response.headers.append("Set-Cookie", session.setCookie);
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
