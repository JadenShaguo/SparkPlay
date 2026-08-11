import { jsonError, jsonOk } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardStats, getVersion, listProjects } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    const [projects, stats] = await Promise.all([listProjects(user.id), getDashboardStats(user.id)]);
    const projectCards = await Promise.all(
      projects.map(async (project) => {
        const currentVersion = await getVersion(project.id, project.currentVersionId);
        return {
          ...project,
          currentVersionThumbnailUrl: currentVersion?.thumbnailKey
            ? `/api/projects/${project.id}/versions/${currentVersion.id}/thumbnail`
            : undefined
        };
      })
    );
    return jsonOk({ projects: projectCards, stats });
  } catch (error) {
    return jsonError(error);
  }
}
