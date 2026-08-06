import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/http";
import { rollbackVersion, readArtifact } from "@/lib/store";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  versionId: z.string()
});

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const body = requestSchema.parse(await request.json());
    const { projectId } = await params;
    const result = await rollbackVersion(projectId, body.versionId);
    const html = await readArtifact(result.version);
    return jsonOk({ ...result, html });
  } catch (error) {
    return jsonError(error);
  }
}
