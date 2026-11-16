// The address the site is published at, for links that must be absolute
// (sitemap, share previews). SITE_URL wins; on Vercel the production domain is
// known; otherwise this is a local run.
export const SITE_URL = (
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000')
).replace(/\/$/, '');

export const SITE_NAME = 'GPtracker';
export const SITE_DESCRIPTION =
  '한국 PS 스토어, 닌텐도 e숍, Xbox 스토어의 게임 가격을 매일 기록해요. 가격 변동 그래프와 세일 이력, 역대 최저가, 스토어별 가격 비교를 볼 수 있어요.';
