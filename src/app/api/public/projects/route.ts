import { jsonError, jsonOk } from "@/lib/http";
import { toPublicProjectView } from "@/lib/public-project-view";
import { listPublicProjectCards } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const sort = new URL(request.url).searchParams.get("sort");
    const cards = await listPublicProjectCards(sort === "remixed" || sort === "played" ? sort : "latest");
    return jsonOk({ projects: cards.map(toPublicProjectView) });
  } catch (error) {
    return jsonError(error);
  }
}
