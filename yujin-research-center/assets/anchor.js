// AI 앵커 카드 렌더러 — window.renderAnchor(el, {kind, title, caption, videoUrl, poster, chapters:[{title, sub, time}], sample, eyebrow})
// 영상 URL이 없으면 지어내지 않고 재생 시 '곧 제공' 토스트만 띄운다 (7-4). 스타일은 이 파일이 한 번만 주입한다.
(function () {
  'use strict';

  var CSS =
    '.vanchor{display:grid;grid-template-columns:340px minmax(0,1fr);gap:20px;align-items:start}' +
    '.vanchor__card{background:#fff;border:1px solid var(--color-hairline);border-radius:var(--radius-lg);overflow:hidden;box-shadow:var(--shadow-soft)}' +
    '.vanchor__stage{position:relative;aspect-ratio:4/5;background:radial-gradient(120% 80% at 50% 18%,#2a5bb8 0%,#0b2e6b 46%,#061026 100%);color:#fff;overflow:hidden}' +
    '.vanchor__stage img,.vanchor__stage video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}' +
    '.vanchor__figure{position:absolute;left:50%;top:44%;width:46%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;' +
      'background:radial-gradient(circle at 38% 32%,rgba(255,255,255,.9),rgba(77,171,247,.55) 34%,rgba(27,116,228,.18) 64%,transparent 70%);' +
      'box-shadow:0 0 60px 10px rgba(77,171,247,.28);animation:vaPulse 3.2s ease-in-out infinite}' +
    '.vanchor__figure::before,.vanchor__figure::after{content:"";position:absolute;inset:-18%;border-radius:50%;border:1px solid rgba(255,255,255,.18)}' +
    '.vanchor__figure::after{inset:-38%;border-color:rgba(255,255,255,.09)}' +
    '@keyframes vaPulse{50%{transform:translate(-50%,-50%) scale(1.05)}}' +
    '.vanchor__live{position:absolute;left:14px;top:14px;display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 9px;border-radius:var(--radius-full);' +
      'background:rgba(224,52,75,.92);font-size:11px;font-weight:800;letter-spacing:.08em}' +
    '.vanchor__live::before{content:"";width:6px;height:6px;border-radius:50%;background:#fff;animation:vaBlink 1.2s steps(2) infinite}' +
    '@keyframes vaBlink{50%{opacity:.2}}' +
    '.vanchor__tag{position:absolute;right:14px;top:14px}' +
    '.vanchor__play{position:absolute;left:50%;top:44%;width:64px;height:64px;transform:translate(-50%,-50%);border-radius:50%;background:rgba(255,255,255,.94);' +
      'color:var(--blue-navy);font-size:22px;display:grid;place-items:center;box-shadow:0 10px 30px rgba(0,0,0,.25);transition:transform var(--dur-micro)}' +
    '.vanchor__play:hover{transform:translate(-50%,-50%) scale(1.06)}' +
    '.vanchor__bottom{position:absolute;left:0;right:0;bottom:0;padding:14px 16px 16px;background:linear-gradient(transparent,rgba(4,10,26,.82))}' +
    '.vanchor__wave{display:flex;align-items:flex-end;gap:3px;height:22px;margin-bottom:10px}' +
    '.vanchor__wave i{flex:1;border-radius:2px;background:rgba(255,255,255,.55);animation:vaWave 1.4s ease-in-out infinite}' +
    '@keyframes vaWave{50%{transform:scaleY(.35)}}' +
    '.vanchor__wave i{transform-origin:bottom}' +
    '.vanchor__bar{height:3px;border-radius:2px;background:rgba(255,255,255,.22);overflow:hidden}' +
    '.vanchor__bar span{display:block;height:100%;width:0;background:var(--blue-point)}' +
    '.vanchor__body{padding:18px 20px 20px}' +
    '.vanchor__eyebrow{font-size:var(--text-micro);font-weight:700;letter-spacing:.08em;color:var(--blue-main)}' +
    '.vanchor__title{margin-top:6px;font-size:var(--text-lg);font-weight:700;line-height:1.4;color:var(--ink-900)}' +
    '.vanchor__cap{margin-top:6px;font-size:14px;color:var(--color-muted)}' +
    '.vanchor__body .btn{margin-top:14px}' +
    '.vanchor__chapters{background:#fff;border:1px solid var(--color-hairline);border-radius:var(--radius-lg);box-shadow:var(--shadow-soft);padding:8px 8px 10px}' +
    '.vanchor__chhead{display:flex;align-items:center;gap:8px;padding:12px 14px 8px;font-size:var(--text-micro);font-weight:700;letter-spacing:.08em;color:var(--ink-500)}' +
    '.vanchor__ch{display:flex;gap:14px;align-items:flex-start;width:100%;padding:14px;border-radius:var(--radius-md);text-align:left;transition:background var(--dur-micro)}' +
    '.vanchor__ch:hover{background:#f6f8fb}' +
    '.vanchor__no{flex:none;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#e8f1fe;color:var(--blue-main);font-size:13px;font-weight:800}' +
    '.vanchor__cht{display:block;font-weight:700;color:var(--ink-900);line-height:1.45}' +
    '.vanchor__chs{display:block;margin-top:2px;font-size:13.5px;color:var(--color-muted);line-height:1.55}' +
    '.vanchor__time{margin-left:auto;flex:none;font-size:12px;font-weight:600;color:var(--gray-400);font-variant-numeric:tabular-nums}' +
    '@media (max-width:900px){.vanchor{grid-template-columns:minmax(0,1fr)}.vanchor__card{max-width:420px;width:100%;margin:0 auto}}' +
    '@media (prefers-reduced-motion:reduce){.vanchor__figure,.vanchor__wave i,.vanchor__live::before{animation:none}}';

  function injectCss() {
    if (document.getElementById('vanchor-css')) return;
    var st = document.createElement('style');
    st.id = 'vanchor-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }

  var e = function (s) { return window.esc ? window.esc(s) : String(s == null ? '' : s); };
  var KIND = { market: 'AI ANCHOR · 오늘의 시황', global: 'AI ANCHOR · 해외 오버나이트', reports: 'AI ANCHOR · 발간 리포트' };

  window.renderAnchor = function (el, o) {
    if (!el) return;
    injectCss();
    o = o || {};
    var chapters = o.chapters || [];
    var bars = '';
    for (var i = 0; i < 28; i++) bars += '<i style="height:' + (30 + ((i * 37) % 70)) + '%;animation-delay:' + ((i % 7) * -0.18).toFixed(2) + 's"></i>';
    el.innerHTML =
      '<div class="vanchor">' +
        '<div class="vanchor__card">' +
          '<div class="vanchor__stage">' +
            (o.poster ? '<img src="' + e(o.poster) + '" alt="AI 앵커 브리핑 화면">' : '<div class="vanchor__figure" aria-hidden="true"></div>') +
            '<span class="vanchor__live">LIVE</span>' +
            (o.sample ? '<span class="vanchor__tag badge badge--sample">예시</span>' : '') +
            '<button class="vanchor__play" type="button" aria-label="브리핑 재생">▶</button>' +
            '<div class="vanchor__bottom"><div class="vanchor__wave" aria-hidden="true">' + bars + '</div><div class="vanchor__bar"><span></span></div></div>' +
          '</div>' +
          '<div class="vanchor__body">' +
            '<div class="vanchor__eyebrow">' + e(o.eyebrow || KIND[o.kind] || 'AI ANCHOR') + '</div>' +
            '<h3 class="vanchor__title">' + e(o.title || '오늘의 브리핑') + '</h3>' +
            (o.caption ? '<p class="vanchor__cap">' + e(o.caption) + '</p>' : '') +
            '<button class="btn btn--primary btn--sm" type="button" data-va-play>브리핑 재생 ▶</button>' +
          '</div>' +
        '</div>' +
        '<div class="vanchor__chapters">' +
          '<div class="vanchor__chhead">CHAPTERS · ' + chapters.length + '</div>' +
          chapters.map(function (c, i) {
            return '<button class="vanchor__ch" type="button" data-va-ch="' + i + '"><span class="vanchor__no">' + (i + 1) + '</span>' +
              '<span><span class="vanchor__cht">' + e(c.title) + '</span>' + (c.sub ? '<span class="vanchor__chs">' + e(c.sub) + '</span>' : '') + '</span>' +
              (c.time ? '<span class="vanchor__time">' + e(c.time) + '</span>' : '') + '</button>';
          }).join('') +
        '</div>' +
      '</div>';

    var stage = el.querySelector('.vanchor__stage');
    var bar = el.querySelector('.vanchor__bar span');
    var video = null;
    var toSec = function (t) { var p = String(t || '0').split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); };
    function play(at) {
      if (!o.videoUrl) { if (window.soon) window.soon('AI 앵커 영상'); return; }
      if (!video) {
        video = document.createElement('video');
        video.src = o.videoUrl; video.controls = true; video.playsInline = true;
        if (o.poster) video.poster = o.poster;
        video.addEventListener('timeupdate', function () { if (video.duration) bar.style.width = (video.currentTime / video.duration * 100) + '%'; });
        stage.appendChild(video);
        el.querySelector('.vanchor__play').hidden = true;
      }
      if (at != null) video.currentTime = at;
      video.play().catch(function () {});
    }
    el.querySelector('.vanchor__play').addEventListener('click', function () { play(); });
    el.querySelector('[data-va-play]').addEventListener('click', function () { play(); });
    Array.prototype.forEach.call(el.querySelectorAll('[data-va-ch]'), function (b) {
      b.addEventListener('click', function () { play(toSec(chapters[+b.dataset.vaCh].time)); });
    });
  };
})();
