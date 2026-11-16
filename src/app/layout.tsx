import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import { SearchBox } from '@/components/SearchBox';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';
import './globals.css';

const title = 'GPtracker 게임 가격 추적';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: title, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: { type: 'website', siteName: SITE_NAME, locale: 'ko_KR', url: '/', title, description: SITE_DESCRIPTION },
  twitter: { card: 'summary', title, description: SITE_DESCRIPTION },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=IBM+Plex+Sans+KR:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <header>
          <div className="bar">
            <a className="logo" href="/">
              <span>GP</span>
              <b>tracker</b>
            </a>
            <Suspense>
              <SearchBox />
            </Suspense>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
