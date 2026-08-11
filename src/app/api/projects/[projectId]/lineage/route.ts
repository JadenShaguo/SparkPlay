import { jsonError, jsonOk } from "@/lib/http";
import { getProject, getProjectLineage } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const project = await getProject(projectId);
    if (!project) return jsonError(new Error("Project not found"), 404);
    const lineage = await getProjectLineage(projectId);
    return jsonOk(lineage);
  } catch (error) {
    return jsonError(error);
  }
}
