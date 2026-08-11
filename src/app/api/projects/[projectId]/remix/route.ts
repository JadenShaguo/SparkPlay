import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
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
    const user = await getCurrentUser(request);
    const project = await getProject(projectId);
    if (!project || project.ownerId !== user.id) return jsonError(new Error("Project not found"), 404);
    const run = await enqueueRemix({
      projectId,
      ...body,
      ownerId: user.id
    });
    return jsonOk({
      runId: run.id,
      status: run.status,
      run
    });
  } catch (error) {
    return jsonError(error);
  }
}
