// The PlayStation and Xbox image servers send full-size artwork (often over
// 1 MB) unless asked for a width. Ask for roughly what the screen shows.
const RESIZABLE = ['image.api.playstation.com', 'store-images.s-microsoft.com'];

export function sized(url: string, width: number): string {
  try {
    const u = new URL(url);
    if (!RESIZABLE.includes(u.hostname)) return url;
    u.searchParams.set('w', String(width));
    return u.toString();
  } catch {
    return url;
  }
}
