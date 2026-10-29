// 테마 로테이션 모듈 (7-5) — ThemeRotation.mount(host, {wide, onStrategy(name), strategyLabel})
// 코드 기본값('예시')으로 먼저 그리고 Supabase themes · theme_constituents · theme_news · reports가 오면 덮어쓴다.
(function () {
  'use strict';

  var e = function (s) { return window.esc ? window.esc(s) : String(s == null ? '' : s); };
  var sg = function (v) { return window.sign ? window.sign(v, 1) : (v > 0 ? '+' : '') + v + '%'; };
  var dc = function (v) { return v > 0 ? 'up' : v < 0 ? 'down' : ''; };

  var PASTEL = ['#cfe2ff', '#ffd9de', '#d5f2e3', '#fff0c2', '#e6dcff', '#cdeff5', '#ffe2c9', '#e3e8ef'];
  var INK = ['#0b2e6b', '#8a1c2b', '#1d5c3c', '#7a5600', '#4b2c91', '#0f5866', '#8a4300', '#3b4554'];
  var STATE = {
    Leadership: ['주도', '자금과 수익률이 함께 앞서 있는 테마예요.'],
    Acceleration: ['가속', '자금 유입이 빨라지면서 수익률이 따라붙는 구간이에요.'],
    Emerging: ['부상', '규모는 아직 작지만 새로 관심이 모이는 테마예요.'],
    Crowded: ['과열 주의', '자금이 많이 몰려 있어 변동성에 유의할 구간이에요.'],
    Cooling: ['둔화', '관심은 남아 있지만 수익률 탄력이 줄어드는 구간이에요.'],
    Reversal: ['반전 시도', '하락 뒤 방향을 바꾸려는 움직임이 보이는 구간이에요.']
  };

  // 기본값(예시) — 집중도 / 1개월 수익률(%)
  var DEFAULT = [
    ['AI 반도체', 9.4, 14.2, 'Leadership', 62, 30], ['전력기기', 6.1, 11.0, 'Acceleration', 78, 48], ['2차전지', 7.0, -3.2, 'Cooling', 28, 62],
    ['바이오', 4.4, 6.8, 'Emerging', 44, 74], ['방산', 3.6, 8.1, 'Acceleration', 86, 74], ['엔터', 2.8, 4.0, 'Emerging', 14, 30],
    ['조선', 3.2, 9.5, 'Acceleration', 40, 22], ['금융/배당', 5.2, 2.1, 'Crowded', 60, 66], ['로봇', 2.4, -1.5, 'Reversal', 18, 80]
  ].map(function (r) { return { name: r[0], concentration: r[1], ret_1m: r[2], state: r[3], pos_x: r[4], pos_y: r[5] }; });

  function seeded(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  }
  function sampleConstituents(theme) {
    var rnd = seeded(theme);
    return 'ABCDEFGH'.split('').map(function (c) { return { stock_name: '예시 종목 ' + c, stock_code: '', ret_1d: +((rnd() - 0.42) * 8).toFixed(2) }; })
      .sort(function (a, b) { return b.ret_1d - a.ret_1d; });
  }

  /* ---------- 데이터 (페이지 안 모든 인스턴스가 공유) ---------- */
  var data = { sample: true, week: null, themes: DEFAULT, cons: {}, news: {}, reports: [] };
  var loading = null;
  function load() {
    if (loading) return loading;
    var sb = window.sb;
    if (!sb) return (loading = Promise.resolve(data));
    var q = function (p) { return p.then(function (r) { return r; }, function () { return { data: null }; }); };
    loading = q(sb.from('themes').select('name,concentration,ret_1m,state,pos_x,pos_y,week_of').order('week_of', { ascending: false }).order('concentration', { ascending: false }).limit(60))
      .then(function (r) {
        var rows = r && r.data || [];
        if (!rows.length) return data;
        var week = rows[0].week_of;
        rows = rows.filter(function (x) { return x.week_of === week; });
        return Promise.all([
          q(sb.from('theme_constituents').select('theme_name,stock_name,stock_code,ret_1d,ret_1w').eq('week_of', week).limit(1000)),
          q(sb.from('theme_news').select('theme_name,title,url,source,pub_date,summary,rank').order('rank', { ascending: true }).limit(500)),
          q(sb.from('reports').select('id,title,category,company,analyst,published_at').order('published_at', { ascending: false }).limit(400))
        ]).then(function (res) {
          var cons = {}, news = {};
          (res[0].data || []).forEach(function (c) { (cons[c.theme_name] = cons[c.theme_name] || []).push(c); });
          (res[1].data || []).forEach(function (n) { (news[n.theme_name] = news[n.theme_name] || []).push(n); });
          data = { sample: false, week: week, themes: rows, cons: cons, news: news, reports: res[2].data || [] };
          return data;
        });
      })
      .catch(function (err) { console.warn('[IL] 테마 로테이션 데이터를 불러오지 못했어요', err); return data; });
    return loading;
  }

  /* ---------- 버블 배치 ---------- */
  function layout(themes, W, H) {
    var rets = themes.map(function (t) { return +t.ret_1m || 0; });
    var lo = Math.min.apply(null, rets), hi = Math.max.apply(null, rets);
    var rel = rets.map(function (v) { return hi === lo ? 0.75 : 0.45 + 0.55 * (v - lo) / (hi - lo); });
    var sumSq = rel.reduce(function (s, v) { return s + v * v; }, 0);
    var k = Math.sqrt(0.46 * W * H / (Math.PI / 4 * sumSq)); // 원 면적 합 ≈ 영역의 46%
    var GAP = 6;
    var b = themes.map(function (t, i) {
      var r = rel[i] * k / 2;
      r = Math.min(r, H / 2 - 10, W / 2 - 10);
      return { t: t, i: i, r: r,
        x: W * (0.1 + 0.8 * (+t.pos_x || 50) / 100), y: H * (0.1 + 0.8 * (+t.pos_y || 50) / 100) };
    });
    var M = 8; // 선택 테두리가 잘리지 않게 가장자리 여백
    function clamp(c) { c.x = Math.max(c.r + M, Math.min(W - c.r - M, c.x)); c.y = Math.max(c.r + M, Math.min(H - c.r - M, c.y)); }
    b.forEach(clamp);
    for (var it = 0; it < 400; it++) {
      var moved = false;
      for (var a = 0; a < b.length; a++) for (var c = a + 1; c < b.length; c++) {
        var p = b[a], q = b[c], dx = q.x - p.x, dy = q.y - p.y, d = Math.sqrt(dx * dx + dy * dy) || 0.01, min = p.r + q.r + GAP;
        if (d < min) {
          var push = (min - d) / 2, ux = dx / d, uy = dy / d;
          if (d === 0.01) { ux = Math.cos(a + c); uy = Math.sin(a + c); }
          p.x -= ux * push; p.y -= uy * push; q.x += ux * push; q.y += uy * push;
          clamp(p); clamp(q); moved = true;
        }
      }
      if (!moved) break;
    }
    return b;
  }

  var shortName = function (n) { return String(n).replace(/\s*[\(（].*?[\)）]\s*/g, '').trim() || n; };
  var tokens = function (n) {
    return String(n).split(/[\s\(\)（）\/·,&＆]+/).filter(function (w) { return w.length >= 2 && !/^(등|관련|테마)$/.test(w); });
  };

  /* ---------- mount ---------- */
  function mount(host, opts) {
    if (!host) return null;
    opts = opts || {};
    var sel = null, tab = 'cons', resizeT;
    host.classList.add('theme-rot');
    if (opts.wide) host.classList.add('theme-rot--wide');
    host.innerHTML =
      '<div class="theme-split">' +
        '<div class="theme-stage-wrap">' +
          '<div class="theme-stage" role="group" aria-label="테마 버블"></div>' +
          '<div class="theme-tip" role="tooltip" hidden></div>' +
          '<p class="theme-legend"><span>버블 크기 = 1개월 수익률 · 색 = 테마 구분</span><span class="theme-week"></span></p>' +
        '</div>' +
        '<aside class="theme-panel card" aria-live="polite"></aside>' +
      '</div>';
    var stage = host.querySelector('.theme-stage');
    var tip = host.querySelector('.theme-tip');
    var panel = host.querySelector('.theme-panel');

    function draw() {
      var W = stage.clientWidth, H = stage.clientHeight;
      if (!W || !H) return;
      var items = layout(data.themes, W, H);
      stage.innerHTML = items.map(function (c) {
        var t = c.t, d = c.r * 2, ci = c.i % PASTEL.length, small = d < 64;
        return '<button type="button" class="theme-bub' + (small ? ' is-small' : '') + (sel === t.name ? ' is-sel' : '') + '" data-i="' + c.i + '"' +
          ' style="width:' + d.toFixed(1) + 'px;height:' + d.toFixed(1) + 'px;left:' + (c.x - c.r).toFixed(1) + 'px;top:' + (c.y - c.r).toFixed(1) +
          'px;background:' + PASTEL[ci] + ';color:' + INK[ci] + ';font-size:' + Math.max(11, Math.min(17, d / 7.5)).toFixed(1) + 'px"' +
          ' aria-pressed="' + (sel === t.name) + '" aria-label="' + e(t.name) + ', 1개월 ' + e(sg(t.ret_1m)) + ', 집중도 ' + e(t.concentration) + '">' +
          '<span class="theme-bub__n">' + e(shortName(t.name)) + '</span>' +
          (small ? '' : '<span class="theme-bub__r">' + e(sg(t.ret_1m)) + '</span>') + '</button>';
      }).join('');
      host.querySelector('.theme-week').innerHTML = data.sample ? '<span class="badge badge--sample">예시</span>' :
        (data.week ? String(data.week).replace(/-/g, '.') + ' 기준' : '');
    }

    function showTip(btn) {
      var t = data.themes[+btn.dataset.i];
      tip.innerHTML = '<b>' + e(t.name) + '</b><span>자금 집중도 ' + e(t.concentration) + '</span><span>1개월 수익률 <em class="' + dc(+t.ret_1m) + '">' + e(sg(t.ret_1m)) + '</em></span>';
      tip.hidden = false;
      var sr = stage.getBoundingClientRect(), br = btn.getBoundingClientRect();
      var x = br.left - sr.left + br.width / 2, y = br.top - sr.top;
      tip.style.left = Math.max(70, Math.min(sr.width - 70, x)) + 'px';
      tip.style.top = Math.max(0, y - 8) + 'px';
    }

    function renderPanel() {
      var t = data.themes.filter(function (x) { return x.name === sel; })[0] || data.themes[0];
      if (!t) { panel.innerHTML = '<div class="card__body muted">테마 데이터가 아직 없어요.</div>'; return; }
      var st = STATE[t.state] || [t.state || '-', ''];
      var body = '';
      if (tab === 'cons') {
        var cons = (data.sample ? sampleConstituents(t.name) : (data.cons[t.name] || []).slice())
          .sort(function (a, b) { return (+b.ret_1d || 0) - (+a.ret_1d || 0); }).slice(0, 16);
        body = cons.length ? '<ol class="theme-cons">' + cons.map(function (c) {
          return '<li><span class="theme-cons__n">' + e(c.stock_name) + (c.stock_code ? '<small>' + e(c.stock_code) + '</small>' : '') + '</span>' +
            '<span class="num ' + dc(+c.ret_1d) + '">' + e(sg(c.ret_1d)) + '</span></li>';
        }).join('') + '</ol>' : '<p class="theme-empty">구성 종목 데이터가 아직 없어요.</p>';
      } else if (tab === 'rep') {
        var tk = tokens(t.name);
        var reps = data.reports.filter(function (r) {
          var hay = [r.title, r.category, r.company].join(' ');
          return tk.some(function (w) { return hay.indexOf(w) >= 0; });
        }).slice(0, 6);
        body = reps.length ? '<ul class="theme-reps">' + reps.map(function (r) {
          return '<li><a href="reports.html?id=' + encodeURIComponent(r.id) + '"><b>' + e(r.title) + '</b><span>' +
            e([r.category, r.analyst, String(r.published_at || '').replace(/-/g, '.')].filter(Boolean).join(' · ')) + '</span></a></li>';
        }).join('') + '</ul>' : '<p class="theme-empty">이 테마와 연결된 최근 리포트가 없어요.</p>';
      } else {
        var news = data.news[t.name] || [];
        body = news.length ? (news[0].summary ? '<div class="ai-summary">' + e(news[0].summary) + '</div>' : '') +
          '<ul class="theme-reps">' + news.slice(0, 6).map(function (n) {
            return '<li><a href="' + e(n.url || '#') + '" target="_blank" rel="noopener"><b>' + e(n.title) + '</b><span>' + e([n.source, n.pub_date].filter(Boolean).join(' · ')) + '</span></a></li>';
          }).join('') + '</ul>' : '<p class="theme-empty">이 테마의 뉴스가 아직 없어요.</p>';
      }
      panel.innerHTML =
        '<div class="card__body">' +
          '<div class="theme-panel__eyebrow">SELECTED THEME' + (data.sample ? ' <span class="badge badge--sample">예시</span>' : '') + '</div>' +
          '<h3 class="theme-panel__name">' + e(t.name) + '</h3>' +
          '<p class="theme-panel__desc">' + e(st[1]) + '</p>' +
          '<div class="theme-panel__badges"><span class="badge badge--brand">' + e(t.state || '') + ' · ' + e(st[0]) + '</span>' +
            '<span class="badge badge--' + (+t.ret_1m >= 0 ? 'up' : 'down') + '">1M ' + e(sg(t.ret_1m)) + '</span>' +
            '<span class="badge badge--muted">집중도 ' + e(t.concentration) + '</span></div>' +
          '<div class="tabs theme-tabs" role="tablist" aria-label="테마 상세">' +
            [['cons', '종목·전일'], ['rep', '리포트'], ['news', '뉴스']].map(function (x) {
              return '<button role="tab" type="button" data-tab="' + x[0] + '" aria-selected="' + (tab === x[0]) + '">' + x[1] + '</button>';
            }).join('') + '</div>' +
          '<div class="theme-panel__body fade-up">' + body + '</div>' +
          (opts.onStrategy ? '<button class="btn btn--primary btn--block theme-panel__cta" type="button">' + e(opts.strategyLabel || '이 테마로 전략 만들기 →') + '</button>' : '') +
        '</div>';
      if (window.wireTabsA11y) window.wireTabsA11y(panel.querySelector('.theme-tabs'), function (k) {
        if (k === tab) return; tab = k; renderPanel(); var f = panel.querySelector('[aria-selected=true]'); if (f) f.focus();
      });
      var cta = panel.querySelector('.theme-panel__cta');
      if (cta) cta.addEventListener('click', function () { opts.onStrategy(t.name); });
    }

    function select(name) {
      sel = name; tab = 'cons';
      Array.prototype.forEach.call(stage.querySelectorAll('.theme-bub'), function (b) {
        var on = data.themes[+b.dataset.i].name === name;
        b.classList.toggle('is-sel', on); b.setAttribute('aria-pressed', on);
      });
      renderPanel();
    }

    stage.addEventListener('click', function (ev) {
      var b = ev.target.closest('.theme-bub'); if (b) select(data.themes[+b.dataset.i].name);
    });
    stage.addEventListener('mouseover', function (ev) { var b = ev.target.closest('.theme-bub'); if (b) showTip(b); });
    stage.addEventListener('focusin', function (ev) { var b = ev.target.closest('.theme-bub'); if (b) showTip(b); });
    stage.addEventListener('mouseleave', function () { tip.hidden = true; });
    stage.addEventListener('focusout', function () { tip.hidden = true; });
    var onResize = function () { clearTimeout(resizeT); resizeT = setTimeout(draw, 150); };
    window.addEventListener('resize', onResize);

    function refresh() {
      if (!data.themes.some(function (t) { return t.name === sel; })) sel = data.themes[0] && data.themes[0].name;
      draw(); renderPanel();
    }
    refresh();
    load().then(refresh);

    return {
      select: select,
      themes: function () { return data.themes.map(function (t) { return t.name; }); },
      destroy: function () { window.removeEventListener('resize', onResize); host.innerHTML = ''; }
    };
  }

  window.ThemeRotation = { mount: mount, load: load };
})();
