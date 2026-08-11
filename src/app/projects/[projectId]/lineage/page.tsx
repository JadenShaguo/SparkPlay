import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject, getProjectLineage, getUser, getVersion } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ProjectLineagePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project || project.visibility === "private") notFound();

  const [author, currentVersion, lineage] = await Promise.all([
    getUser(project.ownerId),
    getVersion(project.id, project.currentVersionId),
    getProjectLineage(project.id)
  ]);
  const ancestors = await Promise.all(
    lineage.ancestors.map(async (item) => {
      const [sourceProject, sourceVersion] = await Promise.all([
        getProject(item.fromProjectId),
        getVersion(item.fromProjectId, item.fromVersionId)
      ]);
      const sourceAuthor = sourceProject ? await getUser(sourceProject.ownerId) : null;
      return { lineage: item, project: sourceProject, version: sourceVersion, author: sourceAuthor };
    })
  );
  const descendants = await Promise.all(
    lineage.descendants.map(async (item) => {
      const [childProject, childVersion] = await Promise.all([
        getProject(item.toProjectId),
        getVersion(item.toProjectId, item.toVersionId)
      ]);
      const childAuthor = childProject ? await getUser(childProject.ownerId) : null;
      return { lineage: item, project: childProject, version: childVersion, author: childAuthor };
    })
  );

  return (
    <main className="public-page">
      <header className="public-header">
        <Link className="public-back" href="/discover">发现</Link>
        <div>
          <p className="eyebrow">衍生关系</p>
          <h1>{project.title}</h1>
          <p>
            作者 {author?.name ?? "Unknown creator"} · 当前版本 {currentVersion?.id ?? project.currentVersionId}
          </p>
        </div>
        <Link className="public-back" href={`/users/${project.ownerId}`}>作者主页</Link>
      </header>

      <section className="lineage-board">
        <LineageColumn title="来源作品" emptyLabel="这是一个原创作品。" items={ancestors} />
        <div className="lineage-current">
          <p className="eyebrow">{project.visibility}</p>
          <h2>{project.title}</h2>
          <p>{project.description}</p>
        </div>
        <LineageColumn title="衍生作品" emptyLabel="还没有公开衍生作品。" items={descendants.filter((item) => item.project?.visibility !== "private")} />
      </section>
    </main>
  );
}

function LineageColumn({
  title,
  emptyLabel,
  items
}: {
  title: string;
  emptyLabel: string;
  items: Array<{
    lineage: { createdAt: string };
    project: Awaited<ReturnType<typeof getProject>>;
    version: Awaited<ReturnType<typeof getVersion>>;
    author: Awaited<ReturnType<typeof getUser>>;
  }>;
}) {
  return (
    <section className="lineage-column">
      <h2>{title}</h2>
      {items.length === 0 ? (
        <div className="public-empty">{emptyLabel}</div>
      ) : (
        items.map((item) => (
          <article className="lineage-node" key={`${item.project?.id ?? "missing"}-${item.version?.id ?? item.lineage.createdAt}`}>
            <p className="eyebrow">{item.version?.sourceKind ?? "version"}</p>
            <h3>{item.project?.title ?? "作品已不可见"}</h3>
            <p>{item.author ? `作者 ${item.author.name}` : "作者不可见"}</p>
            {item.project && item.project.visibility !== "private" ? (
              <Link href={`/projects/${item.project.id}/lineage`}>查看关系</Link>
            ) : null}
          </article>
        ))
      )}
    </section>
  );
}
