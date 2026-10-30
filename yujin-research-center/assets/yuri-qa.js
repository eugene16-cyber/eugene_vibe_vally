// 유리 근거형 Q&A — 페이지에 #yq-host가 있으면 그 자리에 넓은 채팅창("무엇이든 물어보세요!")으로,
//   없으면 오른쪽 아래 버튼 → 누르면 채팅창으로 열린다. 가입 상담 채팅창이 가로로 넓어지며 이어진다.
// · 음성 질문(Web Speech, ko-KR) → 리포트 원문에서 근거를 찾고 → Gemini(/api/yuri 'qa')가 원문 안에서만 답한다. 음성으로 물으면 소리로도 답한다.
// · 서버 AI가 없으면 원문에서 찾은 문장을 그대로 보여 준다. 모든 답에 '원문 근거' 카드(인용 문장 · 리포트 · 원문 PDF)를 붙인다.
(function () {
  'use strict';
  var s = IL.session() || {}, p = s.profile || {};
  var Q_KEY = 'il.home-questions';
  var cfg = window.IL_CONFIG || {};
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 스타일 (첫 화면 홀로그램 패널과 같은 톤 + 금빛 반응) ---------- */
  var css = document.createElement('style');
  css.textContent = [
    '.yq-fab{position:fixed;right:max(20px,env(safe-area-inset-right,0px));bottom:max(20px,env(safe-area-inset-bottom,0px));z-index:400;display:flex;align-items:center;gap:10px;height:56px;padding:0 18px 0 8px;border-radius:999px;border:1px solid rgba(170,180,192,0.315);background:rgba(3,16,26,.92);color:#e8ecf1;font-weight:700;font-size:14px;box-shadow:0 0 30px rgba(170,180,192,0.196),0 12px 30px -10px rgba(0,0,0,.6);transition:transform .2s,box-shadow .2s}',
    '.yq-fab:hover{transform:translateY(-2px);box-shadow:0 0 40px rgba(170,180,192,0.315),0 12px 30px -10px rgba(0,0,0,.6)}',
    '.yq-orb{width:40px;height:40px;border-radius:50%;flex:none;background:radial-gradient(circle at 38% 32%,#f2f4f7,#b3bcc7 42%,#4b5562 78%,#1c222b 100%);box-shadow:0 2px 6px rgba(0,0,0,.18),inset 0 -4px 10px rgba(0,0,0,.25);animation:yq-breathe 3.6s ease-in-out infinite;transition:background .5s,box-shadow .5s}',
    '@keyframes yq-breathe{50%{box-shadow:0 2px 10px rgba(0,0,0,.28),inset 0 -4px 10px rgba(0,0,0,.25)}}',
    '@keyframes yq-beat{50%{transform:scale(1.12)}}',
    // 금빛 반응 — 듣기 · 생각하기 · 말하기 (jarvis 상태 연출 참고)
    '.yq[data-mood=listening] .yq-head .yq-orb,.yq[data-mood=thinking] .yq-head .yq-orb,.yq[data-mood=speaking] .yq-head .yq-orb{background:radial-gradient(circle at 38% 32%,#fffbe6,#f5c518 45%,#a06c00 80%,#221500 100%);box-shadow:0 0 22px rgba(245,197,24,.9)}',
    '.yq[data-mood=listening] .yq-head .yq-orb{animation:yq-beat .9s ease-in-out infinite}',
    '.yq[data-mood=thinking] .yq-head .yq-orb{animation:yq-beat 1.4s ease-in-out infinite}',
    '.yq[data-mood=speaking] .yq-head .yq-orb{animation:yq-beat .45s ease-in-out infinite}',
    '.yq[data-mood=listening],.yq[data-mood=thinking],.yq[data-mood=speaking]{border-color:rgba(245,197,24,.55);box-shadow:0 0 46px rgba(245,197,24,.18),0 30px 70px -20px rgba(0,0,0,.7)}',
    '.yq-fab[aria-expanded=true]{opacity:0;pointer-events:none}',
    '.yq-dock{position:fixed;z-index:401;left:50%;top:50%;width:min(60vmin,520px);aspect-ratio:1;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;background:radial-gradient(circle at 38% 32%,#f2f4f7,#b3bcc7 30%,#4b5562 62%,rgba(0,40,60,0) 72%);box-shadow:0 0 120px rgba(170,180,192,0.42);transition:all .9s cubic-bezier(.16,1,.3,1)}',
    '.yq{position:fixed;z-index:402;right:max(20px,env(safe-area-inset-right,0px));bottom:max(20px,env(safe-area-inset-bottom,0px));width:min(440px,calc(100vw - 32px));height:min(680px,calc(100vh - 96px));display:flex;flex-direction:column;border-radius:14px;color:#e8ecf1;background:rgba(3,16,26,.96);border:1px solid rgba(170,180,192,0.224);box-shadow:0 0 40px rgba(170,180,192,0.112),0 30px 70px -20px rgba(0,0,0,.7);backdrop-filter:blur(10px);transform-origin:bottom right;transform:scale(.6);opacity:0;visibility:hidden;transition:transform .35s cubic-bezier(.16,1,.3,1),opacity .25s,visibility 0s .35s,border-color .5s,box-shadow .5s;font-family:var(--font-sans)}',
    '.yq.is-open{transform:none;opacity:1;visibility:visible;transition:transform .35s cubic-bezier(.16,1,.3,1),opacity .25s,border-color .5s,box-shadow .5s}',
    '.yq-head{display:flex;align-items:center;gap:11px;padding:14px 14px 12px 16px;border-bottom:1px solid rgba(170,180,192,0.126)}',
    '.yq-head .yq-orb{width:32px;height:32px}',
    '.yq-head b{display:block;font-size:15px}.yq-head span{display:block;font-size:11.5px;color:#9aa4b0}',
    '.yq-x{margin-left:auto;width:32px;height:32px;border-radius:8px;border:1px solid rgba(170,180,192,0.126);background:transparent;color:#9aa4b0;font-size:14px}',
    '.yq-log{flex:1;min-height:0;overflow-y:auto;padding:14px 14px 6px;display:flex;flex-direction:column;gap:10px}',
    '.yq-m{max-width:92%;padding:10px 13px;border-radius:10px;font-size:14px;line-height:1.6;animation:fadeUp .28s ease-out both}',
    '.yq-m.bot{align-self:flex-start;background:rgba(170,180,192,0.049);border:1px solid rgba(170,180,192,0.126);border-top-left-radius:3px}',
    '.yq-m.me{align-self:flex-end;background:rgba(170,180,192,0.595);color:#021018;font-weight:600;border-top-right-radius:3px}',
    '.yq-m.me .yq-voice{display:inline-block;margin-right:6px;font-size:11px;font-weight:700;opacity:.7}',
    '.yq-m .t{display:block;font-weight:700;font-size:15px}.yq-m .h{display:block;margin-top:2px;font-size:12.5px;color:#9aa4b0}',
    '.yq-ans{font-size:14.5px;line-height:1.7}.yq-ans sup{font-size:10.5px;color:#b3bcc7;font-weight:700;margin-left:1px}',
    '.yq-tag{display:inline-block;margin-bottom:6px;padding:1px 7px;border-radius:5px;font-size:10.5px;font-weight:700;color:#ffe08a;border:1px solid rgba(245,197,24,.45)}',
    '.yq-tag.rule{color:#9aa4b0;border-color:rgba(170,180,192,0.175)}',
    '.yq-src{margin-top:10px;display:grid;gap:8px}',
    '.yq-src__h{font-size:11.5px;font-weight:700;letter-spacing:.06em;color:#9aa4b0}',
    '.yq-doc{padding:10px 12px;border-radius:9px;background:rgba(2,12,20,.7);border:1px solid rgba(170,180,192,0.112)}',
    '.yq-doc__t{display:flex;gap:8px;align-items:baseline;font-size:13px;font-weight:700}.yq-doc__t i{font-style:normal;color:#b3bcc7;flex:none}',
    '.yq-doc__t small{margin-left:auto;font-weight:400;color:#4c7180;font-size:11px;flex:none}',
    '.yq-doc q{display:block;margin-top:6px;padding-left:10px;border-left:2px solid rgba(245,197,24,.6);font-size:12.5px;line-height:1.6;color:#cfe9f0;quotes:none}',
    '.yq-doc q mark{background:rgba(245,197,24,.22);color:#fff3c4;border-radius:2px;padding:0 1px}',
    '.yq-doc__a{display:flex;gap:10px;margin-top:6px;font-size:12px}.yq-doc__a a{color:#b3bcc7}.yq-doc__a a:hover{text-decoration:underline}',
    '.yq-note{font-size:11px;color:#4c7180;margin-top:8px}',
    '.yq-box{margin:8px 12px 12px;border:1px solid rgba(170,180,192,0.196);border-radius:12px;background:rgba(2,14,22,.82);overflow:hidden}',
    '.yq-box-h{display:flex;justify-content:space-between;padding:10px 14px 8px;border-bottom:1px solid rgba(170,180,192,0.126);font-size:13px;font-weight:600}.yq-box-h span{font-size:10.5px;color:#4c7180;font-weight:400}',
    '.yq-opts{max-height:24vh;overflow-y:auto}',
    '.yq-opt{display:flex;gap:12px;width:100%;padding:9px 14px;text-align:left;color:#e8ecf1;background:transparent;border:0;border-bottom:1px solid rgba(170,180,192,0.056);font-size:13.5px;line-height:1.4}',
    '.yq-opt:hover,.yq-opt:focus-visible{background:rgba(170,180,192,0.056);outline:none}',
    '.yq-opt i{flex:none;width:24px;height:24px;border-radius:7px;display:grid;place-items:center;font-style:normal;font-size:12px;color:#9aa4b0;background:rgba(170,180,192,0.042);border:1px solid rgba(170,180,192,0.126)}',
    '.yq-opt small{display:block;font-size:11.5px;color:#9aa4b0;margin-top:1px}',
    '.yq-ask{display:flex;align-items:center;gap:8px;padding:6px 8px 6px 14px}',
    '.yq-ask>span{color:#9aa4b0}.yq-ask input{flex:1;min-width:0;height:34px;border:0;background:transparent;color:#e8ecf1;font:inherit;font-size:14px}.yq-ask input:focus{outline:none}.yq-ask input::placeholder{color:#4c7180}',
    '.yq-ask button{flex:none;width:34px;height:32px;border-radius:8px;border:1px solid rgba(170,180,192,0.126);background:transparent;color:#9aa4b0;display:grid;place-items:center}',
    '.yq-ask button svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}',
    '.yq-mic[aria-pressed=true]{color:#221500;background:#f5c518;border-color:#f5c518;animation:yq-beat .9s ease-in-out infinite}',
    // 인라인 — Home 맨 위, 구글 검색창처럼 흰 둥근 검색바 하나 + 질문 칩. 답은 물었을 때만 아래에 펼쳐진다
    '.yq.yq--inline{position:relative;right:auto;bottom:auto;z-index:1;width:100%;max-width:760px;height:auto;margin:0 auto;transform:none;opacity:1;visibility:visible;display:block;background:transparent;border:0;box-shadow:none;backdrop-filter:none;text-align:left}',
    '.yq--inline .yq-head,.yq--inline .yq-box-h{display:none}',
    '.yq--inline .yq-box{margin:0;border:0;background:transparent;overflow:visible}',
    '.yq--inline .yq-ask{height:60px;padding:0 8px 0 10px;gap:6px;border-radius:999px;background:#fff;border:1px solid #dfe1e5;box-shadow:0 10px 30px -12px rgba(0,0,0,.5);transition:box-shadow .25s,border-color .25s}',
    '.yq--inline .yq-ask:focus-within{box-shadow:0 1px 6px rgba(32,33,36,.28),0 10px 30px -12px rgba(0,0,0,.5)}',
    '.yq--inline .yq-ask>span{display:none}',
    '.yq--inline .yq-ask .yq-orb{width:30px;height:30px;margin-left:6px}',
    '.yq--inline .yq-ask input{height:56px;color:#202124;font-size:17px}.yq--inline .yq-ask input::placeholder{color:#9aa0a6}',
    '.yq--inline .yq-ask button{width:44px;height:44px;border-radius:50%;border:0;color:#5f6368;background:transparent}',
    '.yq--inline .yq-ask button:hover{background:#f1f3f4}',
    '.yq--inline .yq-mic[aria-pressed=true]{color:#221500;background:#f5c518}',
    '.yq--inline[data-mood=listening] .yq-ask,.yq--inline[data-mood=thinking] .yq-ask,.yq--inline[data-mood=speaking] .yq-ask{border-color:#f5c518;box-shadow:0 0 0 3px rgba(245,197,24,.45),0 10px 30px -12px rgba(0,0,0,.5)}',
    '.yq--inline[data-mood=listening] .yq-ask .yq-orb,.yq--inline[data-mood=thinking] .yq-ask .yq-orb,.yq--inline[data-mood=speaking] .yq-ask .yq-orb{background:radial-gradient(circle at 38% 32%,#fffbe6,#f5c518 45%,#a06c00 80%,#221500 100%);box-shadow:0 0 16px rgba(245,197,24,.9);animation:yq-beat .8s ease-in-out infinite}',
    '.yq--inline .yq-opts{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;max-height:none;overflow:visible;margin-top:16px}',
    '.yq--inline .yq-opt{width:auto;padding:7px 14px;border:1px solid rgba(255,255,255,.18);border-radius:999px;background:rgba(255,255,255,.07);font-size:13px;color:#e8ecf1}',
    '.yq--inline .yq-opt:hover,.yq--inline .yq-opt:focus-visible{background:rgba(255,255,255,.16)}',
    '.yq--inline .yq-opt i,.yq--inline .yq-opt small{display:none}',
    '.yq--inline .yq-log{margin-top:18px;max-height:min(460px,56vh);padding:14px;border-radius:14px;background:rgba(3,16,26,.9);border:1px solid rgba(170,180,192,0.175)}',
    '.yq--inline .yq-log[hidden]{display:none}',
    '.yq--inline.is-grow{animation:yq-grow .9s cubic-bezier(.16,1,.3,1) both}',
    '@keyframes yq-grow{0%{max-width:440px;opacity:.6}100%{max-width:760px;opacity:1}}',
    '@media (max-width:560px){.yq{right:8px;bottom:8px;width:calc(100vw - 16px);height:calc(100svh - 80px)}.yq-fab>span{display:none}.yq-fab{padding:0 8px}}',
    '@media (prefers-reduced-motion:reduce){.yq,.yq-dock,.yq-orb,.yq-mic{transition:none;animation:none!important}}'
  ].join('\n');
  document.head.appendChild(css);

  /* ---------- 검수 완료 질문 — 관심 분야 순서로 ---------- */
  var PRESETS = [
    // stocks: 검수 질문의 관련 종목 태그(자동 추출 대신 고정) — 정보 제공용, 추천 아님
    { id: 'semi', tag: '반도체', q: '최근 반도체 리포트 요약해 줘', keys: /반도체|메모리|HBM|파운드리|D램/i, stocks: ['삼성전자', 'SK하이닉스', '한미반도체'] },
    { id: 'market', tag: '시황', q: '최근 시황 리포트 핵심만 알려 줘', keys: /시황|전략|매크로|증시|코스피/i, macro: true, stocks: [] },
    { id: 'ai', tag: 'AI 인프라', q: 'AI 인프라 관련 최근 자료 찾아 줘', keys: /AI|인공지능|데이터센터|전력기기|GPU/i, stocks: ['SK하이닉스', 'LS ELECTRIC', 'HD현대일렉트릭'], skip: /의료|바이오|제약|헬스/ },
    { id: 'bio', tag: '바이오', q: '바이오 업종 리포트 정리해 줘', keys: /바이오|제약|헬스|의료/ },
    { id: 'battery', tag: '2차전지', q: '2차전지 리포트는 어떤 내용이야?', keys: /2차전지|이차전지|배터리|양극재/ },
    { id: 'rate', tag: '금리', q: '금리 전망 다룬 리포트 있어?', keys: /금리|채권|연준|FOMC|국채/i },
    { id: 'div', tag: '배당', q: '배당 · 인컴 관련 리포트 있어?', keys: /배당|주주환원|밸류업|인컴/ }
  ];
  var want = (p.sectors || []).join(' ');
  PRESETS.sort(function (a, b) {
    var ha = a.keys.test(want) ? 0 : a.id === 'market' ? 1 : 2, hb = b.keys.test(want) ? 0 : b.id === 'market' ? 1 : 2;
    return ha - hb;
  });
  var REPORTS = [
    { id: 'S1', kind: 'sector', category: '반도체', title: '메모리 업황 점검(예시)', summary: '재고 조정이 마무리 단계에 들어서며 가격 흐름이 안정되는 모습이에요. 설비투자 속도를 함께 봐야 해요.', published_at: '2026-10-27' },
    { id: 'S2', kind: 'macro', category: '투자전략', title: '11월 주식시장 전망(예시)', summary: '이익 추정치 변화와 환율 흐름을 변수로 꼽았어요.', published_at: '2026-10-28' }
  ], sample = true;
  if (window.sb) sb.from('reports').select('id,kind,category,title,summary,company,analyst,published_at,url').order('published_at', { ascending: false }).limit(300)
    .then(function (r) { if (r.data && r.data.length) { REPORTS = r.data; sample = false; } }, function () {});

  /* ---------- 원문 검색 — 질문 낱말이 제목 · 업종 · 종목 · 본문에 얼마나 걸리는지 ---------- */
  var STOP = /^(최근|요즘|관련|리포트|자료|알려|줘|주세요|요약|정리|해줘|해|있어|있나요|어떤|내용|무엇|뭐야|어때|대해|좀|핵심|만|은|는|이|가)$/;
  function tokens(q) {
    var t = String(q).replace(/[?？!.,·]/g, ' ').split(/\s+/).map(function (w) { return w.replace(/(은|는|이|가|을|를|에|의|도|로|과|와|쪽|관련)$/, ''); })
      .filter(function (w) { return w.length >= 2 && !STOP.test(w); });
    PRESETS.forEach(function (x) { if (x.keys.test(q) && t.indexOf(x.tag) < 0) t.push(x.tag); });
    return t;
  }
  function search(q) {
    var tk = tokens(q), pre = PRESETS.filter(function (x) { return x.keys.test(q); })[0];
    // 고객이 직접 말한 낱말을 더 무겁게 — 자동으로 붙인 주제어(반도체 등)는 가볍게
    var own = tk.filter(function (w) { return q.indexOf(w) > -1; });
    return REPORTS.map(function (r) {
      var sc = 0, title = r.title || '', meta = [r.category, r.company].join(' '), body = r.summary || '';
      tk.forEach(function (w) {
        var k = own.indexOf(w) > -1 ? 1 : 0.35;
        if (title.indexOf(w) > -1) sc += 4 * k; if (meta.indexOf(w) > -1) sc += 2 * k; if (body.indexOf(w) > -1) sc += 2 * k;
      });
      if (pre && pre.keys.test(title + ' ' + meta + ' ' + body)) sc += 1;
      if (pre && pre.macro && (r.kind === 'macro' || /투자전략|시황|매크로/.test(r.category || ''))) sc += 3;
      if (pre && pre.skip && pre.skip.test(r.category || '')) sc = 0;   // 다른 업종 자료가 낱말만 겹쳐 끼지 않게
      return { r: r, sc: sc };
    }).filter(function (x) { return x.sc > 0; })
      .sort(function (a, b) { return b.sc - a.sc || String(b.r.published_at).localeCompare(String(a.r.published_at)); })
      .slice(0, 3).map(function (x) { return x.r; });
  }
  // 원문에서 질문과 가장 많이 겹치는 문장을 인용으로
  function quote(r, tk) {
    var sents = String(r.summary || '').replace(/\s+/g, ' ').split(/(?<=[.다요])\s+/).filter(function (x) { return x.length > 8; });
    if (!sents.length) return '';
    var best = sents.map(function (x) { return { x: x, n: tk.filter(function (w) { return x.indexOf(w) > -1; }).length }; })
      .sort(function (a, b) { return b.n - a.n; })[0].x;
    best = best.length > 180 ? best.slice(0, 180) + '…' : best;
    var h = esc(best);
    tk.forEach(function (w) { if (w.length >= 2) h = h.split(esc(w)).join('<mark>' + esc(w) + '</mark>'); });
    return h;
  }

  /* ---------- Gemini (서버 함수) — 원문 안에서만 답 ---------- */
  var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var aiOn = local ? Promise.resolve(false) : fetch((cfg.apiBase || '') + '/api/yuri').then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) { return !!(j && j.ai); }).catch(function () { return false; });
  function aiAnswer(q, docs) {
    return aiOn.then(function (on) {
      if (!on || !docs.length) return null;
      // AI가 12초 안에 답하지 않으면 원문 검색 결과로 먼저 보여 준다(시연 중 오래 기다리지 않게)
      var late = new Promise(function (res) { setTimeout(function () { res(null); }, 12000); });
      return Promise.race([late, fetch((cfg.apiBase || '') + '/api/yuri', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: 'qa', question: q, docs: docs.map(function (r) { return { title: r.title, date: r.published_at, text: r.summary }; }) }) })
        .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })]);
    });
  }

  /* ---------- 화면 ---------- */
  var MIC = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
  var SEND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var fab = document.createElement('button');
  fab.type = 'button'; fab.className = 'yq-fab'; fab.setAttribute('aria-expanded', 'false'); fab.setAttribute('aria-controls', 'yq');
  fab.innerHTML = '<i class="yq-orb" aria-hidden="true"></i><span>유리에게 질문</span>';
  var box = document.createElement('section');
  box.className = 'yq'; box.id = 'yq'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', '유리 근거형 Q&A');
  box.innerHTML = '<div class="yq-head"><i class="yq-orb" aria-hidden="true"></i><div><b>유리</b><span id="yq-status">근거형 Q&A · 말로 물어보셔도 돼요</span></div><button type="button" class="yq-x" aria-label="닫기">✕</button></div>' +
    '<div class="yq-log" role="log" aria-live="polite"></div>' +
    '<div class="yq-box"><div class="yq-box-h">검수 완료 질문<span>하나 선택 · 직접 입력 · 음성</span></div><div class="yq-opts"></div>' +
    '<form class="yq-ask"><span aria-hidden="true">✎</span><label class="sr-only" for="yq-in">질문 입력</label><input id="yq-in" autocomplete="off" placeholder="질문을 입력하거나 마이크를 눌러 말해 주세요">' +
    '<button type="button" class="yq-mic" aria-pressed="false" aria-label="음성으로 질문하기">' + MIC + '</button><button type="submit" aria-label="보내기">' + SEND + '</button></form></div>';
  var host = document.getElementById('yq-host'), inline = !!host;
  if (inline) { box.classList.add('yq--inline', 'is-open'); box.removeAttribute('role'); host.appendChild(box); }
  else { document.body.appendChild(fab); document.body.appendChild(box); }
  var logEl = $('.yq-log', box), optsEl = $('.yq-opts', box), input = $('#yq-in', box), micBtn = $('.yq-mic', box), statusEl = $('#yq-status', box);
  // 넓은 모양에서는 입력줄을 창 맨 아래 전체 폭으로
  if (inline) {
    var askF = $('.yq-ask', box);
    askF.insertBefore(Object.assign(document.createElement('i'), { className: 'yq-orb' }), askF.firstChild);
    input.placeholder = '리서치센터 리포트에 무엇이든 물어보세요';
    $('.yq-box', box).insertBefore(askF, optsEl);   // 검색바 → 칩 순서
    box.insertBefore($('.yq-box', box), logEl);     // 검색 영역 → 답
    logEl.hidden = true;
    // 결과는 검색바 아래 넓은 두 칸(답변 카드 + 원문 패널)으로 — assets/yuri-answer.js
    var resultHost = document.createElement('div');
    resultHost.className = 'yqa'; resultHost.hidden = true; resultHost.setAttribute('aria-live', 'polite');
    host.appendChild(resultHost);
  }
  // 예시 질문은 관심 분야 순서로 3개만 보여 준다
  optsEl.innerHTML = PRESETS.slice(0, 3).map(function (q, i) {
    return '<button type="button" class="yq-opt" data-q="' + q.id + '"><i>' + (i + 1) + '</i><span>' + esc(q.q) + '<small>#' + esc(q.tag) + ' · 검수 완료</small></span></button>';
  }).join('');

  var STATUS = { idle: '근거형 Q&A · 말로 물어보셔도 돼요', listening: '듣고 있어요…', thinking: '원문에서 근거를 찾고 있어요…', speaking: '답하고 있어요' };
  function setMood(m) { box.dataset.mood = m; statusEl.textContent = STATUS[m] || STATUS.idle; }
  function msg(cls, html) { logEl.hidden = false; var el = document.createElement('div'); el.className = 'yq-m ' + cls; el.innerHTML = html; logEl.appendChild(el); logEl.scrollTop = logEl.scrollHeight; return el; }
  function remember(q) {
    var l = []; try { l = JSON.parse(localStorage.getItem(Q_KEY) || '[]'); } catch (e) {}
    l = [{ q: q, at: new Date().toISOString() }].concat(l.filter(function (x) { return x.q !== q; })).slice(0, 20);
    try { localStorage.setItem(Q_KEY, JSON.stringify(l)); } catch (e) {}
  }
  // 원문 근거 카드 — 인용 문장 · 리포트 상세 · 원문 PDF
  function sources(docs, tk) {
    return '<div class="yq-src"><span class="yq-src__h">원문 근거</span>' + docs.map(function (r, i) {
      var qt = quote(r, tk);
      return '<div class="yq-doc"><div class="yq-doc__t"><i>[' + (i + 1) + ']</i><span>' + esc(r.title) + '</span><small>' + esc(String(r.published_at || '').replace(/-/g, '.')) + '</small></div>' +
        (qt ? '<q>' + qt + '</q>' : '') +
        '<div class="yq-doc__a"><a href="reports.html?id=' + encodeURIComponent(r.id) + '">리포트 상세</a>' + (r.url ? '<a href="' + esc(r.url) + '" target="_blank" rel="noopener">원문 PDF ↗</a>' : '') + '</div></div>';
    }).join('') + '</div>';
  }

  // 음성으로 물었으면 소리로도 답한다
  function speak(text) {
    if (!('speechSynthesis' in window)) { setMood('idle'); return; }
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(String(text).replace(/\[\d+\]/g, '').slice(0, 260));
      u.lang = 'ko-KR'; u.rate = 1.05;
      var ko = speechSynthesis.getVoices().filter(function (v) { return /ko/i.test(v.lang); })[0]; if (ko) u.voice = ko;
      u.onend = u.onerror = function () { setMood('idle'); };
      setMood('speaking');
      speechSynthesis.speak(u);
    } catch (e) { setMood('idle'); }
  }

  var busy = false;
  function ask(text, byVoice, preset) {
    text = String(text || '').trim(); if (!text || busy) return;
    busy = true;
    preset = preset || PRESETS.filter(function (x) { return x.q === text; })[0];
    if (inline && window.YuriAnswer) {
      remember(text);
      setMood('thinking');
      var tk0 = tokens(text), docs0 = search(text);
      YuriAnswer.loading(resultHost, text, byVoice);
      aiAnswer(text, docs0).then(function (j) {
        var said = YuriAnswer.show(resultHost, { q: text, voice: byVoice, preset: preset, docs: docs0, tokens: tk0, ai: j, sample: sample });
        busy = false;
        if (byVoice) speak(said); else setMood('idle');
      });
      return;
    }
    msg('me', (byVoice ? '<span class="yq-voice">🎙 음성</span>' : '') + esc(text));
    remember(text);
    setMood('thinking');
    var tk = tokens(text), docs = search(text);
    var typing = msg('bot', '<span class="h">원문에서 근거를 찾고 있어요…</span>');
    aiAnswer(text, docs).then(function (j) {
      typing.remove();
      var answerText;
      if (!docs.length) {
        answerText = '지금 발간된 리포트에서는 이 질문의 근거를 찾지 못했어요.';
        msg('bot', '<b class="t">' + esc(answerText) + '</b><span class="h">아래 검수 완료 질문을 골라 보시거나, 섹터 · 종목 이름을 넣어 다시 물어봐 주세요.</span>');
      } else if (j && j.answer) {
        answerText = j.answer;
        var html = esc(j.answer).replace(/\[(\d)\]/g, '<sup>[$1]</sup>');
        msg('bot', '<span class="yq-tag">AI 답변 · 원문 근거 기반</span><div class="yq-ans">' + html + '</div>' + sources(docs, tk) +
          '<p class="yq-note">리서치센터 리포트 원문 안에서만 답했어요 · 정보 제공용이며 투자 권유가 아니에요</p>');
      } else {
        answerText = '관련 리포트 원문에서 찾은 내용이에요.';
        msg('bot', '<span class="yq-tag rule">원문 검색</span><b class="t">관련 리포트 원문에서 찾은 내용이에요.</b>' + sources(docs, tk) +
          '<p class="yq-note">' + (sample ? '예시 리포트 기준 · ' : '') + '정보 제공용이며 투자 권유가 아니에요</p>');
      }
      busy = false;
      if (byVoice) speak(answerText); else setMood('idle');
    });
  }

  /* ---------- 음성 인식 (Web Speech · 한국어) ---------- */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition, rec = null;
  function stopMic() { if (rec) { try { rec.stop(); } catch (e) {} } }
  micBtn.addEventListener('click', function () {
    if (rec) { stopMic(); return; }
    if (!SR) { toast('이 브라우저는 음성 인식을 지원하지 않아요. Chrome이나 Edge에서 써 주세요.'); return; }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    rec = new SR(); rec.lang = 'ko-KR'; rec.interimResults = true; rec.maxAlternatives = 1;
    var finalText = '';
    rec.onresult = function (e) {
      var txt = '';
      for (var i = 0; i < e.results.length; i++) { txt += e.results[i][0].transcript; if (e.results[i].isFinal) finalText = txt; }
      input.value = txt;
    };
    rec.onerror = function (e) {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('마이크 권한이 필요해요. 주소창 옆 권한 설정에서 허용해 주세요.');
      else if (e.error === 'no-speech') toast('말소리가 들리지 않았어요. 다시 눌러 말해 주세요.');
    };
    rec.onend = function () {
      rec = null; micBtn.setAttribute('aria-pressed', 'false');
      var q = (finalText || input.value).trim();
      if (q) { input.value = ''; ask(q, true); } else setMood('idle');
    };
    try { rec.start(); micBtn.setAttribute('aria-pressed', 'true'); setMood('listening'); input.value = ''; input.placeholder = '듣고 있어요… 말을 마치면 바로 답해 드려요'; }
    catch (e) { rec = null; }
  });

  /* ---------- 열기 · 닫기 ---------- */
  function open() {
    box.classList.add('is-open'); fab.setAttribute('aria-expanded', 'true');
    if (!inline && !logEl.children.length) msg('bot', '<b class="t">' + esc(s.name || '고객') + '님, 무엇이 궁금하세요?</b><span class="h">마이크를 누르고 말해 주셔도 돼요. 리포트 원문을 근거로 답해 드려요.</span>');
    if (!inline) { var b = $('.yq-opt', box); if (b) b.focus({ preventScroll: true }); }
  }
  // 라운지 '유리에게 질문' 카드 등에서 부르면: 넓은 모양은 그 자리로 스크롤하고 입력창에 커서
  function focusInline() { box.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); input.focus({ preventScroll: true }); }
  function close() {
    stopMic(); if ('speechSynthesis' in window) speechSynthesis.cancel(); setMood('idle');
    if (inline) return;
    box.classList.remove('is-open'); fab.setAttribute('aria-expanded', 'false'); fab.focus({ preventScroll: true });
  }
  fab.addEventListener('click', open);
  $('.yq-x', box).addEventListener('click', close);
  box.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
    if (e.target.tagName !== 'INPUT' && /^[1-9]$/.test(e.key)) { var b = optsEl.querySelectorAll('.yq-opt')[+e.key - 1]; if (b) { e.preventDefault(); b.click(); } }
  });
  optsEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-q]'); if (!b) return;
    var pr = PRESETS.filter(function (q) { return q.id === b.dataset.q; })[0];
    ask(pr.q, false, pr);   // 검수 완료 질문
  });
  $('.yq-ask', box).addEventListener('submit', function (e) { e.preventDefault(); ask(input.value); input.value = ''; input.placeholder = inline ? '리서치센터 리포트에 무엇이든 물어보세요' : '질문을 입력하거나 마이크를 눌러 말해 주세요'; });
  window.YuriQA = { open: inline ? focusInline : open, close: close, ask: ask };
  if (inline) open(); else if (/#qa$/.test(location.hash)) open();
  // Research '내가 한 질문'에서 home.html?q=… 로 오면 그 질문을 바로 다시 보여 준다
  var q0 = inline && new URLSearchParams(location.search).get('q');
  if (q0) setTimeout(function () { ask(q0); host.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 300);

  /* ---------- 가입 상담에서 넘어왔으면: 큰 구가 작아져 버튼 자리로 ---------- */
  var docked = null;
  try { docked = sessionStorage.getItem('il.yuri-dock'); sessionStorage.removeItem('il.yuri-dock'); } catch (e) {}
  if (docked && inline && !reduce) { box.classList.add('is-grow'); }
  else if (docked && !reduce) {
    var orb = document.createElement('div'); orb.className = 'yq-dock'; document.body.appendChild(orb);
    fab.style.opacity = '0';
    requestAnimationFrame(function () {
      var r = $('.yq-orb', fab).getBoundingClientRect();
      setTimeout(function () {
        orb.style.left = (r.left + r.width / 2) + 'px'; orb.style.top = (r.top + r.height / 2) + 'px';
        orb.style.width = r.width + 'px'; orb.style.opacity = '.9';
      }, 350);
      setTimeout(function () { orb.remove(); fab.style.opacity = ''; toast('유리는 오른쪽 아래에 있어요. 말로 물어보셔도 돼요.'); }, 1350);
    });
  }
})();
