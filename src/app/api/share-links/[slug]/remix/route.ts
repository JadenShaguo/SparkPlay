import { jsonError } from "@/lib/http";
import { getOrCreateCurrentUser } from "@/lib/auth";
import { forkShare } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const session = await getOrCreateCurrentUser(request);
    const project = await forkShare(slug, session.user.id);
    const response = Response.redirect(new URL(`/?project=${project.id}`, request.url), 303);
    if (session.setCookie) response.headers.append("Set-Cookie", session.setCookie);
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
