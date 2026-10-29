// Home — ○○님 맞춤형 서비스 라운지
// 가입 상담에서 알게 된 고객 분류(신생 운용사·자문사 / 금융사 / 상장 법인 / 일반 법인 / 전문투자자 / WM)별로
// 기존 페이지를 라운지 메뉴로 미리 배치하고, 고객은 순서 · 크기 · 추가 · 빼기로 직접 꾸민다(이 브라우저에 저장).
(function () {
  'use strict';
  var s = IL.session() || {};
  var p = s.profile || {};
  var isWM = s.persona === 'hnw';
  var LS = 'il.lounge-v1';

  /* ---------- 제목 · 맞춤 추천 ---------- */
  $('#hm-main').innerHTML = '<em>' + esc(s.name || '고객') + '</em>님 맞춤형 서비스 라운지';

  var BASIC = [
    { name: '섹터 세미나', href: 'conferences.html#seminar', pillar: '행사', why: ['원하는 섹터로 애널리스트 세미나 요청'] },
    { name: '인뎁스 리포트', href: 'reports.html', pillar: '리서치', why: ['관심 섹터 심층 리포트 모아 보기'] },
    { name: '콥데이', href: 'conferences.html?cat=corp', pillar: '행사', why: ['상장사 경영진과 소규모 미팅'] },
    { name: '카드뉴스', href: '#cardnews', pillar: '리서치', why: ['리포트 핵심을 카드 한 장으로'] }
  ];
  var mine = s.recs && s.recs.length;
  var recs = mine ? s.recs : BASIC;
  $('#hm-recs-meta').textContent = mine
    ? '가입 상담 답변 기준 · ' + [p.company, p.segment, (p.sectors || []).slice(0, 2).join('·')].filter(Boolean).join(' · ')
    : '기본 추천 · 가입 상담을 하면 회사에 맞춰 바뀌어요';
  $('#hm-recs').innerHTML = recs.slice(0, 4).map(function (c, i) {
    return '<li><a href="' + esc(c.href) + '"><span class="hm-recs__top"><span class="hm-recs__rank">' + (i + 1) + '</span><span class="hm-recs__pill">' + esc(c.pillar) + '</span></span>' +
      '<b>' + esc(c.name) + '</b>' + (c.why && c.why.length ? '<small>' + esc(c.why[0]) + '</small>' : '') + '</a></li>';
  }).join('');

  /* ---------- 라운지 메뉴 — 지금 있는 페이지들 ---------- */
  // 선 아이콘 — 24px 격자 · 선 굵기 1.75 · 둥근 끝 (이모지 대신)
  var ICONS = {
    market: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
    stockev: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="m12.5 12.5-2 3h3l-2 3"/>',
    reports: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    conf: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/>',
    seminar: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8M7 12l3-3 2 2 4-4"/>',
    cardnews: '<rect x="7" y="7" width="14" height="14" rx="2"/><path d="M17 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2"/>',
    desk: '<path d="M6 3h12v18l-6-4-6 4z"/>',
    qa: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
    quant: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3"/><path d="M7.5 15h9"/>',
    global: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    theme: '<circle cx="9" cy="14" r="5"/><circle cx="16.5" cy="7.5" r="3.5"/><circle cx="18" cy="16.5" r="2"/>'
  };
  var MODULES = {
    market:   { k: 'RESEARCH', t: '오늘의 시황', d: '국내 · 해외 지수와 업종 흐름, 투자자별 수급', href: 'market.html' },
    stockev:  { k: 'EVENT-DRIVEN', t: '종목 이벤트', d: '공시 · 실적 이벤트와 다가오는 일정', href: 'market.html#stock-events', inst: true },
    reports:  { k: 'REPORTS', t: '리서치 리포트', d: '관심 섹터 심층 리포트 모아 보기 · 저장', href: 'reports.html' + ((p.sectors || [])[0] ? '?q=' + encodeURIComponent(p.sectors[0].replace(/·.*/, '')) : '') },
    conf:     { k: 'EVENTS', t: '행사 · 컨퍼런스', d: '콥데이 · IPO · AI 컨퍼런스 · WM 세미나 신청', href: 'conferences.html' },
    seminar:  { k: 'SEMINAR', t: '세미나 · 탐방 요청', d: '섹터 · 애널리스트를 골라 세미나 · NDR 요청', href: 'conferences.html#seminar' },
    cardnews: { k: 'CARD NEWS', t: '카드뉴스', d: '오늘의 리서치를 카드 한 장으로', href: '#cardnews' },
    desk:     { k: 'MY RESEARCH', t: '나의 리서치 · 신청 내역', d: '저장한 리서치 · 받은 자료 · 행사 신청', href: '#history' },
    qa:       { k: 'Q&A', t: '유리에게 질문', d: '리포트를 근거로 답하는 검수 완료 질문', href: '#qa' },
    quant:    { k: 'QUANT', t: 'Quant Studio', d: '테마로 전략을 만들고 10년 데이터로 검증', href: 'quant.html', inst: true },
    global:   { k: 'GLOBAL', t: '해외 증시', d: '미국 · 아시아 지수, 신고가 · 실적 일정', href: 'global.html' },
    theme:    { k: 'THEME', t: '테마 로테이션', d: '지금 돈이 몰리는 테마와 구성 종목', href: isWM ? 'market.html#theme-rotation' : 'quant.html#theme' }
  };
  // 고객 분류별 추천 구성 — 같은 페이지를 사람마다 다르게 배치 (첫 번째는 넓게)
  var PRESETS = {
    newfin: { label: '신생 운용사·자문사', order: ['reports', 'seminar', 'conf', 'cardnews', 'market', 'qa'], wide: ['reports'] },
    fin:    { label: '금융사', order: ['market', 'stockev', 'reports', 'quant', 'conf', 'global'], wide: ['market'] },
    listed: { label: '상장 법인', order: ['conf', 'seminar', 'reports', 'market', 'stockev', 'desk'], wide: ['conf'] },
    corp:   { label: '일반 법인', order: ['market', 'cardnews', 'reports', 'conf', 'qa', 'global'], wide: ['market'] },
    pro:    { label: '전문투자자', order: ['market', 'stockev', 'quant', 'global', 'theme', 'reports'], wide: ['market'] },
    wm:     { label: 'WM 고객', order: ['cardnews', 'theme', 'conf', 'market', 'qa', 'reports'], wide: ['cardnews'] }
  };
  var cls = p.cls || (isWM ? 'wm' : s.persona === 'dma' ? 'pro' : s.persona === 'ia' ? 'newfin' : s.persona === 'am' ? 'fin' : 'corp');
  var preset = PRESETS[cls] || PRESETS.corp;
  var allowed = function (id) { return MODULES[id] && !(MODULES[id].inst && isWM); };

  var state;
  try { state = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) {}
  if (!state || state.cls !== cls) state = fresh();
  function fresh() { return { cls: cls, order: preset.order.filter(allowed), wide: preset.wide.slice(), custom: false }; }
  function save() { try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) {} }

  var live = {};   // 메뉴 카드의 실시간 한 줄 (Supabase · 행사 데이터)
  var editing = false;

  function render() {
    $('#lg-meta').innerHTML = state.custom
      ? '<b>' + esc(preset.label) + '</b> 구성에서 직접 꾸민 라운지예요'
      : '<b>' + esc(preset.label) + '</b>' + (/고객$/.test(preset.label) ? '' : ' 고객') + '에게 맞춰 준비한 구성이에요 · 원하는 대로 바꿔 보세요';
    // 3열에서 마지막 줄이 비면 마지막 카드를 늘려 채운다
    var spans = state.order.reduce(function (n, id) { return n + (state.wide.indexOf(id) > -1 ? 2 : 1); }, 0), rem = spans % 3;
    var lastId = state.order[state.order.length - 1], fill = rem && state.wide.indexOf(lastId) < 0 ? ' fill-' + (4 - rem) : '';
    $('#lg-grid').innerHTML = state.order.map(function (id, i) {
      var m = MODULES[id], wide = state.wide.indexOf(id) > -1;
      return '<li class="lg-card' + (wide ? ' is-wide' : '') + (id === lastId ? fill : '') + (editing ? ' is-edit' : '') + '" data-id="' + id + '">' +
        '<a href="' + esc(m.href) + '"' + (editing ? ' tabindex="-1"' : '') + '><span class="lg-card__top"><span class="lg-card__ic" aria-hidden="true"><svg viewBox="0 0 24 24">' + ICONS[id] + '</svg></span>' +
        '<span><span class="lg-card__k">' + m.k + '</span><br><span class="lg-card__t">' + esc(m.t) + '</span></span></span>' +
        '<span class="lg-card__d">' + esc(m.d) + '</span>' + (live[id] ? '<span class="lg-card__live">' + live[id] + '</span>' : '') + '</a>' +
        (editing ? '<span class="lg-ctl">' +
          '<button type="button" data-act="left" aria-label="' + esc(m.t) + ' 앞으로"' + (i === 0 ? ' disabled' : '') + '>←</button>' +
          '<button type="button" data-act="right" aria-label="' + esc(m.t) + ' 뒤로"' + (i === state.order.length - 1 ? ' disabled' : '') + '>→</button>' +
          '<button type="button" data-act="size" aria-label="' + esc(m.t) + (wide ? ' 작게' : ' 크게') + '">' + (wide ? '⇲' : '⇱') + '</button>' +
          '<button type="button" data-act="remove" aria-label="' + esc(m.t) + ' 빼기">✕</button></span>' : '') +
        '</li>';
    }).join('');
    var rest = Object.keys(MODULES).filter(function (id) { return allowed(id) && state.order.indexOf(id) < 0; });
    $('#lg-tray-list').innerHTML = rest.map(function (id) { return '<button type="button" data-add="' + id + '">+ ' + esc(MODULES[id].t) + '</button>'; }).join('');
    $('#lg-tray').hidden = !editing;
  }
  function change(fn) { fn(); state.custom = true; save(); render(); }

  $('#lg-edit').addEventListener('click', function () {
    editing = !editing;
    this.setAttribute('aria-pressed', editing);
    this.textContent = editing ? '꾸미기 완료' : '라운지 꾸미기';
    render();
    if (!editing) toast('라운지 구성을 저장했어요.');
  });
  $('#lg-grid').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var id = b.closest('[data-id]').dataset.id, i = state.order.indexOf(id);
    change(function () {
      if (b.dataset.act === 'left' && i > 0) state.order.splice(i - 1, 0, state.order.splice(i, 1)[0]);
      if (b.dataset.act === 'right' && i < state.order.length - 1) state.order.splice(i + 1, 0, state.order.splice(i, 1)[0]);
      if (b.dataset.act === 'size') { var w = state.wide.indexOf(id); if (w > -1) state.wide.splice(w, 1); else state.wide.push(id); }
      if (b.dataset.act === 'remove') state.order.splice(i, 1);
    });
  });
  // #qa 카드는 유리 채팅창을 연다
  $('#lg-grid').addEventListener('click', function (e) {
    var a = e.target.closest('a[href="#qa"]'); if (!a || editing) return;
    e.preventDefault(); if (window.YuriQA) YuriQA.open();
  });
  $('#lg-tray-list').addEventListener('click', function (e) {
    var b = e.target.closest('[data-add]'); if (!b) return;
    change(function () { state.order.push(b.dataset.add); });
  });
  $('#lg-reset').addEventListener('click', function () { state = fresh(); save(); render(); toast(preset.label + ' 추천 구성으로 되돌렸어요.'); });

  /* ---------- 메뉴 카드 실시간 한 줄 ---------- */
  var D = window.IL_EVENTS;
  if (D) {
    var nx = D.EVENTS.filter(function (e) { return !D.isPast(e) && !e.tba; }).sort(function (a, b) { return String(a.start).localeCompare(String(b.start)); })[0];
    if (nx) live.conf = '<span>다음 행사 ' + esc(D.md(nx.start)) + '</span>' + esc(nx.title);
  }
  try {
    var saved = JSON.parse(localStorage.getItem('il.saved-research-v1') || '[]');
    live.desk = '<span>저장한 리서치</span>' + saved.length + '건';
  } catch (e) {}
  render();

  if (!sb) return;
  var q = function (x) { return Promise.resolve(x).catch(function () { return { data: null }; }); };
  var sec = (p.sectors || [])[0];
  Promise.all([
    q(sb.from('market_snapshot').select('snapshot_date,kospi,kospi_chg,kosdaq,kosdaq_chg').order('snapshot_date', { ascending: false }).limit(1)),
    q(sb.from('reports').select('id,title,category,published_at').order('published_at', { ascending: false }).limit(60)),
    q(sb.from('global_indices').select('symbol,name,price,change_pct').in('symbol', ['IXIC', 'GSPC'])),
    q(sb.from('themes').select('name,concentration,ret_1m,week_of').order('week_of', { ascending: false }).order('concentration', { ascending: false }).limit(1)),
    q(sb.from('events').select('name,detail,ref_date').order('ref_date', { ascending: false }).limit(1))
  ]).then(function (r) {
    var m = r[0].data && r[0].data[0];
    if (m) live.market = '<span>' + esc(String(m.snapshot_date).slice(5).replace('-', '.')) + ' 마감</span>KOSPI ' + esc(m.kospi) + ' <b class="' + dirCls(m.kospi_chg) + '">' + esc(m.kospi_chg) + '</b> · KOSDAQ ' + esc(m.kosdaq);
    var rs = r[1].data || [];
    var rp = sec ? rs.filter(function (x) { return (x.title + ' ' + (x.category || '')).indexOf(sec.replace(/·.*/, '')) > -1; })[0] : null;
    rp = rp || rs[0];
    if (rp) live.reports = '<span>' + (sec && rp !== rs[0] ? esc(sec) + ' 최신' : '최신 리포트') + '</span>' + esc(rp.title);
    var g = (r[2].data || []).filter(function (x) { return x.symbol === 'IXIC'; })[0];
    if (g) live.global = '<span>나스닥</span>' + esc(fmt(g.price, 2)) + ' <b class="' + dirCls(g.change_pct) + '">' + esc(sign(g.change_pct)) + '</b>';
    var th = r[3].data && r[3].data[0];
    if (th) live.theme = '<span>자금 집중 1위</span>' + esc(th.name) + ' · 1개월 ' + esc(sign(th.ret_1m));
    var ev = r[4].data && r[4].data[0];
    if (ev) live.stockev = '<span>' + esc(ev.ref_date) + '</span>' + esc(ev.name) + ' · ' + esc(String(ev.detail || '').slice(0, 40));
    render();
  }).catch(function (e) { console.warn('[home] 라운지 데이터 조회 실패 — 설명만 보여 줘요', e); });
})();
