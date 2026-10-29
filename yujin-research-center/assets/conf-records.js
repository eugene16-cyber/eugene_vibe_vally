// 행사 신청 · 문의 기록 — window.ILConf (7-6 · C-2)
// localStorage['il-conf-records-v1'] = [{id, kind:'apply'|'request', type, title, eventId, at(ISO), email, ...}] (추가한 순서)
// 실제 접수 · 전송은 없어요. 이 브라우저에만 남는 시연 기록이에요.
(function () {
  'use strict';
  var KEY = 'il-conf-records-v1';
  var subs = [];

  function read() {
    try { var v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { console.warn('[IL] 신청 기록을 저장하지 못했어요', e); }
    emit();
  }
  function emit() { var list = read(); subs.forEach(function (cb) { try { cb(list); } catch (e) { console.warn(e); } }); }

  window.ILConf = {
    KEY: KEY,
    list: read,
    add: function (rec) {
      var r = Object.assign({ id: 'cr-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), kind: 'apply', at: new Date().toISOString() }, rec);
      var list = read(); list.push(r); write(list);
      return r;
    },
    remove: function (id) { write(read().filter(function (r) { return r.id !== id; })); },
    // 그 행사에 남긴 가장 최근 기록 (없으면 null)
    find: function (eventId) { return read().filter(function (r) { return r.eventId === eventId; }).pop() || null; },
    onChange: function (cb) { subs.push(cb); return function () { subs = subs.filter(function (x) { return x !== cb; }); }; }
  };
  // 다른 탭에서 바뀐 것도 반영
  window.addEventListener('storage', function (e) { if (e.key === KEY) emit(); });
})();
