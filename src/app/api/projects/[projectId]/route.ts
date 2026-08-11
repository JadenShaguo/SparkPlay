import { jsonError, jsonOk } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth";
import { getProject, getProjectVersions, getVersion, readArtifact } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const user = await getCurrentUser(_request);
    const project = await getProject(projectId);
    if (!project) return jsonError(new Error("Project not found"), 404);
    if (project.visibility === "private" && project.ownerId !== user.id) {
      return jsonError(new Error("Project not found"), 404);
    }
    const versions = await getProjectVersions(project.id);
    const currentVersion = await getVersion(project.id, project.currentVersionId);
    const html = currentVersion ? await readArtifact(currentVersion) : "";
    const currentVersionThumbnailUrl = currentVersion?.thumbnailKey
      ? `/api/projects/${project.id}/versions/${currentVersion.id}/thumbnail`
      : undefined;
    return jsonOk({ project, versions, currentVersion, currentVersionThumbnailUrl, html });
  } catch (error) {
    return jsonError(error);
  }
}
