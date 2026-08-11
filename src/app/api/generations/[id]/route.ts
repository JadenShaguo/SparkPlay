import { jsonError, jsonOk } from "@/lib/http";
import { getGenerationResult } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { run, project, version, html } = await getGenerationResult(id);
    if (!run) return jsonError(new Error("Generation run not found"), 404);
    return jsonOk({ run, project, version, html });
  } catch (error) {
    return jsonError(error);
  }
}
