import { getCurrentUser } from "@/lib/auth";
import { getProject, getVersion, readThumbnail } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string; versionId: string }> }) {
  const { projectId, versionId } = await params;
  const user = await getCurrentUser(_request);
  const project = await getProject(projectId);
  if (!project) return new Response("Project not found", { status: 404 });
  if (project.visibility === "private" && project.ownerId !== user.id) {
    return new Response("Project not found", { status: 404 });
  }
  const version = await getVersion(projectId, versionId);
  if (!version) return new Response("Version not found", { status: 404 });

  const thumbnail = await readThumbnail(version);
  if (!thumbnail) return new Response("Thumbnail not found", { status: 404 });

  return new Response(new Uint8Array(thumbnail.content), {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": thumbnail.contentType
    }
  });
}
