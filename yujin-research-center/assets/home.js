// Home — 호칭 한 줄 · 유진 Event(Orbit Books). 근거형 Q&A는 yuri-qa.js, 리서치 카드뉴스는 cn-story.js
(function () {
  'use strict';
  var s = IL.session() || {};

  /* ---------- 호칭 ---------- */
  $('#hm-who').innerHTML = '<em>' + esc(s.name || '고객') + '</em>님 맞춤형 서비스 라운지';

  /* ---------- 유진 Event — Orbit Books (Events 페이지와 같은 모듈) ---------- */
  var E = window.IL_EVENTS;
  if (E && E.CATS) $('#ev-title').innerHTML = '<em>' + esc(s.name || '고객') + '</em>님에게 도착한 맞춤형 서비스 ' + E.CATS.length + '개';
  if (window.OrbitBooks && E) {
    var upcoming = function (cat) {
      return E.EVENTS.filter(function (e) { return e.cat === cat && !E.isPast(e); })
        .sort(function (a, b) { return String(a.start).localeCompare(String(b.start)); });
    };
    OrbitBooks.mount($('#hm-orbit'), {
      books: E.CATS, center: 'Event.',
      info: function (c) {
        var up = upcoming(c.id), next = up[0];
        return {
          next: next ? 'NEXT · ' + (next.tba ? '일정 미확정' : E.md(next.start) + ' (' + E.dow(next.start) + ')') : 'NEXT · 추후 안내',
          title: next ? next.title : c.ko + ' 일정 준비 중', up: up.length,
          open: up.filter(function (e) { return E.status(e).can; }).length,
          meta: next ? '예정 ' + up.length + '건' : '예정 일정 없음'
        };
      },
      panel: function (c) {
        var up = upcoming(c.id).slice(0, 3);
        return '<p class="obp__k">' + esc(c.ed) + '</p><h3 class="obp__t">' + esc(c.label) + '<span>' + esc(c.ko) + '</span></h3>' +
          '<p class="obp__d">' + esc(c.desc || '') + '</p>' +
          '<p class="obp__h">' + (up.length ? '다가오는 일정' : '예정된 행사가 없어요') + '</p>' +
          (up.length ? '<ul class="obp__list">' + up.map(function (e) {
            return '<li><a href="conferences.html?event=' + encodeURIComponent(e.id) + '"><time>' + esc(E.dateLabel ? E.dateLabel(e) : e.start) + '</time><span><b>' + esc(e.title) + '</b>' +
              '<em>' + esc(E.status(e).label) + (E.isSample(e) ? ' · 예시' : '') + '</em></span></a></li>';
          }).join('') + '</ul>' : '<p class="obp__none">담당자에게 일정을 문의해 주세요.</p>') +
          '<div class="obp__acts"><a class="btn btn--primary btn--sm" href="conferences.html?cat=' + encodeURIComponent(c.id) + '">' + esc(c.ko) + ' 일정 보기 →</a></div>';
      }
    });
  }

})();
