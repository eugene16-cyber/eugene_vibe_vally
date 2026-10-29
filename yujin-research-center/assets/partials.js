// 공통 chrome(메뉴 · 드로어 · 브레드크럼 · 헤더 밴드 · 푸터) + 헬퍼 + Supabase 클라이언트 (7-1)
// <body data-chrome="none">이면 chrome 없이 헬퍼만 쓴다(진입 화면).
(function () {
  'use strict';

  /* ---------- 헬퍼 ---------- */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var toNum = function (v) { return typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.+-]/g, '')); };
  var fmt = function (v, dec) {
    var n = toNum(v); if (!isFinite(n)) return v == null ? '-' : String(v);
    dec = dec == null ? 2 : dec;
    return n.toLocaleString('ko-KR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  };
  var noDec = function (v) { return fmt(v, 0); };
  var sign = function (v, dec, unit) {
    var n = toNum(v); if (!isFinite(n)) return v == null ? '-' : String(v);
    return (n > 0 ? '+' : n < 0 ? '-' : '') + fmt(Math.abs(n), dec == null ? 2 : dec) + (unit == null ? '%' : unit);
  };
  var dirCls = function (v) { var n = toNum(v); return n > 0 ? 'up' : n < 0 ? 'down' : ''; };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var session = function () { try { return JSON.parse(localStorage.getItem('il.session') || 'null'); } catch (e) { return null; } };

  var toastEl, toastTimer;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-show'); }, 2600);
  }
  var soon = function (what) { toast((what ? what + '은(는) ' : '이 기능은 ') + '곧 제공될 예정이에요.'); };

  /* 모달 — 포커스 가두기 · ESC · 바깥 클릭으로 닫기 */
  function openModal(content, opts) {
    opts = opts || {};
    var prev = document.activeElement;
    var wrap = document.createElement('div');
    wrap.className = 'modal';
    wrap.innerHTML = '<div class="modal__box" role="dialog" aria-modal="true"' + (opts.label ? ' aria-label="' + esc(opts.label) + '"' : '') +
      (opts.width ? ' style="max-width:' + opts.width + 'px"' : '') + '><button class="modal__close" aria-label="닫기">×</button></div>';
    var box = wrap.firstChild;
    if (typeof content === 'string') box.insertAdjacentHTML('beforeend', content); else box.appendChild(content);
    document.body.appendChild(wrap);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { wrap.classList.add('is-open'); });
    var focusables = function () { return $$('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])', box); };
    (focusables()[1] || focusables()[0]).focus();
    function close() {
      document.removeEventListener('keydown', onKey);
      wrap.classList.remove('is-open');
      document.body.style.overflow = '';
      setTimeout(function () { wrap.remove(); }, 200);
      if (prev && prev.focus) prev.focus();
      if (opts.onClose) opts.onClose();
    }
    function onKey(e) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      var f = focusables(); if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    $('.modal__close', box).addEventListener('click', close);
    return { el: box, close: close };
  }

  /* 탭 접근성 — role=tablist 안의 role=tab, ←→ · Home · End */
  function wireTabsA11y(list, onChange) {
    var tabs = $$('[role=tab]', list);
    function select(t, focus) {
      tabs.forEach(function (x) { var on = x === t; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; });
      if (focus) t.focus();
      if (onChange) onChange(t.dataset.tab || t.id, t);
    }
    tabs.forEach(function (t) {
      t.tabIndex = t.getAttribute('aria-selected') === 'true' ? 0 : -1;
      t.addEventListener('click', function () { select(t); });
      t.addEventListener('keydown', function (e) {
        var i = tabs.indexOf(t), n = null;
        if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
        else if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === 'Home') n = tabs[0];
        else if (e.key === 'End') n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); select(n, true); }
      });
    });
    return { select: function (key) { var t = tabs.filter(function (x) { return (x.dataset.tab || x.id) === key; })[0]; if (t) select(t); } };
  }

  /* ---------- Supabase ---------- */
  var cfg = window.IL_CONFIG || {};
  var sb = null;
  try {
    if (window.supabase && cfg.supabaseUrl && cfg.supabaseAnonKey) sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  } catch (e) { console.warn('[IL] Supabase 연결 실패', e); }

  function getUser() {
    if (!sb) return Promise.resolve(null);
    return sb.auth.getUser().then(function (r) { return r.data && r.data.user || null; }).catch(function () { return null; });
  }
  function onAuth(cb) {
    if (!sb) { cb(null); return; }
    sb.auth.onAuthStateChange(function (_e, s) { cb(s && s.user || null); });
  }
  function signOut() {
    var done = function () {
      try { localStorage.removeItem('il.session'); } catch (e) {}
      location.href = 'index.html';
    };
    if (sb) sb.auth.signOut().then(done, done); else done();
  }
  /* 이메일 로그인 모달 — 로그인이 필요한 기능(알림 등록 · 전략 저장)에서 호출 */
  function openAuth(reason) {
    var m = openModal(
      '<h2 class="modal__title">이메일로 로그인</h2>' +
      '<p class="form-note" style="margin-bottom:18px">' + esc(reason || '이 기능은 로그인 후 쓸 수 있어요.') + ' 메일로 받은 링크를 누르면 로그인돼요.</p>' +
      '<form><label class="field"><span class="field__label">이메일</span><input class="input" type="email" name="email" required autocomplete="email" placeholder="name@company.com"></label>' +
      '<button class="btn btn--primary btn--block" type="submit">로그인 링크 받기</button></form>' +
      '<p class="form-note" style="margin-top:12px">시연 중에는 테스트용 이메일을 써 주세요.</p>',
      { label: '이메일 로그인' });
    $('form', m.el).addEventListener('submit', function (e) {
      e.preventDefault();
      var email = e.target.email.value.trim();
      if (!sb) { toast('지금은 로그인 서버에 연결할 수 없어요.'); return; }
      sb.auth.signInWithOtp({ email: email, options: { emailRedirectTo: location.href.split('#')[0] } }).then(function (r) {
        if (r.error) { toast('메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.'); return; }
        m.close(); toast(email + '로 로그인 링크를 보냈어요.');
      });
    });
    return m;
  }

  window.$ = $; window.$$ = $$;
  Object.assign(window, {
    fmt: fmt, sign: sign, dirCls: dirCls, noDec: noDec, esc: esc, toast: toast, soon: soon, openModal: openModal,
    sb: sb, getUser: getUser, onAuth: onAuth, openAuth: openAuth, signOut: signOut, wireTabsA11y: wireTabsA11y
  });
  window.IL = Object.assign(window.IL || {}, { session: session, isWM: function () { var s = session(); return !!s && s.persona === 'hnw'; } });

  /* ---------- 고객 유형별 섹션 정리 — 페이지 스크립트보다 먼저 ---------- */
  var s = session();
  var seg = s && s.persona === 'hnw' ? 'wm' : 'inst';
  $$('[data-for]').forEach(function (el) { if (el.getAttribute('data-for') !== seg) el.remove(); });

  /* ---------- 시연 표시 ---------- */
  var flag = document.createElement('div');
  flag.className = 'demo-flag'; flag.textContent = '시연용 가상 화면';
  document.body.appendChild(flag);

  if (document.body.getAttribute('data-chrome') === 'none') return;

  /* ---------- 상단 메뉴 · 드로어 ---------- */
  var MENU = [
    { id: 'home', label: 'Home', href: 'home.html' },
    { id: 'conferences', label: 'Events', href: 'conferences.html' },
    { id: 'market', label: 'Research', href: 'market.html' },
    { id: 'quant', label: 'Quant Studio', href: 'quant.html', inst: true }
  ];
  var isPage = function (id) { return new RegExp('(^|/)' + id + '(\\.html)?$').test(location.pathname); };
  var items = MENU.filter(function (m) { return !(m.inst && seg === 'wm'); });
  var current = items.filter(function (m) { return isPage(m.id); })[0];
  var onDesk = isPage('desk');
  var name = s && s.name || '고객';
  var cur = function (on) { return on ? ' aria-current="page"' : ''; };
  var links = items.map(function (m) { return '<a href="' + m.href + '"' + cur(current === m) + '>' + m.label + '</a>'; }).join('');

  var header = document.createElement('header');
  header.className = 'gnb';
  header.innerHTML =
    '<div class="gnb__in">' +
      '<a class="logo" href="home.html" aria-label="유진투자증권 Insight Lab 홈"><span class="logo__mark" aria-hidden="true">E</span>유진투자증권<span class="logo__bar" aria-hidden="true"></span><span class="logo__sub">Insight Lab</span></a>' +
      '<nav class="gnb__menu" aria-label="주 메뉴">' + links + '</nav>' +
      '<div class="gnb__right">' +
        '<a class="gnb__me" href="home.html#my" aria-label="' + esc(name) + '님의 라운지"><span class="avatar" aria-hidden="true">' + esc(name.charAt(0)) + '</span>' + esc(name) + '님</a>' +
        '<button class="gnb__out" type="button" data-signout>로그아웃</button>' +
      '</div>' +
      '<button class="gnb__burger" type="button" aria-label="메뉴 열기" aria-expanded="false" aria-controls="il-drawer">☰</button>' +
    '</div>';
  document.body.insertBefore(header, document.body.firstChild);

  var drawer = document.createElement('div');
  drawer.className = 'drawer'; drawer.id = 'il-drawer';
  drawer.innerHTML =
    '<div class="drawer__dim"></div>' +
    '<div class="drawer__panel" role="dialog" aria-modal="true" aria-label="메뉴">' +
      '<div class="drawer__head"><span class="avatar" aria-hidden="true">' + esc(name.charAt(0)) + '</span><b>' + esc(name) + '님</b>' +
      '<button class="drawer__close" type="button" aria-label="메뉴 닫기">×</button></div>' +
      links +
      '<button class="drawer__out" type="button" data-signout>로그아웃</button>' +
    '</div>';
  document.body.appendChild(drawer);
  var burger = $('.gnb__burger', header);
  function setDrawer(open) {
    drawer.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', open);
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) $('.drawer__close', drawer).focus(); else burger.focus();
  }
  burger.addEventListener('click', function () { setDrawer(true); });
  $('.drawer__dim', drawer).addEventListener('click', function () { setDrawer(false); });
  $('.drawer__close', drawer).addEventListener('click', function () { setDrawer(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && drawer.classList.contains('is-open')) setDrawer(false); });
  $$('[data-signout]').forEach(function (b) { b.addEventListener('click', signOut); });

  /* ---------- 브레드크럼 · 헤더 밴드 ---------- */
  var b = document.body.dataset;
  var after = header;
  if (!('noCrumb' in b)) {
    var crumb = document.createElement('nav');
    crumb.className = 'crumb'; crumb.setAttribute('aria-label', '현재 위치');
    crumb.innerHTML = '<a href="home.html">‹ Home</a><span aria-hidden="true">›</span><b>' +
      esc(b.pageTitle || (current && current.label) || (onDesk ? 'Private Desk' : document.title)) + '</b>';
    after.after(crumb); after = crumb;
  }
  if (b.pageTitle) {
    var band = document.createElement('div');
    band.className = 'band';
    band.innerHTML = '<div>' + (b.pageEyebrow ? '<div class="band__eyebrow">' + esc(b.pageEyebrow) + '</div>' : '') +
      '<h1 class="band__title">' + esc(b.pageTitle) + '</h1>' +
      (b.pageDesc ? '<p class="band__desc">' + esc(b.pageDesc) + '</p>' : '') + '</div>' +
      '<a class="band__home" href="home.html">홈으로 ↩</a>';
    after.after(band);
  }

  /* ---------- 푸터 · 맨 위로 ---------- */
  var foot = document.createElement('footer');
  foot.className = 'foot';
  foot.innerHTML = '<div class="wrap"><span class="foot__flag">시연용 가상 화면</span>' +
    '<p>이 화면의 리포트·수치·백테스트 결과는 정보 제공을 위한 자료이며, 투자를 권유하는 내용은 아니에요. 과거의 성과가 미래의 수익을 보장하지는 않아요. ' +
    '금융투자상품은 원금 손실이 발생할 수 있어요. 투자에 대한 최종 판단과 책임은 투자자 본인에게 있어요.</p>' +
    '<p style="margin-top:8px">© 2026 Yujin Investment &amp; Securities Co., Ltd. · 리서치센터</p></div>';
  document.body.appendChild(foot);

  var fab = document.createElement('button');
  fab.className = 'fab'; fab.type = 'button'; fab.setAttribute('aria-label', '맨 위로'); fab.textContent = '↑';
  fab.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  document.body.appendChild(fab);
  window.addEventListener('scroll', function () { fab.classList.toggle('is-show', window.scrollY > 600); }, { passive: true });
})();
