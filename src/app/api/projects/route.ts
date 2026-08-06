import { jsonError, jsonOk } from "@/lib/http";
import { getDashboardStats, listProjects } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [projects, stats] = await Promise.all([listProjects(), getDashboardStats()]);
    return jsonOk({ projects, stats });
  } catch (error) {
    return jsonError(error);
  }
}
