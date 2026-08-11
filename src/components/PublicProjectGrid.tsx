import Link from "next/link";
import type { PublicProjectView } from "@/lib/public-project-view";

interface PublicProjectGridProps {
  projects: PublicProjectView[];
  emptyLabel: string;
}

export function PublicProjectGrid({ projects, emptyLabel }: PublicProjectGridProps) {
  if (projects.length === 0) {
    return <div className="public-empty">{emptyLabel}</div>;
  }

  return (
    <section className="public-grid">
      {projects.map((card) => (
        <article className="public-card" key={card.project.id}>
          <div className="public-thumb" aria-hidden="true">
            {card.thumbnailUrl ? (
              <span className="public-thumb-image" style={{ backgroundImage: `url(${card.thumbnailUrl})` }} />
            ) : (
              <span className="public-thumb-fallback">SparkPlay</span>
            )}
          </div>
          <div className="public-card-body">
            <p className="eyebrow">{card.currentVersion?.manifest.category ?? "playable"}</p>
            <h2>{card.project.title}</h2>
            <p>{card.project.description}</p>
            <div className="public-byline">
              <Link href={card.authorUrl}>{card.author.name}</Link>
              {card.basedOn && card.basedOnUrl ? <span>基于 <Link href={card.basedOnUrl}>{card.basedOn.project.title}</Link></span> : null}
            </div>
            <div className="public-stats">
              <span>{card.shareOpens} 打开</span>
              <span>{card.remixCount} Remix</span>
              <span>{card.project.visibility}</span>
            </div>
            {card.playUrl ? (
              <Link className="public-action" href={card.playUrl}>
                打开试玩
              </Link>
            ) : (
              <span className="public-action disabled">未创建分享链接</span>
            )}
            <Link className="public-action secondary" href={card.lineageUrl}>
              查看关系
            </Link>
          </div>
        </article>
      ))}
    </section>
  );
}
