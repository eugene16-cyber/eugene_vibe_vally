// Orbit Books — 행사 카테고리 책 공전 모듈 (Events · Home)
// OrbitBooks.mount(host, opts) → {select(id|null), current(), refresh(), play(), pause(), destroy()}
//   opts.books      CATS (id · label · ko · color · ink · ed · mk · foot)
//   opts.center     가운데 구 글자 (기본 'Insight.')
//   opts.info(cat)  → {next:'NEXT · 11.05 (목)', title, up, open} 책 속지 · 모바일 카드 한 줄
//   opts.panel(cat) → 오른쪽 패널 HTML. 안의 [data-ob-close]는 선택을 풀어요(× 버튼은 모듈이 붙여요)
//   opts.onSelect(id|null)  책 · 탭 · 화살표로 고르거나 풀 때
//   opts.cx · rx(w) · ry · focusX  궤도 중심(폭 비율) · 가로/세로 반지름 · 고른 책이 비켜설 위치(폭 비율)
// 데스크톱: 책이 기울어진 채 타원 궤도를 돌고, 고르면 정면으로 돌아온 뒤 왼쪽으로 비켜서며 표지가 열리고 오른쪽에 패널이 나와요.
// 모바일(760px 이하): 공전 없이 가로로 넘기는 카드 + 아래 패널.
(function () {
  'use strict';
  var TAU = Math.PI * 2;
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  };
  var mq = function (q) { return window.matchMedia ? window.matchMedia(q) : { matches: false, addEventListener: function () {}, removeEventListener: function () {} }; };
  var reduced = mq('(prefers-reduced-motion: reduce)');
  var mobile = mq('(max-width:760px)');
  var easeOut3 = function (p) { return 1 - Math.pow(1 - p, 3); };
  var easeOut4 = function (p) { return 1 - Math.pow(1 - p, 4); };

  function bookHTML(c, i) {
    var light = c.ink && c.ink.toLowerCase() !== '#fff';
    return '<button class="ob-book" type="button" data-cat="' + esc(c.id) + '" aria-pressed="false"' + (light ? ' data-light' : '') +
      ' style="--cover:' + esc(c.color) + ';--ctext:' + esc(c.ink || '#fff') + '" aria-label="' + esc(c.label) + ' · ' + esc(c.ko) + '">' +
      '<span class="ob-vol" aria-hidden="true">' +
        '<span class="ob-paper"></span>' +
        '<span class="ob-inside" data-inside></span>' +
        '<span class="ob-cover">' +
          '<span class="ob-ed">' + esc(c.ed) + '</span>' +
          '<span class="ob-bt">' + esc(c.label).replace(' ', ' <br>') + '</span>' +
          '<span class="ob-mk">' + esc(c.mk) + '</span>' +
          '<span class="ob-bm" data-meta></span>' +
          '<span class="ob-bf"><span>' + esc(c.foot) + '</span><span data-no>' + ('0' + (i + 1)).slice(-2) + '</span></span>' +
        '</span>' +
      '</span>' +
    '</button>';
  }

  function mount(host, o) {
    o = o || {};
    var books = o.books || [], n = books.length || 1, step = TAU / n;
    var CX = o.cx == null ? 0.5 : o.cx, RX = o.rx || function (w) { return Math.min(w * 0.36, 470); }, RY = o.ry == null ? 118 : o.ry;
    var FX = o.focusX == null ? 0.3 : o.focusX;
    var phase = Math.PI / 2, prev = 0, raf = 0, paused = reduced.matches, hovered = false, focusIn = false, visible = true;
    var tween = null, openTimer = 0, cur = null, fLvl = 0, fFrom = 0, fTo = 0, fT0 = 0, w = 0, h = 0;

    host.classList.add('ob');
    host.innerHTML =
      '<div class="ob__shelf">' +
        '<div class="ob__center" aria-hidden="true">' + esc(o.center || 'Insight.') + '</div>' +
        '<div class="ob__ring" aria-hidden="true"></div><div class="ob__ring ob__ring--two" aria-hidden="true"></div>' +
        '<i class="ob__star" aria-hidden="true"></i><i class="ob__star ob__star--two" aria-hidden="true"></i>' +
        '<button class="ob__toggle" type="button" aria-pressed="false"></button>' +
        '<div class="ob__track" role="group" aria-label="행사 카테고리 선택">' + books.map(bookHTML).join('') + '</div>' +
        '<div class="ob__panel" hidden></div>' +
      '</div>' +
      '<div class="ob__tabs">' +
        '<button class="ob__arrow" type="button" data-step="-1" aria-label="이전 카테고리">‹</button>' +
        '<div class="ob__tablist" role="group" aria-label="행사 카테고리">' + books.map(function (c) {
          return '<button class="ob__tab" type="button" data-cat="' + esc(c.id) + '" aria-pressed="false">' + esc(c.label) + '</button>';
        }).join('') + '</div>' +
        '<button class="ob__arrow" type="button" data-step="1" aria-label="다음 카테고리">›</button>' +
      '</div>';
    var shelf = host.querySelector('.ob__shelf'), track = host.querySelector('.ob__track');
    var panel = host.querySelector('.ob__panel'), toggle = host.querySelector('.ob__toggle');
    var els = Array.prototype.slice.call(track.querySelectorAll('.ob-book'));
    var tabs = Array.prototype.slice.call(host.querySelectorAll('.ob__tab'));
    var catOf = function (id) { return books.filter(function (c) { return c.id === id; })[0]; };
    var active = function () { return !mobile.matches; };

    function measure() { w = shelf.clientWidth; h = shelf.clientHeight; }
    function draw() {
      if (!active()) return;
      var cx = w * CX, cy = h * 0.53, rx = RX(w), ry = RY;
      els.forEach(function (b, i) {
        var a = phase + i * step, depth = (Math.sin(a) + 1) / 2;
        var bw = b.offsetWidth, bh = b.offsetHeight;
        var s = 0.64 + depth * 0.36, x = cx + Math.cos(a) * rx - bw / 2, y = cy + Math.sin(a) * ry - bh / 2;
        var op = 0.62 + depth * 0.38, z = Math.round(depth * 10) + 4;
        if (fLvl > 0) {
          if (b.dataset.cat === cur) { x += (w * FX - bw / 2 - x) * fLvl; y += (cy - bh / 2 - y) * fLvl; s += (1.12 - s) * fLvl; op = 1; z = 40; }
          else { op *= 1 - fLvl; s *= 1 - 0.18 * fLvl; }
        }
        b.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(' + s.toFixed(3) + ')';
        b.style.zIndex = z;
        b.style.opacity = op.toFixed(3);
        b.style.visibility = op < 0.02 ? 'hidden' : '';
        b.style.setProperty('--by', (-14 + Math.cos(a) * 17).toFixed(2) + 'deg');
        b.style.setProperty('--bz', (Math.cos(a) * -4).toFixed(2) + 'deg');
      });
    }
    function clear() { els.forEach(function (b) { b.style.transform = b.style.zIndex = b.style.opacity = b.style.visibility = ''; }); }

    // 매 프레임 — 공전 · 정면 돌려 세우기(tween) · 비켜서기(fLvl)를 실제 시간으로 보간
    function tick(t) {
      var dt = Math.min((t - prev) / 1000, 0.05) || 0; prev = t;
      if (active() && visible && !document.hidden) {
        var target = cur && !tween ? 1 : 0;
        if (target !== fTo) { fFrom = fLvl; fTo = target; fT0 = t; }
        if (fLvl !== fTo) { var q = reduced.matches ? 1 : Math.min((t - fT0) / 700, 1); fLvl = fFrom + (fTo - fFrom) * easeOut3(q); if (q === 1) fLvl = fTo; }
        if (tween) {
          var p = Math.min((t - tween.t0) / 850, 1);
          phase = tween.from + tween.delta * easeOut4(p);
          if (p === 1) tween = null;
          draw();
        } else if (fLvl > 0 || cur) draw();
        else if (!paused && !hovered && !focusIn) { phase += dt * 0.2; draw(); }
      }
      raf = requestAnimationFrame(tick);
    }

    function label() {
      toggle.textContent = paused ? '↻ 공전 재생' : 'Ⅱ 공전 멈추기';
      toggle.setAttribute('aria-pressed', String(paused));
    }
    function setOpen(id) { els.forEach(function (b) { b.classList.toggle('is-open', !!id && b.dataset.cat === id); }); }

    function fillInfo() {
      if (!o.info) return;
      els.forEach(function (b) {
        var f = o.info(catOf(b.dataset.cat)) || {};
        b.querySelector('[data-inside]').innerHTML =
          '<small>' + esc(f.next || 'NEXT · 추후 안내') + '</small><strong>' + esc(f.title || '') + '</strong>' +
          '<span class="ob-in__n">예정 <b>' + (f.up || 0) + '</b>건 · 신청 가능 <b>' + (f.open || 0) + '</b>건</span>' +
          '<small>' + esc(f.hint == null ? '아래 일정 목록이\n이 카테고리로 정리돼요' : f.hint).replace(/\n/g, '<br>') + '</small>';
        b.querySelector('[data-meta]').textContent = f.meta || '';
        b.querySelector('[data-no]').textContent = f.up ? ('0' + f.up).slice(-2) : '—';
      });
    }
    function renderPanel(still) {
      if (!cur || !o.panel) { panel.hidden = true; panel.innerHTML = ''; return; }
      panel.innerHTML = '<button type="button" class="ob__x" data-ob-close aria-label="닫고 다른 행사 보기">×</button>' + o.panel(catOf(cur));
      panel.hidden = false;
      if (still) return; // 내용만 갱신할 때는 들어오는 모션을 다시 틀지 않아요
      panel.classList.remove('is-in'); void panel.offsetWidth; panel.classList.add('is-in');
    }

    // 고르기 — 정면으로 돌려 세운 뒤(850ms) 비켜서며 표지를 열어요. null이면 궤도로 돌아가요.
    function select(id, silent) {
      if (id && !catOf(id)) id = null;
      clearTimeout(openTimer); setOpen(null);
      cur = id || null;
      shelf.classList.toggle('is-focus', !!cur);
      els.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.cat === cur)); });
      tabs.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.cat === cur)); });
      renderPanel();
      if (cur) {
        var i = els.indexOf(track.querySelector('[data-cat="' + cur + '"]'));
        if (!active()) {
          var b = els[i];
          track.scrollTo({ left: b.offsetLeft - (track.clientWidth - b.clientWidth) / 2, behavior: reduced.matches ? 'auto' : 'smooth' });
        } else {
          var target = Math.PI / 2 - i * step;
          var delta = ((target - phase + Math.PI) % TAU + TAU) % TAU - Math.PI;
          if (reduced.matches) { phase += delta; tween = null; draw(); setOpen(cur); }
          else {
            tween = { from: phase, delta: delta, t0: performance.now() };
            openTimer = setTimeout(function () { if (cur === id) setOpen(id); }, 620);
          }
        }
      }
      if (!silent && o.onSelect) o.onSelect(cur);
    }

    els.forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.dataset.cat;
        if (cur === id && active()) b.classList.toggle('is-open'); // 한 번 더 누르면 표지만 닫았다 열어요
        else select(id);
      });
    });
    track.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      var i = els.indexOf(document.activeElement); if (i < 0) return;
      e.preventDefault();
      var nx = els[(i + (e.key === 'ArrowRight' ? 1 : -1) + n) % n];
      nx.focus(); select(nx.dataset.cat);
    });
    host.addEventListener('click', function (e) {
      if (e.target.closest('[data-ob-close]')) { var was = cur; select(null); var b = was && track.querySelector('[data-cat="' + was + '"]'); if (b && active()) b.focus({ preventScroll: true }); return; }
      var tb = e.target.closest('.ob__tab');
      if (tb) { select(cur === tb.dataset.cat ? null : tb.dataset.cat); return; }
      var st = e.target.closest('[data-step]');
      if (st) {
        var i = books.findIndex(function (c) { return c.id === cur; }), d = +st.dataset.step;
        select(books[((i < 0 ? (d > 0 ? -1 : 0) : i) + d + n) % n].id);
      }
    });
    host.addEventListener('keydown', function (e) { if (e.key === 'Escape' && cur) { e.stopPropagation(); select(null); } });
    toggle.addEventListener('click', function () { paused = !paused; tween = null; if (!paused && cur) select(null); label(); });
    shelf.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') hovered = true; });
    shelf.addEventListener('pointerleave', function () { hovered = false; });
    shelf.addEventListener('focusin', function () { focusIn = true; });
    shelf.addEventListener('focusout', function (e) { focusIn = shelf.contains(e.relatedTarget); });

    var ro = window.ResizeObserver ? new ResizeObserver(function () { measure(); if (active()) draw(); else clear(); }) : null;
    if (ro) ro.observe(shelf);
    var io = window.IntersectionObserver ? new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }) : null;
    if (io) io.observe(shelf);
    var onMode = function () { measure(); if (active()) draw(); else clear(); };
    if (mobile.addEventListener) mobile.addEventListener('change', onMode);

    fillInfo(); label(); measure(); draw();
    raf = requestAnimationFrame(tick);

    return {
      select: function (id) { if ((id || null) !== cur) select(id, true); },
      current: function () { return cur; },
      refresh: function () { fillInfo(); if (cur) renderPanel(true); },
      play: function () { paused = false; label(); },
      pause: function () { paused = true; label(); },
      destroy: function () {
        cancelAnimationFrame(raf); clearTimeout(openTimer);
        if (ro) ro.disconnect(); if (io) io.disconnect();
        if (mobile.removeEventListener) mobile.removeEventListener('change', onMode);
        host.innerHTML = ''; host.classList.remove('ob');
      }
    };
  }

  window.OrbitBooks = { mount: mount };
})();
