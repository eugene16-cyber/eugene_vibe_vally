// 종목 이벤트 모듈 (7-4 기관) — StockEvents.mount(host, {region}) · StockEvents.setRegion('kr'|'global')
// 모듈 자체에는 국내/해외 스위치가 없다. 페이지의 전환 바가 setRegion으로 맞춘다.
(function () {
  'use strict';

  var e = function (s) { return window.esc ? window.esc(s) : String(s == null ? '' : s); };
  var dc = function (v) { return v > 0 ? 'up' : v < 0 ? 'down' : ''; };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var kstToday = function () { var d = new Date(Date.now() + 9 * 3600e3); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); };
  var TODAY = kstToday();
  var iso = function (d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };
  var dot = function (s) { return String(s || '').replace(/-/g, '.'); };
  var DOW = ['일', '월', '화', '수', '목', '금', '토'];
  // ref_date 'MM.DD' → 올해(미래면 작년) 날짜
  function refToDate(ref) {
    var m = String(ref || '').match(/(\d{4})?[.\-/]?(\d{1,2})[.\-/](\d{1,2})/);
    if (!m) return null;
    var y = m[1] ? +m[1] : TODAY.getUTCFullYear();
    var d = new Date(Date.UTC(y, +m[2] - 1, +m[3]));
    if (!m[1] && d - TODAY > 864e5) d.setUTCFullYear(y - 1);
    return d;
  }

  /* ---------- 기본값(예시) — 가상 기업 ---------- */
  var SAMPLE_KR = [
    { kind: 'action', ticker: '900001', name: '가상전자', sector: '자사주', detail: '자기주식취득 신탁계약 체결결정', surprise: '수급 개선', tone: 'up', signal: 'High', market: 'KOSPI', days: 1 },
    { kind: 'action', ticker: '900002', name: '한빛소재(가상)', sector: '유상증자', detail: '주요사항보고서(유상증자결정)', surprise: '단기 희석', tone: 'down', signal: 'High', market: 'KOSDAQ', days: 2 },
    { kind: 'action', ticker: '900003', name: '온결바이오(가상)', sector: '합병', detail: '주요사항보고서(회사합병결정)', surprise: '구조 변화', tone: 'up', signal: 'Medium', market: 'KOSDAQ', days: 5 },
    { kind: 'action', ticker: '900004', name: '새벽화학(가상)', sector: '분할', detail: '주요사항보고서(회사분할결정)', surprise: '가치 재평가', tone: 'up', signal: 'Medium', market: 'KOSPI', days: 12 },
    { kind: 'action', ticker: '900002', name: '한빛소재(가상)', sector: '유상증자', detail: '유상증자 최종발행가액 확정', surprise: '단기 희석', tone: 'down', signal: 'Low', market: 'KOSDAQ', days: 20 }
  ];
  var SAMPLE_KR_EARN = [
    { kind: 'earnings', ticker: '900001', name: '가상전자', sector: '반도체', detail: '3Q 영업이익', consensus: '9,800억', actual: '1조 1,200억', surprise: '+14.3%', tone: 'up', signal: 'High', market: 'KOSPI', days: 1 },
    { kind: 'earnings', ticker: '900005', name: '누리조선(가상)', sector: '조선', detail: '3Q 영업이익', consensus: '1,250억', actual: '1,410억', surprise: '+12.8%', tone: 'up', signal: 'Medium', market: 'KOSPI', days: 3 },
    { kind: 'earnings', ticker: '900006', name: '바른유통(가상)', sector: '유통', detail: '3Q 영업이익', consensus: '620억', actual: '540억', surprise: '-12.9%', tone: 'down', signal: 'Medium', market: 'KOSPI', days: 4 },
    { kind: 'earnings', ticker: '900007', name: '하늘게임즈(가상)', sector: '게임', detail: '3Q 영업이익', consensus: '310억', actual: '228억', surprise: '-26.5%', tone: 'down', signal: 'High', market: 'KOSDAQ', days: 8 }
  ];
  var UPCOMING = [
    { d: 2, name: '가상전자', what: '3분기 실적 발표 · 컨퍼런스콜' },
    { d: 5, name: '누리조선(가상)', what: '임시주주총회(분할 승인)' },
    { d: 9, name: '한빛소재(가상)', what: '유상증자 신주 상장' },
    { d: 14, name: '온결바이오(가상)', what: '합병 신주 상장 예정' }
  ];
  function withDates(rows) {
    return rows.map(function (r) { var d = new Date(TODAY - r.days * 864e5); return Object.assign({}, r, { ref_date: pad(d.getUTCMonth() + 1) + '.' + pad(d.getUTCDate()) }); });
  }
  // 해외 실적 14종목 (예시)
  var SAMPLE_GL = [
    ['ORCL', 'Oracle', '정보기술', '2026-09-09', 1.47, 1.48], ['FDX', 'FedEx', '산업재', '2026-09-18', 3.68, 3.62], ['MU', 'Micron', '정보기술', '2026-09-23', 3.03, 2.86],
    ['NKE', 'Nike', '경기소비재', '2026-09-30', 0.49, 0.27], ['JPM', 'JPMorgan', '금융', '2026-10-14', 5.07, 4.85], ['GE', 'GE Aerospace', '산업재', '2026-10-21', 1.66, 1.46],
    ['TSLA', 'Tesla', '경기소비재', '2026-10-22', 0.50, 0.55], ['INTC', 'Intel', '정보기술', '2026-10-23', 0.23, 0.01], ['GOOGL', 'Alphabet', '커뮤니케이션', '2026-10-28', 2.87, 2.33],
    ['MSFT', 'Microsoft', '정보기술', '2026-10-28', 4.13, 3.67], ['META', 'Meta', '커뮤니케이션', '2026-10-29', 7.25, 6.69],
    ['AAPL', 'Apple', '정보기술', null, null, 1.77, '2026-10-30'], ['AMZN', 'Amazon', '경기소비재', null, null, 1.57, '2026-10-30'], ['NVDA', 'NVIDIA', '정보기술', null, null, 1.25, '2026-11-19']
  ].map(function (r) {
    return { ticker: r[0], name: r[1], sector: r[2], last_earnings_date: r[3], eps: r[4], eps_estimate: r[5],
      eps_surprise: r[4] != null ? +((r[4] - r[5]) / Math.abs(r[5]) * 100).toFixed(1) : null, next_earnings_date: r[6] || null };
  });

  /* ---------- 상태 ---------- */
  var S = {
    host: null, region: 'kr', tab: 'action', gtab: 'result',
    f: { market: '전체', type: '전체', period: '전체' }, gsector: '전체', showAll: false,
    kr: { action: withDates(SAMPLE_KR), earnings: withDates(SAMPLE_KR_EARN), sampleA: true, sampleE: true },
    gl: { rows: SAMPLE_GL, sample: true, calls: {} }
  };

  function load() {
    var sb = window.sb;
    if (!sb) return Promise.resolve();
    var q = function (p) { return p.then(function (r) { return r; }, function () { return { data: null }; }); };
    return Promise.all([
      q(sb.from('events').select('id,kind,ticker,name,sector,detail,consensus,actual,surprise,price_move,ref_date,tone,signal').order('id', { ascending: false }).limit(500)),
      q(sb.from('global_quotes').select('ticker,name,sector,next_earnings_date,last_earnings_date,eps,eps_estimate,eps_surprise').limit(500)),
      q(sb.from('global_research').select('kind,title,body,created_at').eq('kind', 'callsummary').order('created_at', { ascending: false }).limit(100))
    ]).then(function (res) {
      var ev = res[0].data || [];
      var act = ev.filter(function (x) { return x.kind === 'action'; });
      var ern = ev.filter(function (x) { return x.kind === 'earnings'; });
      if (act.length) { S.kr.action = act; S.kr.sampleA = false; }
      if (ern.length) { S.kr.earnings = ern; S.kr.sampleE = false; }
      var gq = res[1].data || [];
      if (gq.length) { S.gl.rows = gq; S.gl.sample = false; }
      (res[2].data || []).forEach(function (c) { var t = c.body && c.body.ticker || c.title; if (t && !S.gl.calls[t]) S.gl.calls[t] = c.body && c.body.points || []; });
      // 시장(KOSPI/KOSDAQ)은 stocks에서 — code는 'A' + 6자리
      var codes = {};
      act.concat(ern).forEach(function (x) { if (x.ticker) codes['A' + x.ticker] = 1; });
      var list = Object.keys(codes);
      if (!list.length) return;
      return q(sb.from('stocks').select('code,market').in('code', list)).then(function (r) {
        var m = {};
        (r.data || []).forEach(function (s) { m[s.code.replace(/^A/, '')] = s.market; });
        S.kr.action.concat(S.kr.earnings).forEach(function (x) { if (!x.market) x.market = m[x.ticker] || '기타'; });
      });
    }).catch(function (err) { console.warn('[IL] 종목 이벤트 데이터를 불러오지 못했어요', err); });
  }

  /* ---------- 국내 ---------- */
  function krRows() {
    var rows = S.kr[S.tab] || [];
    return rows.filter(function (r) {
      if (S.f.market !== '전체' && r.market !== S.f.market) return false;
      if (S.f.type !== '전체' && r.sector !== S.f.type) return false;
      if (S.f.period !== '전체') {
        var d = refToDate(r.ref_date), lim = S.f.period === '최근 7일' ? 7 : 30;
        if (!d || (TODAY - d) / 864e5 > lim) return false;
      }
      return true;
    });
  }
  function chips(name, values, cur) {
    return '<div class="se-chiprow"><span class="se-chiprow__label">' + name + '</span><div class="chips">' + values.map(function (v) {
      return '<button type="button" class="chip' + (v === cur ? ' is-active' : '') + '" data-f="' + name + '" data-v="' + e(v) + '" aria-pressed="' + (v === cur) + '">' + e(v) + '</button>';
    }).join('') + '</div></div>';
  }
  var FKEY = { '시장': 'market', '유형': 'type', '업종': 'type', '기간': 'period' };

  function renderKR(body) {
    var sample = S.tab === 'action' ? S.kr.sampleA : S.kr.sampleE;
    var all = S.kr[S.tab] || [];
    var types = ['전체'].concat(all.map(function (r) { return r.sector; }).filter(function (v, i, a) { return v && a.indexOf(v) === i; }));
    if (types.indexOf(S.f.type) < 0) S.f.type = '전체';
    var rows = krRows();
    var up = rows.filter(function (r) { return r.tone === 'up'; }).length, down = rows.filter(function (r) { return r.tone === 'down'; }).length;
    var isAct = S.tab === 'action';
    body.innerHTML =
      '<div class="tabs" role="tablist" aria-label="국내 종목 이벤트">' +
        '<button role="tab" type="button" data-tab="action" aria-selected="' + isAct + '">코퍼레이트 액션</button>' +
        '<button role="tab" type="button" data-tab="earnings" aria-selected="' + !isAct + '">어닝 서프라이즈</button></div>' +
      '<div class="se-filters">' + chips('시장', ['전체', 'KOSPI', 'KOSDAQ'], S.f.market) + chips(isAct ? '유형' : '업종', types, S.f.type) +
        chips('기간', ['전체', '최근 7일', '최근 30일'], S.f.period) + '</div>' +
      '<div class="se-stats" aria-live="polite"><span>총 <b class="num">' + rows.length + '</b>건</span><span class="up">긍정 <b class="num">' + up + '</b></span>' +
        '<span class="down">부정 <b class="num">' + down + '</b></span>' + (sample ? '<span class="badge badge--sample">예시</span>' : '<span class="muted se-src">DART 공시 기준</span>') + '</div>' +
      '<div class="card se-tablecard"><div class="tbl-wrap"><table class="tbl se-tbl"><thead><tr><th>종목</th><th>유형</th><th>' + (isAct ? '공시 내용' : '실적 (실제 / 컨센서스)') +
        '</th><th>기준일</th><th>효과</th><th><span class="sr-only">상세</span></th></tr></thead><tbody>' +
        (rows.length ? (S.krAll ? rows : rows.slice(0, 10)).map(function (r, i) {
          return '<tr class="is-link" tabindex="0" data-i="' + i + '"><td><span class="se-sig se-sig--' + e(String(r.signal || 'Low').toLowerCase()) + '" title="신호 ' + e(r.signal || '-') + '"></span>' +
            '<b>' + e(r.name) + '</b><small class="se-code">' + e(r.ticker) + (r.market && r.market !== '기타' ? ' · ' + e(r.market) : '') + '</small></td>' +
            '<td><span class="badge badge--muted">' + e(r.sector || '-') + '</span></td>' +
            '<td class="se-detail">' + (isAct ? e(r.detail) : e(r.detail || '') + ' ' + e(r.actual || '-') + ' / ' + e(r.consensus || '-')) + '</td>' +
            '<td class="num">' + e(r.ref_date) + '</td>' +
            '<td><span class="badge badge--' + (r.tone === 'up' ? 'up' : r.tone === 'down' ? 'down' : 'muted') + '">' + e(r.surprise || '-') + '</span></td>' +
            '<td class="se-go" aria-hidden="true">›</td></tr>';
        }).join('') : '<tr><td colspan="6" class="se-none">조건에 맞는 이벤트가 없어요.</td></tr>') +
      '</tbody></table></div></div>' +
      (rows.length > 10 ? '<div class="se-more"><button class="btn btn--secondary btn--sm" type="button" data-krmore>' + (S.krAll ? '접기' : '전체 ' + rows.length + '건 보기') + '</button></div>' : '') +
      '<div class="se-bottom">' +
        '<div class="card"><div class="card__body"><div class="se-subhead"><h3>다가오는 이벤트 캘린더</h3><span class="badge badge--sample">예시</span></div>' +
          '<ul class="se-cal">' + UPCOMING.map(function (u) {
            var d = new Date(+TODAY + u.d * 864e5);
            return '<li><span class="se-dday">D-' + u.d + '</span><span class="se-cal__date num">' + pad(d.getUTCMonth() + 1) + '.' + pad(d.getUTCDate()) + ' (' + DOW[d.getUTCDay()] + ')</span>' +
              '<span class="se-cal__t"><b>' + e(u.name) + '</b>' + e(u.what) + '</span></li>';
          }).join('') + '</ul></div></div>' +
        '<div class="card se-alert"><div class="card__body"><div class="se-subhead"><h3>이벤트 알림 등록</h3></div>' +
          '<p class="muted">새 코퍼레이트 액션 · 어닝 서프라이즈가 나오면 알려 드려요. 로그인이 필요해요.</p>' +
          '<button class="btn btn--primary btn--block" type="button" data-se-sub>알림 받기</button></div></div>' +
      '</div>';
    if (window.wireTabsA11y) window.wireTabsA11y(body.querySelector('[role=tablist]'), function (k) {
      if (k === S.tab) return; S.tab = k; S.f.type = '전체'; S.krAll = false; render(true); var t = S.host.querySelector('[role=tab][aria-selected=true]'); if (t) t.focus();
    });
    body.querySelectorAll('[data-f]').forEach(function (b) {
      b.addEventListener('click', function () { S.f[FKEY[b.dataset.f]] = b.dataset.v; S.krAll = false; render(); });
    });
    var krMore = body.querySelector('[data-krmore]');
    if (krMore) krMore.addEventListener('click', function () { S.krAll = !S.krAll; render(); });
    body.querySelectorAll('tr[data-i]').forEach(function (tr) {
      var open = function () { openKR(rows[+tr.dataset.i], sample); };
      tr.addEventListener('click', open);
      tr.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(); } });
    });
    body.querySelector('[data-se-sub]').addEventListener('click', function () { subscribe('stock-events', '종목 이벤트'); });
  }

  // 티커 시드 의사난수 반응 곡선 (예시)
  function curve(r) {
    var h = 0, s = String(r.ticker) + r.ref_date;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    var rnd = function () { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; };
    var bias = r.tone === 'up' ? 0.9 : r.tone === 'down' ? -0.9 : 0, v = 0, pts = [0];
    for (var d = 1; d <= 8; d++) { v += bias * (d < 4 ? 1.2 : 0.4) + (rnd() - 0.5) * 3; pts.push(+v.toFixed(2)); }
    var W = 440, H = 150, P = 24, lo = Math.min.apply(null, pts.concat(-1)), hi = Math.max.apply(null, pts.concat(1));
    var X = function (i) { return P + i * (W - P * 2) / 8; }, Y = function (val) { return P / 2 + (hi - val) * (H - P * 1.5) / (hi - lo); };
    var path = pts.map(function (p, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p).toFixed(1); }).join(' ');
    var last = pts[8], col = last >= 0 ? 'var(--price-up)' : 'var(--price-down)';
    return '<svg class="se-curve" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="이벤트 후 8일 주가 반응 예시 곡선, 8일째 ' + (last > 0 ? '+' : '') + last + '%">' +
      '<line x1="' + P + '" x2="' + (W - P) + '" y1="' + Y(0) + '" y2="' + Y(0) + '" stroke="#cfd0d3" stroke-dasharray="3 4"/>' +
      '<path d="' + path + ' L' + X(8) + ' ' + Y(0) + ' L' + X(0) + ' ' + Y(0) + 'Z" fill="' + col + '" opacity=".08"/>' +
      '<path d="' + path + '" fill="none" stroke="' + col + '" stroke-width="2.4" stroke-linejoin="round"/>' +
      pts.map(function (p, i) { return '<text x="' + X(i) + '" y="' + (H - 2) + '" text-anchor="middle" font-size="10" fill="#8d9299">D+' + i + '</text>'; }).join('') +
      '<circle cx="' + X(8) + '" cy="' + Y(last) + '" r="4" fill="' + col + '"/>' +
      '<text x="' + (X(8) - 8) + '" y="' + (Y(last) - 8) + '" text-anchor="end" font-size="12" font-weight="700" fill="' + col + '">' + (last > 0 ? '+' : '') + last + '%</text></svg>';
  }

  function openKR(r, sample) {
    if (!r || !window.openModal) return;
    var hist = S.kr.action.concat(S.kr.earnings).filter(function (x) { return x.ticker === r.ticker; })
      .sort(function (a, b) { return (refToDate(b.ref_date) || 0) - (refToDate(a.ref_date) || 0); });
    var m = window.openModal(
      '<div class="se-modal">' +
        '<div class="se-modal__eyebrow">' + (r.kind === 'earnings' ? 'EARNINGS SURPRISE' : 'CORPORATE ACTION') + (sample ? ' <span class="badge badge--sample">예시</span>' : '') + '</div>' +
        '<h2 class="modal__title">' + e(r.name) + ' <small class="se-code">' + e(r.ticker) + (r.market && r.market !== '기타' ? ' · ' + e(r.market) : '') + '</small></h2>' +
        '<p class="muted">' + e(r.detail) + ' · ' + e(r.ref_date) + '</p>' +
        '<div class="se-modal__sec"><div class="se-subhead"><h3>이벤트 후 8일 주가 반응</h3><span class="badge badge--sample">예시 반응 곡선</span></div>' + curve(r) +
          '<p class="form-note">실제 주가가 아니라 이벤트 유형에 따른 예시 곡선이에요.</p></div>' +
        '<div class="se-modal__sec"><div class="se-subhead"><h3>이 종목 이벤트 이력</h3></div><ol class="se-tl">' + hist.map(function (h) {
          return '<li><span class="num">' + e(h.ref_date) + '</span><span><b>' + e(h.sector || '') + '</b> ' + e(h.detail) + '</span>' +
            '<span class="badge badge--' + (h.tone === 'up' ? 'up' : h.tone === 'down' ? 'down' : 'muted') + '">' + e(h.surprise || '-') + '</span></li>';
        }).join('') + '</ol></div>' +
        '<div class="se-modal__acts"><button class="btn btn--secondary" type="button" data-sub>이 종목 알림</button>' +
          '<a class="btn btn--primary" href="reports.html?q=' + encodeURIComponent(r.name) + '">관련 리포트 →</a></div>' +
      '</div>', { label: r.name + ' 이벤트 상세', width: 520 });
    m.el.querySelector('[data-sub]').addEventListener('click', function () { subscribe('stock:' + r.ticker, r.name); });
  }

  function subscribe(channel, label) {
    var go = function (user) {
      if (!user) { if (window.openAuth) window.openAuth(label + ' 알림은 로그인 후 등록할 수 있어요.'); return; }
      window.sb.from('subscriptions').upsert({ user_id: user.id, channel: channel, channel_url: location.href.split('#')[0] + '#stock-events' })
        .then(function (r) { window.toast(r.error ? '알림을 등록하지 못했어요. 잠시 후 다시 시도해 주세요.' : label + ' 알림을 등록했어요.'); });
    };
    if (window.getUser) window.getUser().then(go); else go(null);
  }

  /* ---------- 해외 ---------- */
  function renderGL(body) {
    var rows = S.gl.rows;
    var sectors = ['전체'].concat(rows.map(function (r) { return r.sector; }).filter(function (v, i, a) { return v && a.indexOf(v) === i; }));
    if (sectors.indexOf(S.gsector) < 0) S.gsector = '전체';
    var inSec = rows.filter(function (r) { return S.gsector === '전체' || r.sector === S.gsector; });
    var isRes = S.gtab === 'result';
    var res = inSec.filter(function (r) { return r.eps != null; })
      .sort(function (a, b) { return String(b.last_earnings_date || '').localeCompare(String(a.last_earnings_date || '')); });
    var html =
      '<div class="tabs" role="tablist" aria-label="해외 실적">' +
        '<button role="tab" type="button" data-tab="result" aria-selected="' + isRes + '">실적 결과</button>' +
        '<button role="tab" type="button" data-tab="sched" aria-selected="' + !isRes + '">발표 일정</button></div>' +
      '<div class="se-filters">' + chips('섹터', sectors, S.gsector) + '</div>' +
      '<div class="se-stats" aria-live="polite">' + (isRes ? '<span>실적 발표 <b class="num">' + res.length + '</b>종목</span>' : '') +
        (S.gl.sample ? '<span class="badge badge--sample">예시</span>' : '') + '</div>';
    if (isRes) {
      var shown = S.showAll ? res : res.slice(0, 15);
      html += '<div class="card se-tablecard"><div class="tbl-wrap"><table class="tbl se-tbl"><thead><tr><th>티커</th><th>섹터</th><th>발표일</th>' +
        '<th class="num">EPS 실제</th><th class="num">컨센서스</th><th class="num">서프라이즈</th><th><span class="sr-only">상세</span></th></tr></thead><tbody>' +
        (shown.length ? shown.map(function (r, i) {
          return '<tr class="is-link" tabindex="0" data-i="' + i + '"><td><b>' + e(r.ticker) + '</b><small class="se-code">' + e(r.name || '') + '</small></td>' +
            '<td><span class="badge badge--muted">' + e(r.sector || '-') + '</span></td><td class="num">' + e(dot(r.last_earnings_date) || '-') + '</td>' +
            '<td class="num">$' + (+r.eps).toFixed(2) + '</td><td class="num">' + (r.eps_estimate != null ? '$' + (+r.eps_estimate).toFixed(2) : '-') + '</td>' +
            '<td class="num ' + dc(+r.eps_surprise) + '">' + (r.eps_surprise != null ? window.sign(r.eps_surprise, 1) : '-') + '</td><td class="se-go" aria-hidden="true">›</td></tr>';
        }).join('') : '<tr><td colspan="7" class="se-none">조건에 맞는 실적이 없어요.</td></tr>') + '</tbody></table></div></div>' +
        (res.length > 15 ? '<div class="se-more"><button class="btn btn--secondary btn--sm" type="button" data-more>' + (S.showAll ? '접기' : '전체 ' + res.length + '종목 보기') + '</button></div>' : '');
    } else {
      var up = inSec.filter(function (r) { return r.next_earnings_date && r.next_earnings_date >= iso(TODAY); })
        .sort(function (a, b) { return a.next_earnings_date.localeCompare(b.next_earnings_date); });
      var byDay = {};
      up.forEach(function (r) { (byDay[r.next_earnings_date] = byDay[r.next_earnings_date] || []).push(r); });
      var days = Object.keys(byDay);
      html += days.length ? '<div class="se-sched">' + days.map(function (d) {
        var dt = new Date(d + 'T00:00:00Z');
        return '<div class="se-sched__day"><div class="se-sched__date"><b class="num">' + dot(d).slice(5) + '</b> (' + DOW[dt.getUTCDay()] + ')</div><div class="chips">' +
          byDay[d].map(function (r) { return '<button type="button" class="chip" data-t="' + e(r.ticker) + '"><b>' + e(r.ticker) + '</b>&nbsp;' + e(r.name || '') + '</button>'; }).join('') + '</div></div>';
      }).join('') + '</div>' : '<p class="se-none card">다가오는 발표 일정이 없어요.</p>';
    }
    body.innerHTML = html;
    if (window.wireTabsA11y) window.wireTabsA11y(body.querySelector('[role=tablist]'), function (k) {
      if (k === S.gtab) return; S.gtab = k; render(true); var t = S.host.querySelector('[role=tab][aria-selected=true]'); if (t) t.focus();
    });
    body.querySelectorAll('[data-f]').forEach(function (b) { b.addEventListener('click', function () { S.gsector = b.dataset.v; S.showAll = false; render(); }); });
    var more = body.querySelector('[data-more]');
    if (more) more.addEventListener('click', function () { S.showAll = !S.showAll; render(); });
    body.querySelectorAll('tr[data-i]').forEach(function (tr) {
      var open = function () { openGL(shown[+tr.dataset.i]); };
      tr.addEventListener('click', open);
      tr.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(); } });
    });
    body.querySelectorAll('[data-t]').forEach(function (b) {
      b.addEventListener('click', function () { openGL(rows.filter(function (r) { return r.ticker === b.dataset.t; })[0]); });
    });
  }

  function openGL(r) {
    if (!r || !window.openModal) return;
    var has = r.eps != null, sp = +r.eps_surprise;
    var line = has
      ? e(r.name || r.ticker) + '의 EPS는 $' + (+r.eps).toFixed(2) + '로, 컨센서스($' + (+r.eps_estimate).toFixed(2) + ')보다 ' + Math.abs(sp).toFixed(1) + '% ' + (sp >= 0 ? '웃돌았어요.' : '밑돌았어요.')
      : e(r.name || r.ticker) + '의 다음 실적 발표는 ' + dot(r.next_earnings_date) + ' 예정이에요. 컨센서스 EPS는 $' + (r.eps_estimate != null ? (+r.eps_estimate).toFixed(2) : '-') + '예요.';
    var pts = S.gl.calls[r.ticker] || [];
    window.openModal(
      '<div class="se-modal"><div class="se-modal__eyebrow">EARNINGS · ' + e(r.sector || '') + (S.gl.sample ? ' <span class="badge badge--sample">예시</span>' : '') + '</div>' +
        '<h2 class="modal__title">' + e(r.ticker) + ' <small class="se-code">' + e(r.name || '') + '</small></h2>' +
        '<div class="ai-summary">' + line + '</div>' +
        '<table class="tbl se-mtbl"><tbody>' +
          '<tr><th>최근 발표일</th><td class="num">' + e(dot(r.last_earnings_date) || '-') + '</td></tr>' +
          '<tr><th>EPS 실제</th><td class="num">' + (has ? '$' + (+r.eps).toFixed(2) : '-') + '</td></tr>' +
          '<tr><th>EPS 컨센서스</th><td class="num">' + (r.eps_estimate != null ? '$' + (+r.eps_estimate).toFixed(2) : '-') + '</td></tr>' +
          '<tr><th>서프라이즈</th><td class="num ' + dc(sp) + '">' + (r.eps_surprise != null ? window.sign(sp, 1) : '-') + '</td></tr>' +
          '<tr><th>다음 발표 예정</th><td class="num">' + e(dot(r.next_earnings_date) || '-') + '</td></tr></tbody></table>' +
        '<div class="se-modal__sec"><div class="se-subhead"><h3>컨퍼런스콜 요약</h3></div>' +
          (pts.length ? '<ul class="se-bullets">' + pts.map(function (p) { return '<li>' + e(p) + '</li>'; }).join('') + '</ul>'
            : '<p class="form-note">컨퍼런스콜 요약이 아직 없어요. 요약이 올라오면 여기에 보여 드려요.</p>') + '</div></div>',
      { label: r.ticker + ' 실적 상세', width: 500 });
  }

  /* ---------- 공통 ---------- */
  function render(animate) {
    if (!S.host) return;
    var body = S.host.querySelector('.se-body');
    if (S.region === 'global') renderGL(body); else renderKR(body);
    if (animate) { body.classList.remove('fade-up'); void body.offsetWidth; body.classList.add('fade-up'); }
  }

  window.StockEvents = {
    mount: function (host, opts) {
      if (!host) return;
      S.host = host;
      S.region = opts && opts.region === 'global' ? 'global' : 'kr';
      host.innerHTML = '<div class="se-body"></div>';
      render();
      load().then(function () { render(); });
    },
    setRegion: function (region) {
      region = region === 'global' ? 'global' : 'kr';
      if (region === S.region) return;
      S.region = region; S.showAll = false;
      render(true);
    }
  };
})();
