import { jsonError, jsonOk } from "@/lib/http";
import { getGenerationRun } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const run = await getGenerationRun(id);
    if (!run) return jsonError(new Error("Generation run not found"), 404);
    return jsonOk({ run });
  } catch (error) {
    return jsonError(error);
  }
}
