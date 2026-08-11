import Link from "next/link";
import { PublicProjectGrid } from "@/components/PublicProjectGrid";
import { toPublicProjectView } from "@/lib/public-project-view";
import { listPublicCategories, listPublicProjectCardsWithQuery } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function DiscoverPage({
  searchParams
}: {
  searchParams: Promise<{ sort?: string; q?: string; category?: string }>;
}) {
  const { sort, q, category } = await searchParams;
  const selectedSort = sort === "remixed" || sort === "played" ? sort : "latest";
  const [cards, categories] = await Promise.all([
    listPublicProjectCardsWithQuery({
      sort: selectedSort,
      query: q,
      category
    }),
    listPublicCategories()
  ]);
  const views = cards.map(toPublicProjectView);
  const queryPrefix = new URLSearchParams();
  if (q?.trim()) queryPrefix.set("q", q.trim());
  if (category?.trim()) queryPrefix.set("category", category.trim());
  const sortHref = (nextSort: string) => {
    const params = new URLSearchParams(queryPrefix);
    params.set("sort", nextSort);
    return `/discover?${params.toString()}`;
  };

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
          <Link className={selectedSort === "latest" ? "active" : ""} href={sortHref("latest")}>最新</Link>
          <Link className={selectedSort === "remixed" ? "active" : ""} href={sortHref("remixed")}>Remix 最多</Link>
          <Link className={selectedSort === "played" ? "active" : ""} href={sortHref("played")}>试玩最多</Link>
        </nav>
      </header>
      <form className="discover-filters" action="/discover">
        <input name="q" defaultValue={q ?? ""} placeholder="搜索标题、玩法、标签" />
        <select name="category" defaultValue={category ?? "all"}>
          <option value="all">全部分类</option>
          {categories.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <input type="hidden" name="sort" value={selectedSort} />
        <button type="submit">筛选</button>
        {(q || (category && category !== "all")) && <Link href={`/discover?sort=${selectedSort}`}>清空</Link>}
      </form>
      <PublicProjectGrid projects={views} emptyLabel="没有匹配的公开作品。换个关键词或分类试试。" />
    </main>
  );
}
