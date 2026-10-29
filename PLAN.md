# 유진 Insight Lab — 실행 계획 (해커톤 당일판)

> 원본 기획(2~12장)을 오늘 환경·시간·조직 지침에 맞게 줄인 버전이에요. 상세 화면 명세(7장)·SQL(9장)은 원본을 그대로 기준으로 삼고, **이 문서와 다르면 이 문서가 우선**이에요.

## A. 원본에서 바꾸는 것

| # | 원본 | 수정 | 이유 |
|---|---|---|---|
| 1 | 로컬 확인 `python -m http.server 4210` | 그대로 쓰되 전체 경로 `C:\Users\user\AppData\Local\Programs\Python\Python312\python.exe` (VS Code 재시작 전엔 PATH에 안 잡힘) | Python 3.12·3.14 설치돼 있음 |
| 2 | 브라우저 수동 확인 | `node tools/check.mjs <page>` — Playwright + 설치된 Edge(`channel:'msedge'`)로 1440·390px 스크린샷 + 콘솔 오류 수집 + 가로 스크롤 검사. **사용자에게 보여주기는 Artifact**(마일스톤마다 같은 URL로 갱신) | 콘솔 0건은 로컬에서만 검사 가능, 보기·공유는 Artifact가 편함 |
| 3 | 사이트 경로 `Eugene_AI_Project/yujin-research-center/` | 현재 폴더 아래 `yujin-research-center/` | 실제 작업 폴더 기준 |
| 4 | 11단계 + 단계마다 멈춤 | **6개 마일스톤**(아래 C), 마일스톤마다 멈춤 | 시간 절약, 같은 모듈 쓰는 페이지 묶음 |
| 5 | 9단계 lounge_api·jarvis·Railway·Workers | **이번 범위에서 제외.** 정적 스냅샷(`lounge-snapshot.json`) + CSS 오브 + 프리셋 답변만 | Node/npm 빌드·외부 계정·시간 부담, 시연엔 정적으로 충분 |
| 6 | db_loader(Gmail 리포트 메일·KIS 시세) 자동 적재 | **사용 안 함.** 가상 데이터 시드 JSON/SQL로 대체 | 조직 지침 2번(사내 메일·내부 자료 입력 금지) |
| 7 | 2026 행사내역 "실데이터"(실제 기업명·애널리스트 실명) | 가상 기업·가상 이름으로 바꾼 예시 데이터 | 조직 지침 3번(시연 데이터는 가상) — 운영진 확인 시 원복 가능 |
| 8 | 상단 이름 버튼 "안지선님" 고정 | 세션 `name` 사용 | 페르소나별로 달라야 함 |
| 9 | 전환 바 "2026.10.28 종가 기준" 고정 / 기본값 2026-06-23 | 둘 다 데이터의 `snapshot_date`에서 표시 | 날짜 불일치 방지 |
| 10 | 비밀값 `_secrets/db_loader.env` | Windows 사용자 환경변수(`supabase_api_anon_key`, `supabase_service_role`, `dart_api`) 이름으로만 읽기 | 이미 그렇게 설정돼 있음 |
| 12 | 로그인: Google · 이메일 · 시연 | **Google 로그인 제외.** 이메일(Supabase Auth) + "시연으로 둘러보기"만. 세션 `via`는 `'demo'|'email'` | 사용자 결정(시연에 불필요), OAuth 설정 작업도 사라짐 |
| 13 | 0장 4번: 이전 백업 zip · git bundle이 있으면 그걸 기준으로 이어서 개발 | **삭제.** 이전 자료를 찾거나 복원하지 않고 이 문서대로 처음부터 만든다 | 사용자 결정 · 조직 지침 4번(사전 제작 코드 반입 금지) |
| 11 | `db_migration/1_schema.sql` 기준 | **스키마는 이미 Supabase에 있음**(9장 25개 테이블, anon 읽기 OK). 데이터는 사용자가 크롤링으로 적재 중 → `schema.sql`·`seed.sql` 만들지 않음. 사이트는 코드 기본값('예시')으로 먼저 그리고 값이 들어오면 덮어씀 | 2026-10-29 확인: 테이블 25개 모두 0행 |

## B. 공통 규칙 (모든 마일스톤)

