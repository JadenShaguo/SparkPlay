import { z } from "zod";
import { getOrCreateCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { getProject, setProjectVisibility } from "@/lib/store";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  visibility: z.enum(["public", "unlisted"]).default("public")
});

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const body = requestSchema.parse(await request.json().catch(() => ({})));
    const { projectId } = await params;
    const session = await getOrCreateCurrentUser(request);
    const existing = await getProject(projectId);
    if (!existing || existing.ownerId !== session.user.id) return jsonError(new Error("Project not found"), 404);
    const project = await setProjectVisibility(projectId, body.visibility);
    const response = jsonOk({ project });
    if (session.setCookie) response.headers.append("Set-Cookie", session.setCookie);
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
