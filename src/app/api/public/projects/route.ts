import { jsonError, jsonOk } from "@/lib/http";
import { toPublicProjectView } from "@/lib/public-project-view";
import { listPublicCategories, listPublicProjectCardsWithQuery } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const sort = params.get("sort");
    const cards = await listPublicProjectCardsWithQuery({
      sort: sort === "remixed" || sort === "played" ? sort : "latest",
      query: params.get("q") ?? undefined,
      category: params.get("category") ?? undefined
    });
    const categories = await listPublicCategories();
    return jsonOk({ projects: cards.map(toPublicProjectView), categories });
  } catch (error) {
    return jsonError(error);
  }
}
