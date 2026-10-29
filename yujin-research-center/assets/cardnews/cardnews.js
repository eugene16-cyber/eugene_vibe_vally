// 카드뉴스 — deck JSON → 1080×1350 슬라이드 렌더러 + 모달 뷰어 (7-8 · 9장 deck)
// CardNews.render(el, deck, {slide, all}) · CardNews.open(cardRow, {onClose, syncUrl})
// CardNews.SAMPLES = 코드 기본값(예시) 카드뉴스 · CardNews.bucket(category) = 'market'|'industry'|'company'
(function () {
  'use strict';
  var W = 1080, H = 1350;
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var br = function (s) { return esc(s).replace(/\n/g, '<br>'); };
  var toneOf = function (b) {
    if (!b) return '';
    if (b.tone === 'up' || b.tone === 'down') return b.tone;
    var v = String(b.value != null ? b.value : b.chg != null ? b.chg : '').trim();
    return /^\+/.test(v) ? 'up' : /^-/.test(v) ? 'down' : '';
  };
  var signNum = function (v) { var n = parseFloat(String(v).replace(/[^\d.+-]/g, '')); return isFinite(n) ? n : 0; };
  var dot = function (d) { return String(d || '').slice(0, 10).replace(/-/g, '.'); };

  /* ---------- 블록 ---------- */
  var BLOCKS = {
    change: function (b) {
      return '<div class="cnb cnb--change">' + (b.label ? '<div class="cnb__label">' + esc(b.label) + '</div>' : '') +
        '<div class="cnb-change"><span class="cnb-change__from">' + esc(b.from) + '</span><span class="cnb-change__arrow" aria-hidden="true">→</span>' +
        '<span class="cnb-change__to cn-' + toneOf({ tone: b.tone }) + '">' + esc(b.to) + '</span></div>' +
        (b.cap ? '<div class="cnb__cap">' + esc(b.cap) + '</div>' : '') + '</div>';
    },
    bars: function (b) {
      var items = b.items || [];
      var max = Math.max.apply(null, items.map(function (i) { return Math.abs(signNum(i.n)); }).concat([1e-9]));
      return '<div class="cnb cnb--bars">' + (b.label ? '<div class="cnb__label">' + esc(b.label) + '</div>' : '') +
        items.map(function (i) {
          var n = signNum(i.n), t = n > 0 ? 'up' : n < 0 ? 'down' : '';
          return '<div class="cnb-bar"><span class="cnb-bar__name">' + esc(i.name) + '</span>' +
            '<span class="cnb-bar__track"><span class="cnb-bar__fill cn-bg-' + t + '" style="width:' + Math.max(4, Math.abs(n) / max * 100).toFixed(1) + '%"></span></span>' +
            '<span class="cnb-bar__n cn-' + t + '">' + esc(typeof i.n === 'number' ? (n > 0 ? '+' : '') + i.n + (b.unit || '') : i.n) + '</span></div>';
        }).join('') + '</div>';
    },
    stats: function (b) {
      return '<div class="cnb cnb--stats">' + (b.items || []).map(function (i) {
        return '<div class="cnb-stat"><div class="cnb-stat__label">' + esc(i.label) + '</div><div class="cnb-stat__value cn-' + toneOf(i) + '">' + esc(i.value) + '</div>' +
          (i.cap ? '<div class="cnb-stat__cap">' + esc(i.cap) + '</div>' : '') + '</div>';
      }).join('') + '</div>';
    },
    hero: function (b) {
      return '<div class="cnb cnb--hero">' + (b.label ? '<div class="cnb__label">' + esc(b.label) + '</div>' : '') +
        '<div class="cnb-hero__value cn-' + toneOf(b) + '">' + esc(b.value) + '</div>' + (b.cap ? '<div class="cnb__cap">' + esc(b.cap) + '</div>' : '') + '</div>';
    },
    flows: function (b) {
      var items = b.items || ['foreign', 'inst', 'retail'].filter(function (k) { return b[k] != null; })
        .map(function (k) { return { name: { foreign: '외국인', inst: '기관', retail: '개인' }[k], v: b[k] }; });
      return '<div class="cnb cnb--flows">' + (b.label ? '<div class="cnb__label">' + esc(b.label) + '</div>' : '') +
        items.map(function (i) {
          var t = signNum(i.v) > 0 ? 'up' : signNum(i.v) < 0 ? 'down' : '';
          return '<div class="cnb-flow"><span>' + esc(i.name) + '</span><b class="cn-' + t + '">' + esc(i.v) + (b.unit ? '<small>' + esc(b.unit) + '</small>' : '') + '</b></div>';
        }).join('') + '</div>';
    },
    updown: function (b) {
      var col = function (title, arr, t) {
        return '<div class="cnb-ud__col"><div class="cnb-ud__head cn-' + t + '">' + esc(title) + '</div>' + (arr || []).map(function (i) {
          return '<div class="cnb-ud__row"><span>' + esc(i.name) + '</span><b class="cn-' + t + '">' + esc(i.chg) + '</b></div>';
        }).join('') + '</div>';
      };
      return '<div class="cnb cnb--updown">' + col(b.upLabel || '강세', b.up, 'up') + col(b.downLabel || '약세', b.down, 'down') + '</div>';
    },
    list: function (b) {
      return '<ol class="cnb cnb--list">' + (b.items || []).map(function (i, n) {
        return '<li><span class="cnb-list__n">' + String(n + 1).padStart(2, '0') + '</span><div><b>' + esc(i.title) + '</b>' + (i.desc ? '<p>' + esc(i.desc) + '</p>' : '') + '</div></li>';
      }).join('') + '</ol>';
    }
  };

  /* ---------- 슬라이드 ---------- */
  function slideHTML(deck, i) {
    var s = (deck.slides || [])[i] || {}, n = (deck.slides || []).length;
    var series = deck.series || deck.category || deck.team || '리서치';
    var inner;
    if (s.type === 'cover') {
      inner = '<div class="cn-cover">' + (s.date ? '<div class="cn-cover__date">' + esc(s.date) + '</div>' : '') +
        '<h3 class="cn-cover__title">' + br(s.title || deck.title) + '</h3>' +
        (s.sub ? '<p class="cn-cover__sub">' + br(s.sub) + '</p>' : '') +
        (s.stats && s.stats.length ? '<div class="cn-cover__stats">' + s.stats.map(function (st) {
          return '<div class="cn-cover__stat"><span>' + esc(st.label) + '</span><b class="cn-' + toneOf(st) + '">' + esc(st.value) + '</b>' + (st.sub ? '<small>' + esc(st.sub) + '</small>' : '') + '</div>';
        }).join('') + '</div>' : '') + '</div>';
    } else {
      inner = '<div class="cn-content">' + (s.kicker ? '<div class="cn-kicker">' + esc(s.kicker) + '</div>' : '') +
        '<h3 class="cn-title">' + br(s.title) + '</h3>' + (s.sub ? '<p class="cn-sub">' + br(s.sub) + '</p>' : '') +
        '<div class="cn-blocks">' + (s.blocks || []).map(function (b) { return (BLOCKS[b.t] || function () { return ''; })(b); }).join('') + '</div>' +
        (s.disc ? '<p class="cn-disc">본 자료는 정보 제공 목적이며 투자 권유가 아니에요. 투자 판단과 책임은 투자자 본인에게 있어요.</p>' : '') + '</div>';
    }
    return '<div class="cn-slide cn-slide--' + esc(s.type || 'content') + '">' +
      '<div class="cn-glow" aria-hidden="true"></div>' +
      '<div class="cn-top"><b>' + esc(deck.brand || 'EUGENE') + '</b><span>' + esc(series) + '</span><em>' + (i + 1) + ' / ' + n + '</em></div>' +
      inner +
      '<div class="cn-foot"><span>' + esc(deck.source || '자료: 유진투자증권 리서치센터') + '</span><span>' + esc([deck.team, deck.analyst].filter(Boolean).join(' · ')) + '</span></div>' +
      '</div>';
  }

  /* 박스 폭에 맞춰 scale — 프레임마다 ResizeObserver */
  var ro = 'ResizeObserver' in window ? new ResizeObserver(function (es) {
    es.forEach(function (e) { e.target.style.setProperty('--cn-scale', (e.contentRect.width / W).toFixed(4)); });
  }) : null;
  function fit(frame) {
    frame.style.setProperty('--cn-scale', ((frame.clientWidth || W) / W).toFixed(4));
    if (ro) ro.observe(frame);
  }

  function render(el, deck, opts) {
    opts = opts || {};
    deck = parseDeck(deck);
    if (!deck || !(deck.slides || []).length) { el.innerHTML = '<div class="cn-empty">카드뉴스 내용이 아직 없어요.</div>'; return; }
    var idx = opts.all ? deck.slides.map(function (_, i) { return i; }) : [Math.max(0, Math.min(opts.slide || 0, deck.slides.length - 1))];
    el.innerHTML = idx.map(function (i) {
      return '<div class="cn-frame' + (opts.export ? ' cn-frame--export' : '') + '" role="img" aria-label="' + esc((deck.slides[i].title || deck.title || '카드뉴스').replace(/\n/g, ' ')) + ' (' + (i + 1) + '/' + deck.slides.length + ')">' + slideHTML(deck, i) + '</div>';
    }).join('');
    Array.prototype.forEach.call(el.querySelectorAll('.cn-frame'), function (f) { if (!opts.export) fit(f); });
  }

  function parseDeck(d) {
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { return null; } }
    return d && typeof d === 'object' ? d : null;
  }

  /* card_news 행 → 뷰어가 쓰는 형태 */
  function normalize(row) {
    var deck = parseDeck(row.deck) || { slides: [] };
    return {
      id: row.id, sample: !!row.sample,
      title: row.title || deck.title || '카드뉴스',
      category: row.category || deck.category || '',
      team: row.team || deck.team || '', analyst: row.analyst || deck.analyst || '',
      published_at: row.published_at || deck.published_at || '',
      report_url: row.report_url || '', report_id: row.report_id || null,
      deck: deck
    };
  }
  function bucket(category) {
    var c = String(category || '');
    if (/투자전략|시황|전략|매크로/.test(c)) return 'market';
    if (/기업/.test(c)) return 'company';
    return 'industry';
  }
  var BUCKET_LABEL = { market: '시황·전략', industry: '산업·테마', company: '기업 리포트' };

  /* ---------- 모달 뷰어 ---------- */
  function open(row, opts) {
    opts = opts || {};
    if (typeof window.openModal !== 'function') return null;
    var c = normalize(row), deck = c.deck, n = (deck.slides || []).length, cur = 0;
    var toc = (deck.slides || []).map(function (s, i) {
      return '<li><button type="button" data-go="' + i + '"><span class="num">' + String(i + 1).padStart(2, '0') + '</span>' + esc(String(s.kicker || s.title || '').replace(/\n/g, ' ')) + '</button></li>';
    }).join('');
    var m = window.openModal(
      '<div class="cnv">' +
        '<div class="cnv__stage">' +
          '<div class="cnv__frame"></div>' +
          '<div class="cnv__nav">' +
            '<button type="button" class="cnv__arrow" data-step="-1" aria-label="이전 슬라이드">←</button>' +
            '<div class="cnv__dots">' + (deck.slides || []).map(function (_, i) { return '<button type="button" class="cnv__dot" data-go="' + i + '" aria-label="' + (i + 1) + '번 슬라이드"></button>'; }).join('') + '</div>' +
            '<button type="button" class="cnv__arrow" data-step="1" aria-label="다음 슬라이드">→</button>' +
          '</div>' +
          '<p class="sr-only" aria-live="polite" data-live></p>' +
        '</div>' +
        '<aside class="cnv__side">' +
          '<div class="cnv__badges"><span class="badge badge--brand">' + esc(BUCKET_LABEL[bucket(c.category)]) + '</span>' +
            (c.category ? '<span class="badge badge--muted">' + esc(c.category) + '</span>' : '') + (c.sample ? '<span class="badge badge--sample">예시</span>' : '') + '</div>' +
          '<h2 class="cnv__title">' + esc(c.title) + '</h2>' +
          '<p class="cnv__meta">' + esc([c.team, c.analyst].filter(Boolean).join(' · ') || '리서치센터') + '<br><span class="num">' + esc(dot(c.published_at)) + '</span> 발간</p>' +
          '<div class="cnv__toc-h">목차</div><ol class="cnv__toc">' + toc + '</ol>' +
          '<div class="cnv__acts"><button type="button" class="btn btn--primary btn--block" data-save></button>' +
          '<button type="button" class="btn btn--text" data-origin>원문 리포트 보기 →</button></div>' +
        '</aside>' +
      '</div>',
      { label: c.title + ' 카드뉴스', width: 980, onClose: function () {
        document.removeEventListener('keydown', onKey);
        if (opts.syncUrl) syncUrl(null);
        if (opts.onClose) opts.onClose();
      } });
    var box = m.el, frame = box.querySelector('.cnv__frame');

    function go(i) {
      cur = (i + n) % n;
      render(frame, deck, { slide: cur });
      Array.prototype.forEach.call(box.querySelectorAll('.cnv__dot'), function (d, k) { d.setAttribute('aria-current', k === cur ? 'true' : 'false'); });
      Array.prototype.forEach.call(box.querySelectorAll('.cnv__toc button'), function (d, k) { d.classList.toggle('is-on', k === cur); });
      box.querySelector('[data-live]').textContent = (cur + 1) + ' / ' + n + ' 슬라이드';
    }
    function onKey(e) {
      if (/INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1); }
    }
    document.addEventListener('keydown', onKey);
    box.addEventListener('click', function (e) {
      var t = e.target.closest('[data-go],[data-step]');
      if (!t) return;
      if (t.hasAttribute('data-go')) go(+t.getAttribute('data-go')); else go(cur + +t.getAttribute('data-step'));
    });
    // 스와이프
    var sx = null;
    frame.addEventListener('pointerdown', function (e) { sx = e.clientX; });
    frame.addEventListener('pointerup', function (e) {
      if (sx == null) return; var dx = e.clientX - sx; sx = null;
      if (Math.abs(dx) > 40) go(cur + (dx < 0 ? 1 : -1));
    });

    // 저장
    var saveBtn = box.querySelector('[data-save]');
    var paintSave = function () {
      var on = window.ILSaved && window.ILSaved.has('cardnews', c.id);
      saveBtn.textContent = on ? '저장됨 ✓ 나의 리서치' : '나의 리서치에 저장';
      saveBtn.className = 'btn btn--block ' + (on ? 'btn--secondary' : 'btn--primary');
      saveBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    };
    saveBtn.addEventListener('click', function () {
      if (!window.ILSaved) { window.soon && window.soon('저장'); return; }
      var on = window.ILSaved.toggle({ kind: 'cardnews', id: c.id, title: c.title, category: c.category, date: c.published_at });
      paintSave();
      window.toast && window.toast(on ? '나의 리서치에 저장했어요.' : '저장을 취소했어요.');
    });
    paintSave();

    box.querySelector('[data-origin]').addEventListener('click', function () {
      if (c.report_url) window.open(c.report_url, '_blank', 'noopener');
      else if (c.report_id) location.href = 'reports.html?id=' + encodeURIComponent(c.report_id);
      else window.toast && window.toast('예시 카드뉴스라 연결된 원문 리포트가 없어요.');
    });

    if (opts.syncUrl) syncUrl(c.id);
    go(opts.slide || 0);
    return m;
  }
  function syncUrl(id) {
    try {
      var u = new URL(location.href);
      if (id == null) u.searchParams.delete('cn'); else u.searchParams.set('cn', id);
      history.replaceState(history.state, '', u.pathname.split('/').pop() + u.search + u.hash);
    } catch (e) {}
  }

  /* ---------- 코드 기본값(예시) — 가상 수치, card_news에 값이 오면 덮어씀 ---------- */
  var SRC = '자료: 시연용 가상 데이터 (예시)';
  var SAMPLES = [
    { id: 'ex-1', sample: true, title: '10월 마지막 주, 시장 한눈에', category: '투자전략', team: '투자전략', analyst: '가상 애널리스트 A', published_at: '2026-10-28',
      deck: { brand: 'EUGENE', series: 'Weekly Market', source: SRC, team: '투자전략', analyst: '가상 애널리스트 A', slides: [
        { type: 'cover', title: '10월 마지막 주\n시장 한눈에', date: '2026.10.28 · 마감 기준(예시)', stats: [
          { label: 'KOSPI', value: '+1.2%', sub: '가상 지수', tone: 'up' }, { label: 'KOSDAQ', value: '-0.4%', sub: '가상 지수', tone: 'down' }, { label: '원/달러', value: '-3.1원', sub: '가상 환율', tone: 'down' }] },
        { type: 'content', kicker: '이번 주 흐름', title: '대형주 중심의\n완만한 반등', sub: '반도체·전력기기 업종이 지수 상승을 이끌었고, 중소형주는 쉬어 가는 흐름이었어요.', blocks: [
          { t: 'bars', label: '업종별 주간 등락(예시)', unit: '%', items: [{ name: '반도체', n: 4.8 }, { name: '전력기기', n: 3.6 }, { name: '조선', n: 2.1 }, { name: '바이오', n: -1.2 }, { name: '2차전지', n: -2.7 }] }] },
        { type: 'content', kicker: '수급', title: '외국인 순매수 전환', sub: '한 주 동안 투자자별 순매수 합계예요.', blocks: [
          { t: 'flows', unit: '억 원', items: [{ name: '외국인', v: '+8,420' }, { name: '기관', v: '+1,150' }, { name: '개인', v: '-9,310' }] }] },
        { type: 'content', kicker: '다음 주 체크포인트', title: '일정으로 보는\n다음 주', disc: true, blocks: [
          { t: 'list', items: [{ title: '미국 고용 지표 발표', desc: '금리 기대 변화에 따라 성장주 변동성이 커질 수 있어요.' }, { title: '반도체 업종 실적 발표 주간', desc: '가이던스 문구가 업종 분위기를 좌우할 수 있어요.' }, { title: '월말·월초 수급 이벤트', desc: '리밸런싱 물량을 함께 살펴보세요.' }] }] }
      ] } },
    { id: 'ex-2', sample: true, title: '금리와 환율, 이번 주 체크포인트', category: '투자전략', team: '매크로', analyst: '가상 애널리스트 B', published_at: '2026-10-27',
      deck: { brand: 'EUGENE', series: 'Macro Brief', source: SRC, team: '매크로', analyst: '가상 애널리스트 B', slides: [
        { type: 'cover', title: '금리와 환율\n이번 주 체크포인트', date: '2026.10.27(예시)', stats: [{ label: '미 10년물', value: '-8bp', sub: '가상 금리', tone: 'down' }, { label: '달러 인덱스', value: '-0.6%', sub: '가상 지수', tone: 'down' }] },
        { type: 'content', kicker: '금리', title: '장기 금리는\n한 주 새 하락', blocks: [{ t: 'change', label: '미 10년물 국채 금리(예시)', from: '4.32%', to: '4.24%', tone: 'down', cap: '물가 지표가 예상과 비슷하게 나오며 긴장이 완화됐어요.' }] },
        { type: 'content', kicker: '환율', title: '원화는 강세 흐름', blocks: [{ t: 'stats', items: [{ label: '원/달러', value: '1,352원', cap: '전주 대비 -11원(예시)' }, { label: '원/엔(100엔)', value: '912원', cap: '전주 대비 -4원(예시)' }] }] },
        { type: 'content', kicker: '정리', title: '살펴볼 세 가지', disc: true, blocks: [{ t: 'list', items: [{ title: '중앙은행 위원 발언', desc: '연말 금리 경로에 대한 힌트를 확인해요.' }, { title: '수출입 물가', desc: '환율 하락이 물가에 미치는 영향을 봐요.' }, { title: '외국인 채권 자금', desc: '원화 흐름과 함께 확인해요.' }] }] }
      ] } },
    { id: 'ex-3', sample: true, title: 'AI 인프라 투자, 어디까지 왔나', category: '산업분석', team: '반도체', analyst: '가상 애널리스트 C', published_at: '2026-10-26',
      deck: { brand: 'EUGENE', series: 'Sector Insight', source: SRC, team: '반도체', analyst: '가상 애널리스트 C', slides: [
        { type: 'cover', title: 'AI 인프라 투자\n어디까지 왔나', date: '2026.10.26(예시)', stats: [{ label: '설비투자 증가율', value: '+38%', sub: '가상 추정', tone: 'up' }] },
        { type: 'content', kicker: '투자 규모', title: '데이터센터 설비투자\n가파른 증가', blocks: [{ t: 'hero', value: '+38%', tone: 'up', label: '주요 클라우드 기업 합산(예시)', cap: '전년 대비 설비투자 증가율 — 가상 수치예요.' }] },
        { type: 'content', kicker: '밸류체인', title: '수혜 영역별 온도 차', blocks: [{ t: 'updown', upLabel: '수요 강세', downLabel: '수요 둔화', up: [{ name: '고대역폭 메모리', chg: '+42%' }, { name: '전력 설비', chg: '+27%' }, { name: '냉각 장비', chg: '+19%' }], down: [{ name: '범용 서버 D램', chg: '-6%' }, { name: 'PC용 부품', chg: '-3%' }] }] },
        { type: 'content', kicker: '리스크', title: '같이 봐야 할 변수', disc: true, blocks: [{ t: 'list', items: [{ title: '전력 공급 제약', desc: '증설 속도를 늦출 수 있는 요인이에요.' }, { title: '재고 조정 가능성', desc: '수요 둔화 신호를 꾸준히 점검해요.' }] }] }
      ] } },
    { id: 'ex-4', sample: true, title: '2차전지, 재고 사이클 점검', category: '산업분석', team: '2차전지', analyst: '가상 애널리스트 D', published_at: '2026-10-24',
      deck: { brand: 'EUGENE', series: 'Sector Insight', source: SRC, team: '2차전지', analyst: '가상 애널리스트 D', slides: [
        { type: 'cover', title: '2차전지\n재고 사이클 점검', date: '2026.10.24(예시)', stats: [{ label: '재고일수', value: '-12일', sub: '가상 추정', tone: 'down' }] },
        { type: 'content', kicker: '재고', title: '재고일수는\n줄어드는 중', blocks: [{ t: 'change', label: '셀 업체 평균 재고일수(예시)', from: '78일', to: '66일', tone: 'down', cap: '분기 기준 가상 수치예요.' }] },
        { type: 'content', kicker: '지역별 수요', title: '지역마다 다른 속도', disc: true, blocks: [{ t: 'bars', unit: '%', label: '전기차 판매 증가율(예시)', items: [{ name: '유럽', n: 14 }, { name: '중국', n: 9 }, { name: '북미', n: -4 }] }] }
      ] } },
    { id: 'ex-5', sample: true, title: '한빛반도체(가상) 3분기 실적 리뷰', category: '기업분석', team: '반도체', analyst: '가상 애널리스트 C', published_at: '2026-10-23',
      deck: { brand: 'EUGENE', series: 'Company Note', source: SRC, team: '반도체', analyst: '가상 애널리스트 C', slides: [
        { type: 'cover', title: '한빛반도체(가상)\n3분기 실적 리뷰', date: '2026.10.23(예시)', stats: [{ label: '매출', value: '+21%', sub: '전년 대비', tone: 'up' }, { label: '영업이익률', value: '18.4%', sub: '가상 수치' }] },
        { type: 'content', kicker: '실적 요약', title: '시장 예상과\n비슷한 결과', blocks: [{ t: 'stats', items: [{ label: '매출', value: '2.4조', cap: '가상 수치' }, { label: '영업이익', value: '4,410억', cap: '가상 수치' }, { label: '순이익', value: '3,380억', cap: '가상 수치' }] }] },
        { type: 'content', kicker: '체크포인트', title: '다음 분기에 볼 것', disc: true, blocks: [{ t: 'list', items: [{ title: '고객사 재고 수준', desc: '주문 흐름의 선행 지표예요.' }, { title: '신규 공정 수율', desc: '원가 개선 속도를 가늠해요.' }] }] }
      ] } },
    { id: 'ex-6', sample: true, title: '배당 시즌 체크리스트', category: '산업분석', team: '금융', analyst: '가상 애널리스트 E', published_at: '2026-10-21',
      deck: { brand: 'EUGENE', series: 'Theme Note', source: SRC, team: '금융', analyst: '가상 애널리스트 E', slides: [
        { type: 'cover', title: '배당 시즌\n체크리스트', date: '2026.10.21(예시)', stats: [{ label: '평균 배당수익률', value: '3.4%', sub: '가상 업종 평균' }] },
        { type: 'content', kicker: '배당 일정', title: '연말 배당 기준일\n미리 확인해요', blocks: [{ t: 'list', items: [{ title: '배당 기준일 공시', desc: '기업마다 기준일이 달라질 수 있어요.' }, { title: '배당 정책 변화', desc: '분기 배당·자사주 정책도 함께 봐요.' }] }] },
        { type: 'content', kicker: '업종별', title: '업종별 배당수익률', disc: true, blocks: [{ t: 'bars', unit: '%', label: '업종 평균(예시)', items: [{ name: '은행', n: 5.1 }, { name: '보험', n: 4.3 }, { name: '통신', n: 3.9 }, { name: '유틸리티', n: 3.2 }] }] }
      ] } }
  ];

  window.CardNews = { render: render, open: open, normalize: normalize, bucket: bucket, BUCKET_LABEL: BUCKET_LABEL, SAMPLES: SAMPLES };
})();
