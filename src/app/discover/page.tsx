import Link from "next/link";
import { PublicProjectGrid } from "@/components/PublicProjectGrid";
import { toPublicProjectView } from "@/lib/public-project-view";
import { listPublicProjectCards } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function DiscoverPage({
  searchParams
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  const selectedSort = sort === "remixed" || sort === "played" ? sort : "latest";
  const cards = (await listPublicProjectCards(selectedSort)).map(toPublicProjectView);

  return (
    <main className="public-page">
      <header className="public-header">
        <Link className="public-back" href="/">SparkPlay</Link>
        <div>
          <p className="eyebrow">发现</p>
          <h1>公开 Playable</h1>
          <p>浏览已公开的互动作品，从固定版本打开试玩，也可以在分享页继续 Remix。</p>
        </div>
        <nav className="public-tabs" aria-label="排序">
          <Link className={selectedSort === "latest" ? "active" : ""} href="/discover?sort=latest">最新</Link>
          <Link className={selectedSort === "remixed" ? "active" : ""} href="/discover?sort=remixed">Remix 最多</Link>
          <Link className={selectedSort === "played" ? "active" : ""} href="/discover?sort=played">试玩最多</Link>
        </nav>
      </header>
      <PublicProjectGrid projects={cards} emptyLabel="还没有公开作品。先在创作台生成并发布一个作品吧。" />
    </main>
  );
}
