import { buildGitHubAuthorizeUrl } from "@/lib/auth";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = buildGitHubAuthorizeUrl(request);
    const response = Response.redirect(auth.url, 302);
    response.headers.append("Set-Cookie", auth.stateCookie);
    response.headers.append("Set-Cookie", auth.returnCookie);
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
