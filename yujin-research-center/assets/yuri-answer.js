// 근거형 Q&A 결과 화면 — 왼쪽 답변 카드(요약 · 근거 항목 · 종목/테마 태그) + 오른쪽 원문 패널(본문 하이라이트 · 이전/다음 · PDF 원본)
// 태그는 Supabase(themes · theme_constituents · stocks)로 찾고, 누르면 오른쪽 패널에 종목 · 테마 정보를 보여 준다.
// yuri-qa.js가 YuriAnswer.loading / YuriAnswer.show 로 부른다.
(function () {
  'use strict';
  var md = function (d) { return String(d || '').slice(0, 10).replace(/-/g, '.'); };
  var pct = function (v) { return v == null || v === '' ? '-' : sign(v); };
  var cap = function (b) { return b == null ? '-' : b >= 10000 ? (Math.round(b / 1000) / 10).toLocaleString('ko-KR') + '조 원' : Math.round(b).toLocaleString('ko-KR') + '억 원'; };
  var STATE = { Leadership: '주도', Acceleration: '가속', Emerging: '부상', Crowded: '과열 주의', Cooling: '둔화', Reversal: '반전 시도' };

  /* ---------- 태그 재료 (한 번만 불러온다) ---------- */
  var latest = function (rows) { var w = rows.reduce(function (m, r) { return r.week_of > m ? r.week_of : m; }, ''); return rows.filter(function (r) { return r.week_of === w; }); };
  var themesP = window.sb ? sb.from('themes').select('name,concentration,ret_1m,state,week_of').order('week_of', { ascending: false }).limit(60)
    .then(function (r) { return latest(r.data || []); }, function () { return []; }) : Promise.resolve([]);
  var consP = window.sb ? sb.from('theme_constituents').select('theme_name,stock_name,stock_code,ret_1d,ret_1w,week_of').order('week_of', { ascending: false }).limit(600)
    .then(function (r) { return latest(r.data || []); }, function () { return []; }) : Promise.resolve([]);
  var themeKeys = function (name) { return String(name).split(/[\s/()·,＆&]+/).filter(function (w) { return w.length >= 2; }); };

  function findTags(m) {
    var text = [m.q, m.lead].concat(m.docs.map(function (d) { return [d.title, d.company, d.category, d.summary].join(' '); })).join(' ');
    return Promise.all([themesP, consP]).then(function (res) {
      var themes = res[0], cons = res[1], stocks = [], th = [];
      var addStock = function (n) { if (n && stocks.indexOf(n) < 0 && stocks.length < 3) stocks.push(n); };
      m.docs.forEach(function (d) { if (d.company) addStock(d.company); });
      cons.forEach(function (c) { if (text.indexOf(c.stock_name) > -1) addStock(c.stock_name); });
      themes.forEach(function (t) { if (th.length < 3 && themeKeys(t.name).some(function (k) { return text.indexOf(k) > -1; })) th.push(t.name); });
      // 태그한 종목이 속한 테마도 함께
      cons.forEach(function (c) { if (th.length < 3 && stocks.indexOf(c.stock_name) > -1 && th.indexOf(c.theme_name) < 0) th.push(c.theme_name); });
      // 종목 태그는 상장 종목 DB(stocks)에 있는 것만 — 비상장 · IPO 예정사는 뺀다
      var listed = stocks.length && window.sb ? sb.from('stocks').select('name').in('name', stocks).then(function (r) { return (r.data || []).map(function (x) { return x.name; }); }, function () { return []; }) : Promise.resolve([]);
      return listed.then(function (ok) {
        return stocks.filter(function (n) { return ok.indexOf(n) > -1; }).map(function (n) { return { kind: 'stock', name: n }; })
          .concat(th.map(function (n) { return { kind: 'theme', name: n }; }));
      });
    });
  }

  /* ---------- 원문 하이라이트 ---------- */
  function sentences(t) { return String(t || '').replace(/\s+/g, ' ').split(/(?<=[.다요])\s+/).filter(function (x) { return x.length > 6; }); }
  function bestSentence(d, tk) {
    var ss = sentences(d.summary); if (!ss.length) return '';
    return ss.map(function (x) { return { x: x, n: tk.filter(function (w) { return x.indexOf(w) > -1; }).length }; }).sort(function (a, b) { return b.n - a.n; })[0].x;
  }
  function markWords(h, tk) { tk.forEach(function (w) { if (w.length >= 2) h = h.split(esc(w)).join('<b class="yqa__w">' + esc(w) + '</b>'); }); return h; }

  /* ---------- 화면 ---------- */
  var state = null;
  function loading(host, q, voice) {
    host.hidden = false;
    host.innerHTML = '<div class="yqa__grid is-solo"><article class="yqa__card"><p class="yqa__q">' + (voice ? '<span class="yqa__voice">🎙 음성</span>' : '') + 'Q. ' + esc(q) + '</p>' +
      '<p class="yqa__wait"><i></i><i></i><i></i> 원문에서 근거를 찾고 있어요</p></article></div>';
  }

  function show(host, m) {
    var docs = m.docs, ai = m.ai && m.ai.answer ? m.ai : null;
    if (!docs.length) {
      host.innerHTML = '<div class="yqa__grid is-solo"><article class="yqa__card"><p class="yqa__q">Q. ' + esc(m.q) + '</p>' +
        '<p class="yqa__lead">지금 발간된 리포트에서는 이 질문의 근거를 찾지 못했어요.</p><p class="yqa__note">섹터나 종목 이름을 넣어 다시 물어봐 주세요.</p></article></div>';
      return '이 질문의 근거를 찾지 못했어요.';
    }
    // 근거 항목 — AI가 준 항목이 있으면 그대로, 없으면 원문에서 가장 가까운 문장으로
    var points = ai && Array.isArray(ai.points) && ai.points.length ? ai.points.slice(0, 3).map(function (p) {
      var c = Math.min(Math.max(+p.cite || 1, 1), docs.length);
      return { title: String(p.title || docs[c - 1].title), detail: String(p.detail || ''), cite: c, fit: /부분/.test(p.fit) ? '부분 유효' : '유효' };
    }) : docs.map(function (d, i) { return { title: d.title, detail: bestSentence(d, m.tokens), cite: i + 1, fit: i === 0 ? '유효' : '부분 유효' }; });
    var lead = ai ? ai.answer : '관련 리포트 원문에서 질문과 가장 가까운 내용을 골랐어요. 근거 항목을 누르면 오른쪽에 원문이 열려요.';
    var asof = docs.map(function (d) { return d.published_at; }).sort().pop();
    var badge = m.preset ? '<span class="yqa__badge is-ok">검수 완료</span><span>' + esc(m.preset.tag) + ' 담당 애널리스트 검수 · 자료 기준 ' + md(asof) + '</span>'
      : ai ? '<span class="yqa__badge is-ai">AI 답변</span><span>원문 근거 기반 · 검수 전 · 자료 기준 ' + md(asof) + '</span>'
      : '<span class="yqa__badge">원문 검색</span><span>자료 기준 ' + md(asof) + (m.sample ? ' · 예시 리포트' : '') + '</span>';
    state = { docs: docs, tokens: m.tokens, quotes: points.reduce(function (o, p) { (o[p.cite - 1] = o[p.cite - 1] || []).push(p.detail); return o; }, {}), cur: 0, host: host };

    host.innerHTML = '<div class="yqa__tagbar" aria-label="관련 종목 · 테마"></div><div class="yqa__grid">' +
      '<article class="yqa__card">' +
        '<p class="yqa__q">' + (m.voice ? '<span class="yqa__voice">🎙 음성</span>' : '') + 'Q. ' + esc(m.q) + '</p>' +
        '<p class="yqa__meta">' + badge + '</p>' +
        '<p class="yqa__lead">' + esc(lead).replace(/\[(\d)\]/g, '<sup>[$1]</sup>') + '</p>' +
        '<ol class="yqa__pts">' + points.map(function (p) {
          var d = docs[p.cite - 1];
          return '<li><div class="yqa__pt-h"><b>' + esc(p.title) + '</b><em class="yqa__fit' + (p.fit === '유효' ? ' is-ok' : '') + '">' + p.fit + '</em></div>' +
            (p.detail ? '<p>' + esc(p.detail) + '</p>' : '') +
            '<button type="button" class="yqa__src" data-doc="' + (p.cite - 1) + '">' + esc(d.title) + ' · ' + md(d.published_at) + ' ↗</button></li>';
        }).join('') + '</ol>' +
        '<div class="yqa__foot"><span>근거 칩을 누르면 리포트 원문이 옆에 열려요 · 정보 제공용이며 투자 권유가 아니에요</span>' +
        '<button type="button" class="yqa__go" data-doc="0">원문과 함께 보기 →</button></div>' +
      '</article>' +
      '<aside class="yqa__view" aria-label="원문 근거"></aside>' +
    '</div>';
    openDoc(0);
    findTags({ q: m.q, lead: lead, docs: docs }).then(function (tags) {
      var el = $('.yqa__tagbar', host); if (!el || !tags.length) return;
      el.innerHTML = '<span class="yqa__tags-k">관련 종목 · 테마</span>' + tags.map(function (t) {
        return '<button type="button" class="yqa__tag is-' + t.kind + '" data-tag="' + esc(t.name) + '" data-kind="' + t.kind + '">' + (t.kind === 'stock' ? '종목 ' : '테마 ') + '#' + esc(t.name) + '</button>';
      }).join('');
    });
    return lead.replace(/\[\d\]/g, '');
  }

  function viewEl() { return state && $('.yqa__view', state.host); }
  function openDoc(i) {
    var v = viewEl(); if (!v) return;
    var d = state.docs[i]; state.cur = i;
    $('.yqa__grid', state.host).classList.remove('is-solo');
    var qs = state.quotes[i] || [], best = bestSentence(d, state.tokens);
    var body = sentences(d.summary).map(function (x) {
      var hit = x === best || qs.some(function (q) { return q && (x.indexOf(q.slice(0, 18)) > -1 || q.indexOf(x.slice(0, 18)) > -1); });
      var h = markWords(esc(x), state.tokens);
      return hit ? '<mark>' + h + '</mark>' : h;
    }).join(' ');
    v.innerHTML = '<div class="yqa__vh"><div><b>' + esc(d.title) + '</b><span>' + esc([md(d.published_at), d.category, d.company, d.analyst].filter(Boolean).join(' · ')) + '</span></div>' +
      '<button type="button" class="yqa__x" data-close aria-label="원문 닫기">✕</button></div>' +
      '<div class="yqa__vnav"><button type="button" data-step="-1" aria-label="이전 근거"' + (i === 0 ? ' disabled' : '') + '>‹</button>' +
      '<span>근거 ' + (i + 1) + ' / ' + state.docs.length + '</span>' +
      '<button type="button" data-step="1" aria-label="다음 근거"' + (i === state.docs.length - 1 ? ' disabled' : '') + '>›</button>' +
      (d.url ? '<a href="' + esc(d.url) + '" target="_blank" rel="noopener">PDF 원본 ↗</a>' : '<a href="reports.html?id=' + encodeURIComponent(d.id) + '">리포트 상세 →</a>') + '</div>' +
      '<div class="yqa__vbody"><p>' + (body || '본문 요약이 없어요.') + '</p>' +
      '<p class="yqa__note">원문 요약 기준이에요. 전체 내용은 PDF 원본에서 확인해 주세요.</p></div>';
    var mk = $('mark', v); if (mk) mk.scrollIntoView({ block: 'nearest' });
  }

  // 기간 수익률 막대 — [이름, 값(%)] 목록을 0선 기준으로 그린다
  function bars(items) {
    var vals = items.map(function (x) { return +x[1] || 0; });
    var up = Math.max.apply(null, vals.concat([0])), dn = -Math.min.apply(null, vals.concat([0])), span = (up + dn) || 1;
    var W = 320, PH = 96, top = 20, mid = top + PH * up / span, H = top + PH + 38, bw = Math.min(40, (W - 20) / items.length - 12);
    var g = items.map(function (x, i) {
      var v = +x[1] || 0, h = Math.abs(v) / span * PH, cx = 10 + (i + .5) * (W - 20) / items.length, pos = v >= 0;
      return '<rect x="' + (cx - bw / 2).toFixed(1) + '" y="' + (pos ? mid - h : mid).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(h, 1.5).toFixed(1) + '" rx="4" class="' + (pos ? 'up' : 'down') + '"/>' +
        '<text x="' + cx.toFixed(1) + '" y="' + (pos ? mid - h - 6 : mid + h + 14).toFixed(1) + '" class="v ' + (pos ? 'up' : 'down') + '">' + sign(v, 1) + '</text>' +
        '<text x="' + cx.toFixed(1) + '" y="' + (H - 4) + '" class="k">' + esc(x[0]) + '</text>';
    }).join('');
    return '<svg class="yqa__chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="기간 수익률"><line x1="6" x2="' + (W - 6) + '" y1="' + mid.toFixed(1) + '" y2="' + mid.toFixed(1) + '" class="z"/>' + g + '</svg>';
  }

  // 종목 · 테마 정보 (Supabase)
  function openTag(kind, name) {
    var v = viewEl(); if (!v) return;
    $('.yqa__grid', state.host).classList.remove('is-solo');
    var head = function (k, sub) { return '<div class="yqa__vh"><div><b>' + (kind === 'stock' ? '종목 ' : '테마 ') + '#' + esc(name) + '</b><span>' + esc(sub) + '</span></div><button type="button" class="yqa__x" data-close aria-label="닫기">✕</button></div>' +
      '<div class="yqa__vnav"><button type="button" data-back>‹ 원문으로</button><span>' + k + '</span></div>'; };
    v.innerHTML = head('불러오는 중', 'Supabase') + '<div class="yqa__vbody"><p class="yqa__note">정보를 불러오고 있어요…</p></div>';
    var row = function (k, val, cls) { return '<div><span>' + k + '</span><b class="' + (cls || '') + '">' + val + '</b></div>'; };
    Promise.all([themesP, consP]).then(function (res) {
      var themes = res[0], cons = res[1];
      if (kind === 'theme') {
        var t = themes.filter(function (x) { return x.name === name; })[0] || {};
        var members = cons.filter(function (c) { return c.theme_name === name; }).sort(function (a, b) { return (b.ret_1w || 0) - (a.ret_1w || 0); }).slice(0, 8);
        v.innerHTML = head('테마 정보', t.week_of ? md(t.week_of) + ' 주간 기준' : 'Supabase themes') + '<div class="yqa__vbody">' +
          '<div class="yqa__kv">' + row('자금 집중도', t.concentration != null ? t.concentration : '-') + row('1개월 수익률', pct(t.ret_1m), dirCls(t.ret_1m)) + row('상태', STATE[t.state] || t.state || '-') + '</div>' +
          (members.length ? '<p class="yqa__sub">구성 종목 1주 수익률</p>' + bars(members.slice(0, 6).map(function (c) { return [c.stock_name.slice(0, 5), c.ret_1w]; })) +
            '<p class="yqa__sub">구성 종목 · 1주 수익률 순</p><ul class="yqa__list">' + members.map(function (c) {
            return '<li><button type="button" data-tag="' + esc(c.stock_name) + '" data-kind="stock">' + esc(c.stock_name) + '</button><span class="' + dirCls(c.ret_1w) + '">1주 ' + pct(c.ret_1w) + '</span><span class="' + dirCls(c.ret_1d) + '">1일 ' + pct(c.ret_1d) + '</span></li>';
          }).join('') + '</ul>' : '') +
          '<p class="yqa__note">테마 데이터는 정보 제공용이며 투자 권유가 아니에요.</p></div>';
        return;
      }
      var inThemes = cons.filter(function (c) { return c.stock_name === name; }).map(function (c) { return c.theme_name; });
      var q = function (pr) { return Promise.resolve(pr).then(function (r) { return r; }, function () { return { data: null }; }); };
      if (!window.sb) { v.innerHTML = head('종목 정보', '데이터 연결 없음') + '<div class="yqa__vbody"><p class="yqa__note">데이터에 연결할 수 없어요.</p></div>'; return; }
      Promise.all([
        q(sb.from('stocks').select('code,name,sector,market,market_cap_bil,kospi200,kosdaq150,ret_1w,ret_1m,ret_3m,ret_12m,ret_ytd,fwd_pe,fwd_pb').eq('name', name).maybeSingle()),
        q(sb.from('quant_stock_stats').select('cagr,vol,mdd,div,beta_mkt,months').eq('name', name).maybeSingle()),
        q(sb.from('reports').select('id,title,summary,published_at,url').eq('company', name).order('published_at', { ascending: false }).limit(2))
      ]).then(function (r) {
        var s = r[0].data, qs = r[1].data, rp = r[2].data || [];
        if (!s) { v.innerHTML = head('종목 정보', '상장 종목 DB에서 찾지 못했어요') + '<div class="yqa__vbody"><p class="yqa__note">비상장사이거나 이름이 다르게 등록돼 있을 수 있어요.</p></div>'; return; }
        var idx = [s.kospi200 ? 'KOSPI200' : '', s.kosdaq150 ? 'KOSDAQ150' : ''].filter(Boolean).join(' · ');
        var summary = esc(name) + '은(는) ' + esc(s.market || '') + ' ' + esc(s.sector || '') + ' 종목으로 시가총액은 ' + cap(s.market_cap_bil) + '이에요. ' +
          '연초 이후 <b class="' + dirCls(s.ret_ytd) + '">' + pct(s.ret_ytd) + '</b>, 최근 1개월 <b class="' + dirCls(s.ret_1m) + '">' + pct(s.ret_1m) + '</b> 움직였어요.' +
          (qs ? ' 지난 약 ' + Math.round((qs.months || 0) / 12) + '년 월간 기준 연환산 변동성은 ' + fmt(qs.vol * 100, 0) + '%예요.' : '');
        v.innerHTML = head('종목 정보', [s.market, s.sector, String(s.code || '').replace(/^A/, '')].filter(Boolean).join(' · ')) + '<div class="yqa__vbody">' +
          '<p class="yqa__sum">' + summary + '</p>' +
          '<p class="yqa__sub">수익률 흐름 · 기간별 등락</p>' + bars([['1주', s.ret_1w], ['1개월', s.ret_1m], ['3개월', s.ret_3m], ['연초 이후', s.ret_ytd], ['12개월', s.ret_12m]]) +
          '<div class="yqa__kv">' + row('시가총액', cap(s.market_cap_bil)) + row('시장 · 지수', esc(s.market || '-') + (idx ? ' · ' + idx : '')) +
            (qs ? row('연환산 수익률(장기)', sign(qs.cagr * 100, 1), dirCls(qs.cagr)) + row('최대 낙폭', sign(qs.mdd * 100, 1), 'down') + row('시장 베타', fmt(qs.beta_mkt, 2)) + row('배당수익률', fmt(qs.div, 2) + '%') : '') +
            (s.fwd_pe ? row('12개월 선행 PER', fmt(s.fwd_pe, 1) + '배') : '') + '</div>' +
          (rp.length ? '<p class="yqa__sub">이 종목 최근 리포트</p><ul class="yqa__rep">' + rp.map(function (x) {
            return '<li><a href="' + (x.url ? esc(x.url) + '" target="_blank" rel="noopener' : 'reports.html?id=' + encodeURIComponent(x.id)) + '"><b>' + esc(x.title) + '</b><span>' + md(x.published_at) + ' · ' + esc((sentences(x.summary)[0] || '').slice(0, 90)) + '</span></a></li>';
          }).join('') + '</ul>' : '') +
          (inThemes.length ? '<p class="yqa__sub">속한 테마</p><div class="yqa__chips">' + inThemes.map(function (n) { return '<button type="button" class="yqa__tag is-theme" data-tag="' + esc(n) + '" data-kind="theme">테마 #' + esc(n) + '</button>'; }).join('') + '</div>' : '') +
          '<p class="yqa__note">일별 주가 대신 Supabase의 기간 수익률 · 월간 통계로 보여 드려요. 과거 데이터이며 미래 수익을 보장하지 않아요. 정보 제공용이며 투자 권유가 아니에요.</p></div>';
      });
    });
  }

  document.addEventListener('click', function (e) {
    if (!state || !state.host.contains(e.target)) return;
    var d = e.target.closest('[data-doc]'), st = e.target.closest('[data-step]'), tg = e.target.closest('[data-tag]');
    if (d) { openDoc(+d.dataset.doc); if (window.innerWidth < 900) viewEl().scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (st) { openDoc(Math.min(Math.max(state.cur + (+st.dataset.step), 0), state.docs.length - 1)); return; }
    if (tg) {
      Array.prototype.forEach.call(state.host.querySelectorAll('.yqa__tagbar .yqa__tag'), function (b) { b.classList.toggle('is-on', b.dataset.tag === tg.dataset.tag); });
      openTag(tg.dataset.kind, tg.dataset.tag); if (window.innerWidth < 900) viewEl().scrollIntoView({ behavior: 'smooth', block: 'start' }); return;
    }
    if (e.target.closest('[data-back]')) { $$on(); openDoc(state.cur); return; }
    if (e.target.closest('[data-close]')) { $('.yqa__grid', state.host).classList.add('is-solo'); }
  });

  function $$on() { Array.prototype.forEach.call(state.host.querySelectorAll('.yqa__tag.is-on'), function (b) { b.classList.remove('is-on'); }); }

  window.YuriAnswer = { loading: loading, show: show };
})();
