// Quant Studio (7-7) — 전략 만들기(다이렉트 인덱싱) · 백테스트 · 내 전략 보관함 · 테마 로테이션 연결
// 불러오기 패턴(9장): 코드 기본값('예시')으로 먼저 그리고 → Supabase 값이 오면 덮어써서 다시 그린다.
(function () {
  'use strict';

  /* ---------- 공통 ---------- */
  var LS_VAULT = 'il.quant-strategies-v1';
  var RHO = 0.5;            // 종목 간 상관계수 가정
  var TURNOVER = 0.3;       // 리밸런싱 1회당 회전율 가정
  var SAMPLE = '<span class="badge badge--sample">예시</span>';

  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { var a = hash(String(seed)); return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function gauss(r) { var u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  var norm = function (s) { return String(s || '').replace(/[\s·/()]/g, '').toLowerCase(); };
  var pct = function (v, dec) { return fmt(v, dec == null ? 1 : dec) + '%'; };
  // DB 값이 소수(0.12)인지 퍼센트(12)인지 모를 때 퍼센트로 맞춘다
  var asPct = function (v) { var n = +v; return !isFinite(n) ? null : Math.abs(n) <= 1.5 ? n * 100 : n; };
  function readLS(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } }
  function writeLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  /* ---------- 코드 기본값 (예시 · 가상 종목) ---------- */
  // 7-5 테마 기본값과 같은 이름. 종목은 실제 종목이 아닌 가상 이름이에요.
  var DEF_THEMES = [
    ['AI 반도체', 14, 34, ['HBM 메모리', '반도체 장비', '설계 IP', '패키징 소재', '테스트 소켓', '검사 장비']],
    ['전력기기', 12, 30, ['변압기', '전선', '배전반', '전력 반도체', '케이블 소재']],
    ['조선', 10, 31, ['대형 조선', 'LNG선', '기자재', '엔진']],
    ['방산', 11, 28, ['유도무기', '지상장비', '항공 부품', '방산 전자']],
    ['바이오', 9, 38, ['CDMO', '항체 신약', '진단 키트', '바이오 소재', '의료기기']],
    ['2차전지', 6, 42, ['양극재', '음극재', '전해액', '분리막', '셀 장비']],
    ['금융/배당', 8, 18, ['은행 지주', '보험', '증권', '리츠']],
    ['엔터', 7, 36, ['기획사', '콘텐츠 제작', '공연 플랫폼']],
    ['로봇', 5, 40, ['협동로봇', '감속기', '서비스 로봇', '로봇 SW']]
  ];
  function defaultUniverse() {
    var stats = {}, themes = DEF_THEMES.map(function (t, ti) {
      var r = rng('theme:' + t[0]);
      var stocks = t[3].map(function (label, i) {
        var code = 'V' + (ti * 10 + i + 101);
        var cagr = t[1] + gauss(r) * 5, vol = t[2] + gauss(r) * 6;
        stats[code] = {
          code: code, name: label + ' ' + 'ABCDEF'.charAt(i) + '사(가상)',
          cagr: +cagr.toFixed(1), vol: +Math.max(14, vol).toFixed(1), div: +Math.max(0, (t[0] === '금융/배당' ? 4.2 : 1.1) + gauss(r) * 0.7).toFixed(1),
          mdd: +(-Math.min(75, vol * 1.25 + r() * 12)).toFixed(1), idio_share: +(45 + r() * 35).toFixed(0),
          mcap_bil: Math.round((6 - i) * (800 + r() * 2400))
        };
        return code;
      });
      return { name: t[0], codes: stocks };
    });
    return { themes: themes, stats: stats, sample: true, asof: null };
  }

  var DEF_FACTORS = [
    { id: 'momentum', name: '모멘텀', desc: '최근 12개월(직전 1개월 제외) 수익률 상위', mu: 0.0105, beta: 1.05, sd: 0.024 },
    { id: 'value', name: '밸류', desc: 'PBR·PER 하위(저평가) 종목', mu: 0.0078, beta: 0.95, sd: 0.021 },
    { id: 'quality', name: '퀄리티', desc: 'ROE 높고 부채비율 낮은 종목', mu: 0.0088, beta: 0.85, sd: 0.014 },
    { id: 'lowvol', name: '저변동성', desc: '최근 1년 변동성 하위 종목', mu: 0.0072, beta: 0.65, sd: 0.012 },
    { id: 'dividend', name: '배당', desc: '배당수익률 상위 · 배당 지속 종목', mu: 0.0075, beta: 0.75, sd: 0.015 },
    { id: 'flow', name: '수급', desc: '외국인·기관 순매수 강도 상위', mu: 0.0092, beta: 1.0, sd: 0.022 }
  ];
  function defaultFactorData() {
    var months = [], end = new Date(2026, 8, 1); // 2026-09 (마지막 완결 월)
    for (var i = 119; i >= 0; i--) { var d = new Date(end.getFullYear(), end.getMonth() - i, 1); months.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'); }
    var rm = rng('market'), mkt = months.map(function () { return 0.0055 + gauss(rm) * 0.048; });
    var series = { market: mkt };
    DEF_FACTORS.forEach(function (f) {
      var r = rng('factor:' + f.id);
      series[f.id] = mkt.map(function (m) { return f.mu + f.beta * (m - 0.0055) + gauss(r) * f.sd; });
    });
    return { meta: DEF_FACTORS.map(function (f) { return { id: f.id, name: f.name, desc: f.desc }; }), months: months, series: series, bench: 'market', benchName: '시장 벤치마크(예시)', sample: true };
  }

  var U = defaultUniverse();          // 전략 만들기 유니버스
  var F = defaultFactorData();        // 백테스트 데이터
  var bubbleNames = DEF_THEMES.map(function (t) { return t[0]; });
  var tearsheets = [];

  /* ---------- 상태 ---------- */
  var params = new URLSearchParams(location.search);
  var state = { theme: null, weights: {}, factors: ['quality', 'lowvol'], lastBt: null };

  /* ---------- 탭 ---------- */
  var tabApi;
  function showPane(key) {
    $$('.q-pane').forEach(function (p) { p.hidden = p.id !== 'pane-' + key; if (!p.hidden) p.classList.add('fade-up'); });
    state.tab = key;
    renderSrc();
    if (key === 'vault') renderVault();
    if (key === 'bt') { drawCurve(); drawYears(); } // 숨겨진 동안은 폭을 잴 수 없어 보일 때 다시 그린다
  }
  function goTab(key) { tabApi.select(key); }

  function renderSrc() {
    var el = $('[data-src]'); if (!el) return;
    var sample = state.tab === 'bt' ? F.sample : state.tab === 'vault' ? false : U.sample;
    el.innerHTML = sample ? SAMPLE + ' <span class="muted">시연용 예시 데이터예요. 데이터가 적재되면 바뀌어요.</span>' :
      state.tab === 'vault' ? '' : '<span class="badge badge--brand">Supabase</span>' + (U.asof && state.tab !== 'bt' ? ' <span class="muted">' + esc(U.asof) + ' 기준</span>' : '');
  }

  /* ---------- ① 전략 만들기 ---------- */
  function themeList() {
    var order = bubbleNames.map(norm);
    return U.themes.filter(function (t) { return t.codes.length >= 3; }).map(function (t) {
      var mcap = t.codes.reduce(function (s, c) { return s + (+U.stats[c].mcap_bil || 0); }, 0);
      return { t: t, bubble: order.indexOf(norm(t.name)) >= 0, mcap: mcap };
    }).sort(function (a, b) { return (b.bubble - a.bubble) || (b.mcap - a.mcap); }).slice(0, 15).map(function (x) { return x.t; });
  }
  function findTheme(name) {
    var n = norm(name), list = themeList();
    return list.filter(function (t) { return norm(t.name) === n; })[0] ||
      list.filter(function (t) { var m = norm(t.name); return m.indexOf(n) >= 0 || n.indexOf(m) >= 0; })[0] || null;
  }

  function renderThemes() {
    var list = themeList();
    if (!state.theme || !findTheme(state.theme)) state.theme = list[0] && list[0].name;
    $('[data-themes]').innerHTML = list.map(function (t) {
      var on = t.name === state.theme;
      return '<button type="button" class="chip' + (on ? ' is-active' : '') + '" aria-pressed="' + on + '" data-theme="' + esc(t.name) + '">' + esc(t.name) + '<span class="q-chip-n">' + t.codes.length + '</span></button>';
    }).join('') || '<p class="muted">구성 종목이 3개 이상인 테마가 아직 없어요.</p>';
  }

  function selectTheme(name, weights) {
    var t = findTheme(name); if (!t) return false;
    state.theme = t.name;
    state.weights = {};
    t.codes.forEach(function (c) { state.weights[c] = weights && weights[c] != null ? +weights[c] : 100 / t.codes.length; });
    normalize();
    renderThemes(); renderWeights(); renderMetrics();
    return true;
  }
  function normalize() {
    var codes = Object.keys(state.weights), sum = codes.reduce(function (s, c) { return s + state.weights[c]; }, 0);
    codes.forEach(function (c) { state.weights[c] = sum > 0 ? state.weights[c] / sum * 100 : 100 / codes.length; });
  }
  // 한 종목 비중을 v%로 두고 나머지를 원래 비율대로 (100-v)%에 맞춘다
  function setWeight(code, v) {
    v = Math.max(0, Math.min(100, v));
    var others = Object.keys(state.weights).filter(function (c) { return c !== code; });
    var rest = others.reduce(function (s, c) { return s + state.weights[c]; }, 0);
    others.forEach(function (c) { state.weights[c] = rest > 0 ? state.weights[c] / rest * (100 - v) : (100 - v) / others.length; });
    state.weights[code] = v;
  }

  function renderWeights() {
    var codes = Object.keys(state.weights);
    $('[data-weights]').innerHTML = codes.map(function (c) {
      var s = U.stats[c], w = state.weights[c];
      return '<li class="q-w" data-code="' + esc(c) + '">' +
        '<div class="q-w__name"><b>' + esc(s.name) + '</b><span class="muted num">CAGR ' + sign(s.cagr, 1) + ' · 변동성 ' + pct(s.vol) + '</span></div>' +
        '<input class="q-range" type="range" min="0" max="100" step="0.5" value="' + w.toFixed(1) + '" aria-label="' + esc(s.name) + ' 비중" style="--p:' + w.toFixed(1) + '%">' +
        '<output class="q-w__val num">' + w.toFixed(1) + '%</output></li>';
    }).join('');
  }
  function syncWeights() {
    $$('.q-w').forEach(function (li) {
      var w = state.weights[li.dataset.code], r = $('input', li);
      if (document.activeElement !== r) r.value = w.toFixed(1);
      r.style.setProperty('--p', w.toFixed(1) + '%');
      $('output', li).textContent = w.toFixed(1) + '%';
    });
  }

  function buildMetrics(weights) {
    var codes = Object.keys(weights).filter(function (c) { return U.stats[c]; });
    var w = codes.map(function (c) { return weights[c] / 100; }), s = codes.map(function (c) { return U.stats[c]; });
    var dot = function (k) { return s.reduce(function (a, x, i) { return a + w[i] * (+x[k] || 0); }, 0); };
    var v2 = 0, sumSig = 0;
    for (var i = 0; i < s.length; i++) { sumSig += w[i] * s[i].vol; for (var j = 0; j < s.length; j++) v2 += w[i] * w[j] * (i === j ? 1 : RHO) * s[i].vol * s[j].vol; }
    var vol = Math.sqrt(v2);
    return { cagr: dot('cagr'), vol: vol, div: dot('div'), mdd: sumSig ? dot('mdd') * vol / sumSig : 0, idio: dot('idio_share') };
  }
  function tile(label, value, cls, cap) {
    return '<div class="q-tile"><span class="q-tile__label">' + label + '</span><b class="q-tile__val num ' + (cls || '') + '">' + value + '</b>' + (cap ? '<span class="q-tile__cap">' + cap + '</span>' : '') + '</div>';
  }
  function renderMetrics() {
    var m = buildMetrics(state.weights);
    state.lastBuild = m;
    $('[data-metrics]').innerHTML =
      tile('예상 CAGR', sign(m.cagr, 1), dirCls(m.cagr), '연 환산') +
      tile('변동성', pct(m.vol), '', '연 환산') +
      tile('배당수익률', pct(m.div), '') +
      tile('MDD', pct(m.mdd), 'down', '최대 낙폭 추정') +
      tile('종목 고유 수익', pct(m.idio, 0), '', '시장으로 설명 안 되는 몫');
  }

  /* ---------- ② 백테스트 ---------- */
  function renderFactors() {
    $('[data-factors]').innerHTML = F.meta.map(function (f) {
      var on = state.factors.indexOf(f.id) >= 0;
      return '<label class="q-factor"><input type="checkbox" name="factor" value="' + esc(f.id) + '"' + (on ? ' checked' : '') + '>' +
        '<span><b>' + esc(f.name) + '</b><small class="muted">' + esc(f.desc || '') + '</small></span></label>';
    }).join('');
  }

  function runBacktest(cfg) {
    var n = Math.min(F.months.length, cfg.years * 12), start = F.months.length - n;
    var months = F.months.slice(start);
    var ids = cfg.factors.filter(function (id) { return F.series[id]; });
    var strat = months.map(function (_m, k) {
      var i = start + k, r = ids.reduce(function (s, id) { return s + (F.series[id][i] || 0); }, 0) / ids.length;
      if (k % cfg.rebal === 0) r -= TURNOVER * 2 * cfg.cost / 10000;
      return r;
    });
    var bench = F.bench && F.series[F.bench] ? F.series[F.bench].slice(start) : null;
    var st = stats(strat, months), bt = bench ? stats(bench, months) : null;
    return { cfg: cfg, months: months, strat: st, bench: bt };
  }
  function stats(rets, months) {
    var v = 1, peak = 1, mdd = 0, curve = [1], years = {};
    rets.forEach(function (r, i) {
      v *= 1 + r; peak = Math.max(peak, v); mdd = Math.min(mdd, v / peak - 1); curve.push(v);
      var y = months[i].slice(0, 4); years[y] = (years[y] == null ? 1 : years[y]) * (1 + r);
    });
    var mean = rets.reduce(function (a, b) { return a + b; }, 0) / rets.length;
    var sd = Math.sqrt(rets.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / (rets.length - 1));
    return {
      curve: curve, cagr: (Math.pow(v, 12 / rets.length) - 1) * 100, vol: sd * Math.sqrt(12) * 100, mdd: mdd * 100,
      sharpe: sd ? mean * 12 / (sd * Math.sqrt(12)) : 0, total: (v - 1) * 100,
      years: Object.keys(years).map(function (y) { return { y: y, r: (years[y] - 1) * 100 }; })
    };
  }

  function renderBt(res) {
    state.lastBt = res;
    var out = $('[data-bt-out]');
    if (!res) { out.innerHTML = '<div class="card"><div class="card__body q-empty">팩터를 하나 이상 골라 주세요.</div></div>'; return; }
    var s = res.strat, b = res.bench, names = res.cfg.factors.map(factorName).join(' + ');
    var ex = b ? s.cagr - b.cagr : null;
    var first = res.months[0].slice(0, 7).replace('-', '.'), last = res.months[res.months.length - 1].slice(0, 7).replace('-', '.');
    out.innerHTML =
      '<div class="q-banner ' + (ex == null ? '' : ex >= 0 ? 'is-up' : 'is-down') + '">' +
        '<div><span class="q-banner__eyebrow">' + esc(names) + ' · ' + first + '–' + last + '</span>' +
        '<b>' + (ex == null ? '벤치마크 데이터가 아직 없어요' : '벤치마크 대비 연 ' + sign(ex, 1, '%p') + (ex >= 0 ? ' 높았어요' : ' 낮았어요')) + '</b></div>' +
        (F.sample ? SAMPLE : '') + '</div>' +
      '<div class="q-metrics q-metrics--4">' +
        tile('CAGR', sign(s.cagr, 1), dirCls(s.cagr), b ? '벤치마크 ' + sign(b.cagr, 1) : '') +
        tile('MDD', pct(s.mdd), 'down', b ? '벤치마크 ' + pct(b.mdd) : '') +
        tile('샤프 지수', fmt(s.sharpe, 2), '', '무위험수익률 0% 가정') +
        tile('변동성', pct(s.vol), '', '연 환산') +
      '</div>' +
      '<div class="card q-chart-card"><div class="card__body">' +
        '<div class="q-chart-head"><h3>누적 수익</h3>' + legend(!!b) + '</div>' +
        '<div class="q-chart" data-curve></div>' +
      '</div></div>' +
      '<div class="card q-chart-card"><div class="card__body">' +
        '<div class="q-chart-head"><h3>연도별 성과</h3>' + legend(!!b) + '</div>' +
        '<div class="q-chart" data-years></div>' +
        '<p class="form-note">' + (res.months.length % 12 ? '첫 해와 마지막 해는 일부 기간만 반영돼요. ' : '') + '리밸런싱마다 회전율 30%·거래비용을 차감했어요.</p>' +
      '</div></div>' +
      '<div class="q-bt__actions">' +
        '<button class="btn btn--secondary" type="button" data-tearsheet>상세 성과 리포트</button>' +
        '<button class="btn btn--primary" type="button" data-save-bt>이 백테스트 저장</button>' +
        '<button class="btn btn--text" type="button" data-table-view>표로 보기</button>' +
      '</div>';
    drawCurve(); drawYears();
  }
  function legend(hasBench) {
    return '<div class="q-legend"><span><i class="q-key q-key--s"></i>전략</span>' + (hasBench ? '<span><i class="q-key q-key--b"></i>' + esc(F.benchName) + '</span>' : '') + '</div>';
  }
  var factorName = function (id) { var f = F.meta.filter(function (x) { return x.id === id; })[0]; return f ? f.name : id; };

  /* SVG 누적 곡선 — 폭은 컨테이너에 맞춰 다시 그린다, 십자선 + 툴팁 */
  var SVGNS = 'http://www.w3.org/2000/svg';
  function drawCurve() {
    var host = $('[data-curve]'), res = state.lastBt; if (!host || !res || !host.clientWidth) return;
    var W = host.clientWidth || 600, H = W < 500 ? 220 : 280, P = { l: 44, r: 16, t: 12, b: 26 };
    var s = res.strat.curve, b = res.bench && res.bench.curve;
    var all = s.concat(b || []), lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    var pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    var x = function (i) { return P.l + i / (s.length - 1) * (W - P.l - P.r); };
    var y = function (v) { return P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b); };
    var path = function (arr) { return arr.map(function (v, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); }).join(''); };
    var ticks = niceTicks(lo, hi, 4), grid = ticks.map(function (t) {
      return '<line class="q-grid" x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + y(t) + '" y2="' + y(t) + '"/><text class="q-axis" x="' + (P.l - 8) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + Math.round((t - 1) * 100) + '%</text>';
    }).join('');
    var yrs = [], ml = res.months;
    ml.forEach(function (m, i) { if (m.slice(5, 7) === '01') yrs.push(i + 1); });
    var step = Math.ceil(yrs.length / (W < 500 ? 4 : 8));
    var xl = yrs.filter(function (_v, k) { return k % step === 0; }).map(function (i) { return '<text class="q-axis" x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="middle">' + ml[i - 1].slice(0, 4) + '</text>'; }).join('');
    host.innerHTML = '<svg width="' + W + '" height="' + H + '" role="img" aria-label="전략과 벤치마크의 누적 수익 곡선">' + grid +
      '<line class="q-base" x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + y(1) + '" y2="' + y(1) + '"/>' + xl +
      (b ? '<path class="q-line q-line--b" d="' + path(b) + '"/>' : '') + '<path class="q-line q-line--s" d="' + path(s) + '"/>' +
      '<g class="q-cross" visibility="hidden"><line y1="' + P.t + '" y2="' + (H - P.b) + '"/><circle r="4" class="q-dot--s"/>' + (b ? '<circle r="4" class="q-dot--b"/>' : '') + '</g>' +
      '<rect class="q-hit" x="' + P.l + '" y="0" width="' + (W - P.l - P.r) + '" height="' + H + '"/></svg><div class="q-tip" hidden></div>';
    var svg = $('svg', host), cross = $('.q-cross', svg), tip = $('.q-tip', host);
    function at(ev) {
      var rect = svg.getBoundingClientRect(), px = ev.clientX - rect.left;
      var i = Math.round((px - P.l) / (W - P.l - P.r) * (s.length - 1)); i = Math.max(0, Math.min(s.length - 1, i));
      cross.setAttribute('visibility', 'visible');
      $('line', cross).setAttribute('x1', x(i)); $('line', cross).setAttribute('x2', x(i));
      var dots = $$('circle', cross); dots[0].setAttribute('cx', x(i)); dots[0].setAttribute('cy', y(s[i]));
      if (b) { dots[1].setAttribute('cx', x(i)); dots[1].setAttribute('cy', y(b[i])); }
      var label = i === 0 ? '시작' : ml[i - 1].slice(0, 7).replace('-', '.');
      tip.hidden = false;
      tip.innerHTML = '<b>' + label + '</b><span><i class="q-key q-key--s"></i>전략 <em class="num">' + sign((s[i] - 1) * 100, 1) + '</em></span>' +
        (b ? '<span><i class="q-key q-key--b"></i>벤치마크 <em class="num">' + sign((b[i] - 1) * 100, 1) + '</em></span>' : '');
      var tx = x(i) + 12; if (tx + 170 > W) tx = x(i) - 182;
      tip.style.left = Math.max(0, tx) + 'px'; tip.style.top = Math.max(0, y(s[i]) - 30) + 'px';
    }
    svg.addEventListener('pointermove', at);
    svg.addEventListener('pointerleave', function () { cross.setAttribute('visibility', 'hidden'); tip.hidden = true; });
  }
  function niceTicks(lo, hi, n) {
    var span = hi - lo, step = Math.pow(10, Math.floor(Math.log10(span / n))), err = span / n / step;
    step *= err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
    var out = []; for (var t = Math.ceil(lo / step) * step; t <= hi; t += step) out.push(+t.toFixed(6));
    return out;
  }

  /* 연도별 성과 — 전략 · 벤치마크 묶음 막대, 막대마다 툴팁 */
  function drawYears() {
    var host = $('[data-years]'), res = state.lastBt; if (!host || !res || !host.clientWidth) return;
    var ys = res.strat.years, bs = res.bench ? res.bench.years : null;
    var W = host.clientWidth || 600, H = 220, P = { l: 44, r: 8, t: 12, b: 26 };
    var vals = ys.map(function (d) { return d.r; }).concat(bs ? bs.map(function (d) { return d.r; }) : []);
    var lo = Math.min(0, Math.min.apply(null, vals)), hi = Math.max(0, Math.max.apply(null, vals));
    var pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
    var y = function (v) { return P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b); };
    var gw = (W - P.l - P.r) / ys.length, bw = Math.max(4, Math.min(18, (gw - 8) / (bs ? 2 : 1) - 2));
    var ticks = niceTicks(lo, hi, 4);
    var html = ticks.map(function (t) { return '<line class="q-grid" x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + y(t) + '" y2="' + y(t) + '"/><text class="q-axis" x="' + (P.l - 8) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + Math.round(t) + '%</text>'; }).join('');
    var bar = function (cx, v, cls, i, who) {
      var y0 = y(0), y1 = y(v), top = Math.min(y0, y1), h = Math.max(1, Math.abs(y1 - y0));
      return '<rect class="q-bar ' + cls + '" x="' + (cx - bw / 2).toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2" data-i="' + i + '" data-who="' + who + '"/>';
    };
    ys.forEach(function (d, i) {
      var cx = P.l + gw * i + gw / 2;
      if (bs) { html += bar(cx - bw / 2 - 1, d.r, 'q-bar--s', i, 's') + bar(cx + bw / 2 + 1, bs[i].r, 'q-bar--b', i, 'b'); }
      else html += bar(cx, d.r, 'q-bar--s', i, 's');
      if (ys.length <= 6 || i % 2 === 0 || W > 560) html += '<text class="q-axis" x="' + cx + '" y="' + (H - 6) + '" text-anchor="middle">' + (W < 500 ? "'" + d.y.slice(2) : d.y) + '</text>';
      html += '<rect class="q-hit" x="' + (P.l + gw * i) + '" y="0" width="' + gw + '" height="' + H + '" data-i="' + i + '"/>';
    });
    html += '<line class="q-base" x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + y(0) + '" y2="' + y(0) + '"/>';
    host.innerHTML = '<svg width="' + W + '" height="' + H + '" role="img" aria-label="연도별 수익률 막대">' + html + '</svg><div class="q-tip" hidden></div>';
    var tip = $('.q-tip', host);
    $$('.q-hit', host).forEach(function (r) {
      r.addEventListener('pointerenter', function () {
        var i = +r.dataset.i, d = ys[i];
        $$('.q-bar', host).forEach(function (b) { b.classList.toggle('is-dim', +b.dataset.i !== i); });
        tip.hidden = false;
        tip.innerHTML = '<b>' + d.y + '년</b><span><i class="q-key q-key--s"></i>전략 <em class="num">' + sign(d.r, 1) + '</em></span>' +
          (bs ? '<span><i class="q-key q-key--b"></i>벤치마크 <em class="num">' + sign(bs[i].r, 1) + '</em></span>' : '');
        var cx = P.l + gw * i + gw / 2 + 14; if (cx + 170 > W) cx -= 196;
        tip.style.left = Math.max(0, cx) + 'px'; tip.style.top = '8px';
      });
      r.addEventListener('pointerleave', function () { tip.hidden = true; $$('.q-bar', host).forEach(function (b) { b.classList.remove('is-dim'); }); });
    });
  }

  function tableView() {
    var res = state.lastBt; if (!res) return;
    var bs = res.bench && res.bench.years;
    openModal('<h2 class="modal__title">연도별 성과 표</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>연도</th><th class="num">전략</th>' + (bs ? '<th class="num">벤치마크</th><th class="num">차이</th>' : '') + '</tr></thead><tbody>' +
      res.strat.years.map(function (d, i) {
        return '<tr><td>' + d.y + '</td><td class="num ' + dirCls(d.r) + '">' + sign(d.r, 1) + '</td>' +
          (bs ? '<td class="num ' + dirCls(bs[i].r) + '">' + sign(bs[i].r, 1) + '</td><td class="num">' + sign(d.r - bs[i].r, 1, '%p') + '</td>' : '') + '</tr>';
      }).join('') + '</tbody></table></div>' + (F.sample ? '<p class="form-note" style="margin-top:12px">예시 데이터로 계산한 값이에요.</p>' : ''), { label: '연도별 성과 표', width: 520 });
  }

  function openTearsheet() {
    var res = state.lastBt; if (!res) return;
    var key = res.cfg.factors.slice().sort().join('+');
    var t = tearsheets.filter(function (x) { return x.url && (x.key === key || x.key === key + ':' + res.cfg.years); })[0];
    if (t) {
      openModal('<h2 class="modal__title">' + esc(t.title || '상세 성과 리포트') + '</h2><iframe class="q-iframe" src="' + esc(t.url) + '" title="상세 성과 리포트" loading="lazy"></iframe>', { label: '상세 성과 리포트', width: 960 });
      return;
    }
    var s = res.strat, b = res.bench, row = function (k, a, c) { return '<tr><th scope="row">' + k + '</th><td class="num">' + a + '</td>' + (b ? '<td class="num">' + c + '</td>' : '') + '</tr>'; };
    openModal('<h2 class="modal__title">상세 성과 리포트</h2><p class="form-note" style="margin-bottom:14px">' + esc(res.cfg.factors.map(factorName).join(' + ')) + ' · 최근 ' + res.cfg.years + '년 · 리밸런싱 ' + rebalName(res.cfg.rebal) + ' · 거래비용 ' + res.cfg.cost + 'bp' +
      (F.sample ? ' ' + SAMPLE : '') + '</p>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th class="num">전략</th>' + (b ? '<th class="num">벤치마크</th>' : '') + '</tr></thead><tbody>' +
      row('누적 수익', sign(s.total, 1), b && sign(b.total, 1)) + row('CAGR', sign(s.cagr, 1), b && sign(b.cagr, 1)) +
      row('변동성', pct(s.vol), b && pct(b.vol)) + row('MDD', pct(s.mdd), b && pct(b.mdd)) + row('샤프 지수', fmt(s.sharpe, 2), b && fmt(b.sharpe, 2)) +
      row('플러스 연도', s.years.filter(function (d) { return d.r > 0; }).length + ' / ' + s.years.length, b && (b.years.filter(function (d) { return d.r > 0; }).length + ' / ' + b.years.length)) +
      '</tbody></table></div><p class="form-note" style="margin-top:12px">서버에서 만든 상세 리포트(tearsheet)가 아직 없어 화면에서 계산한 요약을 보여드려요.</p>', { label: '상세 성과 리포트', width: 560 });
  }
  var rebalName = function (m) { return { 1: '매월', 3: '분기', 6: '반기', 12: '연 1회' }[m] || m + '개월'; };

  function readBtForm() {
    var f = $('[data-bt-form]');
    return {
      factors: $$('input[name=factor]:checked', f).map(function (i) { return i.value; }),
      years: +f.years.value, rebal: +f.rebal.value, cost: Math.max(0, Math.min(100, +f.cost.value || 0))
    };
  }
  function applyBtForm(cfg) {
    var f = $('[data-bt-form]');
    state.factors = cfg.factors.slice(); renderFactors();
    f.years.value = String(cfg.years); f.rebal.value = String(cfg.rebal); f.cost.value = cfg.cost;
  }
  function doBacktest() {
    var cfg = readBtForm(); state.factors = cfg.factors;
    renderBt(cfg.factors.length ? runBacktest(cfg) : null);
  }

  /* ---------- ③ 보관함 — 로그인하면 saved_strategies, 시연이면 이 브라우저 ---------- */
  var user = null;
  function vaultLoad() {
    if (user && sb) return sb.from('saved_strategies').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(function (r) { if (r.error) throw r.error; return r.data || []; })
      .catch(function (e) { console.warn('[quant] 보관함 조회 실패', e); return []; });
    return Promise.resolve(readLS(LS_VAULT, []));
  }
  function vaultAdd(rec) {
    if (user && sb) return sb.from('saved_strategies').insert({ user_id: user.id, kind: rec.kind, title: rec.title, config: rec.config, metrics: rec.metrics })
      .then(function (r) { if (r.error) throw r.error; });
    var list = readLS(LS_VAULT, []);
    rec.id = 'L' + Date.now(); rec.created_at = new Date().toISOString();
    list.unshift(rec); writeLS(LS_VAULT, list.slice(0, 50));
    return Promise.resolve();
  }
  function vaultRemove(id) {
    if (user && sb) return sb.from('saved_strategies').delete().eq('id', id).eq('user_id', user.id).then(function (r) { if (r.error) throw r.error; });
    writeLS(LS_VAULT, readLS(LS_VAULT, []).filter(function (x) { return String(x.id) !== String(id); }));
    return Promise.resolve();
  }
  function save(rec) {
    return vaultAdd(rec).then(function () {
      toast('‘' + rec.title + '’을(를) 보관함에 저장했어요.');
      updateVaultCount();
    }, function (e) { console.warn('[quant] 저장 실패', e); toast('저장하지 못했어요. 잠시 후 다시 시도해 주세요.'); });
  }
  function updateVaultCount() { vaultLoad().then(function (l) { $('[data-vault-count]').textContent = l.length ? l.length : ''; }); }

  function renderVault() {
    $('[data-vault-note]').innerHTML = user ?
      '<p class="muted">' + esc(user.email || '') + ' 계정에 저장된 전략이에요.</p>' :
      '<div class="q-notice"><div><b>시연 모드 · 이 브라우저에만 저장돼요</b><p class="muted">이메일로 로그인하면 계정 보관함(saved_strategies)에 저장돼요.</p></div><button class="btn btn--secondary btn--sm" type="button" data-login>이메일로 로그인</button></div>';
    var host = $('[data-vault]');
    host.innerHTML = '<p class="muted">불러오는 중…</p>';
    vaultLoad().then(function (list) {
      $('[data-vault-count]').textContent = list.length ? list.length : '';
      if (!list.length) { host.innerHTML = '<div class="card"><div class="card__body q-empty">아직 저장한 전략이 없어요. 전략 만들기나 백테스트에서 저장해 보세요.</div></div>'; return; }
      host.innerHTML = list.map(function (x) {
        var m = x.metrics || {}, c = x.config || {}, isBt = x.kind === 'backtest';
        var sub = isBt ? (c.factors || []).map(factorName).join(' + ') + ' · ' + (c.years || '') + '년 · ' + rebalName(c.rebal) : (c.theme || '') + ' · ' + Object.keys(c.weights || {}).length + '종목';
        return '<article class="card q-vcard"><div class="card__body">' +
          '<div class="q-vcard__top"><span class="badge ' + (isBt ? 'badge--brand' : 'badge--point') + '">' + (isBt ? '백테스트' : '다이렉트 인덱싱') + '</span>' +
          '<time class="muted">' + esc(String(x.created_at || '').slice(0, 10).replace(/-/g, '.')) + '</time></div>' +
          '<h3>' + esc(x.title) + '</h3><p class="muted">' + esc(sub) + '</p>' +
          '<dl class="q-vcard__m"><div><dt>CAGR</dt><dd class="num ' + dirCls(m.cagr) + '">' + sign(m.cagr, 1) + '</dd></div><div><dt>MDD</dt><dd class="num">' + pct(m.mdd) + '</dd></div>' +
          '<div><dt>' + (isBt ? '샤프' : '변동성') + '</dt><dd class="num">' + (isBt ? fmt(m.sharpe, 2) : pct(m.vol)) + '</dd></div></dl>' +
          '<div class="q-vcard__act"><button class="btn btn--secondary btn--sm" type="button" data-load="' + esc(x.id) + '">불러오기</button>' +
          '<button class="btn btn--text" type="button" data-del="' + esc(x.id) + '">삭제</button></div>' +
          '</div></article>';
      }).join('');
      host._list = list;
    });
  }
  function loadSaved(x) {
    var c = x.config || {};
    if (x.kind === 'backtest') { applyBtForm(c); goTab('bt'); doBacktest(); }
    else if (selectTheme(c.theme, c.weights)) goTab('build');
    else { toast('저장할 때의 테마를 지금 데이터에서 찾을 수 없어요.'); return; }
    toast('‘' + x.title + '’을(를) 불러왔어요.');
  }

  /* ---------- 테마 로테이션 연결 ---------- */
  function strategyFromTheme(name) {
    if (!selectTheme(name)) { toast('‘' + name + '’ 테마는 아직 전략 종목 목록이 없어요. 위의 테마 칩에서 골라 주세요.'); return; }
    goTab('build');
    $('#studio').scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast('‘' + state.theme + '’ 테마로 전략을 만들어요. 비중을 조절해 보세요.');
  }
  function mountTheme() {
    var host = $('[data-theme-host]');
    if (window.ThemeRotation && ThemeRotation.mount) {
      try { ThemeRotation.mount(host, { onStrategy: strategyFromTheme, strategyLabel: '이 테마로 전략 만들기 →' }); return; }
      catch (e) { console.warn('[quant] 테마 로테이션 연결 실패', e); }
    }
    host.innerHTML = '<div class="card q-theme-ph"><div class="card__body">' +
      '<span class="badge badge--muted">준비 중</span><h3>테마 로테이션 준비 중</h3>' +
      '<p class="muted">버블 차트는 곧 연결돼요. 그 전까지 아래 테마로 바로 전략을 만들 수 있어요.</p>' +
      '<div class="chips">' + bubbleNames.slice(0, 12).map(function (n) { return '<button type="button" class="chip" data-theme-go="' + esc(n) + '">' + esc(n) + ' →</button>'; }).join('') + '</div>' +
      '</div></div>';
  }

  /* ---------- 템플릿 ---------- */
  var TEMPLATES = [
    { kind: 'build', title: 'AI 반도체 동일 비중', desc: 'AI 반도체 테마 구성 종목을 같은 비중으로 담아요.', tags: ['다이렉트 인덱싱', '테마'], theme: 'AI 반도체' },
    { kind: 'backtest', title: '퀄리티 + 저변동성', desc: '이익 체력이 좋고 덜 흔들리는 종목을 분기마다 다시 골라요.', tags: ['백테스트', '10년 · 분기'], cfg: { factors: ['quality', 'lowvol'], years: 10, rebal: 3, cost: 15 } },
    { kind: 'backtest', title: '배당 + 밸류', desc: '배당수익률과 저평가 팩터를 섞어 반기마다 리밸런싱해요.', tags: ['백테스트', '10년 · 반기'], cfg: { factors: ['dividend', 'value'], years: 10, rebal: 6, cost: 15 } }
  ];
  function renderTemplates() {
    $('[data-templates]').innerHTML = TEMPLATES.map(function (t, i) {
      return '<article class="card is-hover q-tpl"><div class="card__body">' +
        '<div class="chips">' + t.tags.map(function (g) { return '<span class="badge badge--muted">' + esc(g) + '</span>'; }).join('') + '</div>' +
        '<h3>' + esc(t.title) + '</h3><p class="muted">' + esc(t.desc) + '</p>' +
        '<button class="btn btn--text" type="button" data-tpl="' + i + '">불러오기 →</button></div></article>';
    }).join('');
  }
  function useTemplate(t) {
    if (t.kind === 'build') { strategyFromTheme(t.theme); return; }
    var ok = t.cfg.factors.filter(function (id) { return F.series[id]; });
    if (!ok.length) { toast('이 템플릿의 팩터 데이터가 아직 없어요.'); return; }
    applyBtForm(Object.assign({}, t.cfg, { factors: ok })); goTab('bt'); doBacktest();
    $('#studio').scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast('‘' + t.title + '’ 설정으로 백테스트했어요.');
  }

  /* ---------- 이벤트 ---------- */
  function wire() {
    tabApi = wireTabsA11y($('[role=tablist]'), showPane);
    $('[data-themes]').addEventListener('click', function (e) { var b = e.target.closest('[data-theme]'); if (b) selectTheme(b.dataset.theme); });
    $('[data-weights]').addEventListener('input', function (e) {
      var li = e.target.closest('.q-w'); if (!li) return;
      setWeight(li.dataset.code, +e.target.value); syncWeights(); renderMetrics();
    });
    $('[data-weights]').addEventListener('change', syncWeights);
    $('[data-equal]').addEventListener('click', function () { selectTheme(state.theme); });
    $('[data-save-form]').addEventListener('submit', function (e) {
      e.preventDefault();
      var m = state.lastBuild, title = e.target.title.value.trim() || state.theme + ' 전략';
      var w = {}; Object.keys(state.weights).forEach(function (c) { w[c] = +state.weights[c].toFixed(2); });
      save({ kind: 'build', title: title, config: { theme: state.theme, weights: w, sample: U.sample }, metrics: { cagr: +m.cagr.toFixed(2), vol: +m.vol.toFixed(2), div: +m.div.toFixed(2), mdd: +m.mdd.toFixed(2) } })
        .then(function () { e.target.reset(); });
    });
    $('[data-bt-form]').addEventListener('submit', function (e) { e.preventDefault(); doBacktest(); });
    $('[data-bt-form]').addEventListener('change', function (e) { if (e.target.name === 'factor') doBacktest(); });
    $('[data-bt-out]').addEventListener('click', function (e) {
      if (e.target.closest('[data-tearsheet]')) openTearsheet();
      else if (e.target.closest('[data-table-view]')) tableView();
      else if (e.target.closest('[data-save-bt]')) {
        var r = state.lastBt;
        save({ kind: 'backtest', title: r.cfg.factors.map(factorName).join(' + ') + ' · ' + r.cfg.years + '년', config: Object.assign({ sample: F.sample }, r.cfg),
          metrics: { cagr: +r.strat.cagr.toFixed(2), mdd: +r.strat.mdd.toFixed(2), sharpe: +r.strat.sharpe.toFixed(2), vol: +r.strat.vol.toFixed(2) } });
      }
    });
    $('#pane-vault').addEventListener('click', function (e) {
      var l = e.target.closest('[data-load]'), d = e.target.closest('[data-del]'), list = $('[data-vault]')._list || [];
      if (e.target.closest('[data-login]')) { openAuth('로그인하면 전략을 계정 보관함에 저장할 수 있어요.'); return; }
      if (l) { var x = list.filter(function (r) { return String(r.id) === l.dataset.load; })[0]; if (x) loadSaved(x); }
      if (d) vaultRemove(d.dataset.del).then(function () { toast('삭제했어요.'); renderVault(); }, function () { toast('삭제하지 못했어요.'); });
    });
    $('[data-theme-host]').addEventListener('click', function (e) { var b = e.target.closest('[data-theme-go]'); if (b) strategyFromTheme(b.dataset.themeGo); });
    $('[data-templates]').addEventListener('click', function (e) { var b = e.target.closest('[data-tpl]'); if (b) useTemplate(TEMPLATES[+b.dataset.tpl]); });
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { drawCurve(); drawYears(); }, 150); });
  }

  function renderAll() {
    renderThemes();
    if (!selectTheme(state.theme)) { $('[data-weights]').innerHTML = ''; }
    state.factors = state.factors.filter(function (id) { return F.series[id]; });
    if (!state.factors.length && F.meta[0]) state.factors = [F.meta[0].id];
    renderFactors(); doBacktest(); renderSrc();
  }

  /* ---------- Supabase 덮어쓰기 ---------- */
  function load() {
    if (!sb) return;
    var q = function (p) { return p.then(function (r) { return r; }, function () { return { data: null }; }); };
    Promise.all([
      q(sb.from('quant_theme_constituents').select('theme_name,code,stock_name,rank,mcap_bil,updated_at').limit(3000)),
      q(sb.from('quant_stock_stats').select('*').limit(5000)),
      q(sb.from('themes').select('name,week_of,concentration').order('week_of', { ascending: false }).order('concentration', { ascending: false }).limit(60)),
      q(sb.from('quant_factor_meta').select('*')),
      q(sb.from('quant_factor_returns').select('factor_id,month,ret').order('month').limit(10000)),
      q(sb.from('quant_tearsheets').select('key,title,factors,period_years,url'))
    ]).then(function (r) {
      var cons = r[0].data, st = r[1].data, th = r[2].data, meta = r[3].data, rets = r[4].data;
      if (th && th.length) { var wk = th[0].week_of; bubbleNames = th.filter(function (t) { return t.week_of === wk; }).map(function (t) { return t.name; }); }
      if (cons && cons.length && st && st.length) {
        var stats = {}, themes = {}, asof = null;
        st.forEach(function (s) {
          if (s.cagr == null || s.vol == null) return;
          stats[s.code] = { code: s.code, name: s.name, cagr: asPct(s.cagr), vol: asPct(s.vol), div: asPct(s.div) || 0, mdd: -Math.abs(asPct(s.mdd) || 0),
            idio_share: s.idio_share == null ? 0 : asPct(s.idio_share), mcap_bil: s.mcap_bil };
        });
        cons.sort(function (a, b) { return (a.rank || 99) - (b.rank || 99); }).forEach(function (c) {
          if (!stats[c.code]) return;
          if (c.stock_name) stats[c.code].name = c.stock_name;
          if (c.mcap_bil != null) stats[c.code].mcap_bil = c.mcap_bil;
          (themes[c.theme_name] = themes[c.theme_name] || []).push(c.code);
          if (c.updated_at && (!asof || c.updated_at > asof)) asof = c.updated_at;
        });
        var list = Object.keys(themes).map(function (n) {
          var codes = themes[n].sort(function (a, b) { return (stats[b].mcap_bil || 0) - (stats[a].mcap_bil || 0); }).slice(0, 10);
          return { name: n, codes: codes };
        }).filter(function (t) { return t.codes.length >= 3; });
        if (list.length) U = { themes: list, stats: stats, sample: false, asof: asof && asof.slice(0, 10).replace(/-/g, '.') };
      }
      if (meta && meta.length && rets && rets.length) {
        var months = Array.from(new Set(rets.map(function (x) { return String(x.month).slice(0, 10); }))).sort();
        var idx = {}; months.forEach(function (m, i) { idx[m] = i; });
        var series = {};
        rets.forEach(function (x) { var s = series[x.factor_id] = series[x.factor_id] || months.map(function () { return 0; }); s[idx[String(x.month).slice(0, 10)]] = +x.ret; });
        Object.keys(series).forEach(function (k) {
          var s = series[k], avg = s.reduce(function (a, b) { return a + Math.abs(b); }, 0) / s.length;
          if (avg > 0.5) series[k] = s.map(function (v) { return v / 100; }); // 퍼센트로 들어온 경우
        });
        var bench = Object.keys(series).filter(function (k) { return /market|kospi|bench/i.test(k); })[0] || null;
        var fm = meta.filter(function (m) { return series[m.factor_id] && m.factor_id !== bench; })
          .map(function (m) { return { id: m.factor_id, name: m.name_ko || m.factor_id, desc: m.description || m.rule || '' }; });
        if (fm.length) {
          F = { meta: fm, months: months, series: series, bench: bench, benchName: bench ? (meta.filter(function (m) { return m.factor_id === bench; })[0] || {}).name_ko || '벤치마크' : '', sample: false };
          state.factors = state.factors.filter(function (id) { return series[id]; });
        }
      }
      if (r[5].data) tearsheets = r[5].data;
      renderAll();
    }).catch(function (e) { console.warn('[quant] Supabase 조회 실패 — 예시 값을 유지해요', e); });
  }

  /* ---------- 시작 ---------- */
  wire();
  state.theme = params.get('theme') || null;
  renderAll();
  renderTemplates();
  mountTheme();
  updateVaultCount();
  if (params.get('tab') && /^(build|bt|vault)$/.test(params.get('tab'))) goTab(params.get('tab'));
  else showPane('build');
  if (params.get('theme') && !findTheme(params.get('theme'))) toast('‘' + params.get('theme') + '’ 테마는 아직 전략 종목 목록이 없어요.');
  getUser().then(function (u) { user = u; updateVaultCount(); if (state.tab === 'vault') renderVault(); });
  load();
})();
