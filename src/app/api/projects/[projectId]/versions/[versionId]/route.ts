import { jsonError, jsonOk } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth";
import { getProject, getVersion, readArtifact } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string; versionId: string }> }) {
  try {
    const { projectId, versionId } = await params;
    const user = await getCurrentUser(_request);
    const project = await getProject(projectId);
    if (!project) return jsonError(new Error("Project not found"), 404);
    if (project.visibility === "private" && project.ownerId !== user.id) {
      return jsonError(new Error("Project not found"), 404);
    }
    const version = await getVersion(projectId, versionId);
    if (!version) return jsonError(new Error("Version not found"), 404);
    const html = await readArtifact(version);
    return jsonOk({ version, html });
  } catch (error) {
    return jsonError(error);
  }
}
