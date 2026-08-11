import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicProjectGrid } from "@/components/PublicProjectGrid";
import { toPublicProjectView } from "@/lib/public-project-view";
import { getUserProfile } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const profile = await getUserProfile(userId);
  if (!profile) notFound();

  const publicProjects = profile.publicProjects.map(toPublicProjectView);
  const remixProjects = profile.remixProjects.map(toPublicProjectView);

  return (
    <main className="public-page">
      <header className="profile-header">
        <Link className="public-back" href="/discover">发现</Link>
        <div className="profile-avatar" style={{ background: profile.user.avatarColor }}>
          {profile.user.name.slice(0, 1)}
        </div>
        <div>
          <p className="eyebrow">创作者主页</p>
          <h1>{profile.user.name}</h1>
          <p>公开作品、衍生作品和试玩数据会沉淀在这里，方便他人继续打开和 Remix。</p>
        </div>
        <section className="profile-stats" aria-label="公开数据">
          <span><strong>{profile.stats.publicProjectCount}</strong>公开作品</span>
          <span><strong>{profile.stats.remixProjectCount}</strong>Remix 作品</span>
          <span><strong>{profile.stats.totalShareOpens}</strong>分享打开</span>
          <span><strong>{profile.stats.totalRemixCount}</strong>被 Remix</span>
        </section>
      </header>

      <section className="public-section">
        <h2>公开作品</h2>
        <PublicProjectGrid projects={publicProjects} emptyLabel="这个用户还没有公开作品。" />
      </section>

      <section className="public-section">
        <h2>Remix 作品</h2>
        <PublicProjectGrid projects={remixProjects} emptyLabel="这个用户还没有公开 Remix 作品。" />
      </section>
    </main>
  );
}
