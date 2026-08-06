import { jsonError, jsonOk } from "@/lib/http";
import { getProject, getProjectVersions, getVersion, readArtifact } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const project = await getProject(projectId);
    if (!project) return jsonError(new Error("Project not found"), 404);
    const versions = await getProjectVersions(project.id);
    const currentVersion = await getVersion(project.id, project.currentVersionId);
    const html = currentVersion ? await readArtifact(currentVersion) : "";
    return jsonOk({ project, versions, currentVersion, html });
  } catch (error) {
    return jsonError(error);
  }
}
