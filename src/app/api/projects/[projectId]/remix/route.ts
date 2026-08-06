import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/http";
import { runRemix } from "@/lib/workflows";

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
    const result = await runRemix({
      projectId,
      ...body
    });
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
