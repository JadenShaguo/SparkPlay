import type { PublicProjectCard } from "@/types/domain";

export interface PublicProjectView extends PublicProjectCard {
  thumbnailUrl?: string;
  authorUrl: string;
  playUrl?: string;
  lineageUrl: string;
  basedOnUrl?: string;
}

export function toPublicProjectView(card: PublicProjectCard): PublicProjectView {
  return {
    ...card,
    thumbnailUrl: card.currentVersion?.thumbnailKey
      ? `/api/projects/${card.project.id}/versions/${card.currentVersion.id}/thumbnail`
      : undefined,
    authorUrl: `/users/${card.author.id}`,
    playUrl: card.shareSlug ? `/play/${card.shareSlug}` : undefined,
    lineageUrl: `/projects/${card.project.id}/lineage`,
    basedOnUrl: card.basedOn ? `/users/${card.basedOn.author.id}` : undefined
  };
}
