// 리서치 리포트 목록 · 상세 (7-9) — 필터 · 검색 · 정렬 · 상세 모달 · 저장, ?id=로 바로 열기
// 앵커 · 카드뉴스는 이 페이지에 두지 않는다.
(function () {
  'use strict';

  var PAGE = 20;
  var LS_SAVED = 'il.saved-research-v1';
  var KIND = { macro: '매크로', sector: '산업', company: '기업' };
  var SAMPLE = '<span class="badge badge--sample">예시</span>';

  /* ---------- 코드 기본값 (예시 · 가상 기업 · 가상 애널리스트) ---------- */
  var DEF = [
    ['macro', '투자전략', '11월 자산배분 점검: 금리 하향 안정과 이익 사이클', null, null, null, '가상 애널리스트 A', '2026-10-28', '금리 하향 안정 구간에서 업종별 이익 추정치 변화를 점검했어요. 이익 상향 폭이 큰 업종과 밸류에이션 부담이 커진 업종을 나눠 정리했어요.'],
    ['macro', '경제분석', '10월 수출입 동향: 반도체 회복세의 지속성', null, null, null, '가상 애널리스트 B', '2026-10-27', '10월 수출은 반도체와 선박이 이끌었어요. 품목별 단가와 물량 요인을 나눠 회복세가 얼마나 이어질지 살펴봤어요.'],
    ['sector', '반도체', 'AI 서버 투자 사이클 점검: 메모리 수급 시나리오', null, null, null, '가상 애널리스트 C', '2026-10-27', 'AI 서버 출하 전망과 메모리 공급 증설 계획을 바탕으로 세 가지 수급 시나리오를 정리했어요.'],
    ['company', '반도체', '가상반도체(가상) 3Q 리뷰: 고부가 제품 비중 확대', '가상반도체', 'Not Rated', null, '가상 애널리스트 C', '2026-10-24', '3분기 실적은 시장 예상과 비슷했어요. 고부가 제품 비중이 늘며 수익성이 개선된 점을 정리했어요.'],
    ['sector', '전기·전자', '전력기기 업황: 북미 변압기 리드타임 변화', null, null, null, '가상 애널리스트 D', '2026-10-23', '북미 변압기 주문 리드타임과 단가 추이를 통해 업황 흐름을 점검했어요.'],
    ['company', '조선', '가상중공업(가상) 수주 잔고 점검', '가상중공업', 'Not Rated', null, '가상 애널리스트 E', '2026-10-22', '선종별 수주 잔고와 인도 일정을 바탕으로 향후 매출 인식 흐름을 정리했어요.'],
    ['sector', '2차전지', '2차전지 소재: 판가 하락 구간의 재고 조정', null, null, null, '가상 애널리스트 F', '2026-10-21', '양극재 판가와 재고 일수를 통해 조정 구간이 어디쯤인지 살펴봤어요.'],
    ['macro', 'FICC', '채권 주간: 장단기 금리차와 크레딧 스프레드', null, null, null, '가상 애널리스트 G', '2026-10-20', '국고채 장단기 금리차와 회사채 스프레드 움직임을 주간 단위로 정리했어요.'],
    ['sector', '바이오', '바이오 CDMO: 증설 경쟁과 가동률', null, null, null, '가상 애널리스트 H', '2026-10-17', '주요 CDMO 기업의 증설 계획과 가동률 추이를 비교했어요.'],
    ['company', '유통', '가상리테일(가상) 3Q 프리뷰: 객단가 회복', '가상리테일', 'Not Rated', null, '가상 애널리스트 I', '2026-10-15', '객단가 회복과 비용 효율화가 3분기 실적에 어떻게 반영될지 정리했어요.'],
    ['sector', '방산', '방산 수출: 중동·유럽 프로젝트 일정 점검', null, null, null, '가상 애널리스트 E', '2026-10-10', '진행 중인 수출 프로젝트의 계약·인도 일정을 표로 정리했어요.'],
    ['macro', '투자전략', '4분기 시장 전망: 이익 모멘텀과 수급', null, null, null, '가상 애널리스트 A', '2026-09-30', '4분기 시장을 이익 모멘텀과 수급 관점에서 정리했어요.']
  ].map(function (r, i) {
    return { id: 'S' + (i + 1), kind: r[0], category: r[1], title: r[2], company: r[3], rating: r[4], target_price: r[5], analyst: r[6], published_at: r[7], summary: r[8], url: null };
  });

  var ROWS = DEF, sample = true;
  var f = { kind: '', category: '', analyst: '', rating: '', period: '', q: '', sort: 'new' };
  var shown = PAGE;

  /* ---------- 저장 — Track C의 ILSaved와 같은 키 · 형식 ---------- */
  function savedList() { try { return JSON.parse(localStorage.getItem(LS_SAVED) || '[]') || []; } catch (e) { return []; } }
  function isSaved(id) { return savedList().some(function (x) { return x.kind === 'report' && String(x.id) === String(id); }); }
  function toggleSaved(r) {
    var item = { kind: 'report', id: r.id, title: r.title, category: r.category || KIND[r.kind] || '', date: r.published_at, at: new Date().toISOString() };
    if (window.ILSaved && ILSaved.toggle) { try { return ILSaved.toggle(item); } catch (e) { console.warn('[reports] ILSaved 실패', e); } }
    var list = savedList(), had = isSaved(r.id);
    list = had ? list.filter(function (x) { return !(x.kind === 'report' && String(x.id) === String(r.id)); }) : [item].concat(list);
    try { localStorage.setItem(LS_SAVED, JSON.stringify(list)); } catch (e) {}
    return !had;
  }

  /* ---------- 필터 ---------- */
  var analysts = function (r) { return String(r.analyst || '').split(/\s*[,·/]\s*/).filter(Boolean); };
  var date = function (s) { return String(s || '').slice(0, 10).replace(/-/g, '.'); };
  function latest() { return ROWS.reduce(function (m, r) { return r.published_at > m ? r.published_at : m; }, ''); }

  function filtered() {
    var q = f.q.toLowerCase(), since = null;
    if (f.period) { var d = new Date(latest()); d.setDate(d.getDate() - +f.period); since = d.toISOString().slice(0, 10); }
    var list = ROWS.filter(function (r) {
      if (f.kind && r.kind !== f.kind) return false;
      if (f.category && r.category !== f.category) return false;
      if (f.analyst && analysts(r).indexOf(f.analyst) < 0) return false;
      if (f.rating && (r.rating || '') !== f.rating) return false;
      if (since && r.published_at < since) return false;
      if (q && [r.title, r.company, r.analyst, r.category, r.summary].join(' ').toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    return list.sort(function (a, b) {
      if (f.sort === 'title') return String(a.title).localeCompare(String(b.title), 'ko');
      var c = String(b.published_at).localeCompare(String(a.published_at)) || (+b.id || 0) - (+a.id || 0);
      return f.sort === 'old' ? -c : c;
    });
  }

  function fillOptions() {
    var uniq = function (arr) { return Array.from(new Set(arr.filter(Boolean))).sort(function (a, b) { return a.localeCompare(b, 'ko'); }); };
    var opt = function (sel, vals, cur) {
      sel.innerHTML = '<option value="">전체</option>' + vals.map(function (v) { return '<option' + (v === cur ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('');
    };
    opt($('#rp-sector'), uniq(ROWS.map(function (r) { return r.category; })), f.category);
    opt($('#rp-analyst'), uniq([].concat.apply([], ROWS.map(analysts))), f.analyst);
    var ratings = uniq(ROWS.map(function (r) { return r.rating; }));
    $('[data-f=rating]').innerHTML = ratings.length ?
      [''].concat(ratings).map(function (v) { var on = v === f.rating; return '<button type="button" class="chip' + (on ? ' is-active' : '') + '" data-v="' + esc(v) + '" aria-pressed="' + on + '">' + (v ? esc(v) : '전체') + '</button>'; }).join('') :
      '<p class="form-note">투자의견 정보가 아직 없어요.</p>';
  }

  /* ---------- 목록 ---------- */
  function render() {
    var list = filtered(), page = list.slice(0, shown);
    $('[data-rows]').innerHTML = page.map(function (r) {
      return '<tr class="is-link" tabindex="0" data-id="' + esc(r.id) + '">' +
        '<td class="num rp-date">' + date(r.published_at) + '</td>' +
        '<td class="rp-kind"><span class="badge badge--' + (r.kind === 'company' ? 'brand' : r.kind === 'macro' ? 'point' : 'muted') + '">' + esc(KIND[r.kind] || r.kind || '-') + '</span>' +
          (r.category ? '<small>' + esc(r.category) + '</small>' : '') + '</td>' +
        '<td class="rp-title"><b>' + esc(r.title) + '</b><small>' + esc(r.analyst || '') + '</small></td>' +
        '<td class="rp-co">' + esc(r.company || '-') + '</td>' +
        '<td class="rp-rating">' + esc(r.rating || '-') + '</td>' +
        '<td class="num rp-tp">' + (r.target_price ? esc(r.target_price) : '-') + '</td></tr>';
    }).join('');
    $('[data-empty]').hidden = list.length > 0;
    $('[data-more]').hidden = list.length <= shown;
    $('[data-more]').textContent = '더 보기 (' + Math.min(PAGE, list.length - shown) + '건)';
    $('[data-count]').innerHTML = '총 <b>' + list.length + '</b>건' + (list.length !== ROWS.length ? ' <span class="muted">/ 전체 ' + ROWS.length + '건</span>' : '');
    $('[data-src]').innerHTML = sample ? SAMPLE + ' <span class="muted">시연용 예시 목록이에요</span>' : '<span class="muted">' + date(latest()) + ' 발간분까지</span>';
    var n = ['kind', 'category', 'analyst', 'rating', 'period'].filter(function (k) { return f[k]; }).length;
    $('[data-filter-on]').textContent = n ? n + '개 적용' : '';
  }

  /* ---------- 상세 모달 ---------- */
  function openReport(id) {
    var r = ROWS.filter(function (x) { return String(x.id) === String(id); })[0];
    if (!r) { if (!sample) toast('해당 리포트를 찾을 수 없어요.'); return false; }
    setParam(r.id);
    var saved = isSaved(r.id);
    var m = openModal(
      '<div class="rp-d">' +
        '<div class="rp-d__badges"><span class="badge badge--brand">' + esc(KIND[r.kind] || r.kind || '') + '</span>' + (r.category ? '<span class="badge badge--muted">' + esc(r.category) + '</span>' : '') + (sample ? SAMPLE : '') + '</div>' +
        '<h2 class="modal__title rp-d__title">' + esc(r.title) + '</h2>' +
        '<dl class="rp-d__meta">' +
          '<div><dt>발간일</dt><dd class="num">' + date(r.published_at) + '</dd></div>' +
          '<div><dt>애널리스트</dt><dd>' + esc(r.analyst || '-') + '</dd></div>' +
          (r.company ? '<div><dt>종목</dt><dd>' + esc(r.company) + '</dd></div>' : '') +
          (r.rating ? '<div><dt>투자의견</dt><dd>' + esc(r.rating) + '</dd></div>' : '') +
          (r.target_price ? '<div><dt>목표주가</dt><dd class="num">' + esc(r.target_price) + '</dd></div>' : '') +
        '</dl>' +
        '<h3 class="rp-d__h">요약</h3><p class="rp-d__sum">' + esc(r.summary || '요약이 아직 없어요.') + '</p>' +
        '<div class="rp-d__act">' +
          (r.url ? '<a class="btn btn--primary" href="' + esc(r.url) + '" target="_blank" rel="noopener">원문 PDF 보기 ↗</a>' : '<button class="btn btn--primary" type="button" data-soon>원문 PDF 보기</button>') +
          '<button class="btn btn--secondary" type="button" data-save aria-pressed="' + saved + '">' + (saved ? '★ 저장됨' : '☆ 나의 리서치에 저장') + '</button>' +
          '<button class="btn btn--text" type="button" data-copy>링크 복사</button>' +
        '</div>' +
        '<p class="form-note">리포트는 정보 제공용 자료이며 투자 권유가 아니에요.</p>' +
      '</div>', { label: '리포트 상세', width: 620, onClose: function () { setParam(null); } });
    m.el.addEventListener('click', function (e) {
      if (e.target.closest('[data-soon]')) toast('예시 리포트라 원문 PDF가 없어요.');
      var b = e.target.closest('[data-save]');
      if (b) {
        var on = toggleSaved(r);
        if (typeof on !== 'boolean') on = isSaved(r.id);
        b.setAttribute('aria-pressed', on); b.textContent = on ? '★ 저장됨' : '☆ 나의 리서치에 저장';
        toast(on ? '나의 리서치에 저장했어요. Research에서 볼 수 있어요.' : '저장을 취소했어요.');
      }
      if (e.target.closest('[data-copy]')) {
        var url = location.href.split('#')[0];
        (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { toast('링크를 복사했어요.'); }, function () { toast(url); });
      }
    });
    return true;
  }
  function setParam(id) {
    var u = new URL(location.href);
    if (id == null) u.searchParams.delete('id'); else u.searchParams.set('id', id);
    history.replaceState(null, '', u.pathname + u.search + u.hash);
  }

  /* ---------- 이벤트 ---------- */
  function setChip(group, btn) {
    $$('.chip', group).forEach(function (c) { var on = c === btn; c.classList.toggle('is-active', on); c.setAttribute('aria-pressed', on); });
  }
  function wire() {
    $$('.rp-filter [data-f]').forEach(function (g) {
      var key = g.dataset.f;
      if (g.tagName === 'SELECT') g.addEventListener('change', function () { f[key] = g.value; shown = PAGE; render(); });
      else g.addEventListener('click', function (e) { var b = e.target.closest('.chip'); if (!b) return; setChip(g, b); f[key] = b.dataset.v; shown = PAGE; render(); });
    });
    var qt; $('[data-q]').addEventListener('input', function (e) { clearTimeout(qt); qt = setTimeout(function () { f.q = e.target.value.trim(); shown = PAGE; render(); }, 150); });
    $('[data-sort]').addEventListener('change', function (e) { f.sort = e.target.value; render(); });
    $('[data-more]').addEventListener('click', function () { shown += PAGE; render(); });
    $('[data-reset]').addEventListener('click', function () {
      f.kind = f.category = f.analyst = f.rating = f.period = ''; shown = PAGE;
      $$('.rp-filter .chips').forEach(function (g) { var first = $('.chip', g); if (first) setChip(g, first); });
      fillOptions(); render();
    });
    var rows = $('[data-rows]');
    rows.addEventListener('click', function (e) { var tr = e.target.closest('tr[data-id]'); if (tr) openReport(tr.dataset.id); });
    rows.addEventListener('keydown', function (e) { var tr = e.target.closest('tr[data-id]'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openReport(tr.dataset.id); } });
    // 좁은 화면에서는 필터를 접어서 시작
    var narrow = window.matchMedia('(max-width: 900px)');
    if (narrow.matches) $('[data-filter-box]').open = false;
    $('.rp-filter__sum').addEventListener('click', function (e) { if (!narrow.matches) e.preventDefault(); });
  }

  /* ---------- 시작 · Supabase 덮어쓰기 ---------- */
  var params = new URLSearchParams(location.search);
  var want = params.get('id');
  // ?q=<검색어> — 종목 이벤트 모달의 "관련 리포트 →" 등에서 넘어올 때
  if (params.get('q')) { f.q = params.get('q').trim(); $('[data-q]').value = f.q; }
  wire(); fillOptions(); render();
  if (want && /^S\d+$/.test(want)) openReport(want);

  if (!sb) { if (want && !/^S\d+$/.test(want)) toast('리포트 데이터에 연결할 수 없어요.'); return; }
  sb.from('reports').select('id,kind,category,title,summary,company,rating,target_price,analyst,published_at,url')
    .order('published_at', { ascending: false }).limit(1000)
    .then(function (r) {
      if (r.error) throw r.error;
      if (r.data && r.data.length) { ROWS = r.data; sample = false; fillOptions(); render(); }
      if (want && !/^S\d+$/.test(want)) openReport(want);
    })
    .catch(function (e) { console.warn('[reports] Supabase 조회 실패 — 예시 목록을 유지해요', e); });
})();
