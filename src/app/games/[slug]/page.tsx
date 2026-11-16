import type { Metadata } from 'next';
import { GamePage as GameScreen, type BrowserParams } from '@/components/Browser';
import { loadCatalog } from '@/lib/catalog';
import { sized } from '@/lib/image';
import { SITE_NAME } from '@/lib/site';
import { comparable } from '@/lib/view';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<BrowserParams> };
const won = (n: number) => '₩' + n.toLocaleString('ko-KR');

// Title, description and share preview: the game, where it is cheapest and
// whether it is on sale.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const game = (await loadCatalog()).find((g) => g.slug === slug);
  if (!game) return {};
  const stores = [...comparable(game.series)].sort((a, b) => a.cur - b.cur);
  const prices = stores.map((s) => `${s.storeName} ${won(s.cur)}${s.pct > 0 ? ` (-${s.pct}%)` : ''}`).join(', ');
  const title = `${game.title} 가격 추적`;
  const description = `${game.title} 현재 가격: ${prices}. 가격 변동 그래프와 세일 이력, 역대 최저가를 확인하세요.`;
  const image = game.coverUrl ? sized(game.coverUrl, 600) : undefined;
  return {
    title,
    description,
    alternates: { canonical: `/games/${game.slug}` },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: 'ko_KR',
      url: `/games/${game.slug}`,
      title: `${title} | ${SITE_NAME}`,
      description,
      images: image ? [{ url: image, alt: game.title }] : undefined,
    },
    twitter: { card: 'summary', title: `${title} | ${SITE_NAME}`, description, images: image ? [image] : undefined },
  };
}

export default async function GamePage({ params, searchParams }: Props) {
  const { slug } = await params;
  return <GameScreen slug={slug} params={await searchParams} />;
}
