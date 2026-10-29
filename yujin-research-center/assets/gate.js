// 로그인 보호 — 각 페이지 <head> 첫 줄에서 동기 실행 (7-1)
(function () {
  var s = null;
  try { s = JSON.parse(localStorage.getItem('il.session') || 'null'); } catch (e) {}
  if (!s || s.status !== 'approved') {
    try { sessionStorage.setItem('il.return', location.pathname.split('/').pop() + location.search + location.hash); } catch (e) {}
    location.replace('index.html?start=1');
    return;
  }
  // 기관 · WM 차이는 persona==='hnw' 하나로만 가른다 (2장)
  var root = document.documentElement;
  root.setAttribute('data-persona', s.persona);
  root.setAttribute('data-seg', s.persona === 'hnw' ? 'wm' : 'inst');
})();
