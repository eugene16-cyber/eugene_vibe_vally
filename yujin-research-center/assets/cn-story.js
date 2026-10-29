// Home 리서치 카드뉴스 — 스크롤하면 01 시황 → 02 테마 → 03 리포트 카드로 넘어가고(역할별 커서가 따라 움직인다),
// 끝까지 내리면 휴대폰이 'EUGENE CARD NEWS' 보관함(최신 리포트 카드 · 원문 보기)으로 이어진다.
// 좁은 화면 · 움직임 줄이기 설정에서는 스크롤 대신 자동으로 넘기고, 보관함은 아래에 바로 보인다.
(function () {
  'use strict';
  var sec = $('#research');
  if (!sec) return;
  var slides = $('#cns-slides'), steps = $$('.cns__steps li', sec), dots = $$('.cns__dots i', sec), curs = $$('.cns__cur', sec), label = $('#cns-label');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var wide = window.matchMedia('(min-width: 1001px)');
  var LABELS = ['DAILY MARKET · 오늘의 시황', 'THEME · 테마 한 장', 'REPORT · 3분 요약'];
  // 단계마다 커서가 가리키는 자리 (무대 기준 %)
  var POS = [
    { analyst: [14, 24], ai: [84, 30], editor: [16, 70], comp: [84, 80] },
    { analyst: [15, 38], ai: [85, 16], editor: [86, 60], comp: [13, 84] },
    { analyst: [85, 26], ai: [13, 46], editor: [86, 76], comp: [16, 88] }
  ];
  var step = -1, archive = false;
  function go(i) {
    if (i === step) return;
    step = i;
    slides.style.setProperty('--i', i);
    steps.forEach(function (li, k) { li.classList.toggle('is-on', k === i); });
    dots.forEach(function (d, k) { d.classList.toggle('is-on', k === i); });
    if (label) label.textContent = LABELS[i];
    curs.forEach(function (c) { var p = POS[i][c.dataset.c]; c.style.left = p[0] + '%'; c.style.top = p[1] + '%'; });
  }
  function setArchive(on) {
    if (on === archive) return;
    archive = on;
    sec.classList.toggle('is-archive', on);
  }
  function onScroll() {
    if (!wide.matches || reduce) { setArchive(false); return; }
    var r = sec.getBoundingClientRect(), total = sec.offsetHeight - window.innerHeight;
    var p = Math.max(0, Math.min(0.999, -r.top / Math.max(total, 1)));
    // 0~0.75: 카드 세 장, 0.75~1: 보관함
    if (p >= 0.75) { go(2); setArchive(true); }
    else { setArchive(false); go(Math.floor(p / 0.25)); }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  setInterval(function () { if (!wide.matches || reduce) go((step + 1) % 3); }, 3600);
  steps.forEach(function (li, k) {
    li.tabIndex = 0;
    var pick = function () {
      if (wide.matches && !reduce) {
        var total = sec.offsetHeight - window.innerHeight;
        window.scrollTo({ top: sec.offsetTop + total * (k + 0.5) * 0.25, behavior: 'smooth' });
      } else go(k);
    };
    li.addEventListener('click', pick);
    li.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  });
  go(0); onScroll();

  /* ---------- 보관함 — 최신 리포트를 카드뉴스로 ---------- */
  var ART = {
    market: '<path d="M4 34 L16 26 L26 30 L38 16 L50 20 L60 8"/><path d="M4 40h56" opacity=".35"/>',
    theme: '<rect x="8" y="22" width="9" height="18" rx="2"/><rect x="22" y="14" width="9" height="26" rx="2"/><rect x="36" y="8" width="9" height="32" rx="2"/><rect x="50" y="18" width="9" height="22" rx="2"/>',
    report: '<rect x="14" y="6" width="36" height="36" rx="4"/><path d="M22 16h20M22 23h20M22 30h12"/>'
  };
  var TONE = ['navy', 'peri', 'blue', 'white'];
  var KIND = function (r) {
    if (r.kind === 'macro' || /투자전략|시황|매크로|전략|채권/.test(r.category || '')) return 'market';
    if (r.kind === 'company' || r.company) return 'report';
    return 'theme';
  };
  var SAMPLE = [
    { id: 'S1', kind: 'macro', category: '투자전략', title: '11월 주식시장 전망(예시)', published_at: '2026-10-28' },
    { id: 'S2', kind: 'sector', category: '반도체', title: 'AI 반도체, 다음 승부처는 전력(예시)', published_at: '2026-10-27' },
    { id: 'S3', kind: 'company', category: '조선', company: '가상조선', title: '수주 잔고로 본 내년 이익(예시)', published_at: '2026-10-27' },
    { id: 'S4', kind: 'macro', category: '채권', title: 'FOMC 리뷰: 한 박자 쉬고(예시)', published_at: '2026-10-26' }
  ];
  var rows = SAMPLE, sample = true, tab = 'all';
  function md(d) { var x = String(d || '').slice(5).replace('-', '.'); return x; }
  function renderArchive() {
    var list = rows.filter(function (r) { return tab === 'all' || KIND(r) === tab; }).slice(0, 4);
    $('#cna-grid').innerHTML = list.length ? list.map(function (r, i) {
      var k = KIND(r);
      var href = r.url ? esc(r.url) + '" target="_blank" rel="noopener' : 'reports.html?id=' + encodeURIComponent(r.id);
      return '<article class="cna__card cna__card--' + TONE[i % 4] + '">' +
        '<p class="cna__meta">' + esc([r.category, r.company, md(r.published_at)].filter(Boolean).join(' · ')) + '</p>' +
        '<h4>' + esc(r.title) + '</h4>' +
        '<div class="cna__art cna__art--' + k + '" aria-hidden="true"><svg viewBox="0 0 64 48">' + ART[k] + '</svg></div>' +
        '<a class="cna__go" href="' + href + '">원문 보기 →</a></article>';
    }).join('') : '<p class="cna__empty">이 분류의 카드뉴스가 아직 없어요.</p>';
  }
  wireTabsA11y($('#cna-tabs'), function (k) { tab = k; renderArchive(); });
  renderArchive();

  // 첫 카드(최신 국내 마감) · 보관함(최신 리포트)
  if (!window.sb) return;
  sb.from('reports').select('id,kind,category,company,title,published_at,url').order('published_at', { ascending: false }).limit(40)
    .then(function (r) { if (r.data && r.data.length) { rows = r.data; sample = false; renderArchive(); } }, function () {});
  sb.from('market_snapshot').select('snapshot_date,kospi,kospi_chg,usdkrw,usdkrw_chg,strong_sectors,weak_sectors')
    .order('snapshot_date', { ascending: false }).limit(1).then(function (r) {
      var d = r.data && r.data[0]; if (!d) return;
      var dt = new Date(d.snapshot_date + 'T00:00:00'), DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      var st = (d.strong_sectors || [])[0] || {}, wk = (d.weak_sectors || [])[0] || {};
      $('#cnc-date').textContent = 'EUGENE DAILY · ' + (dt.getMonth() + 1) + '.' + String(dt.getDate()).padStart(2, '0') + ' ' + DOW[dt.getDay()];
      $('#cnc-daily').innerHTML = [
        'KOSPI ' + esc(d.kospi) + ' (' + esc(d.kospi_chg) + ')',
        '강세 ' + esc(st.name || '-') + ' · 약세 ' + esc(wk.name || '-'),
        'USD/KRW ' + esc(d.usdkrw) + ' (' + esc(d.usdkrw_chg) + ')'
      ].map(function (x) { return '<li>' + x + '</li>'; }).join('');
    }, function () {});
})();
