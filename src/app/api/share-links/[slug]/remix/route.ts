import { jsonError } from "@/lib/http";
import { forkShare } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const project = await forkShare(slug);
    return Response.redirect(new URL(`/?project=${project.id}`, request.url), 303);
  } catch (error) {
    return jsonError(error);
  }
}
