// Home 아래쪽 — 카드뉴스 스크롤 이펙트 · 고객 유형별 섹션 · 이어서 보기 (7-3)
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 카드뉴스 스크롤 이펙트 ---------- */
  // 진행도 0~1: 슬라이드 넘김(0~.45) → 협업 커서(.45~.7) → 데스크 아카이브(.7~1)
  var fx = $('#cardnews-fx'), screen = $('#cnx-screen'), stepEl = $('#cnx-step');
  var deck = null, slide = -1, phase = '';
  var STEPS = {
    slides: '리포트 본문 숫자로 카드를 만들어요. 스크롤하면 카드가 넘어가요.',
    collab: '애널리스트 · AI 요약 · 에디터 · 컴플라이언스가 한 장을 함께 다듬어요.',
    archive: '완성된 카드는 Private Desk 아카이브에 쌓여요.'
  };
  function setDeck(d) {
    deck = d; slide = -1;
    paint(0);
  }
  function paint(p) {
    if (!deck || !window.CardNews) return;
    var n = (deck.slides || []).length || 1;
    var want = Math.min(n - 1, Math.floor(Math.min(p, .449) / .45 * n));
    if (want !== slide) { slide = want; CardNews.render(screen, deck, { slide: slide }); }
    var ph = p < .45 ? 'slides' : p < .7 ? 'collab' : 'archive';
    if (ph !== phase) { phase = ph; fx.setAttribute('data-phase', ph); stepEl.textContent = STEPS[ph]; }
  }
  var sticky = window.matchMedia('(min-width: 1001px)');
  function onScroll() {
    if (!sticky.matches || reduce) { paint(0); fx.setAttribute('data-phase', 'archive'); return; }
    var r = fx.getBoundingClientRect(), total = fx.offsetHeight - window.innerHeight;
    paint(Math.max(0, Math.min(1, -r.top / Math.max(total, 1))));
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  function renderArchive(rows, sample) {
    $('#cnx-archive').innerHTML = rows.slice(0, 4).map(function (r) {
      return '<li><a href="reports.html?id=' + encodeURIComponent(r.id) + '"><b>' + esc(r.title) + '</b><small>' +
        esc([r.category, r.analyst, String(r.published_at || '').replace(/-/g, '.')].filter(Boolean).join(' · ')) +
        (sample ? ' · 예시' : '') + '</small></a></li>';
    }).join('');
  }
  var SAMPLE_ARCHIVE = [
    { id: 'S1', title: '메모리 업황 점검(예시)', category: '반도체', published_at: '2026-10-27' },
    { id: 'S2', title: '11월 주식시장 전망(예시)', category: '투자전략', published_at: '2026-10-28' },
    { id: 'S3', title: '전력기기 수주 동향(예시)', category: '산업', published_at: '2026-10-24' },
    { id: 'S4', title: '배당 시즌 체크리스트(예시)', category: '투자전략', published_at: '2026-10-22' }
  ];
  renderArchive(SAMPLE_ARCHIVE, true);
  if (window.CardNews && CardNews.SAMPLES && CardNews.SAMPLES.length) setDeck(CardNews.normalize(CardNews.SAMPLES[0]).deck);
  onScroll();

  /* ---------- 기관: 퀀트 전환 (예시 곡선) ---------- */
  var qt = $('#quant-teaser');
  if (qt) {
    // 시드 고정 의사난수로 그린 예시 곡선 — 실제 성과가 아님을 화면에 '예시 곡선'으로 표시
    var seed = 7, rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    var line = [], bench = [], v = 0, b = 0;
    for (var i = 0; i <= 40; i++) {
      v += (rnd() - .3) * 9; b += (rnd() - .4) * 6;
      line.push([40 + i * 12.5, v]); bench.push([40 + i * 12.5, b]);
    }
    // 두 선을 같은 눈금으로 그래프 높이(y 60~250)에 맞춘다
    var all = line.concat(bench).map(function (p) { return p[1]; });
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    var y = function (val) { return 250 - (val - lo) / (hi - lo || 1) * 190; };
    var toD = function (pts) { return pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + y(p[1]).toFixed(1); }).join(' '); };
    var lp = $('#qt-line'); lp.setAttribute('d', toD(line)); $('#qt-bench').setAttribute('d', toD(bench));
    lp.style.setProperty('--len', Math.ceil(lp.getTotalLength()));
    if ('IntersectionObserver' in window && !reduce) {
      var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { qt.classList.add('is-in'); io.disconnect(); } }, { threshold: .35 });
      io.observe(qt);
    } else qt.classList.add('is-in');
  }

  /* ---------- WM: 테마 로테이션 ---------- */
  var th = $('#hm-theme');
  if (th && window.ThemeRotation) ThemeRotation.mount(th, { wide: true });

  /* ---------- 이어서 보기 ---------- */
  function md(iso) { var d = new Date(iso); return isNaN(d) ? '' : (d.getMonth() + 1) + '.' + String(d.getDate()).padStart(2, '0'); }
  function renderQuestions() {
    var list = [];
    try { list = JSON.parse(localStorage.getItem('il.home-questions') || '[]'); } catch (e) {}
    $('#ct-questions').innerHTML = list.length ? list.slice(0, 4).map(function (x) {
      return '<li><button type="button" data-ask="' + esc(x.q) + '">' + esc(x.q) + '</button><time>' + md(x.at) + '</time></li>';
    }).join('') : '<li class="hm-cont__empty">아직 질문한 내용이 없어요. 위에서 유리에게 물어보세요.</li>';
  }
  function renderEvents() {
    var recs = window.ILConf ? ILConf.list() : (function () { try { return JSON.parse(localStorage.getItem('il-conf-records-v1') || '[]'); } catch (e) { return []; } })();
    recs = recs.filter(function (r) { return r.kind === 'apply'; }).slice(-4).reverse();
    $('#ct-events').innerHTML = recs.length ? recs.map(function (r) {
      return '<li><a href="desk.html#events">' + esc(r.title) + '</a><time>' + md(r.at) + ' 신청</time></li>';
    }).join('') : '<li class="hm-cont__empty">신청한 행사가 없어요. <a class="btn btn--text" href="conferences.html">행사 둘러보기 →</a></li>';
  }
  $('#ct-questions').addEventListener('click', function (e) {
    var b = e.target.closest('[data-ask]'); if (!b) return;
    $('#assistant').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    var p = $$('#hh-presets [data-preset]').filter(function (x) { return x.firstChild.textContent === b.dataset.ask; })[0];
    $('#hh-open').click();
    if (p) p.click(); else { $('#hh-input').value = b.dataset.ask; }
  });
  renderQuestions(); renderEvents();
  if (window.ILConf && ILConf.onChange) ILConf.onChange(renderEvents);
  window.HomeFeed = { renderQuestions: renderQuestions };

  /* ---------- Supabase 덮어쓰기 ---------- */
  if (!sb) return;
  var q = function (p) { return Promise.resolve(p).catch(function () { return { data: null }; }); };
  Promise.all([
    q(sb.from('card_news').select('*').order('published_at', { ascending: false }).limit(5)),
    q(sb.from('reports').select('id,title,category,analyst,published_at').order('published_at', { ascending: false }).limit(4))
  ]).then(function (r) {
    var cn = (r[0].data || []).map(CardNews.normalize).filter(function (c) { return (c.deck.slides || []).length; })[0];
    if (cn) setDeck(cn.deck);
    if (r[1].data && r[1].data.length) renderArchive(r[1].data, false);
    onScroll();
  }).catch(function (e) { console.warn('[home] 카드뉴스 · 리포트 조회 실패 — 예시 값을 유지해요', e); });
})();
