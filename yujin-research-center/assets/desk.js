// Private Desk — 인사 헤더 · 워크스페이스 · 카드뉴스 · 나의 리서치 · 이벤트 신청 내역 (7-8)
// 코드 기본값('예시')으로 먼저 그리고 Supabase(card_news · reports)에 값이 있으면 덮어쓴다.
(function () {
  'use strict';
  var s = IL.session() || {};
  var isWM = s.persona === 'hnw';

  /* 고객 유형별 차이 — persona==='hnw' 한 가지 조건 + 유형별 관심 분야 (2장) */
  var PERSONA = {
    am: { fmt: '회의용 브리핑', mgr: '법인영업 담당', interests: ['반도체', 'AI 인프라', '2차전지'] },
    ia: { fmt: '고객 설명자료', mgr: '법인영업 담당', interests: ['반도체', '금리', '배당주'] },
    dma: { fmt: '회의용 브리핑', mgr: 'DMA 데스크', interests: ['반도체', '미국 기술주', '환율'] },
    hnw: { fmt: '카드뉴스', mgr: '담당 PB', interests: ['반도체', '배당주', '미국 금리'] }
  };
  var P = PERSONA[s.persona] || PERSONA.am;
  var name = s.name || '고객';
  var WEEK = '일월화수목금토';

  /* ---------- 날짜 ---------- */
  var kstToday = function () { return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); };
  var TODAY = (window.IL_EVENTS && window.IL_EVENTS.TODAY) || kstToday();
  var addDays = function (d, n) { var t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  var dot = function (d) { return String(d || '').slice(0, 10).replace(/-/g, '.'); };
  var wd = function (d) { var t = new Date(String(d).slice(0, 10) + 'T00:00:00Z'); return isNaN(t) ? '' : WEEK.charAt(t.getUTCDay()); };

  /* ---------- 저장소 ---------- */
  var store = {
    get: function (k, def) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? def : v; } catch (e) { return def; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var prefs = store.get('il.prefs', null) || {};
  if (!Array.isArray(prefs.watch)) prefs.watch = P.interests.slice();
  prefs.alerts = Object.assign({ report: true, events: true, cardnews: true }, prefs.alerts || {});
  var savePrefs = function () { store.set('il.prefs', prefs); };

  var sampleBadge = '<span class="badge badge--sample">예시</span>';
  var interestHit = function (text) {
    var t = String(text || '');
    return prefs.watch.some(function (w) { return w.split(/\s+/).some(function (tok) { return tok.length > 1 && t.indexOf(tok) >= 0; }); });
  };

  /* =========================================================
     1. 인사 헤더
     ========================================================= */
  $('#desk-avatar').textContent = name.charAt(0);
  $('#desk-title').textContent = name + '님의 Private Desk';
  $('#ws-title').textContent = name + '님의 리서치 워크스페이스';
  $('#desk-badges').innerHTML = [
    '<span class="badge badge--point">' + (isWM ? 'WM 고객' : '기관 고객') + '</span>',
    s.cust_type ? '<span class="badge badge--muted">' + esc(s.cust_type) + '</span>' : '',
    (s.org || s.branch) ? '<span class="badge badge--muted">' + esc(s.org || s.branch) + '</span>' : '',
    '<span class="badge badge--brand">' + (s.status === 'approved' ? '승인 완료' : '승인 대기') + '</span>',
    s.via === 'demo' ? '<span class="badge badge--sample">시연 모드</span>' : '<span class="badge badge--muted">이메일 로그인</span>'
  ].join('');

  /* =========================================================
     2. 워크스페이스
     ========================================================= */
  var SAMPLE_BRIEF = {
    sample: true, title: '반도체 업황 점검 — 메모리 가격 흐름과 설비투자 일정',
    summary: '메모리 가격 흐름과 주요 고객사의 설비투자 일정을 함께 정리했어요. 관심 분야와 관련된 최근 리포트를 바탕으로 만든 시연용 예시 브리핑이에요.',
    changes: ['메모리 가격 가정 업데이트(예시)', '데이터센터 설비투자 일정 추가(예시)', '체크포인트 3개로 정리(예시)'],
    meta: '리서치센터 · 예시', href: null
  };
  var brief = SAMPLE_BRIEF;
  function renderBrief() {
    var b = brief;
    $('#ws-brief').innerHTML =
      '<div class="card__body">' +
        '<div class="ws-h"><h3>오늘의 맞춤 브리핑</h3>' + (b.sample ? sampleBadge : '<span class="ws-h__note num">' + esc(b.meta) + '</span>') + '</div>' +
        '<div class="ws-brief__tags">' + prefs.watch.slice(0, 4).map(function (w) { return '<span class="badge badge--brand">#' + esc(w) + '</span>'; }).join('') + '</div>' +
        '<h4 class="ws-brief__title">' + esc(b.title) + '</h4>' +
        '<p class="ws-brief__desc">' + esc(b.summary) + '</p>' +
        (b.changes && b.changes.length ? '<div class="ws-brief__chg"><span>변경점</span><ul>' + b.changes.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul></div>' : '') +
        '<button type="button" class="btn btn--primary btn--sm" id="ws-brief-go">리포트 보기 →</button>' +
      '</div>';
    $('#ws-brief-go').addEventListener('click', function () {
      if (b.href) { if (/^https?:/.test(b.href)) window.open(b.href, '_blank', 'noopener'); else location.href = b.href; }
      else toast('예시 브리핑이라 연결된 리포트가 없어요. 리포트가 들어오면 바로 연결돼요.');
    });
  }
  function briefFromReport(r) {
    var sum = String(r.summary || '').replace(/\s+/g, ' ').trim();
    return {
      sample: false, title: r.title || '리포트',
      summary: sum.length > 150 ? sum.slice(0, 150) + '…' : (sum || '요약이 아직 없어요.'),
      changes: [r.category, r.company, r.analyst && r.analyst + ' 애널리스트'].filter(Boolean),
      meta: dot(r.published_at) + ' 발간',
      href: r.url || 'reports.html?id=' + encodeURIComponent(r.id)
    };
  }

  /* 맞춤 자료함 — 서버 export가 없으므로 예시 + 미리보기 토스트 */
  var FILES = [
    { key: 'brief', icon: '📋', title: '회의용 브리핑', desc: '오늘 아침 회의에 쓸 1장 요약', ext: 'PDF' },
    { key: 'client', icon: '🗂️', title: '고객 설명자료', desc: '고객에게 설명하기 쉬운 쉬운 말 버전', ext: 'PDF' },
    { key: 'card', icon: '🃏', title: '카드뉴스', desc: '핵심 숫자를 카드로 넘겨 보기', ext: 'PNG' },
    { key: 'anchor', icon: '🎙️', title: 'AI 앵커 영상', desc: '3분 영상 브리핑', ext: 'MP4' }
  ];
  function renderFiles() {
    $('#ws-fmt').innerHTML = '기본 형식 <b>' + esc(P.fmt) + '</b>';
    var mine = { '회의용 브리핑': 'brief', '고객 설명자료': 'client', '카드뉴스': 'card' }[P.fmt];
    $('#ws-files').innerHTML = FILES.map(function (f) {
      return '<button type="button" class="ws-file' + (f.key === mine ? ' is-mine' : '') + '" data-file="' + f.key + '">' +
        '<span class="ws-file__ico" aria-hidden="true">' + f.icon + '</span>' +
        '<span class="ws-file__txt"><b>' + esc(f.title) + '</b><span>' + esc(f.desc) + '</span></span>' +
        '<span class="ws-file__meta">' + (f.key === mine ? '<span class="badge badge--point">기본 형식</span>' : '') + sampleBadge + '<span class="ws-file__ext">' + f.ext + '</span></span>' +
      '</button>';
    }).join('');
  }
  $('#ws-files').addEventListener('click', function (e) {
    var b = e.target.closest('[data-file]'); if (!b) return;
    var k = b.getAttribute('data-file');
    if (k === 'card' && cards.length) { openCard(cards[0]); return; }
    if (k === 'anchor') { soon('AI 앵커 영상'); return; }
    toast('예시 자료예요. 자료 생성 서버가 연결되면 실제 파일을 받을 수 있어요.');
  });

  /* 상담 · 담당자 */
  var CONSULT_KEY = 'il.consults-v1';
  var CONSULT_KINDS = ['리포트 내용 문의', '애널리스트 미팅 요청', '행사 · 세미나 문의', '기타 상담'];
  $('#ws-mgr-role').textContent = P.mgr;
  $('#ws-mgr-title').textContent = P.mgr + ' 연결 · 상담 요청';
  function renderConsult() {
    var list = store.get(CONSULT_KEY, []);
    var c = list[0];
    $('#ws-consult').innerHTML = c
      ? '<div class="ws-consult"><div class="ws-consult__top"><span class="badge badge--brand">' + esc(c.status || '접수됨') + '</span><span class="muted num">' + dot(c.at) + '</span></div>' +
        '<b>' + esc(c.kind) + '</b><p>' + esc(c.memo || '메모 없음') + '</p>' +
        (list.length > 1 ? '<span class="muted ws-consult__more">진행 중 상담 ' + list.length + '건</span>' : '') + '</div>'
      : '<div class="ws-consult"><div class="ws-consult__top"><span class="badge badge--brand">답변 준비 중</span>' + sampleBadge + '</div>' +
        '<b>반도체 업종 리포트 문의</b><p>' + esc(P.mgr) + '가 애널리스트 의견을 정리하고 있어요.</p></div>';
  }
  $('#ws-consult-btn').addEventListener('click', function () {
    var ctx = [name, s.org || s.branch, prefs.watch.join(' · ')].filter(Boolean).join(' / ');
    var m = openModal(
      '<h2 class="modal__title">' + esc(P.mgr) + ' 상담 요청</h2>' +
      '<p class="form-note" style="margin-bottom:18px">시연 화면이라 실제로 전달되지는 않고, 이 브라우저에만 기록돼요.</p>' +
      '<form><label class="field"><span class="field__label">상담 종류</span><select class="input" name="kind">' +
        CONSULT_KINDS.map(function (k) { return '<option>' + esc(k) + '</option>'; }).join('') + '</select></label>' +
      '<div class="field"><span class="field__label">전달 맥락</span><div class="ws-ctx">' + esc(ctx) + '</div></div>' +
      '<label class="field"><span class="field__label">메모</span><textarea class="input ws-memo" name="memo" rows="4" maxlength="300" placeholder="궁금한 내용을 적어 주세요."></textarea></label>' +
      '<button class="btn btn--primary btn--block" type="submit">요청 남기기</button></form>',
      { label: '상담 요청' });
    $('form', m.el).addEventListener('submit', function (e) {
      e.preventDefault();
      var list = store.get(CONSULT_KEY, []);
      list.unshift({ id: 'cs-' + Date.now(), kind: e.target.kind.value, memo: e.target.memo.value.trim(), at: new Date().toISOString(), status: '접수됨' });
      store.set(CONSULT_KEY, list.slice(0, 20));
      m.close(); renderConsult();
      toast('상담 요청을 남겼어요. (시연 — 실제 전달 없음)');
    });
  });

  /* 관심 종목 · 테마 + 알림 */
  function renderTags() {
    $('#ws-tags').innerHTML = prefs.watch.length ? prefs.watch.map(function (w, i) {
      return '<li class="ws-tag">' + esc(w) + '<button type="button" data-del="' + i + '" aria-label="' + esc(w) + ' 삭제">×</button></li>';
    }).join('') : '<li class="muted ws-tags__empty">관심 종목 · 테마를 추가해 보세요.</li>';
  }
  $('#ws-tags').addEventListener('click', function (e) {
    var b = e.target.closest('[data-del]'); if (!b) return;
    var w = prefs.watch.splice(+b.getAttribute('data-del'), 1)[0];
    savePrefs(); renderTags(); renderBrief(); renderCards();
    toast(w + '을(를) 관심 목록에서 뺐어요.');
  });
  $('#ws-add').addEventListener('submit', function (e) {
    e.preventDefault();
    var inp = $('#ws-add-input'), v = inp.value.trim();
    if (!v) return;
    if (prefs.watch.indexOf(v) >= 0) { toast('이미 관심 목록에 있어요.'); return; }
    if (prefs.watch.length >= 10) { toast('관심 목록은 10개까지 담을 수 있어요.'); return; }
    prefs.watch.push(v); inp.value = '';
    savePrefs(); renderTags(); renderBrief(); renderCards();
  });
  $$('[data-alert]').forEach(function (cb) {
    var k = cb.getAttribute('data-alert');
    cb.checked = !!prefs.alerts[k];
    cb.addEventListener('change', function () {
      prefs.alerts[k] = cb.checked; savePrefs();
      toast(cb.parentNode.querySelector('span').textContent + ' 알림을 ' + (cb.checked ? '켰어요.' : '껐어요.'));
    });
  });

  /* =========================================================
     3. 카드뉴스
     ========================================================= */
  var cards = (window.CardNews ? CardNews.SAMPLES : []).map(function (r) { return CardNews.normalize(r); });
  var cnTab = 'rec', cnAll = false;
  var bm = function (on) { return on ? '★' : '☆'; };

  function cnList() {
    var l = cards.slice();
    if (cnTab === 'rec') {
      l.sort(function (a, b) {
        var ha = interestHit(a.title + ' ' + a.category + ' ' + a.team) ? 1 : 0, hb = interestHit(b.title + ' ' + b.category + ' ' + b.team) ? 1 : 0;
        return hb - ha || String(b.published_at).localeCompare(String(a.published_at));
      });
    } else l = l.filter(function (c) { return CardNews.bucket(c.category) === cnTab; });
    return l;
  }
  function renderCards() {
    if (!window.CardNews) return;
    var l = cnList(), show = cnAll ? l : l.slice(0, 3);
    var grid = $('#cn-grid');
    grid.innerHTML = show.length ? show.map(function (c) {
      var on = window.ILSaved && ILSaved.has('cardnews', c.id);
      return '<article class="cn-card">' +
        '<button type="button" class="cn-card__open" data-cn="' + esc(c.id) + '" aria-label="' + esc(c.title) + ' 카드뉴스 열기">' +
          '<div class="cn-card__thumb" data-thumb="' + esc(c.id) + '"></div>' +
          '<div class="cn-card__body"><div class="cn-card__badges"><span class="badge badge--brand">' + esc(CardNews.BUCKET_LABEL[CardNews.bucket(c.category)]) + '</span>' + (c.sample ? sampleBadge : '') + '</div>' +
          '<b class="cn-card__title">' + esc(c.title) + '</b>' +
          '<span class="cn-card__meta">' + esc([c.team, c.analyst].filter(Boolean).join(' · ')) + ' · <span class="num">' + dot(c.published_at) + '</span></span></div>' +
        '</button>' +
        '<button type="button" class="cn-card__bm' + (on ? ' is-on' : '') + '" data-bm="' + esc(c.id) + '" aria-pressed="' + !!on + '" aria-label="나의 리서치에 저장">' + bm(on) + '</button>' +
      '</article>';
    }).join('') : '<p class="muted cn-empty-msg">이 분류의 카드뉴스가 아직 없어요.</p>';
    show.forEach(function (c) {
      var el = grid.querySelector('[data-thumb="' + CSS.escape(String(c.id)) + '"]');
      if (el) CardNews.render(el, c.deck, { slide: 0 });
    });
    var more = $('#cn-more');
    more.hidden = l.length <= 3;
    more.textContent = cnAll ? '접기 ↑' : '카드뉴스 전체 보기 (' + l.length + ') →';
    more.setAttribute('aria-expanded', cnAll);
  }
  var findCard = function (id) { return cards.filter(function (c) { return String(c.id) === String(id); })[0]; };
  function openCard(c) { CardNews.open(c, { syncUrl: true }); }
  $('#cn-grid').addEventListener('click', function (e) {
    var b = e.target.closest('[data-bm]');
    if (b) {
      var c = findCard(b.getAttribute('data-bm'));
      var on = ILSaved.toggle({ kind: 'cardnews', id: c.id, title: c.title, category: c.category, date: c.published_at });
      toast(on ? '나의 리서치에 저장했어요.' : '저장을 취소했어요.');
      return;
    }
    var o = e.target.closest('[data-cn]');
    if (o) openCard(findCard(o.getAttribute('data-cn')));
  });
  wireTabsA11y($('#cn-tabs'), function (k) { cnTab = k; cnAll = false; renderCards(); });
  $('#cn-more').addEventListener('click', function () { cnAll = !cnAll; renderCards(); });

  /* =========================================================
     4-1. 나의 리서치
     ========================================================= */
  var rsTab = 'saved', rsCat = '전체', rsAll = false;
  var RECEIVED = [
    { kind: 'file', title: '주간 ' + P.fmt + ' — 10월 마지막 주', category: P.fmt, date: addDays(TODAY, -1), from: P.mgr },
    { kind: 'file', title: '반도체 업종 점검 요약', category: '산업', date: addDays(TODAY, -3), from: P.mgr },
    { kind: 'file', title: '금리 · 환율 주간 체크포인트', category: '시황', date: addDays(TODAY, -6), from: P.mgr }
  ];
  function rsItems() { return rsTab === 'saved' ? (window.ILSaved ? ILSaved.list() : []) : RECEIVED; }
  function renderResearch() {
    var items = rsItems();
    var cats = ['전체'].concat(items.map(function (i) { return i.category || '기타'; }).filter(function (c, i, a) { return a.indexOf(c) === i; }));
    if (cats.indexOf(rsCat) < 0) rsCat = '전체';
    $('#rs-chips').innerHTML = items.length ? cats.map(function (c) {
      return '<button type="button" class="chip' + (c === rsCat ? ' is-active' : '') + '" data-cat="' + esc(c) + '" aria-pressed="' + (c === rsCat) + '">' + esc(c) + '</button>';
    }).join('') : '';
    var l = items.filter(function (i) { return rsCat === '전체' || (i.category || '기타') === rsCat; });
    var show = rsAll ? l : l.slice(0, 5);
    $('#rs-list').innerHTML = show.length ? show.map(function (i) {
      var isSaved = rsTab === 'saved';
      return '<li class="rs-item">' +
        '<button type="button" class="rs-item__open" data-kind="' + esc(i.kind) + '" data-id="' + esc(i.id == null ? '' : i.id) + '">' +
          '<span class="rs-item__kind">' + (i.kind === 'cardnews' ? '카드뉴스' : i.kind === 'report' ? '리포트' : '자료') + '</span>' +
          '<span class="rs-item__txt"><b>' + esc(i.title) + '</b><span class="muted">' + esc(i.category || '') + (i.date ? ' · <span class="num">' + dot(i.date) + '</span>' : '') + (i.from ? ' · ' + esc(i.from) : '') + '</span></span>' +
        '</button>' +
        (isSaved ? '<button type="button" class="rs-item__bm" data-unsave="' + esc(i.kind) + '|' + esc(i.id) + '" aria-label="' + esc(i.title) + ' 저장 취소">★</button>' : sampleBadge) +
      '</li>';
    }).join('') : '<li class="rs-empty">' + (rsTab === 'saved' ? '카드뉴스나 리포트의 ☆ 북마크를 누르면 여기에 모여요.' : '받은 자료가 아직 없어요.') + '</li>';
    var more = $('#rs-more');
    more.hidden = l.length <= 5;
    more.textContent = rsAll ? '접기 ↑' : '전체 보기 (' + l.length + ') →';
  }
  $('#rs-chips').addEventListener('click', function (e) {
    var c = e.target.closest('[data-cat]'); if (!c) return;
    rsCat = c.getAttribute('data-cat'); renderResearch();
  });
  $('#rs-list').addEventListener('click', function (e) {
    var u = e.target.closest('[data-unsave]');
    if (u) {
      var p = u.getAttribute('data-unsave').split('|');
      ILSaved.remove(p[0], p.slice(1).join('|'));
      toast('저장을 취소했어요.');
      return;
    }
    var o = e.target.closest('.rs-item__open'); if (!o) return;
    var kind = o.getAttribute('data-kind'), id = o.getAttribute('data-id');
    if (kind === 'cardnews') { var c = findCard(id); if (c) openCard(c); else toast('이 카드뉴스는 지금 목록에 없어요.'); }
    else if (kind === 'report') location.href = 'reports.html?id=' + encodeURIComponent(id);
    else toast('예시 자료예요. 담당자가 보낸 실제 자료는 연결 후 여기에서 열려요.');
  });
  $('#rs-more').addEventListener('click', function () { rsAll = !rsAll; renderResearch(); });
  wireTabsA11y($('#rs-tabs'), function (k) { rsTab = k; rsCat = '전체'; rsAll = false; renderResearch(); });

  /* =========================================================
     4-2. 내 이벤트 신청 내역 — ILConf(트랙 B)가 있으면 쓰고, 없으면 localStorage 직접
     ========================================================= */
  var CONF_KEY = 'il-conf-records-v1';
  var conf = {
    list: function () { return window.ILConf ? ILConf.list() : store.get(CONF_KEY, []); },
    remove: function (id) {
      if (window.ILConf) ILConf.remove(id);
      else store.set(CONF_KEY, store.get(CONF_KEY, []).filter(function (r) { return r.id !== id; }));
    },
    add: function (rec) {
      if (window.ILConf) ILConf.add(rec);
      else { var l = store.get(CONF_KEY, []); l.push(rec); store.set(CONF_KEY, l); }
    }
  };
  var CAT_KO = { corp: '콥데이', ipo: 'IPO', earnings: '실적 콜', ndr: 'NDR', ai: 'AI 컨퍼런스', wm: 'WM 세미나' };
  var catLabel = function (id) {
    var c = window.IL_EVENTS && (IL_EVENTS.CATS || []).filter(function (x) { return x.id === id; })[0];
    return (c && (c.ko || c.label)) || CAT_KO[id] || id || '행사';
  };
  // events-data.js가 없을 때 '예시 넣어보기'용 가상 행사
  var FALLBACK_EVENTS = [
    { id: 'ex-ev-1', cat: 'corp', title: '4분기 Corporate Day (예시)', start: addDays(TODAY, 12), time: '09:30', place: '온라인 · Zoom', analysts: ['리서치센터'], intro: '상장사 IR 담당자와 소규모로 만나는 분기 기업 설명회예요. 시연용 가상 일정이에요.' },
    { id: 'ex-ev-2', cat: isWM ? 'wm' : 'ai', title: isWM ? '연말 절세 · 연금 전략 세미나 (예시)' : 'AI 인프라 전망 컨퍼런스 (예시)', start: addDays(TODAY, 20), time: '14:00', place: isWM ? '강남금융센터(가상) 세미나실' : '본사 대강당(가상)', analysts: ['가상 애널리스트 C'], intro: '다음 해 산업 전망을 다루는 시연용 가상 행사예요.' },
    { id: 'ex-ev-3', cat: 'ipo', title: '비상장기업 투자 동향 설명회 (예시)', start: addDays(TODAY, -15), time: '16:00', place: '온라인 · Zoom', analysts: ['가상 애널리스트 F'], intro: '지난 행사 예시예요.' }
  ];
  var findEvent = function (id) {
    var all = ((window.IL_EVENTS && IL_EVENTS.EVENTS) || []).concat(FALLBACK_EVENTS);
    return all.filter(function (e) { return String(e.id) === String(id); })[0] || null;
  };
  var evTab = 'up';
  function evRows() {
    return conf.list().map(function (r) {
      var e = findEvent(r.eventId) || {};
      var date = e.start || '';
      return { rec: r, ev: e, date: date, past: !!date && (e.end || date) < TODAY };
    });
  }
  var statusOf = function (row) {
    if (row.rec.kind === 'request') return { t: row.rec.type || '문의 접수', c: 'badge--muted' };
    if (row.past) return { t: '참석 완료', c: 'badge--muted' };
    if (row.ev.tba || row.ev.mode === 'tba') return { t: '관심 등록', c: 'badge--brand' };
    return { t: '신청 완료', c: 'badge--point' };
  };
  function renderEvents() {
    var rows = evRows();
    $('#sum-events').textContent = rows.filter(function (x) { return !x.past; }).length;
    var l = rows.filter(function (x) { return evTab === 'past' ? x.past : !x.past; })
      .sort(function (a, b) { return (evTab === 'past' ? -1 : 1) * String(a.date || '9').localeCompare(String(b.date || '9')); });
    $('#ev-list').innerHTML = l.length ? l.map(function (x) {
      var st = statusOf(x);
      return '<li><button type="button" class="ev-row" data-rec="' + esc(x.rec.id) + '">' +
        '<span class="ev-row__date"><b class="num">' + (x.date ? x.date.slice(5).replace('-', '.') : '미정') + '</b><span>' + (x.date ? wd(x.date) : '') + '</span></span>' +
        '<span class="ev-row__txt"><b>' + esc(x.ev.title || x.rec.title) + '</b><span class="muted">' + esc(catLabel(x.ev.cat)) + ' · ' + esc((x.ev.analysts || []).join(', ') || '리서치센터') + '</span></span>' +
        '<span class="badge ' + st.c + '">' + esc(st.t) + '</span>' +
      '</button></li>';
    }).join('') : '<li class="rs-empty">' + (evTab === 'up'
        ? '다가오는 신청 행사가 없어요. <a class="btn btn--text" href="conferences.html">Events에서 일정 보기 →</a>' +
          (rows.length ? '' : '<br><button type="button" class="btn btn--secondary btn--sm ev-seed" id="ev-seed">예시 신청 내역 넣어보기</button>')
        : '지난 행사 기록이 없어요.') + '</li>';
  }
  $('#ev-list').addEventListener('click', function (e) {
    if (e.target.closest('#ev-seed')) { seedExample(); return; }
    var b = e.target.closest('[data-rec]'); if (!b) return;
    var x = evRows().filter(function (r) { return String(r.rec.id) === b.getAttribute('data-rec'); })[0];
    if (x) openEvent(x);
  });
  function openEvent(x) {
    var e = x.ev, r = x.rec, st = statusOf(x);
    var when = e.start ? dot(e.start) + ' (' + wd(e.start) + ')' + (e.end && e.end !== e.start ? ' ~ ' + dot(e.end) : '') + (e.time ? ' ' + e.time : '') : '일정 미정';
    var row = function (k, v) { return '<div class="ev-dl__row"><dt>' + k + '</dt><dd>' + v + '</dd></div>'; };
    var m = openModal(
      '<div class="ev-detail"><span class="badge ' + st.c + '">' + esc(st.t) + '</span>' + (String(r.eventId || '').indexOf('ex-') === 0 ? ' ' + sampleBadge : '') +
      '<h2 class="modal__title" style="margin-top:10px">' + esc(e.title || r.title) + '</h2>' +
      '<dl class="ev-dl">' +
        row('행사 일시', esc(when)) + row('행사 장소', esc(e.place || e.format || '추후 안내')) + row('신청 상태', esc(st.t)) +
        row('신청 구분', esc(r.type || (r.kind === 'request' ? '문의' : '참가 신청'))) + row('신청일', '<span class="num">' + esc(dot(r.at)) + '</span>') +
        row('분류', esc(catLabel(e.cat))) + row('담당', esc((e.analysts || []).join(', ') || '리서치센터')) +
      '</dl>' +
      (e.intro ? '<p class="ev-intro">' + esc(e.intro) + '</p>' : '') +
      '<div class="ev-acts"><a class="btn btn--secondary btn--sm" href="conferences.html' + (e.id ? '?event=' + encodeURIComponent(e.id) : '') + '">행사 페이지에서 보기</a>' +
      (x.past ? '' : '<button type="button" class="btn btn--sm ev-cancel" data-cancel>신청 취소</button>') + '</div>' +
      '<p class="form-note" style="margin-top:14px">신청 내용 수정은 아직 지원하지 않아요. 바꾸려면 취소한 뒤 Events에서 다시 신청해 주세요.</p></div>',
      { label: '행사 신청 상세', width: 520 });
    var cb = $('[data-cancel]', m.el);
    if (cb) cb.addEventListener('click', function () {
      if (!cb.classList.contains('is-confirm')) { cb.classList.add('is-confirm'); cb.textContent = '한 번 더 누르면 취소돼요'; return; }
      conf.remove(r.id); m.close(); renderEvents();
      toast('신청을 취소했어요. (시연 기록만 지워져요)');
    });
  }
  function seedExample() {
    var src = (window.IL_EVENTS && IL_EVENTS.EVENTS || []).filter(function (e) { return e.start && e.mode === 'apply'; });
    var up = src.filter(function (e) { return e.start >= TODAY; }).slice(0, 2), past = src.filter(function (e) { return e.start < TODAY; }).slice(-1);
    var pick = up.length ? up.concat(past) : FALLBACK_EVENTS;
    var now = Date.now();
    pick.forEach(function (e, i) {
      conf.add({ id: 'rec-' + (now + i), kind: 'apply', type: '참가 신청', title: e.title, eventId: e.id, at: new Date(now - i * 86400e3).toISOString(), email: 'demo@example.com' });
    });
    renderEvents();
    toast('예시 신청 내역을 넣었어요. 행을 눌러 상세 · 취소를 확인해 보세요.');
  }
  wireTabsA11y($('#ev-tabs'), function (k) { evTab = k; renderEvents(); });
  if (window.ILConf && ILConf.onChange) ILConf.onChange(renderEvents);
  window.addEventListener('storage', function (e) { if (e.key === CONF_KEY) renderEvents(); });

  /* ---------- 요약 숫자 ---------- */
  function renderSummary() {
    var since = addDays(TODAY, -7);
    var fresh = cards.filter(function (c) { return String(c.published_at).slice(0, 10) >= since; });
    $('#sum-cn').textContent = fresh.length;
    $('#sum-saved').textContent = window.ILSaved ? ILSaved.list().length : 0;
  }
  if (window.ILSaved) ILSaved.onChange(function () { renderSummary(); renderResearch(); renderCards(); });

  /* ---------- 첫 그림 (코드 기본값) ---------- */
  renderBrief(); renderFiles(); renderConsult(); renderTags();
  renderCards(); renderResearch(); renderEvents(); renderSummary();

  /* ---------- Supabase 덮어쓰기 (9장 불러오기 패턴) ---------- */
  var q = function (p) { return p.then(function (r) { return r; }, function () { return { data: null }; }); };
  var load = window.sb ? Promise.all([
    q(sb.from('card_news').select('*').order('published_at', { ascending: false }).limit(30)),
    q(sb.from('reports').select('id,kind,category,title,summary,company,analyst,published_at,url').order('published_at', { ascending: false }).limit(40))
  ]).then(function (res) {
    var cn = res[0] && res[0].data, rp = res[1] && res[1].data;
    if (res[0] && res[0].error) console.warn('[desk] card_news', res[0].error.message);
    if (res[1] && res[1].error) console.warn('[desk] reports', res[1].error.message);
    if (cn && cn.length) {
      var real = cn.map(CardNews.normalize).filter(function (c) { return (c.deck.slides || []).length; });
      if (real.length) { cards = real; renderCards(); renderSummary(); }
    }
    if (rp && rp.length) {
      var hit = rp.filter(function (r) { return interestHit([r.title, r.category, r.company, r.summary].join(' ')); })[0] || rp[0];
      brief = briefFromReport(hit); renderBrief();
    }
  }).catch(function (e) { console.warn('[desk] 불러오기 실패', e); }) : Promise.resolve();

  /* desk.html?cn=<id> — 카드뉴스 바로 열기 */
  load.then(function () {
    var id = new URLSearchParams(location.search).get('cn');
    if (!id) return;
    var c = findCard(id);
    if (c) openCard(c); else toast('요청한 카드뉴스를 찾지 못했어요.');
  });
})();
