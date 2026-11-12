import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import { SearchBox } from '@/components/SearchBox';
import './globals.css';

export const metadata: Metadata = {
  title: 'GPtracker 게임 가격 추적',
  description: '한국 PS 스토어, 닌텐도 e숍, Xbox 스토어와 디스크 가격을 매일 추적해요.',
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
