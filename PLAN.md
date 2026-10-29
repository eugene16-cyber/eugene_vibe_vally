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
- 페이지 전용 스타일은 `assets/<페이지>.css`에 둔다(공용 `app.css`는 웨이브 2에서만 수정).
- 트랙 완료 조건: `check.mjs`로 1440·390px 콘솔 오류 0건 · 가로 스크롤 0 → Artifact로 게시(여러 `.html` + `assets/`를 `files`로 함께) → 보고 → 멈춤.
- Artifact 안에서는 Supabase 로그인(Google·이메일 리다이렉트)이 동작하지 않을 수 있음 → "시연으로 둘러보기" + 코드 기본값('예시')으로 보이게 만든다.

## C. 진행 순서 — 세션 여러 개로 동시에

```
웨이브 0 (메인 세션, 완료)   M0 준비 · M1 기반+진입 ── main에 커밋·push
                                   │
웨이브 1 (동시 4세션)   ┌─ A Research ─┬─ B Events ─┬─ C Desk ─┬─ D Quant·보조 ─┐
                                   │  각자 브랜치 → 끝나면 push
웨이브 2 (메인 세션)    A→B→C→D 순서로 main에 병합 → Home(H) · 통합 마감
웨이브 3                배포 ("배포해줘" 시에만)
```

### C-1. 트랙과 파일 소유권 (웨이브 1)

**각 세션은 자기 트랙 파일만 만들고 고친다.** 다른 트랙 파일은 읽기만 한다.

| 트랙 | 원본 | 소유 파일 (`yujin-research-center/` 기준) | 포트 | 완료 확인 |
|---|---|---|---|---|
| **A Research** | 7-4 · 7-5 | `market.html` `assets/market.css` `assets/anchor.js` `assets/stock-events.js/.css` `assets/theme-rotation.js/.css` | 4211 | 국내/해외 전환이 모든 영역에 한 번에 적용, 기관=종목 이벤트 / WM=테마 |
| **B Events** | 7-6 · 9장 행사 | `conferences.html` `assets/conferences.css` `assets/events-data.js` `assets/orbit-books.js/.css` `assets/conf-records.js` | 4212 | 책 공전·펼침·필터·신청 4단계·내 신청·문의 |
| **C Desk** | 7-8 · 카드뉴스 deck | `desk.html` `assets/desk.css` `assets/saved-research.js` `assets/cardnews/cardnews.js/.css` `cardnews.html` | 4213 | 카드뉴스 뷰어·저장·신청 상세·취소, `?cn=` |
| **D Quant·보조** | 7-7 · 7-9 | `quant.html` `assets/quant.js/.css` `reports.html` `global.html` `assets/reports.js` `assets/global.js` | 4214 | 전략 만들기·백테스트·보관함, 리포트 목록·상세 |

**모든 트랙이 읽기만 하는 공용 파일**: `app.css` `partials.js` `gate.js` `config.js` `index.html` `entry.*` `login.js` `CLAUDE.md` `PLAN.md` `tools/*`.
공용 파일을 꼭 바꿔야 하면 고치지 말고 `notes/<트랙>.md`(트랙마다 따로)에 "무엇을 왜"를 적는다 → 웨이브 2에서 메인 세션이 반영.

### C-2. 트랙 사이 약속 (먼저 정해 두는 인터페이스)

서로의 결과를 기다리지 않도록, 남의 모듈이 아직 없으면 **있을 때만 쓰고 없으면 자리표시**한다(`if (window.ThemeRotation) …`).

