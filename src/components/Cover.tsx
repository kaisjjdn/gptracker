import { sized } from '@/lib/image';

// A game's cover image, or a coloured tile with its first letter when there is none.
export function Cover({ title, slug, url }: { title: string; slug: string; url: string | null }) {
  if (url) {
    return (
      <div className="cover" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={sized(url, 160)} alt="" />
      </div>
    );
  }
  let hue = 0;
  for (const ch of slug) hue = (hue * 31 + ch.charCodeAt(0)) % 360;
  return (
    <div className="cover num" style={{ background: `hsl(${hue} 55% 42%)` }} aria-hidden="true">
      {title[0]}
    </div>
  );
}
