import { z } from "zod";
import { createSessionCookie, getOrCreateCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { updateUserProfile } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getOrCreateCurrentUser(request);
    const response = jsonOk({
      user: session.user,
      authenticated: session.authenticated,
      guest: session.guest
    });
    if (session.setCookie) response.headers.append("Set-Cookie", session.setCookie);
    return response;
  } catch (error) {
    return jsonError(error);
  }
}

const profileSchema = z.object({
  name: z.string().min(1).max(40).optional(),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()
});

export async function PATCH(request: Request) {
  try {
    const session = await getOrCreateCurrentUser(request);
    const body = profileSchema.parse(await request.json());
    const user = await updateUserProfile(session.user.id, body);
    const response = jsonOk({
      user,
      authenticated: session.authenticated,
      guest: session.guest
    });
    if (session.authenticated) response.headers.append("Set-Cookie", createSessionCookie(user));
    if (session.setCookie) response.headers.append("Set-Cookie", session.setCookie);
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
