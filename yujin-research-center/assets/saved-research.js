// 저장한 리서치 — localStorage['il.saved-research-v1'] (7-8)
// 항목: {kind:'report'|'cardnews', id, title, category, date, at}
// ILSaved.toggle(item) → 저장됐으면 true · has(kind, id) · list(kind?) · remove(kind, id) · onChange(cb)
(function () {
  'use strict';
  var KEY = 'il.saved-research-v1';
  var subs = [];

  function read() {
    try { var v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
    emit();
  }
  function emit() { var l = read(); subs.forEach(function (cb) { try { cb(l); } catch (e) { console.warn('[ILSaved]', e); } }); }
  var same = function (a, kind, id) { return a.kind === kind && String(a.id) === String(id); };

  function has(kind, id) { return read().some(function (a) { return same(a, kind, id); }); }
  function list(kind) {
    return read().filter(function (a) { return !kind || a.kind === kind; })
      .sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
  }
  function remove(kind, id) { write(read().filter(function (a) { return !same(a, kind, id); })); }
  function toggle(item) {
    if (!item || !item.kind || item.id == null) return false;
    if (has(item.kind, item.id)) { remove(item.kind, item.id); return false; }
    var l = read();
    l.push({ kind: item.kind, id: item.id, title: item.title || '', category: item.category || '', date: item.date || '', at: new Date().toISOString() });
    write(l);
    return true;
  }
  function onChange(cb) { subs.push(cb); return function () { subs = subs.filter(function (x) { return x !== cb; }); }; }

  // 다른 탭에서 바뀐 것도 반영
  window.addEventListener('storage', function (e) { if (e.key === KEY) emit(); });

  window.ILSaved = { toggle: toggle, has: has, list: list, remove: remove, onChange: onChange, KEY: KEY };
})();
