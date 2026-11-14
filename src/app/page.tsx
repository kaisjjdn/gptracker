import { GameGrid, type BrowserParams } from '@/components/Browser';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: Promise<BrowserParams> }) {
  return <GameGrid params={await searchParams} />;
}
