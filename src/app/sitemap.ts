import type { MetadataRoute } from 'next';
import { loadCatalog } from '@/lib/catalog';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';

// Every game's page, with the time its price last changed on any store.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const games = await loadCatalog();
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    ...games.map((g) => ({
      url: `${SITE_URL}/games/${g.slug}`,
      lastModified: new Date(Math.max(...g.series.map((s) => s.changes.at(-1)!.t))),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
  ];
}
