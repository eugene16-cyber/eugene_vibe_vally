// Events 페이지 (7-6) — 상단 Orbit Books(카테고리) / 하단 목록·캘린더 탐색 / 신청 · 문의 다이얼로그 / 세미나 요청 · 외부 행사 탭
// 행사 데이터는 events-data.js(IL_EVENTS), 기록은 conf-records.js(ILConf). 실제 접수 · 전송은 없어요.
// 화면 구성 · 용어는 conference_say.html 기준. 공용 데이터(Home · Desk도 씀)는 그대로 두고 이 페이지에서만 이름을 바꿔요.
(function () {
  'use strict';
  var D = window.IL_EVENTS, R = window.ILConf;
  if (!D || !R) { console.warn('[IL] 행사 모듈을 불러오지 못했어요'); return; }
  var TODAY = D.TODAY;
  var sess = (window.IL && IL.session()) || {};
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var scrollBehavior = function () { return reduced.matches ? 'auto' : 'smooth'; };
  var ARROW = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';

  // 카테고리 5개 — 책 이름(book) · 필터 이름(filter) · 개요(desc). 실적발표는 카테고리가 아니라 세미나 탭의 '실적발표 문의'로 받아요.
  var TERMS = {
    corp: { book: '콥데이', filter: '콥데이', desc: '매분기 줌으로 진행하는 기업 IR이에요.' },
    ipo: { book: 'IPO', filter: 'IPO', desc: '매달 정기적으로 IPO와 비상장 투자 시장을 함께 다뤄요.' },
    ndr: { book: 'NDR', filter: 'NDR', desc: '기업 IR팀이 기관을 직접 찾아가는 1:1·소그룹 미팅이에요. 초청 기반이라 참여는 문의로 진행해요.' },
    ai: { book: '특화 컨퍼런스', filter: 'Conference', desc: '섹터·테마별 컨퍼런스에서 업황과 기업 전략을 함께 봐요.' },
    wm: { book: 'WM Seminar', filter: 'WM특화세미나', desc: '자산관리 고객 눈높이에 맞춘 시장 전망과 테마 세미나예요.' }
  };
  var FILTER_ORDER = ['corp', 'ndr', 'ipo', 'ai', 'wm'];
  var BOOKS = D.CATS.filter(function (c) { return TERMS[c.id]; }).map(function (c) {
    var t = TERMS[c.id]; return Object.assign({}, c, { label: t.book, ko: t.filter, desc: t.desc });
  });
  var AUD = { inst: '기관', corp: '법인', wm: 'WM' };
  var SECTORS = ['반도체', '2차전지·소재', '인터넷·AI', '바이오·헬스케어', '자동차', '금융', '스몰캡·IPO', '시장전략·매크로'];
  var ANALYST_LIST = [['김도윤', '반도체'], ['이서연', '2차전지·소재'], ['박지훈', '인터넷·AI'], ['정우진', '스몰캡·IPO'], ['최하늘', '시장전략·매크로']];
  var ANALYSTS = ANALYST_LIST.map(function (a) { return a[0] + ' · ' + a[1]; });

  // 행사 목록 (시연용 가상) — conference_say.html과 같은 행사. seats: 잔여석 · status: open | soon(오픈 예정) | invite(초청)
  var EVENTS = [
    { id: 'corp-2026q3', cat: 'corp', title: '3분기 Corporate Day', company: '참여기업 24개사', start: '2026-11-04', end: '2026-11-06',
      time: '09:30–16:30', place: '온라인(Zoom)', format: '온라인', elig: ['inst', 'corp', 'wm'], cond: '기관투자자·법인·WM 고객',
      cap: 300, seats: 142, analysts: ['최하늘'], status: 'open',
      intro: '3일 동안 오전/오후 총 24개 기업의 콥데이가 진행될 예정이에요',
      program: ['11/4(수) 오전 4개사 · 오후 4개사', '11/5(목) 오전 4개사 · 오후 4개사', '11/6(금) 오전 4개사 · 오후 4개사'] },
    { id: 'corp-2026q4', cat: 'corp', title: '4분기 Corporate Day', company: '참여기업 추후 안내', start: '2027-02-01', tba: true,
      time: '추후 안내', place: '온라인(Zoom)', format: '온라인', elig: ['inst', 'corp', 'wm'], cond: '기관투자자·법인·WM 고객',
      cap: 0, seats: 0, analysts: ['최하늘'], status: 'soon',
      intro: '분기마다 열리는 온라인 Corporate Day. 일정과 참여기업은 추후 안내돼요.', program: [] },
    { id: 'ipo-2610', cat: 'ipo', title: '10월 IPO 기업설명회 · 가온메디칼', company: '가온메디칼(가상)', start: '2026-10-15',
      time: '15:00–16:30', place: '온라인(Zoom)', format: '온라인', elig: ['inst', 'corp'], cond: '기관투자자·법인 고객',
      cap: 80, seats: 0, analysts: ['정우진'], status: 'open',
      intro: '공모 일정 전 회사 개요·성장 전략·공모 구조를 설명하고 질의응답을 진행해요.',
      program: ['회사 개요', '성장 전략', '공모 구조', '질의응답'] },
    { id: 'ipo-2611', cat: 'ipo', title: '11월 IPO 기업설명회 · 새봄로보틱스', company: '새봄로보틱스(가상)', start: '2026-11-12',
      time: '15:00–16:30', place: '온라인(Zoom)', format: '온라인', elig: ['inst', 'corp'], cond: '기관투자자·법인 고객',
      cap: 80, seats: 9, analysts: ['정우진'], status: 'open',
      intro: '공모 일정 전 회사 개요·성장 전략·공모 구조를 설명하고 질의응답을 진행해요.',
      program: ['회사 개요', '성장 전략', '공모 구조', '질의응답'] },
    { id: 'ipo-2612', cat: 'ipo', title: '12월 IPO·비상장 마켓 리뷰', company: '유진투자증권 리서치센터', start: '2026-12-10',
      time: '16:00–17:00', place: '온라인(Zoom)', format: '온라인', elig: ['inst', 'corp', 'wm'], cond: '기관투자자·법인·WM 고객',
      cap: 150, seats: 120, analysts: ['정우진'], status: 'open',
      intro: '매달 정기적으로 IPO와 비상장 투자 시장을 함께 다뤄요.',
      program: ['월간 공모 시장 리뷰', '비상장 투자 동향', '질의응답'] },
    { id: 'ndr-semi', cat: 'ndr', title: '반도체 소부장 NDR · 한결소재', company: '한결소재(가상)', start: '2026-11-18',
      time: '10:00–17:00', place: '여의도(기관 방문)', format: '오프라인', elig: ['inst'], cond: '기관투자자',
      cap: 0, seats: 0, analysts: ['김도윤'], status: 'invite',
      intro: '기업 IR팀이 기관을 직접 찾아가는 1:1·소그룹 미팅이에요. 초청 기반이라 참여는 문의로 진행해요.',
      program: ['1:1 미팅 (50분)', '소그룹 미팅 (60분)'] },
    { id: 'ndr-battery', cat: 'ndr', title: '2차전지 NDR · 누리에너지', company: '누리에너지(가상)', start: '2026-12-02',
      time: '10:00–17:00', place: '여의도(기관 방문)', format: '오프라인', elig: ['inst'], cond: '기관투자자',
      cap: 0, seats: 0, analysts: ['이서연'], status: 'invite',
      intro: '기업 IR팀이 기관을 직접 찾아가는 1:1·소그룹 미팅이에요. 초청 기반이라 참여는 문의로 진행해요.',
      program: ['1:1 미팅 (50분)', '소그룹 미팅 (60분)'] },
    { id: 'conf-ai', cat: 'ai', title: 'AI 밸류체인 컨퍼런스 2026', company: '참여기업 8개사', start: '2026-11-25',
      time: '13:00–17:30', place: '여의도 콘퍼런스홀 · 온라인 중계', format: '하이브리드', elig: ['inst', 'corp'], cond: '기관투자자·법인 고객',
      cap: 120, seats: 18, analysts: ['박지훈'], status: 'open',
      intro: 'AI 인프라부터 서비스까지 밸류체인별 기업 발표와 애널리스트 패널을 진행해요.',
      program: ['키노트: AI 투자 사이클 점검', '세션 1: 반도체·인프라', '세션 2: 소프트웨어·서비스', '애널리스트 패널 토론'] },
    { id: 'conf-semi', cat: 'ai', title: '반도체 업황 점검 컨퍼런스', company: '참여기업 6개사', start: '2026-10-21',
      time: '14:00–17:00', place: '여의도 콘퍼런스홀', format: '오프라인', elig: ['inst', 'corp'], cond: '기관투자자·법인 고객',
      cap: 100, seats: 0, analysts: ['김도윤'], status: 'open',
      intro: '메모리·비메모리 업황과 소부장 기업의 대응 전략을 함께 점검했어요.',
      program: ['업황 점검', '기업 발표', '질의응답'] },
    { id: 'wm-tax', cat: 'wm', title: '연말 절세·자산배분 WM특화세미나', company: '유진투자증권 리서치센터', start: '2026-11-20',
      time: '16:00–17:30', place: '온라인(Zoom)', format: '온라인', elig: ['wm'], cond: 'WM 고객',
      cap: 60, seats: 0, analysts: ['최하늘'], status: 'open',
      intro: '연말을 앞두고 자산배분 점검과 절세 포인트를 함께 살펴봐요.',
      program: ['연말 자산배분 점검', '절세 포인트', '질의응답'] },
    { id: 'wm-outlook', cat: 'wm', title: '2027 시장 전망 WM특화세미나', company: '유진투자증권 리서치센터', start: '2026-12-08',
      time: '15:00–16:30', place: '여의도 본사 세미나실', format: '오프라인', elig: ['wm', 'corp'], cond: 'WM·법인 고객',
      cap: 50, seats: 31, analysts: ['최하늘'], status: 'open',
      intro: '내년 시장 전망과 주목할 테마를 WM 고객 눈높이로 풀어드려요.',
      program: ['2027 시장 전망', '주목할 테마', '질의응답'] }
  ];
  var byId = function (id) { return EVENTS.filter(function (e) { return e.id === id; })[0] || null; };
  var endOf = function (e) { return e.end || e.start; };
  var isPast = function (e) { return !e.tba && endOf(e) < TODAY; };
  var where = function (e) { return e.place + (e.format && e.place.indexOf(e.format) < 0 ? ' · ' + e.format : ''); };
  // 2026.11.04(수) ~ 11.06(금) · 미확정이면 2027.02 예정 · 일정 추후 안내
  function dateLabel(e) {
    if (e.tba) return e.start.slice(0, 4) + '.' + e.start.slice(5, 7) + ' 예정 · 일정 추후 안내';
    var out = dot(e.start) + '(' + wd(e.start) + ')';
    return e.end && e.end !== e.start ? out + ' ~ ' + md(e.end) + '(' + wd(e.end) + ')' : out;
  }
  var TONE = { brand: 'badge--brand', warn: 'cx-badge--warn', muted: 'badge--muted', neutral: 'cx-badge--neutral', point: 'badge--point' };

  /* ═════════ 유틸 ═════════ */
  var md = D.md, dot = D.dot, wd = D.dow;
  var catOf = function (id) { return BOOKS.filter(function (c) { return c.id === id; })[0] || null; };
  var filterLabel = function (id) { return TERMS[id] ? TERMS[id].filter : ''; };
  var mineFor = function (id) { return R.find(id); };
  var byStart = function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; };
  var upcomingOf = function (cat) { return EVENTS.filter(function (e) { return (!cat || e.cat === cat) && !isPast(e); }).sort(byStart); };
  var nextOf = function (list) { return list.filter(function (e) { return !e.tba; })[0] || null; };
  // 내가 신청한 자리는 잔여석에서 빼서 보여 줘요
  var seatsLeft = function (e) { var m = mineFor(e.id); return Math.max(0, (e.seats || 0) - (m && m.kind === 'apply' ? 1 : 0)); };
  var srcTag = function () { return '<span class="cx-sample">예시</span>'; };
  var eligLong = function (e) { return e.cond; };
  var badgeCls = function (r) { return TONE[r.tone] || 'badge--muted'; };
  function josa(w, a, b) { var c = String(w).trim().slice(-1).charCodeAt(0); return w + (c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 !== 0 ? a : b); }
  // 11.05(목) · 기간이면 09.07(월)~10(목) · 미확정이면 2026.12 예정
  function fmtShort(e) {
    if (e.tba) return e.start.slice(0, 4) + '.' + e.start.slice(5, 7) + ' 예정';
    var out = md(e.start) + '(' + wd(e.start) + ')';
    if (e.end && e.end !== e.start) out += '~' + e.end.slice(8) + '(' + wd(e.end) + ')';
    return out;
  }

  // 신청 상태 — 신청 완료 · 종료 · 오픈 예정 · 초청 · 마감 · 마감 임박 · 신청 가능 (can: 바로 신청)
  function st(e) {
    var mine = mineFor(e.id), left = seatsLeft(e);
    if (mine && mine.kind === 'apply') return { key: 'mine', label: '신청 완료', tone: 'brand' };
    if (isPast(e)) return { key: 'past', label: '종료', tone: 'muted' };
    if (e.status === 'soon') return { key: 'soon', label: '오픈 예정', tone: 'muted' };
    if (e.status === 'invite') return { key: 'invite', label: '초청', tone: 'neutral' };
    if (left <= 0) return { key: 'full', label: '마감', tone: 'muted' };
    if (left <= 10) return { key: 'hot', label: '마감 임박 · ' + left + '석', tone: 'warn', can: true };
    return { key: 'open', label: '신청 가능 · ' + left + '석', tone: 'brand', can: true };
  }

  var curUser = null;
  if (typeof getUser === 'function') getUser().then(function (u) { curUser = u; });
  if (typeof onAuth === 'function') onAuth(function (u) { curUser = u; });
  var signedIn = function () { return !!(curUser || sess.name); };

  /* ═════════ 상태 ═════════ */
  var state = { tab: 'internal', cat: 'all', phase: 'upcoming', elig: 'all', analyst: 'all', openOnly: false, q: '', view: 'list', calY: 0, calM: 0 };

  function filtered(anyPhase) {
    var q = state.q.toLowerCase();
    return EVENTS.filter(function (e) {
      if (!anyPhase && isPast(e) !== (state.phase === 'past')) return false;
      if (state.cat !== 'all' && e.cat !== state.cat) return false;
      if (state.elig !== 'all' && (e.elig || []).indexOf(state.elig) < 0) return false;
      if (state.analyst !== 'all' && (e.analysts || []).indexOf(state.analyst) < 0) return false;
      if (state.openOnly && !st(e).can) return false;
      if (q) {
        var c = catOf(e.cat);
        var hay = [e.title, e.company, e.intro, c.label, c.ko, (e.program || []).join(' ')].join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    }).sort(function (a, b) { return state.phase === 'past' ? byStart(b, a) : byStart(a, b); });
  }

  /* ═════════ 상단: 이번 분기 행사 · 카테고리 책 ═════════ */
  function renderHero() {
    var up = upcomingOf(), avail = up.filter(function (e) { return st(e).can; }), next = nextOf(up);
    $('#cx-hero-t').innerHTML = '지금 신청할 수 있는 행사 <b>' + avail.length + '건</b>';
    $('#cx-hero-next').innerHTML = next ? '다음 행사 · <b>' + esc(next.title) + '</b> ' + esc(fmtShort(next)) : '예정된 행사가 없어요';
  }

  var orbit = window.OrbitBooks ? OrbitBooks.mount($('#cx-orbit'), {
    books: BOOKS, center: 'Insight.',
    info: function (c) {
      var up = upcomingOf(c.id), open = up.filter(function (e) { return st(e).can; }).length, next = nextOf(up) || up[0];
      return {
        next: next ? '다음 ' + fmtShort(next) : '다음 · 추후 안내',
        title: next ? next.title : '예정된 행사가 없어요', up: up.length, open: open,
        meta: '예정 ' + up.length + '건' + (open ? ' · 신청 가능 ' + open + '건' : '')
      };
    },
    // 책을 고르면 나오는 행사 개요
    panel: function (c) {
      var up = upcomingOf(c.id), open = up.filter(function (e) { return st(e).can; }).length, next = nextOf(up);
      return '<p class="obp__k">' + esc(c.ed) + '</p>' +
        '<h3 class="obp__t">' + esc(c.label) + '</h3>' +
        '<p class="obp__d">' + esc(c.desc) + '</p>' +
        (next ? '<p class="obp__d">다음 행사 · <b>' + esc(next.title) + '</b> ' + esc(fmtShort(next)) + '</p>' : '') +
        '<div class="obp__stat"><span>예정 <b>' + up.length + '</b>건</span><span>신청 가능 <b>' + open + '</b>건</span></div>' +
        '<div class="obp__acts"><button type="button" class="btn btn--primary btn--sm" data-jump>일정 보기 ↓</button>' +
          '<button type="button" class="btn btn--text btn--sm" data-ob-close>전체 보기</button></div>';
    },
    onSelect: function (id) { setCat(id || 'all'); }
  }) : null;

  /* ═════════ 하단: 카테고리 칩 · 목록 · 캘린더 ═════════ */
  function renderCats() {
    var base = EVENTS.filter(function (e) { return isPast(e) === (state.phase === 'past'); });
    var chip = function (id, label, n, dotc) {
      return '<button type="button" class="chip' + (state.cat === id ? ' is-active' : '') + '" data-filter="' + id + '" aria-pressed="' + (state.cat === id) + '"' +
        (dotc ? ' style="--dot:' + dotc + '"' : '') + '>' + (dotc ? '<i aria-hidden="true"></i>' : '') + esc(label) + ' <span class="c">' + n + '</span></button>';
    };
    $('#cx-cats').innerHTML = chip('all', '전체', base.length) + FILTER_ORDER.map(function (id) {
      return chip(id, filterLabel(id), base.filter(function (e) { return e.cat === id; }).length, catOf(id).dot);
    }).join('');
  }

  function badgesOf(e) {
    var r = st(e);
    return '<span class="badge ' + badgeCls(r) + '">' + esc(r.label) + '</span>' +
      (e.elig || []).map(function (k) { return '<span class="badge cx-badge--neutral">' + esc(AUD[k]) + '</span>'; }).join('');
  }
  // 신청하기 · 참여 문의 · 대기 문의 · (신청 완료 · 오픈 예정은 비활성) — 상세 창에서는 누를 수 있는 것만
  function ctaOf(e, cls, actionable) {
    cls = cls == null ? 'btn--sm' : cls;
    var r = st(e);
    if (r.can) return '<button type="button" class="btn btn--primary ' + cls + '" data-apply="' + e.id + '">신청하기 ' + ARROW + '</button>';
    if (r.key === 'invite') return '<button type="button" class="btn btn--secondary ' + cls + '" data-request="ndr" data-event="' + e.id + '">참여 문의</button>';
    if (r.key === 'full') return '<button type="button" class="btn btn--secondary ' + cls + '" data-request="general" data-event="' + e.id + '">대기 문의</button>';
    if (actionable) return '';
    if (r.key === 'mine') return '<button type="button" class="btn btn--secondary ' + cls + '" disabled>신청 완료</button>';
    if (r.key === 'soon') return '<button type="button" class="btn btn--secondary ' + cls + '" disabled>오픈 예정</button>';
    return '';
  }
  function metaOf(e) {
    return (e.tba ? '일정 추후 안내' : (e.end ? fmtShort(e) + ' ' : '') + e.time) + ' · ' + e.place;
  }

  function renderList() {
    var rows = filtered(), prev = '';
    $('#cx-count').innerHTML = '<b>' + rows.length + '</b>개의 ' + (state.phase === 'past' ? '지난' : '예정') + ' 일정' + (state.cat !== 'all' ? ' · ' + esc(filterLabel(state.cat)) : '');
    if (!rows.length) {
      $('#cx-list').innerHTML = '<div class="cx-empty">조건에 맞는 일정이 없어요.<br><button type="button" class="btn btn--secondary btn--sm" data-reset>필터 초기화</button></div>';
      return;
    }
    $('#cx-list').innerHTML = rows.map(function (e, i) {
      var p = e.start.split('-'), c = catOf(e.cat), past = isPast(e);
      var mon = p[0] + '년 ' + (+p[1]) + '월';
      var head = mon !== prev ? '<h3 class="cx-month">' + mon + '</h3>' : '';
      prev = mon;
      return head + '<article class="cx-row' + (past ? ' is-past' : '') + (reduced.matches ? '' : ' in') + '" style="--dot:' + c.dot + ';--d:' + Math.min(i, 6) * 45 + 'ms">' +
        '<div class="cx-date" aria-label="' + esc(dateLabel(e)) + '"><div class="m">' + p[1] + '월</div><div class="d">' + (e.tba ? '–' : +p[2]) + '</div>' +
          '<div class="w">' + (e.tba ? '미정' : wd(e.start) + '요일') + '</div>' + (e.end && e.end !== e.start ? '<div class="r">~' + md(e.end) + '</div>' : '') + '</div>' +
        '<div class="cx-row__body">' +
          '<span class="cx-cat"><i aria-hidden="true"></i>' + esc(filterLabel(e.cat)) + srcTag(e) + '</span>' +
          '<button type="button" class="cx-title" data-detail="' + e.id + '">' + esc(e.title) + '</button>' +
          '<div class="cx-meta">' + esc(metaOf(e)) + '</div>' +
          '<div class="cx-badges">' + badgesOf(e) + '</div>' +
        '</div>' +
        '<div class="cx-acts">' + ctaOf(e) + '<button type="button" class="cx-more" data-detail="' + e.id + '">상세</button></div>' +
      '</article>';
    }).join('');
  }

  function focusMonth() {
    var first = filtered().filter(function (e) { return !e.tba; })[0] || EVENTS.filter(function (e) { return isPast(e) === (state.phase === 'past'); })[0];
    var iso = first ? first.start : TODAY;
    state.calY = +iso.slice(0, 4); state.calM = +iso.slice(5, 7) - 1;
  }
  // 캘린더는 지난 · 예정 일정을 함께 보여 줘요(지난 일정은 흐리게)
  function renderCalendar() {
    var y = state.calY, m = state.calM, ym = y + '-' + ('0' + (m + 1)).slice(-2);
    var first = new Date(y, m, 1).getDay(), last = new Date(y, m + 1, 0).getDate();
    var rows = filtered(true).filter(function (e) { return !e.tba && e.start <= ym + '-31' && endOf(e) >= ym + '-01'; }).sort(byStart);
    var blank = '<div class="cx-cell is-blank" aria-hidden="true"></div>';
    var cells = D.DOW.map(function (d, i) { return '<div class="cx-dow' + (i === 0 ? ' is-sun' : i === 6 ? ' is-sat' : '') + '">' + d + '</div>'; }).join('') + new Array(first + 1).join(blank);
    for (var d = 1; d <= last; d++) {
      var iso = ym + '-' + ('0' + d).slice(-2);
      var inDay = rows.filter(function (e) { return e.start <= iso && endOf(e) >= iso; });
      cells += '<div class="cx-cell' + (iso === TODAY ? ' is-today' : '') + '"><span class="n">' + d + '</span>' + inDay.map(function (e) {
        return '<button type="button" class="cx-ev' + (isPast(e) ? ' is-past' : '') + '" style="--dot:' + catOf(e.cat).dot + '" data-detail="' + e.id + '" aria-label="' + dot(iso) + ' ' + esc(e.title) + ' 상세">' +
          '<b>' + esc(filterLabel(e.cat)) + '</b><span>' + esc(e.title) + '</span></button>';
      }).join('') + '</div>';
    }
    cells += new Array((7 - (first + last) % 7) % 7 + 1).join(blank);
    $('#cx-count').innerHTML = '<b>' + rows.length + '</b>개의 일정 · ' + y + '년 ' + (m + 1) + '월';
    $('#cx-calendar').innerHTML = '<div class="cx-cal">' +
      '<div class="cx-cal__bar"><h3 aria-live="polite">' + y + '년 ' + (m + 1) + '월</h3><div class="cx-cal__nav">' +
        '<button type="button" data-month="-1" aria-label="이전 달">‹</button><button type="button" data-month="1" aria-label="다음 달">›</button></div></div>' +
      '<div class="cx-grid">' + cells + '</div>' +
      '<div class="cx-agenda"><h4>이 달의 일정</h4>' + (rows.length ? rows.map(function (e) {
        var r = st(e);
        return '<button type="button" class="cx-ag" data-detail="' + e.id + '"><time>' + md(e.start) + (e.end && e.end !== e.start ? '~' : '') + '</time>' +
          '<span class="t">' + esc(e.title) + '</span><span class="badge ' + badgeCls(r) + '">' + esc(r.label) + '</span></button>';
      }).join('') : '<p class="cx-meta cx-agenda__empty">이 달에는 맞는 일정이 없어요. ‹ › 로 다른 달을 확인해주세요.</p>') + '</div>' +
    '</div>';
  }

  function renderExplore() {
    renderCats();
    $('#cx-list').hidden = state.view !== 'list'; $('#cx-calendar').hidden = state.view !== 'calendar';
    if (state.view === 'list') renderList(); else renderCalendar();
  }
  function syncMyCount() { var n = $('#cx-my-n'), k = R.list().length; n.textContent = k; n.toggleAttribute('data-zero', !k); }
  function renderAll() { renderHero(); renderExplore(); syncMyCount(); syncUrl(); if (orbit) orbit.refresh(); }

  // 필터 상태를 주소에 반영 — 공유 · 뒤로가기 · Home 링크가 같은 상태로 열려요
  function syncUrl() {
    if (!history.replaceState || state.tab !== 'internal') return;
    var q = new URLSearchParams(location.search);
    if (state.cat === 'all') q.delete('category'); else q.set('category', state.cat);
    if (state.view === 'list') q.delete('view'); else q.set('view', state.view);
    if (state.phase === 'upcoming') q.delete('phase'); else q.set('phase', state.phase);
    q.delete('event'); q.delete('cat');
    var qs = q.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
  }

  // 카테고리 선택 — 책 · 칩이 같은 상태를 써요
  function setCat(id) {
    state.cat = id;
    if (state.view === 'calendar') focusMonth();
    renderAll();
    if (orbit) orbit.select(id === 'all' ? null : id);
    $('#cx-live').textContent = id === 'all' ? '전체 일정을 표시해요.' : filterLabel(id) + ' 일정 ' + filtered().length + '건으로 목록을 정리했어요.';
    var chip = $('#cx-cats [data-filter="' + id + '"]'), row = $('#cx-cats');
    if (chip && row.scrollWidth > row.clientWidth) row.scrollTo({ left: chip.offsetLeft - (row.clientWidth - chip.clientWidth) / 2 });
  }
  function setPressed(sel, on) { $$(sel).forEach(function (b) { b.setAttribute('aria-pressed', String(on(b))); }); }
  function jumpToExplore() { $('#explore').scrollIntoView({ behavior: scrollBehavior(), block: 'start' }); }

  /* ═════════ 다이얼로그 — partials.js openModal 하나를 열어 두고 내용만 바꿔요 ═════════ */
  var dlg = null, draft = null;
  function showDialog(html, label) {
    label = label || 'SEMINARS & CONFERENCES';
    if (!dlg) {
      dlg = openModal('<div class="cx-dbody"></div>', { label: label, width: 580, onClose: function () { dlg = null; } });
      dlg.el.classList.add('cx-dialog'); dlg.el.parentNode.classList.add('cx-modal');
    }
    dlg.el.setAttribute('aria-label', label);
    $('.cx-dbody', dlg.el).innerHTML = '<p class="cx-dlbl">' + esc(label) + '</p>' + html;
    dlg.el.scrollTop = 0;
    var f = $('.cx-dbody input:not([type=hidden]):not([type=checkbox]),.cx-dbody select,.cx-dbody textarea', dlg.el) || $('.modal__close', dlg.el);
    if (f) f.focus();
  }
  function closeDialog() { if (dlg) dlg.close(); }

  function detail(id) {
    var e = byId(id); if (!e || !TERMS[e.cat]) { toast('행사 정보를 찾지 못했어요.'); return; }
    var c = catOf(e.cat), past = isPast(e);
    var prog = e.program && e.program.length ? '<h3>프로그램</h3><div class="cx-prog">' + e.program.map(function (p, i) {
      return '<div><time>' + ('0' + (i + 1)).slice(-2) + '</time><span>' + esc(p) + '</span></div>';
    }).join('') + '</div>' : '';
    var row = function (k, v) { return '<dt>' + k + '</dt><dd>' + v + '</dd>'; };
    showDialog(
      '<span class="badge cx-badge--neutral cx-dcat" style="--dot:' + c.dot + '"><i aria-hidden="true"></i>' + esc(filterLabel(e.cat)) + ' · 예시 일정</span>' +
      '<h2 class="cx-dtitle">' + esc(e.title) + '</h2>' +
      '<p class="cx-lead">' + esc(e.intro || '') + '</p>' +
      '<div class="cx-badges">' + badgesOf(e) + '</div>' +
      '<dl class="cx-dl">' +
        row('일시', esc(dateLabel(e) + (e.tba ? '' : ' ' + e.time))) +
        row('장소', esc(e.place + ' · ' + e.format)) +
        row('참여 자격', esc(e.cond)) +
        row('기업', esc(e.company)) +
        row('담당', esc(e.analysts.join(', '))) +
        (e.cap ? row('정원', e.cap + '명' + (past ? '' : ' · 잔여 ' + seatsLeft(e) + '석')) : '') +
      '</dl>' + prog +
      '<div class="cx-formacts"><button type="button" class="btn btn--secondary btn--sm" data-close>닫기</button>' + ctaOf(e, 'btn--sm', true) + '</div>',
      c.label.toUpperCase());
  }

  /* ═════════ 폼 조각 ═════════ */
  var opt = function (list, cur) { return list.map(function (s) { return '<option' + (cur === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join(''); };
  var lbl = function (id, text, req) { return '<label class="field__label" for="' + id + '">' + text + (req ? '<span class="req">*</span>' : '<small>선택</small>') + '</label>'; };
  function personFields(p, v) {
    v = v || {};
    return '<div class="field">' + lbl(p + 'name', '이름', true) + '<input class="cx-in" id="' + p + 'name" name="name" required maxlength="50" value="' + esc(v.name != null ? v.name : sess.name || '') + '" placeholder="테스트 이름" autocomplete="off"></div>' +
      '<div class="field">' + lbl(p + 'org', '소속', true) + '<input class="cx-in" id="' + p + 'org" name="org" required maxlength="80" value="' + esc(v.org != null ? v.org : sess.org || sess.branch || '') + '" placeholder="테스트 기관명" autocomplete="off"></div>' +
      '<div class="field">' + lbl(p + 'email', '이메일', true) + '<input class="cx-in" id="' + p + 'email" name="email" type="email" required maxlength="100" value="' + esc(v.email || (curUser && curUser.email) || '') + '" placeholder="test@example.com" autocomplete="off"></div>' +
      '<div class="field">' + lbl(p + 'phone', '연락처') + '<input class="cx-in" id="' + p + 'phone" name="phone" type="tel" maxlength="30" value="' + esc(v.phone || '') + '" placeholder="회신받을 전화번호" autocomplete="off"></div>';
  }
  var CONSENT = '<label class="cx-check"><input type="checkbox" name="demo" required><span>실제 접수·전송이 없는 시연 화면이에요. 테스트 값으로 입력해주세요.</span></label>';
  var YURI = '<div class="cx-svc"><strong>일정은 이메일로 안내해 드려요</strong><p>유리가 담당 애널리스트에게 요청을 전달하고, 조율 결과와 확정 여부를 이메일로 보내 드려요. 요청만으로 일정이 확정되지는 않아요.</p></div>';
  function loginHint() {
    return signedIn() ? '' : '<div class="cx-mini">로그인하면 이메일이 자동으로 채워지고 신청 내역을 계정 기준으로 볼 수 있어요. <button type="button" class="btn btn--text btn--sm" data-login>로그인</button></div>';
  }

  /* ═════════ 행사 신청 — 입력 → 내용 확인 → 기록 ═════════ */
  function apply(id, values) {
    var e = byId(id); if (!e || !st(e).can) { if (e) detail(id); return; }
    values = values || {};
    showDialog('<span class="badge cx-badge--neutral cx-dcat" style="--dot:' + catOf(e.cat).dot + '"><i aria-hidden="true"></i>' + esc(filterLabel(e.cat)) + '</span>' +
      '<h2 class="cx-dtitle">' + esc(e.title) + ' 신청</h2>' +
      '<p class="cx-lead">' + esc([dateLabel(e) + (e.time ? ' ' + e.time : ''), where(e)].filter(Boolean).join(' · ')) + '</p>' + loginHint() +
      '<form data-kind="apply" data-event="' + e.id + '"><div class="cx-fields">' + personFields('ap-', values) +
        '<div class="field full">' + lbl('ap-q', '미리 묻고 싶은 내용') + '<textarea class="cx-in" id="ap-q" name="question" maxlength="1000" placeholder="행사에서 확인하고 싶은 내용을 적어주세요.">' + esc(values.question || '') + '</textarea></div>' +
      '</div>' +
      '<label class="cx-check"><input type="checkbox" name="eligible" required><span>' + esc(eligLong(e)) + ' 대상이며 위 자격 조건에 해당해요.</span></label>' + CONSENT +
      '<div class="cx-formacts"><button class="btn btn--primary btn--sm" type="submit">입력 내용 확인 ' + ARROW + '</button></div>' +
      '</form>', catOf(e.cat).label.toUpperCase() + ' · REGISTRATION');
  }

  /* ═════════ 개별 문의 — 참여 문의(NDR) · 실적발표 문의 · 일반(대기) 문의 ═════════ */
  var REQ = {
    ndr: { type: '참여 문의', desc: 'NDR은 초청으로 참여하는 행사예요. 관심 섹터를 남기면 담당 애널리스트가 미팅 가능 시간을 안내해요.' },
    earnings: { type: '실적발표 문의', desc: '관심 기업과 확인하고 싶은 분기를 남겨주세요.' },
    general: { type: '일반 문의', desc: '희망 주제와 담당자를 골라 문의해주세요.' }
  };
  function requestFields(kind, p, v, ev) {
    var anSel = function () { return '<div class="field full">' + lbl(p + 'analyst', '담당자') + '<select class="cx-in" id="' + p + 'analyst" name="analyst"><option value="">담당자 선택</option>' + opt(ANALYSTS, v.analyst) + '</select></div>'; };
    var body = kind === 'ndr'
      ? '<div class="field full">' + lbl(p + 'sector', '관심 섹터', true) + '<select class="cx-in" id="' + p + 'sector" name="sector" required><option value="">섹터 선택</option>' + opt(SECTORS, v.sector) + '</select></div>'
      : kind === 'earnings'
      ? '<div class="field">' + lbl(p + 'company', '관심 기업', true) + '<input class="cx-in" id="' + p + 'company" name="company" required maxlength="100" value="' + esc(v.company || '') + '"></div>' +
        '<div class="field">' + lbl(p + 'quarter', '확인하고 싶은 분기') + '<input class="cx-in" id="' + p + 'quarter" name="quarter" maxlength="40" value="' + esc(v.quarter || '') + '" placeholder="예: 2026년 3분기"></div>' + anSel()
      : '<div class="field full">' + lbl(p + 'topic', '희망 주제', true) + '<input class="cx-in" id="' + p + 'topic" name="topic" required maxlength="100" value="' + esc(v.topic != null ? v.topic : ev ? ev.title : '') + '"></div>' + anSel();
    return '<div class="cx-fields">' + body + personFields(p, v) +
      '<div class="field full">' + lbl(p + 'message', '문의 내용') + '<textarea class="cx-in" id="' + p + 'message" name="message" maxlength="1200" placeholder="궁금한 내용을 적어주세요.">' + esc(v.message || '') + '</textarea></div></div>';
  }
  function request(kind, values, forId) {
    var ev = forId && byId(forId), q = REQ[kind] || REQ.general;
    showDialog('<h2 class="cx-dtitle">' + (ev ? esc(ev.title) + ' · ' : '') + q.type + '</h2>' +
      '<p class="cx-lead">' + q.desc + '</p>' +
      '<p class="cx-formnote">공개 일정에 올리지 않는 개별 문의예요 · 시연에서는 서버로 전송하지 않아요.</p>' + loginHint() +
      '<form data-kind="' + kind + '"' + (ev ? ' data-event="' + ev.id + '"' : '') + '>' + requestFields(kind, 'rq-', values || {}, ev) +
        (kind !== 'ndr' ? YURI : '') + CONSENT +
        '<div class="cx-formacts"><button class="btn btn--primary btn--sm" type="submit">입력 내용 확인 ' + ARROW + '</button></div>' +
      '</form>', 'INDIVIDUAL INQUIRY');
  }

  /* ═════════ 세미나 요청 폼 (탭 안) ═════════ */
  function seminarFields(p) {
    return '<div class="cx-fields">' +
      '<div class="field full"><span class="field__label">어떻게 고를까요?</span>' +
        '<div class="cx-seg" role="group" aria-label="세미나 요청 기준"><button type="button" data-pick-by="sector" aria-pressed="true">섹터로 선택</button><button type="button" data-pick-by="analyst" aria-pressed="false">애널리스트로 선택</button></div>' +
        '<input type="hidden" name="selectBy" value="sector"></div>' +
      '<div class="field full" data-by="sector">' + lbl(p + 'sector', '관심 섹터', true) + '<select class="cx-in" id="' + p + 'sector" name="sector" required><option value="">섹터 선택</option>' + opt(SECTORS) + '</select></div>' +
      '<div class="field full" data-by="analyst" hidden>' + lbl(p + 'analyst', '애널리스트', true) + '<select class="cx-in" id="' + p + 'analyst" name="analyst" disabled><option value="">애널리스트 선택</option>' + opt(ANALYSTS) + '</select></div>' +
      '<div class="field full">' + lbl(p + 'question', '궁금한 내용', true) + '<textarea class="cx-in" id="' + p + 'question" name="question" required maxlength="1200" placeholder="예: 메모리 업황 전망과 하반기 실적 점검"></textarea></div>' +
      '<div class="field">' + lbl(p + 'date', '희망 일정') + '<input class="cx-in" id="' + p + 'date" name="preferred" type="date" min="' + TODAY + '"></div>' +
      '<div class="field">' + lbl(p + 'fmt', '진행 방식') + '<select class="cx-in" id="' + p + 'fmt" name="format">' + opt(['온라인(화상)', '방문(기관 사무실)', '유진 본사', '협의 후 결정']) + '</select></div>' +
      '<div class="field">' + lbl(p + 'aud', '참석 대상') + '<select class="cx-in" id="' + p + 'aud" name="audience">' + opt(['운용역·애널리스트', '법인 경영진·재무 담당', 'WM 고객', '기타']) + '</select></div>' +
      '<div class="field">' + lbl(p + 'cnt', '예상 인원') + '<input class="cx-in" id="' + p + 'cnt" name="attendees" type="number" min="1" max="10000" inputmode="numeric" placeholder="명"></div>' +
      personFields(p) +
    '</div>';
  }
  function toggleBy(form, val) {
    form.elements.selectBy.value = val;
    $$('[data-pick-by]', form).forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.pickBy === val)); });
    $$('[data-by]', form).forEach(function (f) { var on = f.dataset.by === val, s = $('select', f); f.hidden = !on; s.disabled = !on; s.required = on; });
  }

  /* ═════════ 외부 행사 폼 — 행사 주선 문의 / 행사 제안 ═════════ */
  function renderExternalForm() {
    if ($('#cx-ext-form')) return;
    $('#cx-ext-area').innerHTML = '<form id="cx-ext-form" data-kind="external" data-inline novalidate>' +
      '<div class="cx-seg cx-seg--form" role="group" aria-label="문의 방식"><button type="button" data-ext-mode="inquiry" aria-pressed="true">행사 주선 문의</button><button type="button" data-ext-mode="propose" aria-pressed="false">행사 제안</button></div>' +
      '<h3 id="ex-head">행사 주선 문의</h3>' +
      '<input type="hidden" name="requestMode" value="inquiry">' +
      '<div class="cx-fields">' +
        '<div class="field full">' + lbl('ex-type', '행사 유형', true) + '<select class="cx-in" id="ex-type" name="inquiryType" required><option value="">선택해주세요</option>' + opt(['산업·테마 세미나', '기업 인사이트 세션', '연사 초청·행사 협업', '기타']) + '</select></div>' +
        '<div class="field full"><label class="field__label" for="ex-topic" id="ex-topic-lbl">관심 행사 또는 주제<span class="req">*</span></label><input class="cx-in" id="ex-topic" name="topic" required maxlength="100"></div>' +
        '<div class="field">' + lbl('ex-date', '희망 일정') + '<input class="cx-in" id="ex-date" name="preferred" type="date" min="' + TODAY + '"></div>' +
        '<div class="field">' + lbl('ex-loc', '장소 또는 방식') + '<input class="cx-in" id="ex-loc" name="location" maxlength="100" placeholder="예: 기관 사무실, 온라인"></div>' +
        '<div class="field full"><label class="field__label" for="ex-need" id="ex-need-lbl">필요한 내용<small>선택</small></label><textarea class="cx-in" id="ex-need" name="need" maxlength="1200" placeholder="행사 목적, 참석 대상, 궁금한 내용을 남겨주세요."></textarea></div>' +
        personFields('ex-') +
      '</div>' + CONSENT +
      '<div class="cx-formacts"><button class="btn btn--primary btn--sm" type="submit"><span id="ex-submit">입력 내용 확인</span> ' + ARROW + '</button></div>' +
    '</form>';
  }
  function setExtMode(mode, focus) {
    renderExternalForm();
    var f = $('#cx-ext-form'), p = mode === 'propose';
    f.elements.requestMode.value = p ? 'propose' : 'inquiry';
    $$('[data-ext-mode]', f).forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.extMode === mode)); });
    $('#ex-head').textContent = p ? '행사 제안' : '행사 주선 문의';
    $('#ex-topic-lbl').innerHTML = (p ? '제안하는 주제' : '관심 행사 또는 주제') + '<span class="req">*</span>';
    $('#ex-topic').placeholder = p ? '예: 반도체 기업의 현장 이야기를 듣고 싶어요' : '';
    $('#ex-need-lbl').innerHTML = (p ? '제안 배경' : '필요한 내용') + '<small>선택</small>';
    $('#ex-submit').textContent = p ? '제안 내용 확인' : '입력 내용 확인';
    if (focus) { $('#cx-ext-area').scrollIntoView({ behavior: scrollBehavior(), block: 'start' }); $(p ? '#ex-type' : '#ex-topic').focus({ preventScroll: true }); }
  }

  /* ═════════ 입력 내용 확인 → 기록 ═════════ */
  var formData = function (form) { var o = {}; new FormData(form).forEach(function (v, k) { o[k] = v; }); return o; };
  // 화면에 보이는 칸만, 라벨 그대로 [라벨, 값]
  function fieldsOf(form) {
    var out = [];
    $$('input,select,textarea', form).forEach(function (el) {
      if (!el.name || el.type === 'checkbox' || el.type === 'hidden' || el.disabled || el.closest('[hidden]')) return;
      var v = String(el.value).trim(); if (!v) return;
      var l = form.querySelector('label[for="' + el.id + '"]'), t = el.name;
      if (l) { l = l.cloneNode(true); $$('.req,small', l).forEach(function (x) { x.remove(); }); t = l.textContent.trim(); }
      out.push([t, v]);
    });
    return out;
  }
  function confirmDraft(form) {
    var raw = formData(form), kind = form.dataset.kind, ev = form.dataset.event && byId(form.dataset.event);
    var type = kind === 'apply' ? '행사 신청' : kind === 'seminar' ? '세미나 요청' : kind === 'external' ? (raw.requestMode === 'propose' ? '외부 행사 제안' : '외부 행사 주선 문의') : (REQ[kind] || REQ.general).type;
    var basis = raw.selectBy === 'analyst' ? '애널리스트로 선택' : '섹터로 선택';
    var title = ev ? ev.title : kind === 'seminar' ? ((raw.selectBy === 'analyst' ? raw.analyst : raw.sector) || '').split(' · ')[0] + ' 세미나'
      : kind === 'earnings' ? '실적발표 문의' : kind === 'external' ? raw.topic : '개별 문의';
    var fields = (kind === 'apply' ? [['행사', ev.title], ['일시', dateLabel(ev) + (ev.time ? ' ' + ev.time : '')]] : ev ? [['행사', ev.title]] : kind === 'seminar' ? [['요청 기준', basis]] : []).concat(fieldsOf(form));
    var yuri = kind === 'seminar' || kind === 'earnings' || kind === 'general';
    draft = { kind: kind, type: type, title: title, eventId: ev ? ev.id : '', fields: fields, raw: raw, yuri: yuri, inline: form.hasAttribute('data-inline') };
    showDialog('<h2 class="cx-dtitle">' + esc(type) + ' · 입력 내용 확인</h2>' +
      '<p class="cx-lead">입력 내용은 이 브라우저의 시연 기록으로만 남고 실제로 전송되지 않아요.</p>' +
      '<dl class="cx-sum">' + fields.map(function (f) { return '<dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd>'; }).join('') + '</dl>' +
      (yuri ? YURI : '') +
      '<div class="cx-formacts"><button type="button" class="btn btn--secondary btn--sm" data-edit>수정하기</button><button type="button" class="btn btn--primary btn--sm" data-complete>기록하기 ' + ARROW + '</button></div>', 'REVIEW');
  }
  function editDraft() {
    if (!draft) return;
    var d = draft;
    if (d.inline) { closeDialog(); return; }
    if (d.kind === 'apply') apply(d.eventId, d.raw); else request(d.kind, d.raw, d.eventId);
  }
  function complete() {
    if (!draft) return;
    var d = draft; draft = null;
    var ev = d.eventId && byId(d.eventId), data = Object.assign({}, d.raw);
    delete data.demo; delete data.eligible;
    R.add(Object.assign(data, { kind: d.kind === 'apply' ? 'apply' : 'request', type: d.type, title: d.title, eventId: d.eventId || null,
      email: data.email || '', cat: ev ? ev.cat : '', date: ev ? ev.start : data.preferred || '', fields: d.fields }));
    if (d.inline) {
      var f = d.kind === 'external' ? $('#cx-ext-form') : $('#cx-seminar-form');
      if (f) { f.reset(); if (d.kind === 'external') setExtMode('inquiry'); else toggleBy(f, 'sector'); }
    }
    var done = josa(d.type, '이', '가') + ' 기록됐어요';
    showDialog('<div class="cx-center"><div class="cx-ok" aria-hidden="true">✓</div><h2 class="cx-dtitle">' + esc(done) + '</h2>' +
      '<p class="cx-lead">‘내 신청·문의’와 일정 목록의 신청 상태에 바로 반영했어요. 실제 접수·이메일 발송은 일어나지 않았어요.</p></div>' +
      (d.yuri ? YURI : '') +
      '<div class="cx-formacts"><button type="button" class="btn btn--secondary btn--sm" data-close>닫기</button><button type="button" class="btn btn--primary btn--sm" data-my>내 신청·문의 보기</button></div>', 'COMPLETE');
    toast(done + '.');
  }
  function myRecords() {
    var list = R.list().slice().reverse();
    var when = function (iso) { var t = new Date(iso); return isNaN(t) ? '' : dot(iso.slice(0, 10)) + ' ' + ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2) + ' 기록'; };
    showDialog('<h2 class="cx-dtitle">내 신청·문의</h2><p class="cx-lead">' + (curUser ? esc(curUser.email) + ' 계정으로 로그인 중 · ' : '') + '이 브라우저에서 진행한 시연 기록이에요.</p>' +
      (signedIn() ? '' : '<p class="cx-formnote">로그인하면 신청 폼의 이메일이 자동으로 채워져요.</p>') +
      (list.length ? list.map(function (r) {
        return '<div class="cx-myitem"><div class="cx-myitem__b"><span class="badge ' + (r.kind === 'apply' ? 'badge--brand' : 'cx-badge--neutral') + '">' + esc(r.type) + '</span>' +
          '<h4>' + esc(r.title) + '</h4><p>' + when(r.at || '') + '</p></div>' +
          (r.eventId && byId(r.eventId) && TERMS[byId(r.eventId).cat] ? '<button type="button" data-detail="' + esc(r.eventId) + '">상세</button>' : '') +
          '<button type="button" data-remove="' + esc(r.id) + '" aria-label="' + esc(r.title) + ' 기록 삭제">기록 삭제</button></div>';
      }).join('') : '<div class="cx-empty">아직 신청·문의 기록이 없어요.</div>') +
      '<div class="cx-formacts"><button type="button" class="btn btn--secondary btn--sm" data-close>닫기</button></div>', 'MY REQUESTS');
  }

  /* ═════════ 탭 · 이벤트 연결 ═════════ */
  var panels = { internal: $('#panel-internal'), seminar: $('#panel-seminar'), external: $('#panel-external') };
  function showTab(tab) {
    state.tab = tab;
    Object.keys(panels).forEach(function (k) { panels[k].hidden = k !== tab; });
    panels[tab].classList.remove('fade-up'); void panels[tab].offsetWidth; panels[tab].classList.add('fade-up');
    if (tab === 'external') renderExternalForm();
    if (history.replaceState) { if (tab === 'internal') syncUrl(); else history.replaceState(null, '', location.pathname + '#' + tab); }
  }
  var tabs = wireTabsA11y($('#cx-tabs'), showTab);
  function gotoTab(tab) { tabs.select(tab); $('#cx-tabs').scrollIntoView({ behavior: scrollBehavior(), block: 'nearest' }); }

  // 세미나 탭 폼 필드
  $('[data-fields="seminar"]').outerHTML = seminarFields('sm-');

  document.addEventListener('click', function (ev) {
    // 책 · 아래 카테고리 탭 · 공전 토글 · 패널 닫기는 orbit-books.js가 처리해요
    var b = ev.target.closest('button'); if (!b || b.closest('.ob-book,.ob__tabs,.ob__toggle,[data-ob-close]')) return;
    var ds = b.dataset;
    if (ds.filter) { setCat(ds.filter); return; }
    if ('jump' in ds) { jumpToExplore(); return; }
    if (ds.goto) { closeDialog(); gotoTab(ds.goto); if (ds.goto === 'external') setExtMode('inquiry', true); return; }
    if (ds.phase) { state.phase = ds.phase; setPressed('#cx-phase [data-phase]', function (x) { return x === b; }); focusMonth(); renderExplore(); syncUrl(); return; }
    if (ds.view) { state.view = ds.view; setPressed('#cx-view [data-view]', function (x) { return x === b; }); if (state.view === 'calendar') focusMonth(); renderExplore(); syncUrl(); return; }
    if ('month' in ds) {
      state.calM += +ds.month;
      if (state.calM < 0) { state.calM = 11; state.calY--; } if (state.calM > 11) { state.calM = 0; state.calY++; }
      renderCalendar();
      var nb = $('#cx-calendar [data-month="' + ds.month + '"]'); if (nb) nb.focus();
      return;
    }
    if ('reset' in ds) {
      state.analyst = 'all'; state.elig = 'all'; state.openOnly = false; state.q = '';
      $('#cx-analyst').value = 'all'; $('#cx-elig').value = 'all'; $('#cx-open').checked = false; $('#cx-q').value = '';
      setCat('all'); return;
    }
    if (ds.detail) { detail(ds.detail); return; }
    if (ds.apply) { apply(ds.apply); return; }
    if ('login' in ds) { closeDialog(); if (typeof openAuth === 'function') openAuth('로그인하면 신청 폼의 이메일이 자동으로 채워져요.'); return; }
    if (ds.request) { request(ds.request, {}, ds.event || ''); return; }
    if (ds.pickBy) { toggleBy(b.form, ds.pickBy); return; }
    if (ds.ext) {
      setExtMode('inquiry'); $('#ex-type').value = ds.ext;
      $('#cx-ext-area').scrollIntoView({ behavior: scrollBehavior(), block: 'start' }); $('#ex-topic').focus({ preventScroll: true }); return;
    }
    if (ds.extMode) { setExtMode(ds.extMode, !b.closest('#cx-ext-form')); return; }
    if ('my' in ds) { myRecords(); return; }
    if ('edit' in ds) { editDraft(); return; }
    if ('complete' in ds) { complete(); return; }
    if (ds.remove) { R.remove(ds.remove); toast('기록을 삭제했어요.'); myRecords(); return; }
    if ('close' in ds) { closeDialog(); return; }
  });
  document.addEventListener('submit', function (ev) {
    var f = ev.target; if (!f.dataset.kind) return;
    ev.preventDefault();
    if (f.reportValidity()) confirmDraft(f);
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.id === 'cx-elig') { state.elig = t.value; renderExplore(); }
    if (t.id === 'cx-analyst') { state.analyst = t.value; renderExplore(); }
    if (t.id === 'cx-open') { state.openOnly = t.checked; renderExplore(); }
  });
  $('#cx-q').addEventListener('input', function (e) { state.q = e.target.value.trim(); if (state.view === 'calendar') focusMonth(); renderExplore(); });
  R.onChange(function () { renderAll(); });

  /* ═════════ 시작 — ?category= · ?view= · ?phase= · ?event= · #seminar · #external · #my ═════════ */
  $('#cx-analyst').insertAdjacentHTML('beforeend', ANALYST_LIST.map(function (a) { return '<option value="' + esc(a[0]) + '">' + esc(a[0] + ' · ' + a[1]) + '</option>'; }).join(''));
  var initTab = location.hash.slice(1), init = new URLSearchParams(location.search);
  var initCat = init.get('category') || init.get('cat');
  if (catOf(initCat)) state.cat = initCat;
  if (init.get('view') === 'calendar') { state.view = 'calendar'; setPressed('#cx-view [data-view]', function (x) { return x.dataset.view === 'calendar'; }); }
  if (init.get('phase') === 'past') { state.phase = 'past'; setPressed('#cx-phase [data-phase]', function (x) { return x.dataset.phase === 'past'; }); }
  if (panels[initTab] && initTab !== 'internal') tabs.select(initTab);
  focusMonth(); renderAll();
  if (state.cat !== 'all' && orbit) orbit.select(state.cat);
  var initEvent = init.get('event');
  if (initEvent && byId(initEvent)) detail(initEvent);
  else if ((init.has('view') || init.has('category') || init.has('cat')) && state.tab === 'internal') jumpToExplore();
  if (initTab === 'my') myRecords();
})();
