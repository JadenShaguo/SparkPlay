import { z } from "zod";
import { getOrCreateCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { getShareBySlug, reportProject } from "@/lib/store";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  reason: z.string().min(2).max(240)
});

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const body = requestSchema.parse(await request.json());
    const session = await getOrCreateCurrentUser(request);
    const share = await getShareBySlug(slug);
    if (!share) return jsonError(new Error("Share link not found"), 404);
    const review = await reportProject({
      projectId: share.projectId,
      versionId: share.versionId,
      reporterId: session.user.id,
      reason: body.reason
    });
    const response = jsonOk({ review });
    if (session.setCookie) response.headers.append("Set-Cookie", session.setCookie);
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
