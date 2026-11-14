import type { Metadata } from 'next';
import { GamePage as GameScreen, type BrowserParams } from '@/components/Browser';
import { loadCatalog } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<BrowserParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const game = (await loadCatalog()).find((g) => g.slug === slug);
  return game ? { title: `${game.title} 가격 기록 | GPtracker` } : {};
}

export default async function GamePage({ params, searchParams }: Props) {
  const { slug } = await params;
  return <GameScreen slug={slug} params={await searchParams} />;
}
