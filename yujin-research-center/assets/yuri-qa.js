// 유리 근거형 Q&A — 가입 상담 화면이 작아져 오른쪽 아래 버튼이 되고, 누르면 채팅창으로 다시 열린다
// 서버 AI가 없으니 검수 완료 질문에만 답하고, 답은 Supabase reports의 실제 요약 + 근거 리포트 링크로 만든다.
(function () {
  'use strict';
  var s = IL.session() || {}, p = s.profile || {};
  var Q_KEY = 'il.home-questions';

  /* ---------- 스타일 (첫 화면 홀로그램 패널과 같은 톤) ---------- */
  var css = document.createElement('style');
  css.textContent = [
    '.yq-fab{position:fixed;right:max(20px,env(safe-area-inset-right,0px));bottom:max(20px,env(safe-area-inset-bottom,0px));z-index:400;display:flex;align-items:center;gap:10px;height:56px;padding:0 18px 0 8px;border-radius:999px;border:1px solid rgba(63,243,255,.45);background:rgba(3,16,26,.92);color:#e4fbff;font-weight:700;font-size:14px;box-shadow:0 0 30px rgba(63,243,255,.28),0 12px 30px -10px rgba(0,0,0,.6);transition:transform .2s,box-shadow .2s}',
    '.yq-fab:hover{transform:translateY(-2px);box-shadow:0 0 40px rgba(63,243,255,.45),0 12px 30px -10px rgba(0,0,0,.6)}',
    '.yq-orb{width:40px;height:40px;border-radius:50%;flex:none;background:radial-gradient(circle at 38% 32%,#e9feff,#3ff3ff 42%,#0077a8 78%,#022 100%);box-shadow:0 0 18px rgba(63,243,255,.8),inset 0 -4px 10px rgba(0,30,50,.5);animation:yq-breathe 3.6s ease-in-out infinite}',
    '@keyframes yq-breathe{50%{box-shadow:0 0 28px rgba(63,243,255,1),inset 0 -4px 10px rgba(0,30,50,.5)}}',
    '.yq-fab[aria-expanded=true]{opacity:0;pointer-events:none}',
    '.yq-dock{position:fixed;z-index:401;left:50%;top:50%;width:min(60vmin,520px);aspect-ratio:1;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;background:radial-gradient(circle at 38% 32%,#e9feff,#3ff3ff 30%,#0077a8 62%,rgba(0,40,60,0) 72%);box-shadow:0 0 120px rgba(63,243,255,.6);transition:all .9s cubic-bezier(.16,1,.3,1)}',
    '.yq{position:fixed;z-index:402;right:max(20px,env(safe-area-inset-right,0px));bottom:max(20px,env(safe-area-inset-bottom,0px));width:min(420px,calc(100vw - 32px));height:min(640px,calc(100vh - 100px));display:flex;flex-direction:column;border-radius:14px;color:#e4fbff;background:rgba(3,16,26,.96);border:1px solid rgba(63,243,255,.32);box-shadow:0 0 40px rgba(63,243,255,.16),0 30px 70px -20px rgba(0,0,0,.7);backdrop-filter:blur(10px);transform-origin:bottom right;transform:scale(.6);opacity:0;visibility:hidden;transition:transform .35s cubic-bezier(.16,1,.3,1),opacity .25s,visibility 0s .35s;font-family:var(--font-sans)}',
    '.yq.is-open{transform:none;opacity:1;visibility:visible;transition:transform .35s cubic-bezier(.16,1,.3,1),opacity .25s}',
    '.yq-head{display:flex;align-items:center;gap:11px;padding:14px 14px 12px 16px;border-bottom:1px solid rgba(63,243,255,.18)}',
    '.yq-head .yq-orb{width:32px;height:32px}',
    '.yq-head b{display:block;font-size:15px}.yq-head span{display:block;font-size:11.5px;color:#7fa9b8}',
    '.yq-x{margin-left:auto;width:32px;height:32px;border-radius:8px;border:1px solid rgba(63,243,255,.18);background:transparent;color:#7fa9b8;font-size:14px}',
    '.yq-log{flex:1;min-height:0;overflow-y:auto;padding:14px 14px 6px;display:flex;flex-direction:column;gap:10px}',
    '.yq-m{max-width:90%;padding:10px 13px;border-radius:10px;font-size:14px;line-height:1.6;animation:fadeUp .28s ease-out both}',
    '.yq-m.bot{align-self:flex-start;background:rgba(63,243,255,.07);border:1px solid rgba(63,243,255,.18);border-top-left-radius:3px}',
    '.yq-m.me{align-self:flex-end;background:rgba(63,243,255,.85);color:#021018;font-weight:600;border-top-right-radius:3px}',
    '.yq-m .t{display:block;font-weight:700;font-size:15px}.yq-m .h{display:block;margin-top:2px;font-size:12.5px;color:#7fa9b8}',
    '.yq-m ul{margin:8px 0 0;padding-left:16px;display:grid;gap:8px}.yq-m li span{color:#9cc4d0;font-size:13px}',
    '.yq-cites{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}',
    '.yq-cites a{max-width:100%;padding:4px 10px;border-radius:999px;font-size:12px;color:#bdf7ff;background:rgba(63,243,255,.1);border:1px solid rgba(63,243,255,.3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.yq-note{font-size:11px;color:#4c7180;margin-top:8px}',
    '.yq-box{margin:8px 12px 12px;border:1px solid rgba(63,243,255,.28);border-radius:12px;background:rgba(2,14,22,.82);overflow:hidden}',
    '.yq-box-h{display:flex;justify-content:space-between;padding:10px 14px 8px;border-bottom:1px solid rgba(63,243,255,.18);font-size:13px;font-weight:600}.yq-box-h span{font-size:10.5px;color:#4c7180;font-weight:400}',
    '.yq-opts{max-height:30vh;overflow-y:auto}',
    '.yq-opt{display:flex;gap:12px;width:100%;padding:9px 14px;text-align:left;color:#e4fbff;background:transparent;border:0;border-bottom:1px solid rgba(63,243,255,.08);font-size:13.5px;line-height:1.4}',
    '.yq-opt:hover,.yq-opt:focus-visible{background:rgba(63,243,255,.08);outline:none}',
    '.yq-opt i{flex:none;width:24px;height:24px;border-radius:7px;display:grid;place-items:center;font-style:normal;font-size:12px;color:#7fa9b8;background:rgba(63,243,255,.06);border:1px solid rgba(63,243,255,.18)}',
    '.yq-opt small{display:block;font-size:11.5px;color:#7fa9b8;margin-top:1px}',
    '.yq-ask{display:flex;align-items:center;gap:8px;padding:6px 8px 6px 14px}',
    '.yq-ask span{color:#7fa9b8}.yq-ask input{flex:1;min-width:0;height:34px;border:0;background:transparent;color:#e4fbff;font:inherit;font-size:14px}.yq-ask input:focus{outline:none}.yq-ask input::placeholder{color:#4c7180}',
    '.yq-ask button{width:32px;height:30px;border-radius:7px;border:1px solid rgba(63,243,255,.18);background:transparent;color:#7fa9b8}',
    '@media (max-width:560px){.yq{right:8px;bottom:8px;width:calc(100vw - 16px);height:calc(100svh - 80px)}.yq-fab span{display:none}.yq-fab{padding:0 8px}}',
    '@media (prefers-reduced-motion:reduce){.yq,.yq-dock,.yq-orb{transition:none;animation:none}}'
  ].join('\n');
  document.head.appendChild(css);

  /* ---------- 검수 완료 질문 — 관심 분야 순서로 ---------- */
  var PRESETS = [
    { id: 'semi', tag: '반도체', q: '최근 반도체 리포트 요약해 줘', keys: /반도체|메모리|HBM|파운드리|D램/i, lead: '최근 반도체 관련 리포트에서 짚은 내용이에요.' },
    { id: 'market', tag: '시황', q: '최근 시황 리포트 핵심만 알려 줘', match: function (r) { return r.kind === 'macro' || /투자전략|시황|매크로|전략/.test(r.category || ''); }, lead: '최근 시황 · 전략 리포트의 핵심이에요.' },
    { id: 'ai', tag: 'AI 인프라', q: 'AI 인프라 관련 최근 자료 찾아 줘', keys: /AI|인공지능|데이터센터|전력기기|GPU/i, lead: 'AI 인프라와 연결된 최근 자료예요.' },
    { id: 'bio', tag: '바이오', q: '바이오 업종 리포트 정리해 줘', keys: /바이오|제약|헬스|의료/, lead: '바이오 · 헬스케어 관련 최근 리포트예요.' },
    { id: 'battery', tag: '2차전지', q: '2차전지 리포트는 어떤 내용이야?', keys: /2차전지|이차전지|배터리|양극재/, lead: '2차전지 관련 최근 리포트예요.' },
    { id: 'rate', tag: '금리', q: '금리 전망 다룬 리포트 있어?', keys: /금리|채권|연준|FOMC|국채/i, lead: '금리 · 통화정책을 다룬 최근 리포트예요.' },
    { id: 'div', tag: '배당', q: '배당 · 인컴 관련 리포트 있어?', keys: /배당|주주환원|밸류업|인컴/, lead: '배당 · 주주환원을 다룬 최근 리포트예요.' }
  ];
  var want = (p.sectors || []).join(' ');
  PRESETS.sort(function (a, b) {
    var ha = a.keys && a.keys.test(want) ? 0 : a.id === 'market' ? 1 : 2, hb = b.keys && b.keys.test(want) ? 0 : b.id === 'market' ? 1 : 2;
    return ha - hb;
  });
  var REPORTS = [
    { id: 'S1', kind: 'sector', category: '반도체', title: '메모리 업황 점검(예시)', summary: '재고 조정이 마무리 단계에 들어서며 가격 흐름이 안정되는 모습이에요.', published_at: '2026-10-27' },
    { id: 'S2', kind: 'macro', category: '투자전략', title: '11월 주식시장 전망(예시)', summary: '이익 추정치 변화와 환율 흐름을 변수로 꼽았어요.', published_at: '2026-10-28' }
  ], sample = true;
  if (window.sb) sb.from('reports').select('id,kind,category,title,summary,company,published_at').order('published_at', { ascending: false }).limit(200)
    .then(function (r) { if (r.data && r.data.length) { REPORTS = r.data; sample = false; } }, function () {});

  /* ---------- 화면 ---------- */
  var fab = document.createElement('button');
  fab.type = 'button'; fab.className = 'yq-fab'; fab.setAttribute('aria-expanded', 'false'); fab.setAttribute('aria-controls', 'yq');
  fab.innerHTML = '<i class="yq-orb" aria-hidden="true"></i><span>유리에게 질문</span>';
  var box = document.createElement('section');
  box.className = 'yq'; box.id = 'yq'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', '유리 근거형 Q&A');
  box.innerHTML = '<div class="yq-head"><i class="yq-orb" aria-hidden="true"></i><div><b>유리</b><span>근거형 Q&A · 리서치센터 리포트로 답해요</span></div><button type="button" class="yq-x" aria-label="닫기">✕</button></div>' +
    '<div class="yq-log" role="log" aria-live="polite"></div>' +
    '<div class="yq-box"><div class="yq-box-h">검수 완료 질문<span>하나 선택 · 직접 입력 가능</span></div><div class="yq-opts"></div>' +
    '<form class="yq-ask"><span aria-hidden="true">✎</span><label class="sr-only" for="yq-in">직접 입력</label><input id="yq-in" autocomplete="off" placeholder="직접 입력"><button type="submit" aria-label="보내기">↵</button></form></div>';
  document.body.appendChild(fab); document.body.appendChild(box);
  var logEl = $('.yq-log', box), optsEl = $('.yq-opts', box), input = $('#yq-in', box);
  optsEl.innerHTML = PRESETS.map(function (q, i) {
    return '<button type="button" class="yq-opt" data-q="' + q.id + '"><i>' + (i + 1) + '</i><span>' + esc(q.q) + '<small>#' + esc(q.tag) + ' · 검수 완료</small></span></button>';
  }).join('');

  function msg(cls, html) { var el = document.createElement('div'); el.className = 'yq-m ' + cls; el.innerHTML = html; logEl.appendChild(el); logEl.scrollTop = logEl.scrollHeight; return el; }
  var first = function (t) { t = String(t || '').replace(/\s+/g, ' ').trim(); var m = t.match(/^.{20,130}?[.다요]\s/); return m ? m[0].trim() : t.slice(0, 110) + (t.length > 110 ? '…' : ''); };
  function cites(list) { return list.length ? '<div class="yq-cites">' + list.map(function (r) { return '<a href="reports.html?id=' + encodeURIComponent(r.id) + '">📄 ' + esc(r.title) + '</a>'; }).join('') + '</div>' : ''; }
  function remember(q) {
    var l = []; try { l = JSON.parse(localStorage.getItem(Q_KEY) || '[]'); } catch (e) {}
    l = [{ q: q, at: new Date().toISOString() }].concat(l.filter(function (x) { return x.q !== q; })).slice(0, 8);
    try { localStorage.setItem(Q_KEY, JSON.stringify(l)); } catch (e) {}
  }
  function answerPreset(q) {
    msg('me', esc(q.q));
    var hits = REPORTS.filter(q.match || function (r) { return q.keys.test([r.title, r.category, r.company, r.summary].join(' ')); }).slice(0, 3);
    msg('bot', hits.length
      ? '<b class="t">' + esc(q.lead) + '</b><ul>' + hits.map(function (r) { return '<li><b>' + esc(r.title) + '</b><br><span>' + esc(first(r.summary)) + '</span></li>'; }).join('') + '</ul>' + cites(hits) +
        '<p class="yq-note">' + (sample ? '예시 리포트 기준' : '리서치센터 리포트 요약 기준') + ' · 정보 제공용이며 투자 권유가 아니에요</p>'
      : '<b class="t">지금은 이 주제를 다룬 리포트가 없어요.</b><span class="h">새 리포트가 나오면 여기에 정리해 드릴게요.</span>');
    remember(q.q);
  }
  function ask(text) {
    text = String(text || '').trim(); if (!text) return;
    var q = PRESETS.filter(function (x) { return text.indexOf(x.tag) > -1 || (x.keys && x.keys.test(text)); })[0];
    if (q) { answerPreset(Object.assign({}, q, { q: text })); return; }
    msg('me', esc(text));
    var words = text.split(/\s+/).filter(function (w) { return w.length >= 2; });
    var rel = REPORTS.filter(function (r) { return words.some(function (w) { return String(r.title).indexOf(w) > -1; }); }).slice(0, 3);
    msg('bot', '<b class="t">아직 검수된 답이 없는 질문이에요.</b><span class="h">아래 검수 완료 질문을 골라 주세요.' + (rel.length ? ' 제목이 비슷한 리포트는 찾아 뒀어요.' : '') + '</span>' + cites(rel));
    remember(text);
  }

  function open() {
    box.classList.add('is-open'); fab.setAttribute('aria-expanded', 'true');
    if (!logEl.children.length) msg('bot', '<b class="t">' + esc(s.name || '고객') + '님, 무엇이 궁금하세요?</b><span class="h">리서치센터 리포트를 근거로 답해 드려요</span>');
    var b = $('.yq-opt', box); if (b) b.focus({ preventScroll: true });
  }
  function close() { box.classList.remove('is-open'); fab.setAttribute('aria-expanded', 'false'); fab.focus({ preventScroll: true }); }
  fab.addEventListener('click', open);
  $('.yq-x', box).addEventListener('click', close);
  box.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
    if (e.target.tagName !== 'INPUT' && /^[1-9]$/.test(e.key)) { var b = optsEl.querySelectorAll('.yq-opt')[+e.key - 1]; if (b) { e.preventDefault(); b.click(); } }
  });
  optsEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-q]'); if (!b) return;
    answerPreset(PRESETS.filter(function (q) { return q.id === b.dataset.q; })[0]);
  });
  $('.yq-ask', box).addEventListener('submit', function (e) { e.preventDefault(); ask(input.value); input.value = ''; });
  window.YuriQA = { open: open, close: close };
  if (/#qa$/.test(location.hash)) open();

  /* ---------- 가입 상담에서 넘어왔으면: 큰 구가 작아져 버튼 자리로 ---------- */
  var docked = null;
  try { docked = sessionStorage.getItem('il.yuri-dock'); sessionStorage.removeItem('il.yuri-dock'); } catch (e) {}
  if (docked && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var orb = document.createElement('div'); orb.className = 'yq-dock'; document.body.appendChild(orb);
    fab.style.opacity = '0';
    requestAnimationFrame(function () {
      var r = $('.yq-orb', fab).getBoundingClientRect();
      setTimeout(function () {
        orb.style.left = (r.left + r.width / 2) + 'px'; orb.style.top = (r.top + r.height / 2) + 'px';
        orb.style.width = r.width + 'px'; orb.style.opacity = '.9';
      }, 350);
      setTimeout(function () { orb.remove(); fab.style.opacity = ''; toast('유리는 오른쪽 아래에 있어요. 궁금한 게 생기면 눌러 주세요.'); }, 1350);
    });
  }
})();
