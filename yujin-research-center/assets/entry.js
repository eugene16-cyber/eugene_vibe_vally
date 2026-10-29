// 진입 단계 전환 · 시연 세션 (7-2). 이메일 로그인은 login.js.
(function () {
  'use strict';

  // 2장 고객 유형 — 비워 두면 이 예시 값으로 들어간다
  var DEMO = {
    am:  { cust_type: '자산운용사', name: '김민준', org: '한빛자산운용(가상)' },
    ia:  { cust_type: '투자자문·일임사', name: '이서연', org: '온결투자자문(가상)' },
    dma: { cust_type: 'DMA 전문투자자', name: '박지훈', org: '개인 전문투자자(가상)' },
    etc: { cust_type: '기타 기관', name: '김민준', org: '한빛자산운용(가상)' },
    hnw: { cust_type: '고액자산가', name: '최은정', branch: '강남금융센터(가상)' }
  };

  var profile = null;   // 고른 고객 정보 — 로그인 단계에서 세션이 된다
  var lastForm = 's-type';

  var main = $('#main'), video = $('#reel-video');

  function go(id) {
    // 쇼릴 단계만 전체 화면, 나머지는 줄어든 프레임에서 반복 재생
    var reel = id === 's-reel';
    main.setAttribute('data-phase', reel ? 'reel' : 'pick');
    video.loop = !reel;
    if (!reel && video.paused) video.play().catch(function () {});
    $$('.step').forEach(function (s) { s.classList.toggle('is-on', s.id === id); });
    $('#entry-foot').hidden = id === 's-reel';
    window.scrollTo(0, 0);
    var h = $('#' + id + ' h1, #' + id + ' h2');
    if (h && id !== 's-reel') { h.tabIndex = -1; h.focus({ preventScroll: true }); }
  }

  function buildProfile(form, persona) {
    var d = DEMO[persona], v = function (n) { return form[n] ? form[n].value.trim() : ''; };
    var p = { role: 'customer', persona: persona, seg: persona === 'hnw' ? 'WM' : '법인', cust_type: d.cust_type, name: v('name') || d.name };
    if (persona === 'hnw') { p.branch = v('branch') || d.branch; p.invite_code = v('invite_code'); }
    else p.org = v('org') || d.org;
    return p;
  }

  function showWho() {
    $('#login-who').innerHTML = '<b>' + esc(profile.name) + '</b> · ' + esc(profile.cust_type) + ' · ' + esc(profile.org || profile.branch);
  }

  function finish(session) {
    try { localStorage.setItem('il.session', JSON.stringify(session)); } catch (e) {}
    if (session.status === 'approved') {
      var back = null;
      try { back = sessionStorage.getItem('il.return'); sessionStorage.removeItem('il.return'); } catch (e) {}
      location.href = back && !/^index(\.html)?/.test(back) ? back : 'home.html';
    } else showWait(session.status);
  }

  function showWait(status) {
    var no = status === 'rejected';
    $('#wait-icon').className = 'wait__icon' + (no ? ' wait__icon--no' : '');
    $('#wait-icon').innerHTML = no ? '!' : '<span class="wait__spin"></span>';
    $('#wait-title').textContent = no ? '승인되지 않았어요' : '소속 확인 중이에요';
    $('#wait-desc').textContent = no
      ? '입력한 소속을 확인하지 못했어요. 담당 영업 직원이나 PB에게 문의해 주세요.'
      : '담당자가 소속을 확인하면 이메일로 알려드려요. 보통 영업일 기준 하루 안에 끝나요.';
    $('#btn-approve').hidden = no;
    go('s-wait');
  }

  /* ---------- 이벤트 ---------- */
  // 쇼릴 진행 바 · 끝나면 고객 유형 선택으로
  video.addEventListener('timeupdate', function () {
    if (video.duration) $('#reel-progress').style.width = (video.currentTime / video.duration * 100) + '%';
  });
  video.addEventListener('ended', function () { if (main.getAttribute('data-phase') === 'reel') go('s-type'); });
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-go]');
    if (t) go(t.getAttribute('data-go'));
  });
  $$('.pick__card').forEach(function (c) {
    c.addEventListener('click', function () { lastForm = c.dataset.seg === 'WM' ? 's-wm' : 's-inst'; go(lastForm); });
  });
  $('#f-inst').addEventListener('submit', function (e) {
    e.preventDefault();
    profile = buildProfile(e.target, e.target.persona.value);
    showWho(); go('s-login');
  });
  $('#f-wm').addEventListener('submit', function (e) {
    e.preventDefault();
    profile = buildProfile(e.target, 'hnw');
    showWho(); go('s-login');
  });
  $('#login-back').addEventListener('click', function () { go(lastForm); });
  $('#btn-demo').addEventListener('click', function () {
    finish(Object.assign({}, profile, { status: 'approved', via: 'demo' }));
  });
  $('#btn-approve').addEventListener('click', function () {
    var s = IL.session() || Object.assign({ via: 'demo' }, profile || buildProfile({}, 'am'));
    finish(Object.assign(s, { status: 'approved' }));
  });

  window.ILEntry = { go: go, finish: finish, showWait: showWait, getProfile: function () { return profile; }, DEMO: DEMO };

  /* ---------- 시작 화면 ---------- */
  var q = new URLSearchParams(location.search);
  var demoStatus = q.get('demo_status');
  if (demoStatus === 'pending' || demoStatus === 'rejected') showWait(demoStatus);
  else go(q.get('start') === '1' ? 's-type' : 's-reel');
  // 첫 화면은 애니메이션 없이 자리 잡고, 이후 단계 전환부터 줄어드는 모션을 쓴다
  requestAnimationFrame(function () { requestAnimationFrame(function () { main.classList.remove('is-instant'); }); });
})();
