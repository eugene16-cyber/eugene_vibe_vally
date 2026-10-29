# Track D (Quant · 보조) — 웨이브 2 병합 메모

## 공용·다른 트랙 파일에 반영할 것
1. **quant.html ↔ theme-rotation (Track A)** — A가 병합되면 `quant.html`의 주석 자리에 아래 두 줄 추가.
   `quant.js`는 `window.ThemeRotation`이 있으면 `mount(host, {onStrategy, strategyLabel})`로 붙고, 없으면 "준비 중" 카드 + 테마 칩으로 대체해요.
   ```html
   <link rel="stylesheet" href="assets/theme-rotation.css?v=…">
   <script src="assets/theme-rotation.js?v=…" defer></script>   <!-- quant.js 보다 먼저 -->
   ```
   `onStrategy(name)` → ①탭 전환 · 테마 선택(이름 공백·`/`·`·` 무시 부분 일치) · 스크롤 · 토스트. 목록에 없으면 안내 토스트.
2. **reports.js ↔ saved-research (Track C)** — 같은 키 `localStorage['il.saved-research-v1']`·같은 형식으로 직접 읽고 써요.
   `window.ILSaved.toggle(item)`이 있으면 그걸 먼저 써요. C 병합 후 `reports.html`에 `saved-research.js`를 넣을지 결정해 주세요(넣으면 Desk와 onChange 연동).
3. **새 파일(소유권 표에 없던 페이지 전용 CSS)**: `assets/reports.css`, `assets/global.css` — B장 "페이지 전용 스타일은 assets/<페이지>.css" 규칙대로 만들었어요. 다른 트랙과 겹치지 않아요.
4. **진입 링크** — `reports.html`·`global.html`은 메뉴에 없어요(7-9). Home/Research/Desk에서 링크로 연결:
   - `reports.html?id=<reports.id>` → 상세 모달 바로 열림 (Desk "원문 리포트 보기", 테마 패널 리포트 탭에 쓰기 좋음)
   - `quant.html?theme=<테마명>` · `quant.html?tab=bt|vault`
   - `global.html#highs`
5. **지수 스트립 중복** — `global.html`의 해외 지수 그룹은 `global.js` 안에 있어요. Track A `market.html`의 해외 지수와 겹치면 웨이브 2에서 하나의 모듈로 합칠지 판단.

## 데이터 메모 (2026-10-29 확인)
- 채워짐: `reports`(108) · `themes`(15) · `global_indices` · `global_research(overnight)` · `global_sectors` · `global_highs` · `global_quotes`(14) → 화면이 Supabase 값으로 덮어써짐.
- 비어 있음 → '예시' 배지: `quant_*` 5개 테이블 전부, `global_deep_research`, `saved_strategies`.
- `global_indices.symbol`은 `^` 없는 형식(IXIC·SSEC·DXY). `global.js`는 `^`가 붙어 와도 떼고 맞춰요.
- `quant_factor_returns.ret`·`quant_stock_stats` 단위(소수/퍼센트)를 모르니 자동 판별해요. 벤치마크는 factor_id에 `market|kospi|bench`가 들어간 계열.
- 보관함: 로그인 사용자는 `saved_strategies`(RLS `auth.uid()=user_id`), 시연 세션은 `localStorage['il.quant-strategies-v1']`.
- 예시 종목은 모두 가상 이름(`…사(가상)`, `V-ALP` 등) — 실제 종목에 지어낸 수치를 붙이지 않음.