| 모듈 (만드는 트랙) | 전역 · 사용법 | 쓰는 곳 |
|---|---|---|
| `theme-rotation.js` (A) | `ThemeRotation.mount(host, {wide, onStrategy(name), strategyLabel})` | Research WM · Quant(D) · Home(H) |
| `anchor.js` (A) | `renderAnchor(el, {kind, title, caption, videoUrl, poster, chapters:[{title, sub, time}]})` | Research · Home(H) |
| `orbit-books.js` (B) | `OrbitBooks.mount(host, {books: CATS, center:'Insight.', onPick(catId)})` | Events · Home(H) |
| `events-data.js` (B) | `IL_EVENTS = {CATS, EVENTS, TODAY}` | Events · Desk(C) |
| `conf-records.js` (B) | `ILConf.list() / add(rec) / remove(id) / onChange(cb)` — `localStorage['il-conf-records-v1']` | Events · Desk(C) |
| `saved-research.js` (C) | `ILSaved.toggle/has/list/remove/onChange` — `localStorage['il.saved-research-v1']` | Desk · Reports(D) · Home(H) |
| `cardnews/cardnews.js` (C) | `CardNews.render(el, deck, {slide})` · `CardNews.open(cardRow)`(모달 뷰어) | Desk · Home(H) |

- Desk(C)는 B가 끝나기 전엔 `ILConf`가 없을 수 있다 → `localStorage['il-conf-records-v1']`를 직접 읽는 대체 코드로 그린다.
- Quant(D)의 테마 로테이션 섹션은 `ThemeRotation`이 없으면 "테마 로테이션 준비 중" 카드 → 웨이브 2에서 연결 확인.

### C-3. 세션 시작 방법

메인 세션(이 폴더)에서 M1을 커밋·push한 뒤, 트랙마다 **git worktree**(같은 저장소의 별도 작업 폴더)를 만든다. 같은 폴더를 여러 세션이 동시에 고치면 서로 덮어쓰므로 폴더를 나눈다.

```bash
# 메인 폴더에서 한 번
git worktree add ../il-A -b track-A-research
git worktree add ../il-B -b track-B-events
git worktree add ../il-C -b track-C-desk
git worktree add ../il-D -b track-D-quant
# 각 폴더에서 한 번 (git에 없는 파일 준비)
node tools/make-config.mjs && (cd tools && npm i)
```

그다음 VS Code 창을 폴더별로 열고 Claude Code 세션에 이렇게 시작한다:
> `PLAN.md C장 트랙 A 진행해줘` (B · C · D도 같은 형식)

각 세션 규칙:
- 로컬 서버는 자기 포트로: `python -m http.server 421X` (`yujin-research-center/`에서), 확인은 `node tools/check.mjs <페이지> --persona=am --base=http://localhost:421X` + `--persona=hnw`.
- Artifact 미리보기는 트랙별 따로 게시(제목 예: "Insight Lab · Research"). 통합본은 웨이브 2에서 메인 세션이 기존 M1 Artifact를 갱신.
- 끝나면 자기 브랜치에 커밋하고 `git push -u origin track-X-…` → 보고 → 멈춤. **main에 직접 병합하지 않는다.**
- Supabase는 읽기만. 테이블 · RLS를 바꾸지 않는다.

### C-4. 웨이브 2 · 3 (메인 세션)

| 단계 | 내용 | 확인 |
|---|---|---|
| 병합 | `git merge track-A-research` → B → C → D. 충돌은 소유권 표 기준으로 해결, `notes/*.md` 요청을 공용 파일에 반영 | 전 페이지 `check.mjs` 기관·WM |
| H Home | `home.html` `home.js` `home-feed.js` `home.css` (7-3) — A·B·C 모듈 재사용 | Orbit Books · 앵커 · 카드뉴스 스크롤 · 유형별 섹션 |
| 마감 | 리다이렉트 4개(12장) · `lounge-snapshot.json` · Quant↔테마 연결 · 390px · 접근성 · 공용 `?v=` 일괄 갱신 | 전 페이지 콘솔 0건, 통합 Artifact 갱신 |
| 배포 | 12장 절차 ("배포해줘" 시에만) | 라이브에서 기관·WM 재확인 |

> 세션을 하나만 쓸 때도 같은 순서(A→B→C→D→H)로 진행하면 된다.

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

## F. 회의 변경사항 (2026-10-29 · VIP Lounge)

