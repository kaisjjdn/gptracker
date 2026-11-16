import type { Metadata } from 'next';
import { GameGrid, type BrowserParams } from '@/components/Browser';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<BrowserParams> };

// Filtered, sorted and searched views are the same page to a search engine;
// search results themselves are not worth indexing.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return { alternates: { canonical: '/' }, robots: q ? { index: false, follow: true } : undefined };
}

export default async function Home({ searchParams }: Props) {
  return <GameGrid params={await searchParams} />;
}
