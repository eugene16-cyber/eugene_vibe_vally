# 트랙 C (Desk) — 웨이브 2 병합 메모

## 메인 세션이 할 일
1. **`desk.html` 주석 두 줄 풀기** — 트랙 B 병합 후 `assets/events-data.js` · `assets/conf-records.js`가 생기면
   `desk.html` `<head>`의 주석 처리된 `<script>` 두 줄을 푼다. 그 전에는 404 콘솔 오류를 피하려고 막아 두었다.
   - 풀면 `desk.js`가 `IL_EVENTS.EVENTS`에서 행사 일시·장소·소개를 찾고, `ILConf.list/add/remove/onChange`로 기록을 다룬다.
   - 안 풀어도 `localStorage['il-conf-records-v1']`를 직접 읽고 지우므로 동작은 한다(행사 상세만 '추후 안내'로 보임).
2. **트랙 B에 맞출 것** — Desk의 "행사 페이지에서 보기"는 `conferences.html?event=<id>`로 간다. Events가 이 파라미터로 상세를 열면 좋다.
3. **Home(H)에서 재사용** — `assets/cardnews/cardnews.css` + `cardnews.js`를 불러 `CardNews.render(el, deck, {slide})` · `CardNews.open(row)`. 예시 deck은 `CardNews.SAMPLES`. 태그 링크는 `desk.html#cardnews`, 신청한 행사 링크는 `desk.html#events`.
4. **Reports(D)** — 리포트 저장은 `ILSaved.toggle({kind:'report', id, title, category, date})`. Desk의 나의 리서치에서 리포트 항목은 `reports.html?id=<id>`로 연다.

## 공용 파일 요청
- 없음. (`app.css`·`partials.js`는 고치지 않았다.)

## 이 트랙에서 새로 쓰는 localStorage 키
- `il.saved-research-v1` (ILSaved), `il.prefs` ({watch[], alerts{report,events,cardnews}}), `il.consults-v1` (상담 요청 시연 기록)
