import { completeGitHubOAuth } from "@/lib/auth";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await completeGitHubOAuth(request);
    const response = Response.redirect(new URL(auth.returnTo, request.url), 303);
    response.headers.append("Set-Cookie", auth.sessionCookie);
    response.headers.append("Set-Cookie", auth.clearStateCookie);
    response.headers.append("Set-Cookie", auth.clearReturnCookie);
    response.headers.append("Set-Cookie", auth.clearGuestCookie);
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