- **포지셔닝**: 법인 맞춤형 추천 서비스. VIP Lounge = 행사(유입) + 리서치(유지 — 인뎁스 리스트 · 카드뉴스 · 근거형 Q&A).
- **첫 화면 = `index.html` = 홀로그램 v3 그대로**(`web effect/eugene-hologram-v3.html`, 경로만 수정). 쇼릴은 쓰지 않음(영상 파일 삭제).
- **가입 = 채팅 상담** (`signup.html` `#s-chat` — v3의 "직접 유형 고르기"는 `signup.html?pick=1`, `assets/signup-chat.js/.css`, `assets/disclosure-data.js`)
  - 회사명 → 공시 자동 반영(시연용 가상 공시 스냅샷 6개사: 황소자산운용 · A자문사 · B법인 · 한빛자산운용 · 온결투자자문 · 새솔공제회) → 빈 정보만 질문 **5~6개 가변**(고객사마다 다름) → 답이 안 맞으면 다시 질문 → 프로필 → 추천.
  - 확보 정보: 기업 분류 · 운용 규모 · 관심 섹터 · 투자 성향 · 관심 서비스 (+ 유형별 니즈 · 자료 형식은 질문 수 보충용).
  - 추천 = 어드민 기본값(`ADMIN_BASE`) < 답변 기반 판단. 화면에 근거와 "어드민 기본 순서 대비 바뀐 점"을 함께 보여 준다.
  - 서버 AI(Claude) 미연결 — 규칙 기반 계산이며 화면에 그렇게 표시. 실제 DART 조회 · LLM 질문 생성은 서버가 생기면 교체.
  - 결과는 `il.session.profile` · `il.session.recs`(+ `localStorage['il.profile']`)에 저장. 기존 유형 직접 선택(WM 포함)은 "유형 직접 선택 →"으로 남김.
- **Home**: 메인 카피 "법인 맞춤형 추천 서비스" + 서브 카피 → 홀로그램(`hologram.html` = `web effect/eugene-hologram-v3.html` 그대로, 경로만 수정) → 내 추천 서비스 4개 → 근거형 Q&A → 기존 섹션.
- **남은 일**: PWA(manifest · 서비스 워커 · 아이콘), 가입 질문 트리 5개 최종안(세희) 반영.

### F-2. 가입 상담 질문 개편 (어드민 고려 · 2026-10-29)

- **슬롯 먼저**: ① 고객 구분 ② 고객 정체성 ③ 운용 규모 · 목적 ④ 관심 분야 + 원하는 서비스 ⑤ 심화. 모든 답은 `il.session.profile`에 슬롯으로 저장.
- **분기는 Q1 한 번**: 법인명 → 공시 DB 조회(가상 금융사 공시 `disclosure-data.js` → Supabase `stocks`(상장 = 공시 대상, 금융 업종 = 금융사) + `events` 최근 이슈) → 못 찾으면 고객 구분(금융사 / 공시 대상 법인 / 일반 법인 / WM VIP)을 직접 묻는다. 구분마다 ②③ 보기만 다르다.
- **이미 아는 건 묻지 않음**: DB · 공시로 채운 슬롯은 건너뛴다. 자유 입력 한 번이 여러 슬롯을 채운다(예: "바이오 쪽 세미나 자주 듣고 싶어요" → 관심 분야 + 원하는 서비스 + 빈도).
- **④는 우리가 줄 수 있는 것으로 유도**: 지금 열린 행사(`events-data.js`) + 관심 섹터의 최근 리포트(Supabase `reports`) → "이 주제로 세미나를 요청할 수 있어요". **⑤는 ④에서 고른 서비스별 질문**.
- **Gemini**: 질문 문구 다듬기 · 자유 입력 슬롯 추출만. 보기(칩) · 추천 점수는 어드민 설정(`assets/yuri-flow.js` `IL_SIGNUP_FLOW`, `admin.html`에서 트리 확인). 키는 Cloudflare Pages 시크릿 `GEMINI_API_KEY` → 함수 `functions/api/yuri.js`(GET = 키 유무, POST = ask/extract). 키 · 서버가 없으면 같은 흐름을 규칙 기반으로 진행.
- **파일**: 첫 화면 `index.html`(v3 UI + 새 엔진), `hologram.html`은 삭제(Home iframe은 `index.html`), `signup.html`은 유형 직접 선택 · 이메일 로그인 · 승인 대기만, `signup-chat.*` 삭제.
