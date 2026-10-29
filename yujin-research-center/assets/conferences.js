// Events 페이지 (7-6) — 상단 Orbit Books(카테고리) / 하단 목록·캘린더 탐색 / 신청 · 문의 다이얼로그 / 세미나 요청 · 외부 행사 탭
// 행사 데이터는 events-data.js(IL_EVENTS), 기록은 conf-records.js(ILConf). 실제 접수 · 전송은 없어요.
(function () {
  'use strict';
  var D = window.IL_EVENTS, R = window.ILConf;
  if (!D || !R) { console.warn('[IL] 행사 모듈을 불러오지 못했어요'); return; }
  var TODAY = D.TODAY, EVENTS = D.EVENTS;
  var sess = (window.IL && IL.session()) || {};
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var scrollBehavior = function () { return reduced.matches ? 'auto' : 'smooth'; };
  var ARROW = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';

  // 하단 필터는 배너 책(CATS 6개)과 이름 · 순서가 달라요. Earnings Call은 필터에서만 빠지고 '전체'와 책에서는 보여요.
  var FILTERS = [['corp', '콥데이'], ['ndr', 'NDR'], ['ipo', 'IPO'], ['ai', 'Conference'], ['wm', 'WM특화세미나']];
  var SERIES_NAME = { mna: '매월 진행', corpday: '분기마다 진행' };
  var SECTORS = ['반도체 · IT', '2차전지 · 소재', '모빌리티 · 산업재', '금융 · 디지털자산', '소비재 · 유통', '매크로 · 투자전략', '기타 / 담당자 상담'];
  var ANALYSTS = ['윤태오 · 반도체/IT', '서지우 · IPO·M&A', '한도윤 · 2차전지·소재', '정하린 · 자산배분·WM', '강서진 · 투자전략', '오민재 · 인터넷·플랫폼', '이도현 · AI·디지털금융'];
  var TONE = { brand: 'badge--brand', warn: 'cx-badge--warn', muted: 'badge--muted', neutral: 'cx-badge--neutral', point: 'badge--point' };

  /* ═════════ 유틸 ═════════ */
  var catOf = D.catOf, md = D.md, dot = D.dot, wd = D.dow;
  var filterLabel = function (id) { var f = FILTERS.filter(function (x) { return x[0] === id; })[0]; return f ? f[1] : (catOf(id) || {}).label || ''; };
  var mineFor = function (id) { return R.find(id); };
  // 내가 신청한 자리는 잔여석에서 빼서 보여 줘요
  var seatsLeft = function (e) { var m = mineFor(e.id); return Math.max(0, (e.seats || 0) - (m && m.kind === 'apply' ? 1 : 0)); };
  var srcTag = function (e) { return e.source === 'roster' || e.source === 'notice' ? '' : '<span class="cx-sample">' + (e.source === 'pattern' ? '예정' : '예시') + '</span>'; };
  var srcLabel = function (e) { return e.source === 'roster' ? ' · 2026 행사내역(가상)' : e.source === 'notice' ? ' · 안내문 기준(가상)' : e.source === 'pattern' ? ' · 예정(일정 미확정)' : ' · 예시 일정'; };
  // 담당 · 시간 · 장소처럼 있는 정보만 이어 붙여요
  var metaOf = function (e) {
    return [e.analysts && e.analysts.length ? '담당 ' + e.analysts.join(', ') : '', e.time, D.where(e)].filter(Boolean).join(' · ') || '세부 정보 추후 안내';
  };
  var upcomingOf = function (cat) { return EVENTS.filter(function (e) { return e.cat === cat && !D.isPast(e); }).sort(byStart); };
  var byStart = function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; };
  var badgeCls = function (r) { return TONE[r.tone] || 'badge--muted'; };

  var curUser = null;
  if (typeof getUser === 'function') getUser().then(function (u) { curUser = u; });
  if (typeof onAuth === 'function') onAuth(function (u) { curUser = u; });

  /* ═════════ 상태 ═════════ */
  var state = { tab: 'internal', cat: 'all', phase: 'upcoming', elig: 'all', analyst: 'all', openOnly: false, q: '', view: 'list', calY: 0, calM: 0 };

  function filtered(anyPhase) {
    var q = state.q.toLowerCase();
    return EVENTS.filter(function (e) {
      if (!anyPhase && D.isPast(e) !== (state.phase === 'past')) return false;
      if (state.cat !== 'all' && e.cat !== state.cat) return false;
      if (state.elig !== 'all' && (e.elig || []).indexOf(state.elig) < 0) return false;
      if (state.analyst !== 'all' && (e.analysts || []).indexOf(state.analyst) < 0) return false;
      if (state.openOnly && !D.status(e).can) return false;
      if (q) {
        var c = catOf(e.cat);
        var days = (e.days || []).map(function (d) { return d.sessions.map(function (s) { return s[1] + ' ' + s[2]; }).join(' '); }).join(' ');
        var hay = [e.title, c.label, c.ko, e.place, e.format, e.cond, days].concat(e.tags || [], e.analysts || []).join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    }).sort(function (a, b) { return state.phase === 'past' ? byStart(b, a) : byStart(a, b); });
  }

  /* ═════════ 상단: 카테고리 책 (고르면 왼쪽에서 펼쳐지고 오른쪽에 카테고리 패널) ═════════ */
  var dateShort = function (e) { return e.tba ? e.tba : md(e.start) + (e.end && e.end !== e.start ? '–' + md(e.end) : ''); };
  var pastOf = function (cat) { return EVENTS.filter(function (e) { return e.cat === cat && D.isPast(e) && e.source; }); };
  var orbit = window.OrbitBooks ? OrbitBooks.mount($('#cx-orbit'), {
    books: D.CATS, center: 'Insight.',
    info: function (c) {
      var up = upcomingOf(c.id), open = up.filter(function (e) { return D.status(e).can; }).length, next = up[0];
      return {
        next: next ? 'NEXT · ' + (next.tba ? next.tba.replace(' 중', '') + ' 예정' : md(next.start) + ' (' + wd(next.start) + ')') : 'NEXT · 추후 안내',
        title: next ? next.title : c.ko + ' 일정 준비 중', up: up.length, open: open,
        meta: next ? '다음 ' + dateShort(next) + ' · 예정 ' + up.length + '건' + (open ? ' · 신청 가능 ' + open : '') : '예정 일정 없음'
      };
    },
    panel: function (c) {
      var up = upcomingOf(c.id), past = pastOf(c.id), list = (up.length ? up : past.slice().reverse()).slice(0, 4);
      return '<p class="obp__k">' + esc(c.ed) + '</p>' +
        '<h3 class="obp__t">' + esc(c.label) + '<span>' + esc(c.ko) + '</span></h3>' +
        '<p class="obp__d">' + esc(c.desc) + '</p>' +
        '<div class="obp__stat"><span>예정 <b>' + up.length + '</b>건</span>' + (past.length ? '<span>2026년 <b>' + past.length + '</b>회 진행</span>' : '') + '</div>' +
        '<p class="obp__h">' + (up.length ? '다가오는 일정' : past.length ? '최근 진행한 행사' : '예정된 행사가 없어요') + '</p>' +
        (list.length ? '<ul class="obp__list">' + list.map(function (e) {
          var r = D.status(e);
          return '<li><button type="button" data-detail="' + e.id + '"><time>' + esc(dateShort(e)) + '</time><span><b>' + esc(e.title) + '</b>' +
            '<em>' + esc([(e.analysts || []).join(', '), r.label].filter(Boolean).join(' · ')) + srcTag(e) + '</em></span></button></li>';
        }).join('') + '</ul>' : '<p class="obp__none">담당자에게 일정을 문의해 주세요.</p>') +
        '<div class="obp__acts"><button type="button" class="btn btn--primary btn--sm" data-jump>' + esc(c.ko) + ' 일정 보기 ' + ARROW + '</button>' +
          '<button type="button" class="btn btn--text btn--sm" data-ob-close>← 다른 행사 보기</button></div>';
    },
    onSelect: function (id) { setCat(id || 'all'); }
  }) : null;

  /* ═════════ 하단: 카테고리 칩 · 목록 · 캘린더 ═════════ */
  function renderCats() {
    var base = EVENTS.filter(function (e) { return D.isPast(e) === (state.phase === 'past'); });
    var chip = function (id, label, n, dotc) {
      return '<button type="button" class="chip' + (state.cat === id ? ' is-active' : '') + '" data-filter="' + id + '" aria-pressed="' + (state.cat === id) + '"' +
        (dotc ? ' style="--dot:' + dotc + '"' : '') + '>' + (dotc ? '<i aria-hidden="true"></i>' : '') + esc(label) + ' <span class="c">' + n + '</span></button>';
    };
    $('#cx-cats').innerHTML = chip('all', '전체', base.length) + FILTERS.map(function (f) {
      return chip(f[0], f[1], base.filter(function (e) { return e.cat === f[0]; }).length, catOf(f[0]).dot);
    }).join('');
  }

  function badgesOf(e) {
    var r = D.status(e), mine = mineFor(e.id), out = [];
    if (mine) out.push('<span class="badge cx-badge--mine">✓ ' + (mine.kind === 'apply' ? '신청 완료' : '문의 접수') + '</span>');
    out.push('<span class="badge ' + badgeCls(r) + '">' + esc(r.label) + '</span>');
    if (e.cap && !D.isPast(e) && r.key !== 'full' && r.key !== 'soon') out.push('<span class="badge badge--muted">잔여 ' + seatsLeft(e) + '/' + e.cap + '석</span>');
    (e.elig || []).forEach(function (k) { out.push('<span class="badge cx-badge--neutral">' + esc(D.ELIG[k]) + '</span>'); });
    return out.join('');
  }
  function ctaOf(e, cls) {
    cls = cls == null ? 'btn--sm' : cls;
    var r = D.status(e), mine = mineFor(e.id);
    if (mine) return '<button type="button" class="btn btn--secondary ' + cls + '" data-my>신청 내역</button>';
    if (r.can) return '<button type="button" class="btn btn--primary ' + cls + '" data-apply="' + e.id + '">신청하기 ' + ARROW + '</button>';
    if (r.ask) return '<button type="button" class="btn btn--secondary ' + cls + '" data-request="ndr" data-event="' + e.id + '">참여 문의</button>';
    if (r.key === 'tba') return '<button type="button" class="btn btn--secondary ' + cls + '" data-request="interest" data-event="' + e.id + '">관심 등록</button>';
    if (e.days) return '<button type="button" class="btn btn--secondary ' + cls + '" data-detail="' + e.id + '">참여기업 보기</button>';
    var off = { full: '정원 마감', closed: '종료된 행사', ended: '신청 마감' }[r.key] || '신청 준비 중';
    return '<button type="button" class="btn btn--secondary ' + cls + '" disabled>' + off + '</button>';
  }

  function renderList() {
    var rows = filtered(), prev = '';
    $('#cx-count').innerHTML = '<b>' + rows.length + '</b>개의 ' + (state.phase === 'past' ? '지난' : '예정') + ' 일정' + (state.cat !== 'all' ? ' · ' + esc(catOf(state.cat).label) : '');
    if (!rows.length) {
      $('#cx-list').innerHTML = '<div class="cx-empty">조건에 맞는 일정이 없어요.<br><button type="button" class="btn btn--secondary btn--sm" data-reset>필터 초기화</button></div>';
      return;
    }
    $('#cx-list').innerHTML = rows.map(function (e, i) {
      var p = e.start.split('-'), c = catOf(e.cat), past = D.isPast(e);
      var mon = p[0] + '년 ' + (+p[1]) + '월';
      var head = mon !== prev ? '<h3 class="cx-month">' + mon + '<span>' + (state.phase === 'past' ? '지난 행사' : '예정 행사') + '</span></h3>' : '';
      prev = mon;
      var sc = D.seriesCount(e);
      return head + '<article class="cx-row' + (past ? ' is-past' : '') + (reduced.matches ? '' : ' in') + '" style="--dot:' + c.dot + ';--d:' + Math.min(i, 6) * 45 + 'ms">' +
        '<div class="cx-date" aria-label="' + esc(D.dateLabel(e)) + '"><div class="m">' + p[1] + '월</div><div class="d">' + (e.tba ? '–' : +p[2]) + '</div>' +
          '<div class="w">' + (e.tba ? '일정 미정' : wd(e.start) + '요일') + '</div>' + (e.end && e.end !== e.start ? '<div class="r">~' + md(e.end) + '</div>' : '') + '</div>' +
        '<div class="cx-row__body">' +
          '<span class="cx-cat"><i aria-hidden="true"></i>' + esc(c.label) + srcTag(e) + '</span>' +
          '<button type="button" class="cx-title" data-detail="' + e.id + '">' + esc(e.title) + '</button>' +
          '<div class="cx-meta">' + esc(metaOf(e)) + '</div>' +
          (e.cond ? '<div class="cx-meta">자격 · ' + esc(e.cond) + (e.deadline && !past ? ' · 마감 ' + md(e.deadline) : '') + '</div>' : '') +
          (sc > 1 ? '<div class="cx-meta">' + (SERIES_NAME[e.series] || '정기 행사') + ' · 2026년 ' + sc + '회</div>' : '') +
          '<div class="cx-badges">' + badgesOf(e) + '</div>' +
        '</div>' +
        '<div class="cx-acts">' + ctaOf(e) + '<button type="button" class="cx-more" data-detail="' + e.id + '">상세 보기</button></div>' +
      '</article>';
    }).join('');
  }

  function focusMonth() {
    var first = filtered()[0] || EVENTS.filter(function (e) { return D.isPast(e) === (state.phase === 'past'); })[0];
    var iso = first ? first.start : TODAY;
    state.calY = +iso.slice(0, 4); state.calM = +iso.slice(5, 7) - 1;
  }
  // 캘린더는 지난 · 예정 일정을 함께 보여 줘요(지난 일정은 흐리게)
  function renderCalendar() {
    var y = state.calY, m = state.calM, ym = y + '-' + ('0' + (m + 1)).slice(-2);
    var first = new Date(y, m, 1).getDay(), last = new Date(y, m + 1, 0).getDate();
    var rows = filtered(true).filter(function (e) { return !e.tba && e.start <= ym + '-31' && D.endOf(e) >= ym + '-01'; }).sort(byStart);
    var blank = '<div class="cx-cell is-blank" aria-hidden="true"></div>';
    var cells = D.DOW.map(function (d, i) { return '<div class="cx-dow' + (i === 0 ? ' is-sun' : i === 6 ? ' is-sat' : '') + '">' + d + '</div>'; }).join('') + new Array(first + 1).join(blank);
    for (var d = 1; d <= last; d++) {
      var iso = ym + '-' + ('0' + d).slice(-2);
      var inDay = rows.filter(function (e) { return e.start <= iso && D.endOf(e) >= iso; });
      cells += '<div class="cx-cell' + (iso === TODAY ? ' is-today' : '') + '"><span class="n">' + d + '</span>' + inDay.map(function (e) {
        return '<button type="button" class="cx-ev' + (D.isPast(e) ? ' is-past' : '') + '" style="--dot:' + catOf(e.cat).dot + '" data-detail="' + e.id + '" aria-label="' + dot(iso) + ' ' + esc(e.title) + ' 상세">' +
          '<b>' + esc(catOf(e.cat).label) + '</b><span>' + esc(e.title) + '</span></button>';
      }).join('') + '</div>';
    }
    cells += new Array((7 - (first + last) % 7) % 7 + 1).join(blank);
    $('#cx-count').innerHTML = '<b>' + rows.length + '</b>개의 일정 · ' + y + '년 ' + (m + 1) + '월';
    $('#cx-calendar').innerHTML = '<div class="cx-cal">' +
      '<div class="cx-cal__bar"><h3 aria-live="polite">' + y + '년 ' + (m + 1) + '월</h3><div class="cx-cal__nav">' +
        '<button type="button" data-month="-1" aria-label="이전 달">‹</button><button type="button" data-month="0">이번 일정</button><button type="button" data-month="1" aria-label="다음 달">›</button></div></div>' +
      '<div class="cx-grid">' + cells + '</div>' +
      '<div class="cx-agenda"><h4>이 달의 일정</h4>' + (rows.length ? rows.map(function (e) {
        var r = D.status(e);
        return '<button type="button" class="cx-ag" data-detail="' + e.id + '"><time>' + md(e.start) + (e.end && e.end !== e.start ? '~' : '') + '</time>' +
          '<span class="t">' + esc(e.title) + '</span><span class="badge ' + badgeCls(r) + '">' + esc(r.label) + '</span></button>';
      }).join('') : '<p class="cx-meta cx-agenda__empty">선택한 조건에 맞는 일정이 없는 달이에요. ‹ › 로 다른 달을 확인해주세요.</p>') + '</div>' +
    '</div>';
  }

  function renderExplore() {
    renderCats();
    $('#cx-list').hidden = state.view !== 'list'; $('#cx-calendar').hidden = state.view !== 'calendar';
    if (state.view === 'list') renderList(); else renderCalendar();
  }
  function syncMyCount() { var n = $('#cx-my-n'), k = R.list().length; n.textContent = k; n.toggleAttribute('data-zero', !k); }
  function renderAll() { renderExplore(); syncMyCount(); syncUrl(); if (orbit) orbit.refresh(); }

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
  var dlg = null, detailEv = null, draft = null;
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
    var e = D.byId(id); if (!e) { toast('행사 정보를 찾지 못했어요.'); return; }
    detailEv = e;
    var c = catOf(e.cat), mine = mineFor(e.id), sc = D.seriesCount(e), r = D.status(e);
    var prog = e.days
      ? '<h3>참여기업·일정 <small>· 안내문 기준 A/B 동시 진행</small></h3>' +
        '<div class="cx-daytabs" role="tablist" aria-label="행사 날짜">' + e.days.map(function (d, i) {
          return '<button type="button" role="tab" data-day="' + i + '" aria-selected="' + (i === 0) + '">' + md(d.date) + ' ' + wd(d.date) + '</button>';
        }).join('') + '</div><div id="cx-daytable"></div>'
      : '<h3>프로그램</h3><div class="cx-prog">' + (e.program ? e.program.map(function (p) {
          return '<div><time>' + esc(p[0]) + '</time><span>' + esc(p[1]) + (p[2] ? '<small>' + esc(p[2]) + '</small>' : '') + '</span></div>';
        }).join('') : '<p class="cx-meta">프로그램 확정 후 안내 예정</p>') + '</div>';
    var how = e.mode === 'invite' ? '초청 기반 · 담당 애널리스트 문의' : e.mode === 'tba' || e.tba ? '일정 확정 후 안내 · 관심 등록 가능' :
      e.openAt && e.openAt > TODAY ? dot(e.openAt) + ' 신청 오픈 예정' : e.deadline ? '온라인 신청 · 마감 ' + dot(e.deadline) + ' 18:00' : '추후 안내';
    var row = function (k, v) { return '<dt>' + k + '</dt><dd>' + v + '</dd>'; };
    showDialog(
      '<span class="badge cx-badge--neutral cx-dcat" style="--dot:' + c.dot + '"><i aria-hidden="true"></i>' + esc(c.label + srcLabel(e)) + '</span>' +
      '<h2 class="cx-dtitle">' + esc(e.title) + '</h2>' +
      '<p class="cx-lead">' + esc(e.intro || '') + '</p>' +
      '<div class="cx-badges">' + badgesOf(e) + '</div>' +
      '<dl class="cx-dl">' +
        row('일시', esc(D.dateLabel(e)) + (e.time ? '<br>' + esc(e.time) : '')) +
        (e.analysts && e.analysts.length ? row('담당', esc(e.analysts.join(', '))) : '') +
        (sc > 1 ? row('정기 행사', (SERIES_NAME[e.series] || '정기 행사') + ' · 2026년 ' + sc + '회 진행') : '') +
        row('장소·방식', esc(D.where(e)) || '추후 안내') +
        row('참여 대상', (e.elig || []).map(function (k) { return D.ELIG[k]; }).join(' · ') || '추후 안내') +
        (e.cond ? row('자격 조건', esc(e.cond)) : '') +
        row('신청 방식', how) +
        (e.cap ? row('정원', e.cap + '명 · ' + (D.isPast(e) ? '행사 종료' : '잔여 ' + seatsLeft(e) + '석')) : '') +
        row('내 신청 상태', mine ? (mine.kind === 'apply' ? '신청 완료' : '문의 접수') + ' · ' + dot(mine.at.slice(0, 10)) + ' (시연 기록)' : '미신청') +
      '</dl>' + prog +
      (e.notes ? '<h3>참여 안내</h3><div class="cx-prog">' + e.notes.map(function (n, i) { return '<div><time>0' + (i + 1) + '</time><span>' + esc(n) + '</span></div>'; }).join('') + '</div>' : '') +
      (r.ask ? '<div class="cx-mini">NDR은 기업 IR팀의 초청으로 진행돼요. 문의를 남기면 담당자가 초청 가능 여부를 확인해 안내해요.</div>' : '') +
      '<div class="cx-dfoot"><span class="cx-dfoot__meta">문의 · 유진투자증권 법인영업팀 · 리서치센터</span>' + ctaOf(e, '') + '</div>',
      c.label.toUpperCase());
    if (e.days) selectDay(e, 0);
  }
  function selectDay(e, i) {
    $$('[data-day]').forEach(function (b) { b.setAttribute('aria-selected', String(+b.dataset.day === i)); });
    var d = e.days[i];
    $('#cx-daytable').innerHTML = '<table class="cx-ab"><caption class="sr-only">' + dot(d.date) + ' 참여기업</caption>' +
      '<thead><tr><th scope="col">시작</th><th scope="col">A</th><th scope="col">B</th></tr></thead><tbody>' +
      d.sessions.map(function (s) { return '<tr><th scope="row">' + esc(s[0]) + '</th><td>' + esc(s[1]) + '</td><td>' + esc(s[2]) + '</td></tr>'; }).join('') + '</tbody></table>';
  }

  /* ═════════ 신청 — 로그인 안내 → 입력 → 내용 확인 → 완료 ═════════ */
  function personFields(p, v) {
    v = v || {};
    return '<div class="field"><label class="field__label" for="' + p + 'name">이름<span class="req">*</span></label><input class="cx-in" id="' + p + 'name" name="name" required maxlength="50" value="' + esc(v.name != null ? v.name : sess.name || '') + '" placeholder="테스트 이름" autocomplete="off"></div>' +
      '<div class="field"><label class="field__label" for="' + p + 'org">소속 기관<span class="req">*</span></label><input class="cx-in" id="' + p + 'org" name="org" required maxlength="80" value="' + esc(v.org != null ? v.org : sess.org || sess.branch || '') + '" placeholder="테스트 기관명" autocomplete="off"></div>' +
      '<div class="field"><label class="field__label" for="' + p + 'email">업무용 이메일<span class="req">*</span></label><input class="cx-in" id="' + p + 'email" name="email" type="email" required maxlength="100" value="' + esc(v.email || (curUser && curUser.email) || '') + '" placeholder="test@example.com" autocomplete="off"></div>' +
      '<div class="field"><label class="field__label" for="' + p + 'phone">연락처<small>선택</small></label><input class="cx-in" id="' + p + 'phone" name="phone" type="tel" maxlength="30" value="' + esc(v.phone || '') + '" placeholder="회신받을 전화번호" autocomplete="off"></div>';
  }
  var CONSENT = '<label class="cx-check"><input type="checkbox" name="demo" required><span>실제 접수·전송이 없는 시연 화면임을 확인했어요. 테스트 값으로 입력해주세요.</span></label>';

  function apply(id, skipLogin, values) {
    var e = D.byId(id); if (!e || !D.status(e).can) return;
    if (!curUser && !skipLogin) {
      showDialog('<h2 class="cx-dtitle">로그인하고 신청할까요?</h2>' +
        '<p class="cx-lead">로그인하면 이메일이 자동으로 채워지고 신청 내역을 계정 기준으로 확인할 수 있어요. 시연에서는 비회원으로 계속해도 돼요.</p>' +
        '<div class="cx-mini">' + esc(e.title) + ' · ' + esc(D.dateLabel(e)) + '</div>' +
        '<div class="cx-formacts"><button type="button" class="btn btn--secondary btn--sm" data-apply="' + id + '" data-guest>비회원으로 계속</button>' +
        '<button type="button" class="btn btn--primary btn--sm" data-login>로그인</button></div>', 'REGISTRATION');
      return;
    }
    values = values || {};
    var c = catOf(e.cat);
    showDialog('<span class="badge badge--brand">참가 신청</span>' +
      '<h2 class="cx-dtitle">' + esc(e.title) + '</h2>' +
      '<p class="cx-lead">' + esc([D.dateLabel(e), e.time, D.where(e)].filter(Boolean).join(' · ')) + '</p>' +
      '<div class="cx-mini">자격 조건 · ' + esc(e.cond || '추후 안내') + (e.cap ? ' · 잔여 ' + seatsLeft(e) + '석' : '') + '</div>' +
      '<form data-kind="apply" data-event="' + e.id + '"><div class="cx-fields">' + personFields('ap-', values) +
        (e.format === '하이브리드' ? '<div class="field full"><label class="field__label" for="ap-attend">참석 방식<span class="req">*</span></label><select class="cx-in" id="ap-attend" name="attend"><option>현장 참석</option><option>온라인 시청</option></select></div>' : '') +
        '<div class="field full"><label class="field__label" for="ap-q">사전 질문<small>선택</small></label><textarea class="cx-in" id="ap-q" name="question" maxlength="1000" placeholder="행사에서 확인하고 싶은 내용을 적어주세요.">' + esc(values.question || '') + '</textarea></div>' +
      '</div>' +
      '<label class="cx-check"><input type="checkbox" name="eligible" required><span>' + esc((e.elig || []).map(function (k) { return D.ELIG[k]; }).join('·')) + ' 대상이며 위 자격 조건에 해당해요.</span></label>' + CONSENT +
      '<div class="cx-formacts"><button type="button" class="btn btn--secondary btn--sm" data-detail="' + e.id + '">이전</button><button class="btn btn--primary btn--sm" type="submit">신청 내용 확인 ' + ARROW + '</button></div>' +
      '</form>', c.label.toUpperCase() + ' · REGISTRATION');
  }

  function requestFields(kind, p, v) {
    v = v || {};
    if (kind === 'interest') {
      return '<div class="cx-fields">' + personFields(p, v) +
        '<div class="field full"><label class="field__label" for="' + p + 'question">알림 받을 때 함께 받고 싶은 내용<small>선택</small></label><textarea class="cx-in" id="' + p + 'question" name="question" maxlength="600" placeholder="예: 참여 기업 명단이 확정되면 알려주세요.">' + esc(v.question || '') + '</textarea></div></div>';
    }
    var by = v.selectBy || 'sector';
    var opt = function (list, cur) { return list.map(function (s) { return '<option' + (cur === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join(''); };
    return '<div class="cx-fields">' +
      '<div class="field full"><label class="field__label" for="' + p + 'by">' + (kind === 'earnings' ? '실적발표 문의 기준' : kind === 'ndr' ? 'NDR 문의 기준' : '세미나 요청 기준') + '<span class="req">*</span></label>' +
        '<select class="cx-in" id="' + p + 'by" name="selectBy"><option value="sector"' + (by === 'sector' ? ' selected' : '') + '>섹터로 선택</option><option value="analyst"' + (by === 'analyst' ? ' selected' : '') + '>애널리스트로 선택</option></select></div>' +
      '<div class="field full" data-by="sector"' + (by === 'analyst' ? ' hidden' : '') + '><label class="field__label" for="' + p + 'sector">섹터<span class="req">*</span></label><select class="cx-in" id="' + p + 'sector" name="sector"' + (by === 'analyst' ? ' disabled' : ' required') + '><option value="">섹터 선택</option>' + opt(SECTORS, v.sector) + '</select></div>' +
      '<div class="field full" data-by="analyst"' + (by === 'sector' ? ' hidden' : '') + '><label class="field__label" for="' + p + 'analyst">애널리스트(가상)<span class="req">*</span></label><select class="cx-in" id="' + p + 'analyst" name="analyst"' + (by === 'sector' ? ' disabled' : ' required') + '><option value="">애널리스트 선택</option>' + opt(ANALYSTS, v.analyst) + '</select></div>' +
      (kind === 'earnings' ? '<div class="field full"><label class="field__label" for="' + p + 'company">관심 기업<span class="req">*</span></label><input class="cx-in" id="' + p + 'company" name="company" required maxlength="100" value="' + esc(v.company || '') + '" placeholder="문의할 기업명"></div>' : '') +
      (kind === 'ndr' ? '<div class="field full"><label class="field__label" for="' + p + 'event">관심 NDR<small>선택</small></label><select class="cx-in" id="' + p + 'event" name="eventTitle"><option value="">일정 선택</option>' +
        opt(EVENTS.filter(function (e) { return e.cat === 'ndr' && !D.isPast(e); }).map(function (e) { return e.title; }), v.eventTitle) + '</select></div>' : '') +
      '<div class="field"><label class="field__label" for="' + p + 'date">희망 일정<small>선택</small></label><input class="cx-in" id="' + p + 'date" name="preferred" type="date" min="' + TODAY + '" value="' + esc(v.preferred || '') + '"></div>' +
      '<div class="field"><label class="field__label" for="' + p + 'fmt">희망 방식</label><select class="cx-in" id="' + p + 'fmt" name="format">' + opt(['담당자와 협의', '대면', '온라인'], v.format) + '</select></div>' +
      personFields(p, v) +
      '<div class="field full"><label class="field__label" for="' + p + 'question">' + (kind === 'earnings' ? '문의 내용' : '궁금한 내용 · 희망 주제') + '<span class="req">*</span></label><textarea class="cx-in" id="' + p + 'question" name="question" required maxlength="1200" placeholder="' +
        (kind === 'earnings' ? '확인하고 싶은 기업·분기 및 문의 내용' : '예: 반도체 업황과 주요 기업 전망, AI 투자 흐름 등') + '">' + esc(v.question || '') + '</textarea></div>' +
    '</div>';
  }
  var SCHEDULE_NOTE = '<div class="cx-svc"><strong>유리를 통한 일정 조율 안내</strong><p>유리가 요청 내용을 담당 애널리스트에게 전달하고, 입력한 이메일로 일정 조율과 확정 여부를 안내해 드려요. 요청만으로 일정이 확정되지는 않아요.</p></div>';
  var REQ_TITLE = { ndr: 'NDR 참여 문의', earnings: '실적발표 문의', seminar: '애널리스트 세미나 요청', interest: '관심 등록' };

  function request(kind, values, forId) {
    values = values || {};
    var ev = forId && D.byId(forId);
    if (ev && !values.eventTitle) values.eventTitle = ev.title;
    var lead = kind === 'ndr' ? 'NDR은 초청을 통해 참여하는 방식이에요. 관심 섹터를 남기면 담당 애널리스트가 미팅 가능 시간을 안내해요.'
      : kind === 'interest' ? '일정이 확정되면 입력한 이메일로 먼저 안내해 드려요.' : '희망 주제와 담당자를 선택해 문의해주세요.';
    var seg = kind === 'seminar' || kind === 'earnings'
      ? '<div class="cx-seg cx-seg--form" role="group" aria-label="문의 유형"><button type="button" data-kind="seminar" aria-pressed="' + (kind === 'seminar') + '">애널리스트 세미나</button><button type="button" data-kind="earnings" aria-pressed="' + (kind === 'earnings') + '">실적발표</button></div>' : '';
    showDialog('<h2 class="cx-dtitle">' + REQ_TITLE[kind] + '</h2>' + (ev ? '<div class="cx-mini">' + esc(ev.title) + ' · ' + esc(D.dateLabel(ev)) + '</div>' : '') +
      '<p class="cx-lead">' + lead + '</p>' + seg +
      '<form data-kind="' + kind + '"' + (ev ? ' data-event="' + ev.id + '"' : '') + '>' + requestFields(kind, 'rq-', values) + (kind === 'seminar' ? SCHEDULE_NOTE : '') + CONSENT +
        '<div class="cx-formacts"><button type="button" class="btn btn--secondary btn--sm" data-close>닫기</button><button class="btn btn--primary btn--sm" type="submit">' + (kind === 'interest' ? '관심 등록 확인' : '문의 내용 확인') + ' ' + ARROW + '</button></div>' +
        '<p class="cx-formnote">공개 일정에 게시하지 않는 개별 문의 · 시연에서는 서버로 전송하지 않아요.</p>' +
      '</form>', kind === 'interest' ? 'NOTIFY ME' : 'INDIVIDUAL INQUIRY');
  }

  /* 외부 행사 폼 */
  function renderExternalForm() {
    if ($('#cx-ext-form')) return;
    $('#cx-ext-area').innerHTML = '<form id="cx-ext-form" data-kind="external" data-inline novalidate>' +
      '<h3 id="ex-head">행사 주선 문의</h3>' +
      '<div class="cx-seg cx-seg--form" role="group" aria-label="요청 방식"><button type="button" data-ext-mode="inquiry" aria-pressed="true">행사 주선 문의</button><button type="button" data-ext-mode="suggest" aria-pressed="false">희망 행사 제안</button></div>' +
      '<input type="hidden" name="requestMode" value="행사 주선 문의">' +
      '<div class="cx-fields">' +
        '<div class="field full"><label class="field__label" for="ex-type">관심 행사 유형<span class="req">*</span></label><select class="cx-in" id="ex-type" name="inquiryType" required><option value="">행사 유형 선택</option><option>산업·테마 세미나</option><option>기업 인사이트 세션</option><option>연사 초청·행사 협업</option><option>외부 행사 참가</option><option>기타 / 담당자와 협의</option></select></div>' +
        '<div class="field full"><label class="field__label" for="ex-title" id="ex-title-lbl">관심 행사 또는 주제<span class="req">*</span></label><input class="cx-in" id="ex-title" name="eventTitle" required maxlength="100" placeholder="예: 반도체 산업전망 세미나"></div>' +
        '<div class="field"><label class="field__label" for="ex-date">희망 일정<small>선택</small></label><input class="cx-in" id="ex-date" name="preferred" type="date" min="' + TODAY + '"></div>' +
        '<div class="field"><label class="field__label" for="ex-loc">장소 또는 방식<small>선택</small></label><input class="cx-in" id="ex-loc" name="location" maxlength="100" placeholder="대면 / 온라인 / 협의"></div>' +
        personFields('ex-') +
        '<div class="field full"><label class="field__label" for="ex-q" id="ex-q-lbl">필요한 내용<span class="req">*</span></label><textarea class="cx-in" id="ex-q" name="question" required maxlength="1200" placeholder="행사 목적, 참석 대상, 궁금한 내용 등을 남겨주세요."></textarea></div>' +
      '</div>' +
      '<div class="cx-svc"><strong>전화·이메일로 개별 안내</strong><p>요청 내용을 확인한 뒤 행사 관계자와 주선 가능 여부를 검토해요.</p></div>' +
      CONSENT +
      '<div class="cx-formacts"><button class="btn btn--primary btn--sm" type="submit"><span id="ex-submit">문의 내용 확인</span> ' + ARROW + '</button></div>' +
    '</form>';
  }
  function setExtMode(mode, focus) {
    renderExternalForm();
    var f = $('#cx-ext-form'), s = mode === 'suggest';
    f.elements.requestMode.value = s ? '희망 행사 제안' : '행사 주선 문의';
    $$('[data-ext-mode]', f).forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.extMode === mode)); });
    $('#ex-head').textContent = s ? '원하는 행사 제안' : '행사 주선 문의';
    $('#ex-title-lbl').innerHTML = (s ? '원하는 행사 · 주제' : '관심 행사 또는 주제') + '<span class="req">*</span>';
    $('#ex-q-lbl').innerHTML = (s ? '듣고 싶은 내용 · 만나고 싶은 기업' : '필요한 내용') + '<span class="req">*</span>';
    $('#ex-submit').textContent = s ? '제안 내용 확인' : '문의 내용 확인';
    if (focus) { $('#cx-ext-area').scrollIntoView({ behavior: scrollBehavior(), block: 'start' }); $('#ex-title').focus({ preventScroll: true }); }
  }
  function toggleBy(form, val) {
    $$('[data-by]', form).forEach(function (f) { var on = f.dataset.by === val, s = $('select', f); f.hidden = !on; s.disabled = !on; s.required = on; });
  }

  /* 내용 확인 → 완료 */
  var NAMES = { name: '이름', org: '소속 기관', email: '이메일', phone: '연락처', attend: '참석 방식', question: '질문·문의', sector: '섹터', analyst: '애널리스트',
    company: '관심 기업', eventTitle: '행사·주제', preferred: '희망 일정', format: '희망 방식', audience: '참석 대상', attendees: '예상 인원',
    requestMode: '요청 방식', inquiryType: '행사 유형', location: '장소·방식' };
  var formData = function (form) { var o = {}; new FormData(form).forEach(function (v, k) { o[k] = v; }); return o; };
  function confirmDraft(form) {
    var raw = formData(form), data = Object.assign({}, raw);
    delete data.demo; delete data.eligible;
    if (data.selectBy === 'analyst') delete data.sector; else delete data.analyst;
    delete data.selectBy;
    var kind = form.dataset.kind, ev = form.dataset.event && D.byId(form.dataset.event);
    var type = kind === 'apply' ? '참가 신청' : kind === 'seminar' ? '세미나 요청' : kind === 'earnings' ? '실적발표 문의' : kind === 'ndr' ? 'NDR 참여 문의' :
      kind === 'interest' ? '관심 등록' : data.requestMode === '희망 행사 제안' ? '희망 행사 제안' : '외부 행사 주선 문의';
    var title = ev ? ev.title : data.eventTitle || (data.company ? data.company + ' 실적발표' : '') || (data.sector || data.analyst || '').split(' · ')[0] + ' ' + type;
    draft = { kind: kind, type: type, title: title, eventId: ev ? ev.id : '', data: data, raw: raw, inline: form.hasAttribute('data-inline') };
    showDialog('<span class="badge badge--brand">내용 확인</span><h2 class="cx-dtitle">' + esc(type) + ' 내용 확인</h2><p class="cx-lead">' + esc(title) + '</p>' +
      '<dl class="cx-sum">' + Object.keys(data).filter(function (k) { return NAMES[k] && data[k]; }).map(function (k) { return '<dt>' + NAMES[k] + '</dt><dd>' + esc(data[k]) + '</dd>'; }).join('') + '</dl>' +
      '<div class="cx-mini">입력 내용은 이 브라우저의 시연 기록으로만 남고 실제로 전송되지 않아요.</div>' +
      '<div class="cx-formacts"><button type="button" class="btn btn--secondary btn--sm" data-edit>수정</button><button type="button" class="btn btn--primary btn--sm" data-complete>' +
        (kind === 'apply' ? '신청하기' : kind === 'seminar' ? '세미나 요청하기' : kind === 'interest' ? '관심 등록하기' : '문의하기') + ' ' + ARROW + '</button></div>', 'REVIEW');
  }
  function editDraft() {
    if (!draft) return;
    var d = draft;
    if (d.inline) { closeDialog(); return; }
    if (d.kind === 'apply') apply(d.eventId, true, d.raw); else request(d.kind, d.raw, d.eventId);
  }
  function complete() {
    if (!draft) return;
    var d = draft; draft = null;
    var ev = d.eventId && D.byId(d.eventId);
    R.add(Object.assign({}, d.data, { kind: d.kind === 'apply' ? 'apply' : 'request', type: d.type, title: d.title, eventId: d.eventId || null,
      email: d.data.email || '', cat: ev ? ev.cat : '', date: ev ? ev.start : d.data.preferred || '' }));
    if (d.inline) {
      var f = d.kind === 'external' ? $('#cx-ext-form') : $('#cx-seminar-form');
      if (f) { f.reset(); if (d.kind === 'external') setExtMode('inquiry'); else toggleBy(f, 'sector'); }
    }
    showDialog('<div class="cx-center"><div class="cx-ok" aria-hidden="true">✓</div><h2 class="cx-dtitle">' + esc(d.type) + ' 완료 (시연)</h2><p class="cx-lead">' + esc(d.title) + '</p></div>' +
      (d.kind === 'seminar' ? SCHEDULE_NOTE : '') +
      '<div class="cx-mini">‘내 신청·문의’와 일정 목록의 신청 상태에 바로 반영했어요. 실제 접수·이메일 발송은 일어나지 않았어요.</div>' +
      '<div class="cx-formacts"><button type="button" class="btn btn--secondary btn--sm" data-my>내 신청·문의</button><button type="button" class="btn btn--primary btn--sm" data-close>확인</button></div>', 'COMPLETE');
    toast(d.type + '이(가) 기록됐어요.');
  }
  function myRecords() {
    var list = R.list().slice().reverse();
    showDialog('<h2 class="cx-dtitle">내 신청·문의</h2><p class="cx-lead">' + (curUser ? esc(curUser.email) + ' 계정으로 로그인 중 · ' : '') + '이 브라우저에서 진행한 시연 기록이에요.</p>' +
      (list.length ? list.map(function (r) {
        return '<div class="cx-myitem"><div class="cx-myitem__b"><span class="badge ' + (r.kind === 'apply' ? 'badge--brand' : 'cx-badge--neutral') + '">' + esc(r.type) + '</span>' +
          '<h4>' + esc(r.title) + '</h4><p>' + dot((r.at || '').slice(0, 10)) + ' · ' + (r.kind === 'apply' ? '신청 완료' : '접수 · 담당자 검토 대기') + ' · 시연 기록</p></div>' +
          (r.eventId && D.byId(r.eventId) ? '<button type="button" data-detail="' + esc(r.eventId) + '">상세</button>' : '') +
          '<button type="button" data-remove="' + esc(r.id) + '" aria-label="' + esc(r.title) + ' 기록 삭제">삭제</button></div>';
      }).join('') : '<div class="cx-empty">아직 신청·문의 기록이 없어요.</div>'), 'MY REQUESTS');
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
  $('[data-fields="seminar"]').outerHTML = requestFields('seminar', 'sm-');

  document.addEventListener('click', function (ev) {
    // 책 · 아래 카테고리 탭 · 공전 토글 · 패널 닫기는 orbit-books.js가 처리해요
    var b = ev.target.closest('button'); if (!b || b.closest('.ob-book,.ob__tabs,.ob__toggle,[data-ob-close]')) return;
    var ds = b.dataset;
    if (ds.filter) { setCat(ds.filter); return; }
    if ('jump' in ds) { jumpToExplore(); return; }
    if (ds.goto) { closeDialog(); gotoTab(ds.goto); return; }
    if (ds.phase) { state.phase = ds.phase; setPressed('#cx-phase [data-phase]', function (x) { return x === b; }); focusMonth(); renderExplore(); syncUrl(); return; }
    if (ds.view) { state.view = ds.view; setPressed('#cx-view [data-view]', function (x) { return x === b; }); if (state.view === 'calendar') focusMonth(); renderExplore(); syncUrl(); return; }
    if ('month' in ds) {
      var d = +ds.month;
      if (d === 0) focusMonth(); else { state.calM += d; if (state.calM < 0) { state.calM = 11; state.calY--; } if (state.calM > 11) { state.calM = 0; state.calY++; } }
      renderCalendar();
      var nb = $('#cx-calendar [data-month="' + ds.month + '"]'); if (nb) nb.focus();
      return;
    }
    if ('reset' in ds) {
      state.analyst = 'all'; state.elig = 'all'; state.openOnly = false; state.q = '';
      $('#cx-analyst').value = 'all'; $('#cx-elig').value = 'all'; $('#cx-open').checked = false; $('#cx-q').value = '';
      setCat('all'); return;
    }
    if (ds.day) { if (detailEv && detailEv.days) selectDay(detailEv, +ds.day); return; }
    if (ds.detail) { detail(ds.detail); return; }
    if (ds.apply) { apply(ds.apply, 'guest' in ds); return; }
    if ('login' in ds) { closeDialog(); if (typeof openAuth === 'function') openAuth('로그인하면 신청 폼의 이메일이 자동으로 채워져요.'); return; }
    if (ds.request) { request(ds.request, {}, ds.event || ''); return; }
    if (ds.kind && b.closest('.cx-seg')) { request(ds.kind); return; }
    if (ds.ext) {
      setExtMode('inquiry'); $('#ex-type').value = ds.ext; $('#ex-title').value = ds.ext;
      $('#cx-ext-area').scrollIntoView({ behavior: scrollBehavior(), block: 'start' }); $('#ex-q').focus({ preventScroll: true }); return;
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
    if (t.name === 'selectBy') toggleBy(t.form, t.value);
    if (t.id === 'cx-elig') { state.elig = t.value; renderExplore(); }
    if (t.id === 'cx-analyst') { state.analyst = t.value; renderExplore(); }
    if (t.id === 'cx-open') { state.openOnly = t.checked; renderExplore(); }
  });
  $('#cx-q').addEventListener('input', function (e) { state.q = e.target.value.trim(); if (state.view === 'calendar') focusMonth(); renderExplore(); });
  R.onChange(function () { renderAll(); });

  /* ═════════ 시작 — ?category= · ?view= · ?phase= · ?event= · #seminar · #external · #my ═════════ */
  $('#cx-analyst').insertAdjacentHTML('beforeend', EVENTS.reduce(function (a, e) {
    (e.analysts || []).forEach(function (n) { if (a.indexOf(n) < 0) a.push(n); }); return a;
  }, []).sort(function (a, b) { return a.localeCompare(b, 'ko'); }).map(function (n) { return '<option>' + esc(n) + '</option>'; }).join(''));
  var initTab = location.hash.slice(1), init = new URLSearchParams(location.search);
  var initCat = init.get('category') || init.get('cat');
  if (catOf(initCat)) state.cat = initCat;
  if (init.get('view') === 'calendar') { state.view = 'calendar'; setPressed('#cx-view [data-view]', function (x) { return x.dataset.view === 'calendar'; }); }
  if (init.get('phase') === 'past') { state.phase = 'past'; setPressed('#cx-phase [data-phase]', function (x) { return x.dataset.phase === 'past'; }); }
  if (panels[initTab] && initTab !== 'internal') tabs.select(initTab);
  focusMonth(); renderAll();
  if (state.cat !== 'all' && orbit) orbit.select(state.cat);
  var initEvent = init.get('event');
  if (initEvent && D.byId(initEvent)) detail(initEvent);
  else if ((init.has('view') || init.has('category') || init.has('cat')) && state.tab === 'internal') jumpToExplore();
  if (initTab === 'my') myRecords();
})();
