import { jsonError, jsonOk } from "@/lib/http";
import { getOrCreateCurrentUser } from "@/lib/auth";
import { getDashboardStats, getVersion, listProjects } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getOrCreateCurrentUser(request);
    const [projects, stats] = await Promise.all([listProjects(session.user.id), getDashboardStats(session.user.id)]);
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
    const response = jsonOk({ projects: projectCards, stats });
    if (session.setCookie) response.headers.append("Set-Cookie", session.setCookie);
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
