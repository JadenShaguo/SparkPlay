import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/http";
import { createShareLink } from "@/lib/store";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  projectId: z.string(),
  versionId: z.string()
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const share = await createShareLink(body.projectId, body.versionId);
    return jsonOk({ share, url: `/play/${share.slug}` });
  } catch (error) {
    return jsonError(error);
  }
}
