import { z } from "zod";
import { getOrCreateCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { getProject, rollbackVersion, readArtifact } from "@/lib/store";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  versionId: z.string()
});

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const body = requestSchema.parse(await request.json());
    const { projectId } = await params;
    const session = await getOrCreateCurrentUser(request);
    const project = await getProject(projectId);
    if (!project || project.ownerId !== session.user.id) return jsonError(new Error("Project not found"), 404);
    const result = await rollbackVersion(projectId, body.versionId);
    const html = await readArtifact(result.version);
    const response = jsonOk({ ...result, html });
    if (session.setCookie) response.headers.append("Set-Cookie", session.setCookie);
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
