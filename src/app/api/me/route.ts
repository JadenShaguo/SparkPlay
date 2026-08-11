import { getCurrentUser, isAuthenticated } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    return jsonOk({ user, authenticated: isAuthenticated(request) });
  } catch (error) {
    return jsonError(error);
  }
}
