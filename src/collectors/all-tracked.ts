import type { Db } from '../db';
import * as s from '../db/schema';
import { TRACKED, type TrackedGame } from './tracked';

// The games to collect: the hand-picked list in tracked.ts, plus what discovery
// added. A discovered row with the slug of a hand-picked game only fills in
// store ids that entry leaves out.
export async function loadTracked(db: Db): Promise<TrackedGame[]> {
  const rows = await db.select().from(s.discoveredGames);
  return mergeTracked(TRACKED, rows);
}

type DiscoveredRow = Pick<typeof s.discoveredGames.$inferSelect, 'slug' | 'title' | 'psConceptId' | 'eshopId' | 'xboxProductId'>;

export function mergeTracked(handPicked: TrackedGame[], rows: DiscoveredRow[]): TrackedGame[] {
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const merged = handPicked.map((g) => {
    const r = bySlug.get(g.slug);
    if (!r) return g;
    return {
      ...g,
      psConceptId: g.psConceptId ?? r.psConceptId ?? undefined,
      eshopId: g.eshopId ?? r.eshopId ?? undefined,
      xboxProductId: g.xboxProductId ?? r.xboxProductId ?? undefined,
    };
  });
  const handPickedSlugs = new Set(handPicked.map((g) => g.slug));
  for (const r of rows) {
    if (handPickedSlugs.has(r.slug)) continue;
    merged.push({
      slug: r.slug,
      title: r.title,
      psConceptId: r.psConceptId ?? undefined,
      eshopId: r.eshopId ?? undefined,
      xboxProductId: r.xboxProductId ?? undefined,
    });
  }
  return merged;
}
