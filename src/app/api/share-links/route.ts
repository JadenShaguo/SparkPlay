import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { createShareLink, getProject } from "@/lib/store";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  projectId: z.string(),
  versionId: z.string()
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const user = await getCurrentUser(request);
    const project = await getProject(body.projectId);
    if (!project || project.ownerId !== user.id) return jsonError(new Error("Project not found"), 404);
    const share = await createShareLink(body.projectId, body.versionId);
    return jsonOk({ share, url: `/play/${share.slug}` });
  } catch (error) {
    return jsonError(error);
  }
}
