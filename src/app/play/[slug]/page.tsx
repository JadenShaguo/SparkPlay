import { notFound } from "next/navigation";
import { Copy, GitFork, Play } from "lucide-react";
import { getProject, getShareBySlug, getVersion, readArtifact, recordShareOpen } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function PlayPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const share = await getShareBySlug(slug);
  if (!share) notFound();
  await recordShareOpen(slug);

  const project = await getProject(share.projectId);
  const version = await getVersion(share.projectId, share.versionId);
  if (!project || !version) notFound();
  const html = await readArtifact(version);

  return (
    <main className="play-page">
      <section className="play-shell">
        <div className="play-toolbar">
          <div>
            <p className="eyebrow">SparkPlay</p>
            <h1>{version.manifest.title}</h1>
          </div>
          <div className="play-actions">
            <form action={`/api/share-links/${slug}/remix`} method="post">
              <button className="icon-button with-label" type="submit">
                <GitFork size={18} />
                Remix
              </button>
            </form>
            <button className="icon-button with-label" type="button">
              <Copy size={18} />
              分享
            </button>
          </div>
        </div>
        <div className="play-frame-wrap">
          <iframe
            title={version.manifest.title}
            srcDoc={html}
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="play-meta">
          <span>
            <Play size={15} /> {share.opens} 次打开
          </span>
          <span>版本 {version.id}</span>
          <span>{version.manifest.category}</span>
        </div>
      </section>
    </main>
  );
}
