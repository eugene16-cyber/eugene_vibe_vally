// 해외 증시 · 신고가 (7-9) — 지수 그룹 · 모닝 브리핑 · 섹터·테마 히트맵 · 20일 신고가 · ATH 스크리너 · AI Deep Research · 이번 주 실적 띠
// 불러오기 패턴(9장): 코드 기본값('예시')으로 먼저 그리고 → Supabase 값이 오면 영역별로 덮어쓴다.
(function () {
  'use strict';

  var SAMPLE = '<span class="badge badge--sample">예시</span>';
  var GROUPS = [
    { name: '미국', items: [['IXIC', '나스닥'], ['GSPC', 'S&P 500'], ['DJI', '다우'], ['RUT', '러셀 2000']] },
    { name: '아시아', items: [['N225', '닛케이 225'], ['HSI', '항셍'], ['SSEC', '상해종합']] },
    { name: '매크로', items: [['VIX', 'VIX'], ['TNX', '미 10년물'], ['DXY', '달러 인덱스']] }
  ];
  var MAXSAT = { '1d': 2.5, '1w': 5, '1m': 10 };   // 이 등락률 이상이면 최대 채도

  /* ---------- 코드 기본값 (예시) — 종목은 모두 가상 ---------- */
  var D = {
    asof: null,
    indices: {
      'IXIC': [21480.12, 0.84], 'GSPC': [6512.40, 0.52], 'DJI': [45120.75, 0.21], 'RUT': [2380.66, -0.37],
      'N225': [41250.30, 0.66], 'HSI': [25480.10, -0.92], 'SSEC': [3720.45, 0.18],
      'VIX': [16.42, -3.10], 'TNX': [4.12, -0.04], 'DXY': [98.65, 0.12]
    },
    brief: { title: '기술주 강세 속 금리 하향 안정', note: '밤사이 미국 증시는 반도체·소프트웨어 중심으로 올랐어요. 미 10년물 금리가 소폭 내리며 성장주 부담이 줄었고, 에너지 업종은 유가 하락으로 약했어요.', rows: [['나스닥', 0.84], ['S&P 500', 0.52], ['다우', 0.21], ['WTI', -1.40]] },
    sectors: [
      ['XLK', '정보기술', 1.42, 3.1, 6.8], ['XLC', '커뮤니케이션', 0.96, 2.2, 4.1], ['XLY', '경기소비재', 0.61, 1.0, 2.6], ['XLF', '금융', 0.33, 0.8, 1.9],
      ['XLI', '산업재', 0.24, 1.4, 3.3], ['XLV', '헬스케어', -0.12, -0.6, -1.8], ['XLB', '소재', -0.28, -0.4, 0.7], ['XLP', '필수소비재', -0.35, -1.1, -2.4],
      ['XLRE', '부동산', -0.52, -0.9, -3.1], ['XLU', '유틸리티', -0.74, 0.3, 2.2], ['XLE', '에너지', -1.36, -2.8, -5.6]
    ],
    themes: [
      ['AI·SEMI', 'AI 반도체', 2.10, 4.6, 11.2], ['CLOUD', '클라우드', 1.05, 2.4, 5.1], ['CYBER', '사이버보안', 0.72, 1.8, 3.6], ['NUCL', '원자력', 0.44, 3.9, 9.4],
      ['ROBO', '로봇·자동화', 0.18, 1.2, 4.0], ['BIO', '바이오텍', -0.40, -1.5, -2.2], ['SOLAR', '태양광', -1.20, -3.4, -8.1], ['EV', '전기차', -0.86, -2.1, -4.7]
    ],
    // ticker, name, sector, close, chg, vol_ratio, is_20d, is_ath, from_52w_high, ath_streak, ma20_gap, next_earnings
    highs: [
      ['V-ALP', 'Alpha Semi(가상)', '정보기술', 182.40, 3.2, 2.1, true, true, 0, 4, 9.8, '2026-11-05'],
      ['V-BRV', 'Bravo Cloud(가상)', '정보기술', 96.15, 2.4, 1.7, true, true, 0, 2, 7.1, '2026-11-12'],
      ['V-CHL', 'Charlie Grid(가상)', '유틸리티', 54.80, 1.9, 1.5, true, false, -4.2, 0, 5.6, '2026-11-03'],
      ['V-DLT', 'Delta Health(가상)', '헬스케어', 141.20, 2.8, 2.6, true, false, -18.5, 0, 6.3, '2026-11-04'],
      ['V-ECH', 'Echo Retail(가상)', '경기소비재', 63.05, 1.4, 1.3, true, false, -22.1, 0, 4.4, '2026-11-18'],
      ['V-FXT', 'Foxtrot Bank(가상)', '금융', 38.90, 0.9, 1.2, true, false, -2.8, 0, 3.2, '2026-10-30'],
      ['V-GLF', 'Golf Media(가상)', '커뮤니케이션', 211.70, 1.1, 1.4, false, true, 0, 7, 4.9, '2026-11-06'],
      ['V-HTL', 'Hotel Energy(가상)', '에너지', 27.35, 3.6, 3.1, true, false, -31.4, 0, 8.7, '2026-11-02']
    ],
    deep: {
      'V-ALP': { thesis: 'AI 서버용 고대역폭 메모리 수요가 늘며 매출 구성이 바뀌는 중이에요. 신고가는 이익 추정치 상향과 함께 나왔어요.', drivers: ['데이터센터 투자 계획 확대', '고부가 제품 비중 상승', '공급 증설 일정의 지연'], risks: ['고객사 재고 조정', '공급 과잉 전환 시점', '수출 규제 변화'], checkpoints: ['다음 분기 가이던스', '주요 고객사 설비투자 발표'] },
      'V-DLT': { thesis: '52주 고가 대비 아직 낮은 위치에서 20일 신고가가 나왔어요. 신약 임상 일정이 다가오며 거래량이 늘었어요.', drivers: ['임상 3상 결과 발표 예정', '비용 효율화'], risks: ['임상 결과 불확실성', '약가 정책 변화'], checkpoints: ['임상 데이터 공개일', '거래량 유지 여부'] }
    },
    // ticker, name, date
    earnings: [['V-FXT', 'Foxtrot Bank', '2026-10-30'], ['V-HTL', 'Hotel Energy', '2026-11-02'], ['V-CHL', 'Charlie Grid', '2026-11-03'], ['V-DLT', 'Delta Health', '2026-11-04'], ['V-ALP', 'Alpha Semi', '2026-11-05'], ['V-GLF', 'Golf Media', '2026-11-06']]
  };
  var S = {
    asof: { idx: null, sec: null, hi: null },
    sample: { idx: true, brief: true, sec: true, hi: true, earn: true },
    indices: D.indices,
    brief: D.brief,
    sectors: { sector: D.sectors.map(sec), theme: D.themes.map(sec) },
    highs: D.highs.map(function (h) {
      return { ticker: h[0], name: h[1], sector: h[2], close: h[3], chg_pct: h[4], vol_ratio: h[5], is_20d: h[6], is_ath: h[7], from_52w_high: h[8], ath_streak: h[9], ma20_gap: h[10], next_earnings: h[11], spark: spark(h[0], h[4]) };
    }),
    deep: D.deep,
    earnings: D.earnings.map(function (e) { return { ticker: e[0], name: e[1], date: e[2] }; })
  };
  function sec(a) { return { symbol: a[0], name: a[1], chg_1d: a[2], chg_1w: a[3], chg_1m: a[4] }; }
  function spark(seed, last) {  // 예시 스파크라인 — 티커 시드 의사난수로 오르막을 만든다
    var h = 0; for (var i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    var v = 100, out = [];
    for (var k = 0; k < 20; k++) { h = (h * 1103515245 + 12345) >>> 0; v *= 1 + ((h % 1000) / 1000 - 0.42) * 0.03; out.push(+v.toFixed(2)); }
    out.push(+(v * (1 + last / 100)).toFixed(2));
    return out;
  }

  var HI_FIRST = 15;   // 먼저 보여 줄 종목 수
  var state = { kind: 'sector', period: '1d', hi: '20d', hiAll: false };
  var srcBadge = function (key, asof) { var el = $('[data-src="' + key + '"]'); if (el) el.innerHTML = S.sample[key] ? SAMPLE : asof ? '<span class="gl-asof">' + esc(asof) + ' 기준</span>' : ''; };

  /* ---------- 지수 그룹 ---------- */
  function renderIndices() {
    $('[data-indices]').innerHTML = GROUPS.map(function (g) {
      return '<div class="gl-group"><h3>' + g.name + '</h3><ul>' + g.items.map(function (it) {
        var v = S.indices[it[0]], tnx = it[0] === 'TNX';
        if (!v) return '<li><span>' + esc(it[1]) + '</span><b class="num">-</b><em></em></li>';
        var cls = v[1] > 0 ? 'is-up' : v[1] < 0 ? 'is-down' : '';
        return '<li><span>' + esc(it[1]) + '</span><b class="num">' + fmt(v[0], 2) + (tnx ? '%' : '') + '</b>' +
          '<em class="num ' + cls + '">' + (tnx ? sign(v[1], 2, '%p') : sign(v[1], 2)) + '</em></li>';
      }).join('') + '</ul></div>';
    }).join('');
    srcBadge('idx', S.asof.idx);
  }

  /* ---------- 모닝 브리핑 ---------- */
  function renderBrief() {
    var b = S.brief;
    $('[data-brief]').innerHTML = '<div class="gl-brief__top"><span class="sec-eyebrow">MORNING BRIEF</span>' + (S.sample.brief ? SAMPLE : b.asof ? '<span class="gl-asof gl-asof--muted">' + esc(b.asof) + '</span>' : '') + '</div>' +
      '<h2 class="gl-brief__t">' + esc(b.title) + '</h2>' +
      '<p class="gl-brief__note">' + esc(b.note) + '</p>' +
      '<div class="gl-brief__chips">' + (b.rows || []).map(function (r) { return '<span class="gl-chip"><span>' + esc(r[0]) + '</span><b class="num ' + dirCls(r[1]) + '">' + sign(r[1], 2) + '</b></span>'; }).join('') + '</div>' +
      '<a class="btn btn--text gl-brief__more" href="today.html?region=global">Research 해외 시황에서 더 보기 →</a>';
  }

  /* ---------- 히트맵 ---------- */
  function heatColor(v, max) {
    var t = Math.min(1, Math.abs(v) / max), base = [242, 244, 247], to = v >= 0 ? [224, 52, 75] : [20, 63, 150];
    var c = base.map(function (b, i) { return Math.round(b + (to[i] - b) * t); });
    return { bg: 'rgb(' + c.join(',') + ')', dark: t > 0.55 };
  }
  function renderHeat() {
    var key = 'chg_' + state.period, max = MAXSAT[state.period];
    var list = (S.sectors[state.kind] || []).filter(function (s) { return s[key] != null; }).slice().sort(function (a, b) { return b[key] - a[key]; });
    var host = $('[data-heat]');
    host.classList.remove('fade-up'); void host.offsetWidth; host.classList.add('fade-up');
    host.innerHTML = list.length ? list.map(function (s) {
      var c = heatColor(s[key], max);
      return '<div class="gl-tile' + (c.dark ? ' is-dark' : '') + '" style="background:' + c.bg + '" title="' + esc(s.name) + ' ' + sign(s[key], 2) + '">' +
        '<span class="gl-tile__n">' + esc(s.name) + '</span><span class="gl-tile__s">' + esc(s.symbol) + '</span><b class="num">' + sign(s[key], 2) + '</b></div>';
    }).join('') : '<p class="gl-empty">' + (state.kind === 'theme' ? '테마' : '섹터') + ' 데이터가 아직 없어요.</p>';
    $('[data-heat-note]').innerHTML = (state.kind === 'sector' ? '미국 S&amp;P 500 섹터 ETF 기준' : '미국 상장 테마 ETF 기준') +
      ' · 색이 가장 진한 기준 ±' + max + '% · <span class="gl-key gl-key--up"></span>상승 <span class="gl-key gl-key--down"></span>하락';
    srcBadge('sec', S.asof.sec);
  }

  /* ---------- 신고가 · ATH ---------- */
  var HI = {
    '20d': { desc: '최근 20거래일 중 가장 높은 종가를 새로 쓴 종목이에요.', filter: function (h) { return h.is_20d; }, sort: 'vol_ratio' },
    ath: { desc: '상장 이후 가장 높은 종가를 쓴 종목이에요. 연속 일수는 최고가를 이어서 갱신한 거래일 수예요.', filter: function (h) { return h.is_ath; }, sort: 'ath_streak' },
    turn: { desc: '20일 신고가이면서 52주 고가보다 15% 이상 낮은 종목이에요. 하락 뒤 방향이 바뀌는 중인지 살펴볼 후보예요.', filter: function (h) { return h.is_20d && h.from_52w_high != null && h.from_52w_high <= -15; }, sort: 'from_52w_high', asc: true }
  };
  function sparkSvg(arr) {
    if (!arr || arr.length < 2) return '';
    arr = arr.slice(-21); // 20일 추이만
    var lo = Math.min.apply(null, arr), hi = Math.max.apply(null, arr), W = 72, H = 22;
    var pts = arr.map(function (v, i) { return (i / (arr.length - 1) * W).toFixed(1) + ',' + (H - 2 - (hi === lo ? 0.5 : (v - lo) / (hi - lo)) * (H - 4)).toFixed(1); }).join(' ');
    return '<svg class="gl-spark" width="' + W + '" height="' + H + '" aria-hidden="true"><polyline points="' + pts + '"/></svg>';
  }
  function renderHighs() {
    var cfg = HI[state.hi];
    var list = S.highs.filter(cfg.filter).sort(function (a, b) { var x = +a[cfg.sort] || 0, y = +b[cfg.sort] || 0; return cfg.asc ? x - y : y - x; });
    var third = state.hi === 'ath' ? '연속' : state.hi === 'turn' ? '52주 고가 대비' : '거래량 배수';
    $('[data-hi-desc]').textContent = cfg.desc;
    $('[data-hi-head]').innerHTML = '<tr><th scope="col">종목</th><th scope="col" class="gl-hide-m">섹터</th><th scope="col" class="num">종가</th><th scope="col" class="num">등락</th>' +
      '<th scope="col" class="num">' + third + '</th><th scope="col" class="gl-hide-m">20일 추이</th><th scope="col" class="gl-hide-m">다음 실적</th></tr>';
    $('[data-hi-rows]').innerHTML = (state.hiAll ? list : list.slice(0, HI_FIRST)).map(function (h) {
      var third = state.hi === 'ath' ? (h.ath_streak || 0) + '일' : state.hi === 'turn' ? sign(h.from_52w_high, 1) : (h.vol_ratio != null ? fmt(h.vol_ratio, 1) + '배' : '-');
      return '<tr class="is-link" tabindex="0" data-ticker="' + esc(h.ticker) + '"><td><b class="gl-tk">' + esc(h.ticker) + '</b><small class="gl-nm">' + esc(h.name || '') + '</small></td>' +
        '<td class="gl-hide-m">' + esc(h.sector || '-') + '</td><td class="num">' + fmt(h.close, 2) + '</td>' +
        '<td class="num ' + dirCls(h.chg_pct) + '">' + sign(h.chg_pct, 2) + '</td><td class="num">' + third + '</td>' +
        '<td class="gl-hide-m">' + sparkSvg(h.spark) + '</td><td class="gl-hide-m num">' + (h.next_earnings ? esc(String(h.next_earnings).slice(5).replace('-', '.')) : '-') + '</td></tr>';
    }).join('');
    $('[data-hi-empty]').hidden = list.length > 0;
    var more = $('[data-hi-more]');
    more.hidden = state.hiAll || list.length <= HI_FIRST;
    more.textContent = '전체 ' + list.length + '종목 보기';
    srcBadge('hi', S.asof.hi);
  }

  /* ---------- AI Deep Research 모달 ---------- */
  var asList = function (v) { return Array.isArray(v) ? v : v ? [v] : []; };
  var itemText = function (x) { return typeof x === 'string' ? x : x && (x.title || x.text || x.name || x.label) || JSON.stringify(x); };
  function openDeep(ticker) {
    var h = S.highs.filter(function (x) { return x.ticker === ticker; })[0] || { ticker: ticker };
    var d = S.deep[ticker];
    var list = function (t, arr) { arr = asList(arr); return arr.length ? '<h3 class="gl-d__h">' + t + '</h3><ul class="gl-d__ul">' + arr.map(function (x) { return '<li>' + esc(itemText(x)) + '</li>'; }).join('') + '</ul>' : ''; };
    var metrics = d && d.metrics && typeof d.metrics === 'object' && !Array.isArray(d.metrics) ? Object.keys(d.metrics).slice(0, 6) : [];
    openModal(
      '<div class="gl-d"><div class="gl-d__top"><span class="badge badge--brand">AI Deep Research</span>' + (S.sample.hi ? SAMPLE : '') + '</div>' +
      '<h2 class="modal__title">' + esc(h.ticker) + ' <span class="muted gl-d__nm">' + esc(h.name || '') + '</span></h2>' +
      '<dl class="gl-d__m"><div><dt>종가</dt><dd class="num">' + (h.close != null ? fmt(h.close, 2) : '-') + '</dd></div><div><dt>등락</dt><dd class="num ' + dirCls(h.chg_pct) + '">' + (h.chg_pct != null ? sign(h.chg_pct, 2) : '-') + '</dd></div>' +
        '<div><dt>52주 고가 대비</dt><dd class="num">' + (h.from_52w_high != null ? sign(h.from_52w_high, 1) : '-') + '</dd></div><div><dt>20일선 괴리</dt><dd class="num">' + (h.ma20_gap != null ? sign(h.ma20_gap, 1) : '-') + '</dd></div>' +
        metrics.map(function (k) { return '<div><dt>' + esc(k) + '</dt><dd class="num">' + esc(d.metrics[k]) + '</dd></div>'; }).join('') + '</dl>' +
      (d ? '<div class="ai-summary">' + esc(d.thesis || '') + '</div>' + list('주요 동인', d.drivers) + list('리스크', d.risks) + list('확인할 것', d.checkpoints) +
        (asList(d.sources).length ? '<p class="form-note gl-d__src">출처 · ' + asList(d.sources).map(function (x) { return esc(itemText(x)); }).join(' · ') + '</p>' : '') +
        '<p class="form-note">' + (d.model ? esc(d.model) + '로 만든 ' : 'AI가 만든 ') + '요약이에요. 리서치센터 검수 전 자료이며 투자 권유가 아니에요.</p>'
        : '<p class="gl-empty">이 종목의 AI Deep Research가 아직 없어요.</p>') +
      '</div>', { label: h.ticker + ' AI Deep Research', width: 600 });
  }

  /* ---------- 이번 주 실적 띠 ---------- */
  function weekRange(base) {
    var d = base ? new Date(base) : new Date(), day = (d.getDay() + 6) % 7;
    var mon = new Date(d); mon.setDate(d.getDate() - day);
    var sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    var iso = function (x) { return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
    return [iso(mon), iso(sun)];
  }
  function renderEarnings() {
    var W = '일월화수목금토', list = S.earnings.slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
    $('[data-earnings]').innerHTML = (S.sample.earn ? SAMPLE : '') + (list.length ? list.map(function (e) {
      var d = new Date(e.date + 'T00:00:00');
      return '<button type="button" class="gl-epill" data-ticker="' + esc(e.ticker) + '"><span class="num">' + e.date.slice(5).replace('-', '.') + '(' + W.charAt(d.getDay()) + ')</span><b>' + esc(e.ticker) + '</b>' +
        (e.name ? '<small>' + esc(e.name) + '</small>' : '') + '</button>';
    }).join('') : '<span class="gl-earn__none">이번 주 예정된 실적 발표가 없어요.</span>');
  }

  /* ---------- 이벤트 ---------- */
  function wire() {
    wireTabsA11y($('[data-heat-kind]'), function (k) { state.kind = k; renderHeat(); });
    wireTabsA11y($('[data-heat-period]'), function (k) { state.period = k; renderHeat(); });
    wireTabsA11y($('[data-hi-tabs]'), function (k) { state.hi = k; state.hiAll = false; renderHighs(); });
    $('[data-hi-more]').addEventListener('click', function () { state.hiAll = true; renderHighs(); });
    var rows = $('[data-hi-rows]');
    rows.addEventListener('click', function (e) { var tr = e.target.closest('[data-ticker]'); if (tr) openDeep(tr.dataset.ticker); });
    rows.addEventListener('keydown', function (e) { var tr = e.target.closest('[data-ticker]'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openDeep(tr.dataset.ticker); } });
    $('[data-earnings]').addEventListener('click', function (e) { var b = e.target.closest('[data-ticker]'); if (b) openDeep(b.dataset.ticker); });
  }

  /* ---------- Supabase 덮어쓰기 ---------- */
  var day = function (s) { return s ? String(s).slice(0, 10).replace(/-/g, '.') : null; };
  function load() {
    if (!sb) return;
    var q = function (p) { return p.then(function (r) { return r; }, function () { return { data: null }; }); };
    Promise.all([
      q(sb.from('global_indices').select('*')),
      q(sb.from('global_research').select('*').eq('kind', 'overnight').order('created_at', { ascending: false }).limit(1)),
      q(sb.from('global_sectors').select('*')),
      q(sb.from('global_highs').select('*').limit(500)),
      q(sb.from('global_deep_research').select('*').limit(500)),
      q(sb.from('global_quotes').select('ticker,name,next_earnings_date').not('next_earnings_date', 'is', null).limit(2000))
    ]).then(function (r) {
      var idx = r[0].data, br = r[1].data, secs = r[2].data, hi = r[3].data, deep = r[4].data, qs = r[5].data;
      if (idx && idx.length) {
        S.indices = {}; idx.forEach(function (x) { S.indices[String(x.symbol).replace(/^\^/, '')] = [+x.price, +x.change_pct]; });
        S.sample.idx = false; S.asof.idx = idx[0].as_of || day(idx[0].updated_at); renderIndices();
      }
      if (br && br.length && br[0].body) {
        var b = br[0].body;
        S.brief = { title: br[0].title, note: b.note || '', asof: b.asof || day(br[0].created_at), rows: (b.rows || []).map(function (x) { return [x.name, parseFloat(x.chg)]; }) };
        S.sample.brief = false; renderBrief();
      }
      if (secs && secs.length) {
        S.sectors = { sector: secs.filter(function (x) { return x.kind === 'sector'; }), theme: secs.filter(function (x) { return x.kind === 'theme'; }) };
        S.sample.sec = false; S.asof.sec = secs[0].asof || day(secs[0].updated_at); renderHeat();
      }
      if (hi && hi.length) {
        S.highs = hi; S.sample.hi = false; S.asof.hi = hi[0].asof || day(hi[0].updated_at);
        S.deep = {}; (deep || []).forEach(function (d) { S.deep[d.ticker] = d; });
        renderHighs();
      }
      if (qs && qs.length) {
        var w = weekRange(S.asof.hi ? S.asof.hi.replace(/\./g, '-') : null);
        S.earnings = qs.filter(function (x) { return x.next_earnings_date >= w[0] && x.next_earnings_date <= w[1]; })
          .map(function (x) { return { ticker: x.ticker, name: x.name, date: x.next_earnings_date }; });
        S.sample.earn = false; renderEarnings();
      }
    }).catch(function (e) { console.warn('[global] Supabase 조회 실패 — 예시 값을 유지해요', e); });
  }

  wire();
  renderIndices(); renderBrief(); renderHeat(); renderHighs(); renderEarnings();
  load();
})();
