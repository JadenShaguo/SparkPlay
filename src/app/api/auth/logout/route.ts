import { clearSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const returnTo = new URL(request.url).searchParams.get("returnTo") ?? "/";
  const response = Response.redirect(new URL(returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/", request.url), 303);
  response.headers.append("Set-Cookie", clearSessionCookie());
  return response;
}
