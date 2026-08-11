import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Play } from "lucide-react";
import { PlayPageClient } from "@/components/PlayPageClient";
import { isAuthenticated } from "@/lib/auth";
import {
  getProject,
  getProjectLineage,
  getShareBySlug,
  getUser,
  getVersion,
  readArtifact,
  recordShareOpen
} from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function PlayPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const requestHeaders = await headers();
  const sessionRequest = new Request("http://sparkplay.local", { headers: requestHeaders });
  const share = await getShareBySlug(slug);
  if (!share) notFound();

  const project = await getProject(share.projectId);
  const version = await getVersion(share.projectId, share.versionId);
  if (!project || !version) notFound();
  if (project.visibility === "private") notFound();
  await recordShareOpen(slug);
  const html = await readArtifact(version);
  const thumbnailUrl = version.thumbnailKey ? `/api/projects/${project.id}/versions/${version.id}/thumbnail` : undefined;
  const [author, lineage, sourceProject] = await Promise.all([
    getUser(project.ownerId),
    getProjectLineage(project.id),
    project.remixOf ? getProject(project.remixOf.projectId) : Promise.resolve(null)
  ]);
  const sourceAuthor = sourceProject ? await getUser(sourceProject.ownerId) : null;

  return (
    <main className="play-page">
      <section className="play-shell">
        <PlayPageClient
          slug={slug}
          title={version.manifest.title}
          html={html}
          thumbnailUrl={thumbnailUrl}
          authorName={author?.name ?? "Unknown creator"}
          authorUrl={`/users/${project.ownerId}`}
          basedOnTitle={sourceProject?.title}
          basedOnAuthorName={sourceAuthor?.name}
          basedOnAuthorUrl={sourceAuthor ? `/users/${sourceAuthor.id}` : undefined}
          remixCount={lineage.descendants.length}
          authenticated={isAuthenticated(sessionRequest)}
        />
        <div className="play-meta">
          <span>
            <Play size={15} /> {share.opens} 次打开
          </span>
          <span>{share.remixClicks} 次 Remix 点击</span>
          <span>{lineage.descendants.length} 个衍生作品</span>
          <span>版本 {version.id}</span>
          <span>{version.manifest.category}</span>
        </div>
      </section>
    </main>
  );
}
