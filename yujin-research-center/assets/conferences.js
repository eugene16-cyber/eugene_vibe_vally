// Events 페이지 (7-6) — 탭 · Orbit Books 배너 · 일정 목록/캘린더 · 신청 4단계 · 내 신청·문의 · 세미나 요청 · 외부 행사
// 행사 데이터는 events-data.js(IL_EVENTS), 기록은 conf-records.js(ILConf). 실제 접수 · 전송은 없어요.
(function () {
  'use strict';
  var D = window.IL_EVENTS, R = window.ILConf;
  if (!D || !R) { console.warn('[IL] 행사 모듈을 불러오지 못했어요'); return; }
  var TODAY = D.TODAY;
  var sess = (window.IL && IL.session()) || {};

  // 필터 칩 — Earnings Call은 칩에서만 빠지고 '전체'와 책에서는 보여요
  var CHIPS = [['', '전체'], ['corp', '콥데이'], ['ndr', 'NDR'], ['ipo', 'IPO'], ['ai', 'Conference'], ['wm', 'WM특화세미나']];
  var SRC = { roster: '행사내역', notice: '공지', pattern: '예상 일정' };
  var SECTORS = ['반도체 · IT하드웨어', '2차전지 · 소재', '자동차 · 부품', '인터넷 · 플랫폼', '바이오 · 헬스케어', '금융 · 지주', '조선 · 기계 · 방산', '매크로 · 투자전략', '해외주식'];
  var ANALYSTS = ['윤태오 · 반도체/IT', '서지우 · IPO·M&A·스몰캡', '한도윤 · 2차전지·소재', '정하린 · 자산배분·WM', '강서진 · 투자전략', '오민재 · 인터넷·플랫폼', '이도현 · AI·디지털금융'];

  var st = { time: 'up', cat: '', elig: '', view: 'list', month: null };
  var ob = null;

  /* ---------- 공용 ---------- */
  var catChip = function (c) { return '<span class="cf-cat" style="--c:' + c.color + ';--ink:' + c.ink + '">' + esc(c.label) + '</span>'; };
  var srcBadge = function (ev) {
    return D.isSample(ev) ? '<span class="badge badge--sample">예시</span>' : '<span class="badge badge--muted">' + esc(SRC[ev.source] || '') + '</span>';
  };
  var upcoming = function () { return D.EVENTS.filter(function (e) { return !D.isPast(e); }); };
  // 신청 기록까지 반영한 상태
  function stateOf(ev) {
    var s = D.status(ev), rec = R.find(ev.id);
    if (rec && s.key !== 'done') {
      if (rec.kind === 'apply') return { key: 'mine', label: '신청 완료', rec: rec };
      return { key: 'mine', label: ev.cat === 'ndr' ? '문의 완료' : '관심 등록됨', rec: rec };
    }
    if (s.key === 'open' && ev.seats != null) s = { key: 'open', label: '신청 가능 · 잔여 ' + ev.seats + '석' };
    return s;
  }
  var stBadge = function (s) { return '<span class="cf-st cf-st--' + s.key + '">' + esc(s.label) + '</span>'; };
  var fmtAt = function (iso) {
    var d = new Date(iso); if (isNaN(d)) return '';
    var p = function (n) { return ('0' + n).slice(-2); };
    return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  };
  var validEmail = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); };

  /* ---------- 탭 ---------- */
  var panels = { conf: $('#panel-conf'), seminar: $('#panel-seminar'), external: $('#panel-external') };
  var tabs = wireTabsA11y($('.cf-tabbar [role=tablist]'), function (key) {
    Object.keys(panels).forEach(function (k) { panels[k].hidden = k !== key; });
    panels[key].classList.remove('fade-up'); void panels[key].offsetWidth; panels[key].classList.add('fade-up');
    if (history.replaceState) history.replaceState(null, '', key === 'conf' ? location.pathname + location.search : '#' + key);
  });

  /* ---------- 배너 · Orbit Books ---------- */
  $('#cf-cats').innerHTML = D.CATS.map(function (c, i) {
    return '<li><button type="button" data-cat="' + c.id + '"><span class="cf-dot" style="--c:' + c.color + '"></span>' +
      '<span class="cf-cats__no">' + ('0' + (i + 1)).slice(-2) + '</span>' + esc(c.label) + '</button></li>';
  }).join('');
  var nUp = function (cat) { return upcoming().filter(function (e) { return e.cat === cat; }).length; };
  if (window.OrbitBooks) {
    ob = OrbitBooks.mount($('#cf-orbit'), {
      books: D.CATS, center: 'Insight.',
      detail: function (c) { return '예정 ' + nUp(c.id) + '건 · 목록 보기 ↓'; },
      onPick: function (id) { setFilter({ cat: id, time: 'up' }); announce(D.catOf(id).label + ' 일정으로 정리했어요.'); }
    });
  }
  $('#cf-cats').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-cat]'); if (!b) return;
    if (ob) ob.pick(b.dataset.cat);
    setFilter({ cat: b.dataset.cat, time: 'up' });
    $('#cf-schedule').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  function counts() {
    $('#cf-n-up').textContent = upcoming().length;
    $('#cf-n-open').textContent = upcoming().filter(function (e) { return stateOf(e).key === 'open'; }).length;
    $('#cf-mine-n').textContent = R.list().length;
  }
  $('#cf-all').addEventListener('click', function (e) {
    e.preventDefault();
    if (ob) ob.close();
    setFilter({ cat: '', elig: '', time: 'up' });
    $('#cf-schedule').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ---------- 일정 필터 ---------- */
  function renderChips() {
    var list = CHIPS.slice();
    // 칩에 없는 카테고리(Earnings Call)를 책으로 골랐으면 임시 칩으로 보여 줘요
    if (st.cat && !CHIPS.some(function (c) { return c[0] === st.cat; })) list.push([st.cat, D.catOf(st.cat).label + ' ×']);
    $('#cf-chips').innerHTML = list.map(function (c) {
      return '<button type="button" class="chip' + (st.cat === c[0] ? ' is-active' : '') + '" data-cat="' + c[0] + '" aria-pressed="' + (st.cat === c[0]) + '">' + esc(c[1]) + '</button>';
    }).join('');
  }
  $('#cf-chips').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cat]'); if (!b) return;
    var cat = b.dataset.cat;
    if (cat && cat === st.cat && b.textContent.indexOf('×') > -1) cat = '';
    if (ob) { if (cat) ob.pick(cat); else ob.close(); }
    setFilter({ cat: cat });
  });
  function segWire(id, key) {
    $('#' + id).addEventListener('click', function (e) {
      var b = e.target.closest('[data-v]'); if (!b) return;
      var o = {}; o[key] = b.dataset.v; setFilter(o);
    });
  }
  segWire('cf-time', 'time'); segWire('cf-view', 'view');
  $('#cf-elig').addEventListener('change', function (e) { setFilter({ elig: e.target.value }); });

  function setFilter(o) {
    // 조건이 바뀌면 캘린더는 첫 일정이 있는 달로 다시 맞춰요
    if ('time' in o || 'cat' in o || 'elig' in o) st.month = null;
    Object.assign(st, o);
    $$('#cf-time [data-v]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.v === st.time); });
    $$('#cf-view [data-v]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.v === st.view); });
    $('#cf-elig').value = st.elig;
    renderChips();
    renderOut();
  }
  function filtered() {
    return D.EVENTS.filter(function (e) {
      if ((st.time === 'past') !== D.isPast(e)) return false;
      if (st.cat && e.cat !== st.cat) return false;
      if (st.elig && (e.elig || []).indexOf(st.elig) < 0) return false;
      return true;
    }).sort(function (a, b) { return st.time === 'past' ? (b.start < a.start ? -1 : 1) : (a.start < b.start ? -1 : 1); });
  }
  var live = $('#cf-live');
  function announce(msg) { live.textContent = ''; setTimeout(function () { live.textContent = msg; }, 30); }

  function renderOut() {
    var list = filtered();
    var out = $('#cf-out');
    out.innerHTML = st.view === 'cal' ? calHTML(list) : listHTML(list);
    out.classList.remove('fade-up'); void out.offsetWidth; out.classList.add('fade-up');
    counts();
  }

  /* 목록 */
  function listHTML(list) {
    if (!list.length) return '<p class="cf-empty">조건에 맞는 일정이 없어요.</p>';
    var html = '', month = '';
    list.forEach(function (ev) {
      var m = ev.start.slice(0, 7);
      if (m !== month) {
        if (month) html += '</ul>';
        month = m;
        html += '<h3 class="cf-month">' + m.slice(0, 4) + '년 ' + (+m.slice(5)) + '월</h3><ul class="cf-list">';
      }
      var c = D.catOf(ev.cat), s = stateOf(ev);
      var meta = [ev.time, ev.place, ev.format && ev.format !== ev.place ? ev.format : ''].filter(Boolean).join(' · ');
      html += '<li><button type="button" class="cf-ev" data-open="' + ev.id + '">' +
        '<span class="cf-ev__date' + (ev.tba ? ' is-tba' : '') + '">' +
          (ev.tba ? '<b>' + (+ev.start.slice(5, 7)) + '월</b><span>미정</span>'
                  : '<b>' + ev.start.slice(5).replace('-', '.') + '</b><span>' + D.dow(ev.start) + (ev.end ? ' ~ ' + ev.end.slice(5).replace('-', '.') : '') + '</span>') +
        '</span>' +
        '<span class="cf-ev__body">' +
          '<span class="cf-ev__tags">' + catChip(c) + srcBadge(ev) + '</span>' +
          '<span class="cf-ev__title">' + esc(ev.title) + '</span>' +
          '<span class="cf-ev__meta">' + esc(meta || '시간·장소 미정') + ' · ' + esc(ev.analysts.join(', ')) + '</span>' +
        '</span>' +
        '<span class="cf-ev__side">' + stBadge(s) + '<span class="cf-ev__go" aria-hidden="true">›</span></span>' +
      '</button></li>';
    });
    return html + '</ul>';
  }

  /* 월 캘린더 */
  function calHTML(list) {
    if (!st.month) {
      var first = list.filter(function (e) { return !e.tba; })[0] || list[0];
      st.month = first ? first.start.slice(0, 7) : TODAY.slice(0, 7);
    }
    var y = +st.month.slice(0, 4), mo = +st.month.slice(5, 7);
    var firstDow = new Date(y, mo - 1, 1).getDay(), days = new Date(y, mo, 0).getDate();
    var pad = function (n) { return ('0' + n).slice(-2); };
    var inMonth = list.filter(function (e) {
      var a = e.start.slice(0, 7), b = (e.end || e.start).slice(0, 7);
      return a <= st.month && b >= st.month;
    });
    var cells = '';
    for (var i = 0; i < firstDow; i++) cells += '<div class="cf-cal__cell is-blank" aria-hidden="true"></div>';
    for (var d = 1; d <= days; d++) {
      var ds = st.month + '-' + pad(d);
      var evs = inMonth.filter(function (e) { return !e.tba && e.start <= ds && (e.end || e.start) >= ds; });
      var dw = (firstDow + d - 1) % 7;
      cells += '<div class="cf-cal__cell' + (ds === TODAY ? ' is-today' : '') + (dw === 0 ? ' is-sun' : dw === 6 ? ' is-sat' : '') + '">' +
        '<span class="cf-cal__d">' + d + '</span>' +
        evs.map(function (e) {
          var c = D.catOf(e.cat);
          return '<button type="button" class="cf-cal__ev" data-open="' + e.id + '" style="--c:' + c.color + ';--ink:' + c.ink + '" title="' + esc(e.title) + '">' +
            '<span>' + esc(e.title) + '</span></button>';
        }).join('') +
      '</div>';
    }
    var tba = inMonth.filter(function (e) { return e.tba; });
    var body = inMonth.length ? '' : '<p class="cf-empty">선택한 조건에 맞는 일정이 없는 달이에요. ‹ › 로 다른 달을 확인해주세요.</p>';
    return '<div class="cf-cal">' +
      '<div class="cf-cal__nav"><button type="button" data-mon="-1" aria-label="이전 달">‹</button>' +
      '<b aria-live="polite">' + y + '년 ' + mo + '월</b><button type="button" data-mon="1" aria-label="다음 달">›</button></div>' +
      '<div class="cf-cal__grid" role="grid" aria-label="' + y + '년 ' + mo + '월 행사 캘린더">' +
        D.DOW.map(function (w, i) { return '<div class="cf-cal__dow' + (i === 0 ? ' is-sun' : i === 6 ? ' is-sat' : '') + '">' + w + '</div>'; }).join('') +
        cells +
      '</div>' +
      (tba.length ? '<div class="cf-cal__tba"><b>일정 미확정</b>' + tba.map(function (e) {
        return '<button type="button" data-open="' + e.id + '">' + esc(e.title) + ' ›</button>';
      }).join('') + '</div>' : '') +
      body + '</div>';
  }
  $('#cf-out').addEventListener('click', function (e) {
    var mb = e.target.closest('[data-mon]');
    if (mb) {
      var y = +st.month.slice(0, 4), m = +st.month.slice(5, 7) - 1 + (+mb.dataset.mon);
      var dt = new Date(y, m, 1);
      st.month = dt.getFullYear() + '-' + ('0' + (dt.getMonth() + 1)).slice(-2);
      $('#cf-out').innerHTML = calHTML(filtered());
      var nb = $('#cf-out [data-mon="' + mb.dataset.mon + '"]'); if (nb) nb.focus();
      return;
    }
    var ob2 = e.target.closest('[data-open]');
    if (ob2) openDetail(ob2.dataset.open);
  });

  /* ---------- 행사 상세 ---------- */
  function row(k, v) { return v ? '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>' : ''; }
  function openDetail(id) {
    var ev = D.byId(id); if (!ev) { toast('행사 정보를 찾지 못했어요.'); return; }
    var c = D.catOf(ev.cat), s = stateOf(ev);
    var elig = (ev.elig || []).map(function (k) { return D.ELIG[k]; }).join(' · ');
    var seats = ev.cap ? ev.cap + '명 · ' + (ev.seats ? '잔여 ' + ev.seats + '석' : '마감') : '';
    var html = '<div class="cf-dt">' +
      '<div class="cf-ev__tags">' + catChip(c) + srcBadge(ev) + stBadge(s) + '</div>' +
      '<h2 class="modal__title cf-dt__title">' + esc(ev.title) + '</h2>' +
      '<p class="cf-dt__intro">' + esc(ev.intro || c.desc) + '</p>' +
      '<dl class="cf-dl">' +
        row('일시', esc(D.dateLabel(ev, true)) + (ev.time ? ' · ' + esc(ev.time) : '')) +
        row('장소', esc(ev.place || '')) + row('형식', esc(ev.format && ev.format !== ev.place ? ev.format : '')) +
        row('담당', esc(ev.analysts.join(', '))) + row('대상', esc(ev.cond || elig)) +
        row('정원', esc(seats)) + row('신청 마감', ev.deadline ? esc(D.dateLabel({ start: ev.deadline }, true)) : '') +
      '</dl>' +
      (ev.program ? '<h3 class="cf-dt__h">프로그램</h3><table class="tbl cf-prog"><tbody>' + ev.program.map(function (p) {
        return '<tr><td class="num">' + esc(p[0]) + '</td><td>' + esc(p[1]) + '</td><td class="muted">' + esc(p[2]) + '</td></tr>';
      }).join('') + '</tbody></table>' : '') +
      (ev.days ? '<h3 class="cf-dt__h">날짜별 세션 <small>A / B 동시 진행</small></h3><div class="cf-days">' + ev.days.map(function (d) {
        return '<div class="cf-day"><b>' + esc(D.dateLabel({ start: d.date })) + '</b><ul>' + d.sessions.map(function (x) {
          return '<li><span class="num">' + esc(x[0]) + '</span><span>A · ' + esc(x[1]) + '</span><span>B · ' + esc(x[2]) + '</span></li>';
        }).join('') + '</ul></div>';
      }).join('') + '</div>' : '') +
      (ev.cat === 'ndr' ? '<p class="cf-dt__note">NDR은 기업 IR팀의 초청으로 진행돼요. 참여를 원하시면 문의를 남겨 주세요. 담당자가 초청 가능 여부를 확인해 안내해요.</p>' : '') +
      '<div class="cf-dt__act">' + actionHTML(ev, s) + '</div>' +
    '</div>';
    var m = openModal(html, { label: ev.title + ' 상세', width: 600 });
    var act = $('[data-act]', m.el);
    if (act) act.addEventListener('click', function () { m.close(); setTimeout(function () { openApply(ev); }, 220); });
    var mine = $('[data-mine]', m.el);
    if (mine) mine.addEventListener('click', function () { m.close(); setTimeout(openMine, 220); });
  }
  function flowOf(ev) {
    if (ev.cat === 'ndr') return { kind: 'request', type: 'NDR 참여 문의', btn: 'NDR 참여 문의', submit: '문의 보내기', q: '문의 내용' };
    if (ev.tba || ev.mode === 'tba') return { kind: 'request', type: '관심 등록', btn: '관심 등록', submit: '관심 등록하기', q: '알림 받을 때 함께 받고 싶은 내용' };
    return { kind: 'apply', type: '참가 신청', btn: '참가 신청', submit: '신청하기', q: '사전 질문' };
  }
  function actionHTML(ev, s) {
    if (s.key === 'done') return '<p class="muted">종료된 행사예요.</p>';
    if (s.key === 'mine') return '<p class="cf-dt__done">' + esc(s.label) + ' · ' + esc(fmtAt(s.rec.at)) + '</p><button type="button" class="btn btn--secondary" data-mine>내 신청·문의 보기</button>';
    if (s.key === 'closed') return '<button type="button" class="btn btn--primary" disabled>신청 마감</button>';
    if (s.key === 'planned') return '<p class="muted">신청 일정이 열리면 안내해 드려요.</p>';
    return '<button type="button" class="btn btn--primary" data-act>' + esc(flowOf(ev).btn) + '</button>';
  }

  /* ---------- 신청 4단계 ---------- */
  var STEPS = ['시연 확인', '입력', '내용 확인', '완료'];
  function openApply(ev) {
    var f = flowOf(ev);
    var elig = (ev.elig || []).map(function (k) { return D.ELIG[k]; }).join(' · ');
    var data = { name: sess.name || '', org: sess.org || sess.branch || '', email: '', q: '', demo: false, elig: false };
    var step = 0;
    var m = openModal('<div class="cf-ap"></div>', { label: ev.title + ' ' + f.btn, width: 520 });
    var root = $('.cf-ap', m.el);

    function stepper() {
      return '<ol class="cf-stepper">' + STEPS.map(function (t, i) {
        return '<li class="' + (i < step ? 'is-done' : i === step ? 'is-now' : '') + '"' + (i === step ? ' aria-current="step"' : '') + '><b>' + (i + 1) + '</b><span>' + t + '</span></li>';
      }).join('') + '</ol>';
    }
    function draw() {
      var h = '<p class="cf-ap__k">' + esc(f.btn) + '</p><h2 class="modal__title">' + esc(ev.title) + '</h2>' +
        '<p class="cf-ap__date">' + esc(D.dateLabel(ev, true)) + (ev.time ? ' · ' + esc(ev.time) : '') + '</p>' + stepper();
      if (step === 0) {
        h += '<div class="cf-ap__box">시연용 가상 화면이에요. 이 화면에서 입력한 내용은 이 브라우저에만 저장되고, 리서치센터로 전송되지 않아요.</div>' +
          '<label class="cf-check"><input type="checkbox" name="demo"' + (data.demo ? ' checked' : '') + '> <span>실제 접수·전송이 없는 시연 화면임을 확인했어요. 테스트 값으로 입력해주세요.</span></label>' +
          '<div class="cf-ap__act"><button type="button" class="btn btn--primary" data-next' + (data.demo ? '' : ' disabled') + '>다음</button></div>';
      } else if (step === 1) {
        h += '<form novalidate>' +
          '<label class="field"><span class="field__label">이름</span><input class="input" name="name" required maxlength="30" value="' + esc(data.name) + '"></label>' +
          '<label class="field"><span class="field__label">소속</span><input class="input" name="org" required maxlength="40" value="' + esc(data.org) + '"></label>' +
          '<label class="field"><span class="field__label">이메일</span><input class="input" type="email" name="email" required placeholder="test@example.com" value="' + esc(data.email) + '"></label>' +
          '<label class="field"><span class="field__label">' + esc(f.q) + ' <small class="muted">(선택)</small></span><textarea class="input cf-textarea" name="q" rows="3" maxlength="300">' + esc(data.q) + '</textarea></label>' +
          '<label class="cf-check"><input type="checkbox" name="elig"' + (data.elig ? ' checked' : '') + '> <span>참여 대상(' + esc(ev.cond || elig) + ')에 해당하는 것을 확인했어요.</span></label>' +
          '<p class="cf-form__err" role="alert"></p>' +
          '<div class="cf-ap__act"><button type="button" class="btn btn--secondary" data-prev>이전</button><button type="submit" class="btn btn--primary">다음</button></div></form>';
      } else if (step === 2) {
        h += '<dl class="cf-dl cf-dl--confirm">' + row('구분', esc(f.type)) + row('이름', esc(data.name)) + row('소속', esc(data.org)) +
          row('이메일', esc(data.email)) + row(esc(f.q), esc(data.q) || '<span class="muted">없음</span>') + '</dl>' +
          '<div class="cf-ap__act"><button type="button" class="btn btn--secondary" data-prev>이전</button><button type="button" class="btn btn--primary" data-submit>' + esc(f.submit) + '</button></div>';
      } else {
        h += '<div class="cf-ap__ok"><span class="cf-ap__check" aria-hidden="true">✓</span>' +
          '<p><b>' + esc(f.type) + ' 완료</b></p>' +
          '<p class="muted">‘내 신청·문의’와 일정 목록의 신청 상태에 바로 반영했어요. 실제 접수·이메일 발송은 일어나지 않았어요.</p></div>' +
          '<div class="cf-ap__act"><button type="button" class="btn btn--secondary" data-mine>내 신청·문의 보기</button><button type="button" class="btn btn--primary" data-close>닫기</button></div>';
      }
      root.innerHTML = h;
      var first = $(step === 0 ? 'input[name=demo]' : 'input:not([type=checkbox]),[data-submit],[data-close]', root);
      if (first) first.focus();
      wire();
    }
    function wire() {
      var demo = $('input[name=demo]', root);
      if (demo) demo.addEventListener('change', function () { data.demo = demo.checked; $('[data-next]', root).disabled = !demo.checked; });
      var next = $('[data-next]', root); if (next) next.addEventListener('click', function () { step = 1; draw(); });
      $$('[data-prev]', root).forEach(function (b) { b.addEventListener('click', function () { keep(); step -= 1; draw(); }); });
      var form = $('form', root);
      if (form) form.addEventListener('submit', function (e) {
        e.preventDefault(); keep();
        var err = !data.name.trim() ? '이름을 입력해주세요.' : !data.org.trim() ? '소속을 입력해주세요.' :
          !validEmail(data.email) ? '이메일 형식을 확인해주세요.' : !data.elig ? '참여 대상 확인에 체크해주세요.' : '';
        if (err) { $('.cf-form__err', root).textContent = err; return; }
        step = 2; draw();
      });
      var sub = $('[data-submit]', root);
      if (sub) sub.addEventListener('click', function () {
        R.add({ kind: f.kind, type: f.type, title: ev.title, eventId: ev.id, email: data.email, cat: ev.cat, date: ev.start,
          name: data.name, org: data.org, question: data.q });
        step = 3; draw();
      });
      var mine = $('[data-mine]', root); if (mine) mine.addEventListener('click', function () { m.close(); setTimeout(openMine, 220); });
      var cl = $('[data-close]', root); if (cl) cl.addEventListener('click', m.close);
    }
    function keep() {
      var form = $('form', root); if (!form) return;
      data.name = form.name.value; data.org = form.org.value; data.email = form.email.value.trim(); data.q = form.q.value; data.elig = form.elig.checked;
    }
    draw();
  }

  /* ---------- 내 신청·문의 ---------- */
  function openMine() {
    var m = openModal('<h2 class="modal__title">내 신청·문의</h2><p class="form-note">이 브라우저에만 저장된 시연 기록이에요. 실제 접수·전송은 없어요.</p><div class="cf-mine-list"></div>',
      { label: '내 신청·문의', width: 560 });
    var box = $('.cf-mine-list', m.el);
    function draw() {
      var list = R.list().slice().reverse();
      box.innerHTML = list.length ? '<ul>' + list.map(function (r) {
        var ev = r.eventId && D.byId(r.eventId);
        return '<li class="cf-rec"><div class="cf-rec__main">' +
          '<span class="cf-rec__type cf-rec__type--' + (r.kind === 'apply' ? 'apply' : 'req') + '">' + esc(r.type || (r.kind === 'apply' ? '참가 신청' : '문의')) + '</span>' +
          '<b>' + esc(r.title) + '</b>' +
          '<small>' + (ev ? esc(D.dateLabel(ev)) + ' · ' : '') + '기록 ' + esc(fmtAt(r.at)) + (r.email ? ' · ' + esc(r.email) : '') + '</small></div>' +
          '<div class="cf-rec__act">' + (ev ? '<button type="button" class="btn btn--text btn--sm" data-view="' + ev.id + '">행사 보기</button>' : '') +
          '<button type="button" class="btn btn--sm cf-rec__del" data-del="' + esc(r.id) + '" aria-label="' + esc(r.title) + ' 기록 삭제">삭제</button></div></li>';
      }).join('') + '</ul>' : '<p class="cf-empty">아직 신청·문의 기록이 없어요.</p>';
    }
    box.addEventListener('click', function (e) {
      var del = e.target.closest('[data-del]');
      if (del) { R.remove(del.dataset.del); draw(); toast('기록을 삭제했어요.'); var f = $('[data-del]', box) || $('.modal__close', m.el); f.focus(); return; }
      var v = e.target.closest('[data-view]');
      if (v) { m.close(); setTimeout(function () { openDetail(v.dataset.view); }, 220); }
    });
    draw();
  }
  $('#cf-mine').addEventListener('click', openMine);
  R.onChange(function () { counts(); if (!panels.conf.hidden) renderOut(); });

  /* ---------- 세미나/탐방 요청 ---------- */
  var by = 'sector';
  var semForm = $('#cf-seminar-form');
  function fillTarget() {
    var opts = by === 'sector' ? SECTORS : ANALYSTS;
    $('#cf-by-label').textContent = by === 'sector' ? '섹터' : '애널리스트(가상)';
    $('#cf-target').innerHTML = opts.map(function (o) { return '<option>' + esc(o) + '</option>'; }).join('');
    $$('#cf-by [data-v]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.v === by); });
  }
  $('#cf-by').addEventListener('click', function (e) { var b = e.target.closest('[data-v]'); if (b) { by = b.dataset.v; fillTarget(); } });
  fillTarget();
  var tmr = new Date(D.parse(TODAY).getTime() + 86400000);
  semForm.date.min = tmr.getFullYear() + '-' + ('0' + (tmr.getMonth() + 1)).slice(-2) + '-' + ('0' + tmr.getDate()).slice(-2);
  semForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = semForm, err = !f.topic.value.trim() ? '희망 주제를 입력해주세요.' : !f.date.value ? '희망 날짜를 골라주세요.' :
      f.date.value < f.date.min ? '희망 날짜는 내일 이후로 골라주세요.' : !validEmail(f.email.value.trim()) ? '이메일 형식을 확인해주세요.' :
      !f.demo.checked ? '시연 화면 확인에 체크해주세요.' : '';
    $('.cf-form__err', f).textContent = err;
    if (err) return;
    var target = f.target.value.split(' · ')[0];
    R.add({ kind: 'request', type: '세미나 요청', title: target + ' 세미나 요청 · ' + f.topic.value.trim(), eventId: null,
      email: f.email.value.trim(), date: f.date.value, by: by, target: f.target.value });
    f.reset(); fillTarget();
    toast('세미나 요청을 ‘내 신청·문의’에 기록했어요. 실제 전송은 없어요.');
  });

  /* ---------- 외부 행사 ---------- */
  $('#cf-ext').addEventListener('click', function (e) {
    var b = e.target.closest('[data-ext]'); if (!b) return;
    var what = b.dataset.ext;
    var m = openModal('<h2 class="modal__title">' + esc(what) + ' 주선 문의</h2>' +
      '<p class="form-note" style="margin-bottom:16px">관심 주제를 남기면 맞는 외부 행사를 찾아 안내해 드려요.</p>' +
      '<form novalidate><label class="field"><span class="field__label">관심 주제</span><input class="input" name="topic" required maxlength="80" placeholder="예: 전력 인프라, 로봇"></label>' +
      '<label class="field"><span class="field__label">연락처(이메일)</span><input class="input" type="email" name="email" required placeholder="test@example.com"></label>' +
      '<label class="cf-check"><input type="checkbox" name="demo"> <span>실제 접수·전송이 없는 시연 화면임을 확인했어요.</span></label>' +
      '<p class="cf-form__err" role="alert"></p><button class="btn btn--primary btn--block" type="submit">문의 남기기</button></form>',
      { label: what + ' 주선 문의' });
    var f = $('form', m.el);
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var err = !f.topic.value.trim() ? '관심 주제를 입력해주세요.' : !validEmail(f.email.value.trim()) ? '이메일 형식을 확인해주세요.' : !f.demo.checked ? '시연 화면 확인에 체크해주세요.' : '';
      $('.cf-form__err', f).textContent = err;
      if (err) return;
      R.add({ kind: 'request', type: '주선 문의', title: what + ' · ' + f.topic.value.trim(), eventId: null, email: f.email.value.trim() });
      m.close(); toast('주선 문의를 ‘내 신청·문의’에 기록했어요. 실제 전송은 없어요.');
    });
  });
  var pf = $('#cf-propose-form');
  pf.addEventListener('submit', function (e) {
    e.preventDefault();
    var err = !pf.title.value.trim() ? '제목을 입력해주세요.' : !validEmail(pf.email.value.trim()) ? '이메일 형식을 확인해주세요.' : !pf.demo.checked ? '시연 화면 확인에 체크해주세요.' : '';
    $('.cf-form__err', pf).textContent = err;
    if (err) return;
    R.add({ kind: 'request', type: '행사 제안', title: pf.kind.value + ' 제안 · ' + pf.title.value.trim(), eventId: null, email: pf.email.value.trim(), body: pf.body.value });
    pf.reset();
    toast('행사 제안을 ‘내 신청·문의’에 기록했어요. 실제 전송은 없어요.');
  });

  /* ---------- 시작 — ?cat= · ?event= · #seminar · #external ---------- */
  var q = new URLSearchParams(location.search);
  var hash = location.hash.slice(1);
  if (panels[hash]) tabs.select(hash);
  var qc = q.get('cat');
  if (qc && D.catOf(qc)) { setFilter({ cat: qc }); if (ob) ob.pick(qc); } else setFilter({});
  if (q.get('event')) openDetail(q.get('event'));
  if (hash === 'schedule' || hash === 'cf-schedule') $('#cf-schedule').scrollIntoView();
})();
