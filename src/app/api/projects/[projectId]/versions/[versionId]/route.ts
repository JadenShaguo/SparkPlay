import { jsonError, jsonOk } from "@/lib/http";
import { getVersion, readArtifact } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string; versionId: string }> }) {
  try {
    const { projectId, versionId } = await params;
    const version = await getVersion(projectId, versionId);
    if (!version) return jsonError(new Error("Version not found"), 404);
    const html = await readArtifact(version);
    return jsonOk({ version, html });
  } catch (error) {
    return jsonError(error);
  }
}
