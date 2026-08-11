import { jsonError } from "@/lib/http";
import { getCurrentUser, isAuthenticated } from "@/lib/auth";
import { forkShare } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    if (!isAuthenticated(request)) {
      return Response.redirect(new URL(`/api/auth/github/start?returnTo=/play/${slug}`, request.url), 303);
    }
    const user = await getCurrentUser(request);
    const project = await forkShare(slug, user.id);
    return Response.redirect(new URL(`/?project=${project.id}`, request.url), 303);
  } catch (error) {
    return jsonError(error);
  }
}
