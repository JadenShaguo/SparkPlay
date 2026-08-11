import { jsonError, jsonOk } from "@/lib/http";
import { toPublicProjectView } from "@/lib/public-project-view";
import { getUserProfile } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params;
    const profile = await getUserProfile(userId);
    if (!profile) return jsonError(new Error("User not found"), 404);
    return jsonOk({
      ...profile,
      publicProjects: profile.publicProjects.map(toPublicProjectView),
      remixProjects: profile.remixProjects.map(toPublicProjectView)
    });
  } catch (error) {
    return jsonError(error);
  }
}
