import { z } from "zod";
import { getOrCreateCurrentUser } from "@/lib/auth";
import { enqueueRemix } from "@/lib/generation-queue";
import { jsonError, jsonOk } from "@/lib/http";
import { getProject } from "@/lib/store";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  prompt: z.string().min(2),
  versionId: z.string().optional(),
  assets: z
    .array(
      z.object({
        id: z.string(),
        kind: z.enum(["image", "audio"]),
        name: z.string(),
        mimeType: z.string(),
        dataUrl: z.string(),
        bytes: z.number()
      })
    )
    .default([])
});

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const body = requestSchema.parse(await request.json());
    const { projectId } = await params;
    const session = await getOrCreateCurrentUser(request);
    const project = await getProject(projectId);
    if (!project || project.ownerId !== session.user.id) return jsonError(new Error("Project not found"), 404);
    const run = await enqueueRemix({
      projectId,
      ...body,
      ownerId: session.user.id
    });
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
