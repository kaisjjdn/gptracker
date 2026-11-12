# GPtracker

한국 PS 스토어, 닌텐도 e숍, Xbox 스토어의 게임 가격을 매일 기록하고, 가격이 왜 바뀌었는지 함께 보여주는 사이트입니다.

## 내 컴퓨터에서 실행

Node.js 22 이상이 필요합니다. 데이터베이스는 따로 설치하지 않아도 됩니다(`.data/` 폴더에 자동으로 만들어집니다).

```bash
npm install
npm run db:migrate   # 표 만들기
npm run collect      # 스토어에서 지금 가격 수집
npm run dev          # http://localhost:3000
```

| 명령 | 하는 일 |
|---|---|
| `npm run collect` | 모든 스토어 수집 |
| `npm run collect -- eshop` | 이름을 적은 스토어만 수집 (`ps_store`, `eshop`, `xbox_store`, `coupang`) |
| `npm run db:seed` | 샘플 게임 6개로 채우기. **기존 데이터를 모두 지웁니다.** 화면 개발용이며 운영 DB에서는 실행하지 마세요. |
| `npm test` / `npm run typecheck` | 테스트 / 타입 검사 |

추적할 게임은 `src/collectors/tracked.ts`에 적습니다.

## 배포

구성은 세 부분입니다.

- **Supabase**: 가격 기록을 저장하는 Postgres 데이터베이스
- **GitHub Actions**: 매일 00:37(한국 시간)에 가격 수집 (`.github/workflows/collect.yml`)
- **Vercel**: 사이트

### 1. 데이터베이스 (Supabase)

1. https://supabase.com 에서 프로젝트를 만듭니다. 지역은 Seoul을 고르세요.
2. 프로젝트의 **Connect** 화면에서 **Transaction pooler** 연결 문자열을 복사합니다(포트 6543). `[YOUR-PASSWORD]` 자리를 프로젝트 비밀번호로 바꿉니다.

이 문자열이 `DATABASE_URL`입니다. 비밀번호가 들어 있으니 코드나 채팅에 붙여넣지 말고 아래 두 곳에만 넣으세요.

### 2. 매일 수집 (GitHub Actions)

1. 이 폴더(`gptracker`)를 GitHub 저장소로 올립니다.
2. 저장소 **Settings > Secrets and variables > Actions > New repository secret**에서 `DATABASE_URL`을 추가합니다.
3. **Actions** 탭에서 **Collect prices > Run workflow**로 한 번 직접 실행해 봅니다. 표 만들기와 첫 수집이 함께 이뤄집니다.

쿠팡 디스크 가격을 수집하려면 `COUPANG_ACCESS_KEY`, `COUPANG_SECRET_KEY`도 같은 방법으로 추가합니다. 없으면 쿠팡만 건너뜁니다.

알아둘 점:

- 저장소에 60일 동안 활동이 없으면 GitHub가 예약 실행을 멈춥니다. 메일로 알림이 오고, Actions 탭에서 다시 켤 수 있습니다.
- 예약 시각은 몇 분에서 수십 분 늦어질 수 있습니다.
- 한 게임이라도 수집에 실패하면 실행이 실패로 표시되고 GitHub가 메일을 보냅니다. 스토어 페이지 구조가 바뀌었을 때 알아차리기 위한 것입니다.

### 3. 사이트 (Vercel)

1. https://vercel.com 에서 GitHub 저장소를 가져옵니다(Import).
2. **Environment Variables**에 `DATABASE_URL`을 추가하고 배포합니다.

사이트는 가격 데이터를 10분 동안 기억해 두고 보여줍니다. 수집 직후에는 최대 10분 뒤에 새 가격이 나타납니다.

## 구조

```
src/collectors/          가격 수집
  stores/                PS 스토어, 닌텐도 e숍, Xbox 스토어 (공개 상품 페이지를 읽음)
  retail/                디스크 가격 (쿠팡 파트너스 API)과 상품명 매칭 규칙
  detect-changes.ts      이전 가격과 비교해 변동 이유를 판단
  record.ts              가격과 변동 기록을 DB에 저장
  tracked.ts             추적할 게임 목록
  run.ts                 수집 실행
src/db/                  표 정의(schema.ts), 연결, 마이그레이션, 샘플 데이터
src/lib/                 화면용 데이터 조회와 가공
src/app/, src/components/  화면
drizzle/                 DB 마이그레이션 파일
```

가격은 통화의 최소 단위 정수로 저장하고(원화는 원, 달러는 센트), 통화는 상품이 속한 지역에서 정해집니다. 가격 기록은 값이 바뀔 때만 한 줄씩 추가됩니다.

## 수집 방식

- 스토어의 robots.txt가 허용하는 공개 상품 페이지만 읽습니다. 게임 하나당 요청 한 번, 요청 사이 3초 간격입니다.
- 스토어 내부 API는 쓰지 않습니다.
- 스토어가 페이지 구조를 바꾸면 수집기가 오류를 내며 멈춥니다. 틀린 가격을 조용히 저장하지 않기 위해서입니다.
