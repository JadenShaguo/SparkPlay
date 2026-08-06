import { jsonError, jsonOk } from "@/lib/http";
import { getProjectVersions } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const versions = await getProjectVersions(projectId);
    return jsonOk({ versions });
  } catch (error) {
    return jsonError(error);
  }
}
