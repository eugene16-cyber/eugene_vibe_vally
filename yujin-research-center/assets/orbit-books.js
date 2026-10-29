// Orbit Books — 행사 카테고리 책 공전 모듈 (Events · Home)
// OrbitBooks.mount(host, {books: CATS, center:'Insight.', onPick(catId), onClose(), detail(cat) → HTML, openAt:0.5, dockHint, openHint})
//   반환: {dock(id|null), open(id), close(), toggleOpen(id), pick(id)=dock, play(), pause(), destroy()}
// 데스크톱: 책이 타원 궤도를 3D 원근으로 돌고(뒤쪽은 작고 흐림), 누르면 앞으로 와서 멈추고(dock), 한 번 더 누르면 표지가 열려요.
// 모바일(760px 이하): 공전 없이 가로로 넘기는 책 카드.
(function () {
  'use strict';
  var PERIOD = 36; // 한 바퀴 초
  var TAU = Math.PI * 2;
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  };
  var mq = function (q) { return window.matchMedia ? window.matchMedia(q) : { matches: false, addEventListener: function () {} }; };
  var reduceMQ = mq('(prefers-reduced-motion: reduce)');
  var trackMQ = mq('(max-width:760px)');
  var easeOut = function (p) { return 1 - Math.pow(1 - p, 3); };

  function bookHTML(c, i) {
    var no = ('0' + (i + 1)).slice(-2);
    return '<button class="ob-book" type="button" data-cat="' + esc(c.id) + '" style="--c:' + esc(c.color) + ';--ink:' + esc(c.ink || '#fff') + '"' +
      ' aria-label="' + esc(c.label) + ' · ' + esc(c.ko) + '" aria-pressed="false">' +
      '<span class="ob-book__vol">' +
        '<span class="ob-book__body"><span class="ob-book__page">' +
          '<span class="ob-page__ko">' + esc(c.ko) + '</span>' +
          '<span class="ob-page__desc">' + esc(c.desc || '') + '</span>' +
          '<span class="ob-page__detail" data-detail></span>' +
        '</span></span>' +
        '<span class="ob-book__cover" aria-hidden="true">' +
          '<span class="ob-book__front">' +
            '<span class="ob-cv__ed">' + esc(c.ed) + '</span>' +
            '<span class="ob-cv__mk">' + esc(c.mk) + '</span>' +
            '<span class="ob-cv__label">' + esc(c.label) + '</span>' +
            '<span class="ob-cv__foot"><span>' + esc(c.foot) + '</span><span>' + no + '</span></span>' +
          '</span>' +
          '<span class="ob-book__back"><span class="ob-cv__mk">' + esc(c.mk) + '</span><span class="ob-cv__label">' + esc(c.label) + '</span></span>' +
        '</span>' +
      '</span>' +
      '<span class="ob-book__cap" data-cap></span>' +
    '</button>';
  }

  function mount(host, opts) {
    opts = opts || {};
    var books = opts.books || [];
    var n = books.length || 1, step = TAU / n;
    var reduce = reduceMQ.matches;
    var running = !reduce, hold = false, picked = null, docked = null, anim = null;
    var phase = 0, last = 0, raf = 0, visible = true, track = trackMQ.matches;
    var W = 0, H = 0, cx = 0, cy = 0, rx = 0, ry = 0, bw = 80, openS = 1.6;

    host.classList.add('ob');
    host.innerHTML =
      '<div class="ob__stage" role="group" aria-label="행사 카테고리 선택">' +
        '<span class="ob__ring ob__ring--outer" aria-hidden="true"></span><span class="ob__ring ob__ring--inner" aria-hidden="true"></span>' +
        '<div class="ob__core" aria-hidden="true"><span>' + esc(opts.center || 'Insight.') + '</span></div>' +
        books.map(bookHTML).join('') +
      '</div>' +
      '<div class="ob__bar">' +
        '<button class="ob__toggle" type="button" aria-pressed="false"></button>' +
        '<p class="ob__hint" aria-live="polite"></p>' +
        '<button class="ob__close" type="button" hidden>표지 닫기</button>' +
      '</div>';
    var stage = host.querySelector('.ob__stage');
    var rings = host.querySelectorAll('.ob__ring');
    var els = Array.prototype.slice.call(host.querySelectorAll('.ob-book'));
    var toggle = host.querySelector('.ob__toggle');
    var hint = host.querySelector('.ob__hint');
    var closeBtn = host.querySelector('.ob__close');
    var elOf = function (id) { return els.filter(function (x) { return x.dataset.cat === id; })[0] || null; };
    var catOf = function (id) { return books.filter(function (c) { return c.id === id; })[0]; };

    // 책 속지 · 모바일 카드 아래 한 줄 — detail(cat)
    function fillDetail() {
      if (!opts.detail) return;
      els.forEach(function (el) {
        var html = opts.detail(catOf(el.dataset.cat)) || '';
        el.querySelector('[data-detail]').innerHTML = html;
        el.querySelector('[data-cap]').innerHTML = html;
      });
    }

    function measure() {
      W = stage.clientWidth; H = stage.clientHeight;
      bw = Math.max(52, Math.min(96, W * 0.17));
      var bh = bw * 1.38;
      cx = W / 2; cy = H / 2;
      rx = W / 2 - bw * 0.62;
      ry = Math.max(20, Math.min(H * 0.27, H / 2 - bh * 0.5));
      openS = Math.max(1, Math.min(1.75, (H * 0.88) / bh, (W * 0.92) / (2 * bw)));
      stage.style.setProperty('--bw', bw + 'px');
      rings[0].style.cssText = 'width:' + rx * 2 + 'px;height:' + ry * 2 + 'px;left:' + (cx - rx) + 'px;top:' + (cy - ry) + 'px';
      rings[1].style.cssText = 'width:' + rx * 1.24 + 'px;height:' + ry * 1.24 + 'px;left:' + (cx - rx * 0.62) + 'px;top:' + (cy - ry * 0.62) + 'px';
    }

    function layout() {
      if (track) return;
      els.forEach(function (el, i) {
        if (el === picked) return;
        var a = phase + i * step + Math.PI / 2; // 0번 책이 맨 앞에서 시작
        var sn = Math.sin(a), d = (sn + 1) / 2;
        var s = (0.58 + 0.42 * d) * (el.dataset.cat === docked ? 1.08 : 1);
        el.style.transform = 'translate(' + (cx + Math.cos(a) * rx).toFixed(1) + 'px,' + (cy + sn * ry).toFixed(1) + 'px) translate(-50%,-50%) scale(' + s.toFixed(3) + ')';
        el.style.zIndex = sn >= 0 ? 20 + Math.round(d * 10) : 1 + Math.round(d * 8);
        el.style.opacity = picked ? 0.22 : (0.5 + 0.5 * d).toFixed(2);
        el.style.filter = d < 0.45 && !picked ? 'blur(' + ((0.45 - d) * 3.2).toFixed(2) + 'px)' : '';
      });
    }

    var spinning = function () { return running && !hold && !picked && !docked && visible && !track; };
    function frame(t) {
      raf = 0;
      var dt = last ? Math.min(t - last, 50) : 16; last = t;
      if (anim) {
        var p = Math.min(1, (t - anim.t0) / anim.dur);
        if (!anim.t0) { anim.t0 = t; p = 0; }
        phase = anim.from + anim.delta * easeOut(p);
        if (p >= 1) anim = null;
      } else if (spinning()) phase = (phase + dt / 1000 * TAU / PERIOD) % TAU;
      layout();
      if (anim || spinning()) raf = requestAnimationFrame(frame); else last = 0;
    }
    function kick() { if (!raf && !track) raf = requestAnimationFrame(frame); }

    function setToggle() {
      toggle.setAttribute('aria-pressed', String(!running));
      toggle.textContent = running ? 'Ⅱ 공전 멈추기' : '▶ 공전 ' + (reduce && !phase ? '시작' : '다시 시작');
    }
    function setHint() {
      hint.textContent = picked ? (opts.openHint == null ? '아래 일정 목록이 이 카테고리로 정리돼요.' : opts.openHint)
        : docked && !track ? (opts.dockHint == null ? '한 번 더 누르면 책이 펼쳐져요.' : opts.dockHint) : '';
      closeBtn.hidden = !picked;
    }

    // 고른 책을 맨 앞으로 돌려 세워요. null이면 다시 공전.
    function dock(id) {
      if (id && !elOf(id)) id = null;
      if (picked && picked.dataset.cat !== id) close(true);
      docked = id || null;
      els.forEach(function (el) { el.setAttribute('aria-pressed', String(el.dataset.cat === docked)); el.classList.toggle('is-docked', el.dataset.cat === docked); });
      if (docked && !track) {
        var i = els.indexOf(elOf(docked));
        var target = (-i * step) % TAU;
        var delta = ((target - phase) % TAU + TAU * 1.5) % TAU - Math.PI;
        if (reduce || Math.abs(delta) < 0.001) { phase += delta; anim = null; }
        else anim = { from: phase, delta: delta, t0: 0, dur: 650 };
      }
      if (docked && track) {
        var el = elOf(docked);
        stage.scrollTo({ left: el.offsetLeft - (stage.clientWidth - el.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' });
      }
      setHint(); layout(); kick();
    }

    function open(id) {
      var el = elOf(id);
      if (!el || track) return;
      if (picked === el) return;
      if (picked) close(true);
      if (docked !== id) dock(id);
      picked = el;
      var at = opts.openAt == null ? 0.5 : opts.openAt;
      el.classList.add('is-flying', 'is-open');
      el.setAttribute('aria-expanded', 'true');
      el.style.zIndex = 60; el.style.opacity = 1; el.style.filter = '';
      el.style.transform = 'translate(' + (W * at + bw * openS * 0.5).toFixed(1) + 'px,' + cy.toFixed(1) + 'px) translate(-50%,-50%) scale(' + openS.toFixed(3) + ')';
      host.classList.add('is-picked');
      setHint(); layout();
    }

    function close(silent) {
      if (!picked) return;
      var el = picked;
      picked = null;
      el.classList.remove('is-open');
      el.removeAttribute('aria-expanded');
      host.classList.remove('is-picked');
      setHint(); layout();
      setTimeout(function () { el.classList.remove('is-flying'); kick(); }, 560);
      if (!silent && opts.onClose) opts.onClose();
    }

    function setMode() {
      track = trackMQ.matches;
      host.classList.toggle('ob--track', track);
      if (track) {
        close(true); anim = null;
        els.forEach(function (el) { el.style.transform = el.style.zIndex = el.style.opacity = el.style.filter = ''; });
      } else { measure(); layout(); }
      setHint(); kick();
    }

    els.forEach(function (el) {
      el.addEventListener('click', function () {
        var id = el.dataset.cat;
        if (picked === el) { close(); return; }
        if (docked === id && !track) { open(id); return; }
        dock(id);
        if (opts.onPick) opts.onPick(id);
      });
    });
    // 책 사이 ←→ 이동
    stage.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      var i = els.indexOf(document.activeElement); if (i < 0) return;
      e.preventDefault();
      els[(i + (e.key === 'ArrowRight' ? 1 : -1) + els.length) % els.length].focus();
    });
    closeBtn.addEventListener('click', function () { var el = picked; close(); if (el) el.focus(); });
    toggle.addEventListener('click', function () { running = !running; setToggle(); kick(); });
    // 마우스를 올리거나 키보드로 책에 들어오면 잠깐 멈춰서 누르기 쉽게
    stage.addEventListener('pointerenter', function () { hold = true; });
    stage.addEventListener('pointerleave', function () { hold = false; kick(); });
    stage.addEventListener('focusin', function () { hold = true; });
    stage.addEventListener('focusout', function () { hold = false; kick(); });
    host.addEventListener('keydown', function (e) { if (e.key === 'Escape' && picked) { var el = picked; close(); el.focus(); } });

    var ro = window.ResizeObserver ? new ResizeObserver(function () {
      if (track) return;
      measure();
      if (picked) { var id = picked.dataset.cat; close(true); open(id); }
      layout();
    }) : null;
    if (ro) ro.observe(stage); else window.addEventListener('resize', function () { if (!track) { measure(); layout(); } });
    var io = window.IntersectionObserver ? new IntersectionObserver(function (en) { visible = en[0].isIntersecting; kick(); }) : null;
    if (io) io.observe(stage);
    var onVis = function () { visible = !document.hidden; kick(); };
    document.addEventListener('visibilitychange', onVis);
    if (trackMQ.addEventListener) trackMQ.addEventListener('change', setMode);

    fillDetail(); setToggle(); setMode();

    return {
      dock: dock, pick: dock, open: open,
      close: function () { close(true); },
      toggleOpen: function (id) { if (picked && picked.dataset.cat === id) close(true); else open(id); },
      refresh: fillDetail,
      play: function () { running = true; setToggle(); kick(); },
      pause: function () { running = false; setToggle(); },
      destroy: function () {
        if (raf) cancelAnimationFrame(raf);
        if (ro) ro.disconnect(); if (io) io.disconnect();
        document.removeEventListener('visibilitychange', onVis);
        if (trackMQ.removeEventListener) trackMQ.removeEventListener('change', setMode);
        host.innerHTML = ''; host.classList.remove('ob', 'ob--track', 'is-picked');
      }
    };
  }

  window.OrbitBooks = { mount: mount };
})();
