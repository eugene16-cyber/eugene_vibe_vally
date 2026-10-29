# 트랙 A (Research) → 웨이브 2 요청

공용 파일은 고치지 않았어요. 병합할 때 아래를 반영해 주세요.

1. **`app.css` `.tbl-wrap{position:relative}` 추가** — 표 안의 `.sr-only`(position:absolute)가 가로 스크롤 박스 밖으로 새어 390px에서 페이지 전체가 가로로 넘쳤어요(363px). 트랙 A는 `stock-events.css`의 `.se-tablecard .tbl-wrap`에만 임시로 넣었어요. 다른 트랙 표에서도 같은 문제가 생길 수 있어요.
2. **`reports.html` `?q=<검색어>` 지원**(트랙 D) — 종목 이벤트 모달의 "관련 리포트 →"가 `reports.html?q=<종목명>`으로 가요. 테마 패널 · 애널리스트 코멘트는 `reports.html?id=<id>`를 써요.
3. **앵커 카드 스타일** — `anchor.js`가 `<style id="vanchor-css">`를 한 번 주입해요. Home에서는 `anchor.js`만 불러오면 돼요(별도 CSS 없음).
4. **Home 재사용** — `ThemeRotation.mount(host, {wide, onStrategy, strategyLabel})`는 데이터를 스스로 불러와요(`themes` 최신 week_of · `theme_constituents` · `theme_news` · `reports`). 같은 페이지에서 여러 번 mount해도 조회는 한 번이에요. 반환값 `{select(name), themes(), destroy()}` — Quant(D)의 "이 테마로 전략 만들기"에서 테마 이름을 넘겨받아요.
5. `market.html`은 `?region=global` 주소를 유지해요. Quant 하단 크로스링크는 `market.html#stock-events`.
