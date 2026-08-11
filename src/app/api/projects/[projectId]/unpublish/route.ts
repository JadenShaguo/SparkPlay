import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { getProject, setProjectVisibility } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const user = await getCurrentUser(request);
    const existing = await getProject(projectId);
    if (!existing || existing.ownerId !== user.id) return jsonError(new Error("Project not found"), 404);
    const project = await setProjectVisibility(projectId, "private");
    return jsonOk({ project });
  } catch (error) {
    return jsonError(error);
  }
}