- 정적 HTML + CSS + vanilla JS, 빌드 없음. 폰트는 Pretendard CDN 하나.
- 모든 페이지: 상단 **"시연용 가상 화면"** 배지 + 푸터 유의문(6장). 코드 기본값에는 **'예시'** 배지, Supabase 값이 오면 덮어씀(9장 불러오기 패턴).
- 문구 해요체, 투자 권유 표현 금지.
- 공용 기능은 `assets/` 모듈 하나로(5장). 페이지 판별은 `/market(\.html)?$/`처럼 `.html` 유무 무관.
- Supabase: URL `https://cowwkddihelfgkftfqxr.supabase.co` + anon key만 `config.js`에. service_role은 클라이언트 금지.
- 마일스톤 완료 조건: `check.mjs`로 1440·390px 콘솔 오류 0건 · 가로 스크롤 0 → Artifact로 게시(여러 `.html` + `assets/`를 `files`로 함께) → 보고 → 멈춤.
- Artifact 안에서는 Supabase 로그인(Google·이메일 리다이렉트)이 동작하지 않을 수 있음 → "시연으로 둘러보기" + 코드 기본값('예시')으로 보이게 만든다.

## C. 마일스톤

| M | 내용 (원본 11장 단계) | 핵심 산출물 | 확인 포인트 |
|---|---|---|---|
| M0 | 준비 | `git init`, `.gitignore`(비밀 파일·`_secrets/`·`.env`·`node_modules`·mp4>50MB), `tools/check.mjs` | 로컬 서버 뜨고 check 스크립트 동작 |
| M1 | 기반 + 진입 (1·2) | `app.css` `config.js` `gate.js` `partials.js` `index.html` `entry.js/.css` `login.js`, 빈 페이지 5개 | 기관/WM 메뉴 차이, 시연 진입 → home, 미승인 시 index로 |
| M2 | Research (3) | `market.html` `anchor.js` `stock-events.js/.css` `theme-rotation.js` | 국내/해외 전환 일괄 적용, 기관=종목 이벤트 / WM=테마 |
| M3 | Events + Desk (4·5) | `events-data.js` `orbit-books.js/.css` `conferences.html` `desk.html` `saved-research.js` `cardnews/*` | 책 공전·필터·신청 4단계 → Desk 신청 내역·취소, 카드뉴스 뷰어·저장 |
| M4 | Quant + Home (6·7) | `quant.html` `home.html` `home.js` `home-feed.js` `home.css` | 테마 → 전략 연결, 백테스트 곡선, Home 스크롤 이펙트·유형별 섹션 |
| M5 | 보조·마감 (8) | `reports` `global` `cardnews` `admin`(서버 없음 안내), 리다이렉트 4개, 접근성, `lounge-snapshot.json` | 전 페이지 390px · 콘솔 0건 |
| M6 | 배포 (12, "배포해줘" 시에만) | `dist` 만들기 → `wrangler pages deploy` | 라이브에서 기관·WM 재확인 |

## D. 사용자가 직접 해야 하는 것 (이 환경에서 불가)

1. **VS Code 재시작** — Node가 PATH에 안 잡혀 있음(`setx`한 환경변수도 재시작해야 반영). 안 되면 전체 경로로 실행할게요.
2. **Supabase 대시보드** — (테이블은 생성 완료, 데이터는 크롤링 적재 중) Auth › URL Configuration에 `http://localhost:4210`·Pages 주소 등록. 이메일 로그인 테스트.
3. **GitHub** — 새 계정 비공개 저장소 생성 + 로그인(`gh` 미설치, push 시 브라우저 인증 필요).
4. **Cloudflare** — `wrangler login` 브라우저 인증(배포할 때만).
5. **AI 앵커 영상** — 생성 불가. 포스터 이미지 + "곧 제공" 토스트로 처리(원본 규칙과 동일). 쇼릴은 `output/insightlab-showreel/preview-draft.mp4`(14MB) 재사용 가능.
6. **운영진 확인 필요** — ① 행사내역 실명/실제 기업명 사용 여부 ② `db_loader/`·`web effect/`·`output/` 코드가 오늘 만든 것인지(지침 4번: 사전 제작 코드 반입 금지).

## E. 환경 메모

- 환경변수 `supabase_servide_role`(오타)도 있음 — 안 쓰는 값이면 지워도 돼요.
- `ANTHROPIC_API_KEY` 미설정 → AI 요약·Jarvis 답변은 프리셋/스냅샷으로.
- `2_import.py`는 `supabase_url`·`supabase_service_key`를 읽는데 실제 변수명과 달라 그대로는 실행 불가 → 사용자 크롤링 적재로 대체.
