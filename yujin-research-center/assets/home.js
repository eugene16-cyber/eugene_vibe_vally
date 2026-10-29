// Home 상단 — AI 리서치 어시스턴트(검수 질문 · 근거 리포트) · 유진 Event(Orbit Books) · AI 앵커 (7-3)
// 서버(lounge_api)가 없으니 검수 완료 질문에만 답하고, 답은 Supabase reports의 실제 요약으로 만든다.
(function () {
  'use strict';
  var s = IL.session() || {};
  var Q_KEY = 'il.home-questions';
  var hero = $('#assistant');

  /* ---------- 검수 완료 질문 ---------- */
  var PRESETS = [
    { id: 'semi', tag: '반도체', q: '이번 주 반도체 관련 리포트를 요약해 줘', keys: /반도체|메모리|HBM|파운드리|D램|DRAM/i, lead: '최근 반도체 관련 리포트에서 짚은 내용이에요.' },
    { id: 'market', tag: '시황', q: '최근 시황 리포트의 핵심만 알려 줘', match: function (r) { return r.kind === 'macro' || /투자전략|시황|매크로|전략/.test(r.category || ''); }, lead: '최근 발간된 시황 · 전략 리포트의 핵심이에요.' },
    { id: 'ai', tag: 'AI 인프라', q: 'AI 인프라 관련 최근 자료를 찾아 줘', keys: /AI|인공지능|데이터센터|전력기기|GPU|인프라/i, lead: 'AI 인프라와 연결된 최근 자료예요.' },
    { id: 'battery', tag: '2차전지', q: '2차전지 업종 리포트는 어떤 내용이 있어?', keys: /2차전지|이차전지|배터리|양극재|리튬/i, lead: '2차전지 관련 최근 리포트를 모았어요.' },
    { id: 'rate', tag: '금리', q: '금리 전망을 다룬 리포트가 있어?', keys: /금리|채권|연준|FOMC|국채|통화정책/i, lead: '금리와 통화정책을 다룬 최근 리포트예요.' },
    { id: 'div', tag: '배당', q: '배당주 관련 리포트가 있어?', keys: /배당|주주환원|밸류업|자사주/i, lead: '배당 · 주주환원을 다룬 최근 리포트예요.' }
  ];
  // 관심 분야 순서대로 먼저 보여 준다 (2장 고객 유형)
  var INTEREST = { am: ['semi', 'ai', 'battery'], etc: ['semi', 'ai', 'battery'], ia: ['semi', 'rate', 'div'], dma: ['semi', 'market', 'rate'], hnw: ['semi', 'div', 'rate'] };
  var first = INTEREST[s.persona] || [];
  PRESETS.sort(function (a, b) {
    var ia = first.indexOf(a.id), ib = first.indexOf(b.id);
    return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib);
  });

  var SAMPLE_REPORTS = [
    { id: 'S1', kind: 'sector', category: '반도체', title: '메모리 업황 점검(예시)', summary: '재고 조정이 마무리 단계에 들어서며 가격 흐름이 안정되는 모습이에요. 투자 사이클의 속도를 함께 봐야 해요.', published_at: '2026-10-27' },
    { id: 'S2', kind: 'macro', category: '투자전략', title: '11월 주식시장 전망(예시)', summary: '이익 추정치 변화와 환율 흐름이 지수 방향을 가를 변수로 꼽혔어요.', published_at: '2026-10-28' }
  ];
  var REPORTS = SAMPLE_REPORTS, reportsSample = true;

  function firstSentence(t) {
    t = String(t || '').replace(/\s+/g, ' ').trim();
    var m = t.match(/^.{20,140}?[.다요]\s/);
    return m ? m[0].trim() : t.slice(0, 120) + (t.length > 120 ? '…' : '');
  }
  function matchReports(p) {
    var test = p.match || function (r) { return p.keys.test([r.title, r.category, r.company, r.summary].join(' ')); };
    return REPORTS.filter(test).slice(0, 3);
  }

  var presetList = $('#hh-presets');
  presetList.innerHTML = PRESETS.map(function (p) {
    return '<li><button type="button" data-preset="' + p.id + '">' + esc(p.q) + '<small>#' + esc(p.tag) + ' · 검수 완료</small></button></li>';
  }).join('');

  function remember(q) {
    var list = [];
    try { list = JSON.parse(localStorage.getItem(Q_KEY) || '[]'); } catch (e) {}
    list = [{ q: q, at: new Date().toISOString() }].concat(list.filter(function (x) { return x.q !== q; })).slice(0, 8);
    try { localStorage.setItem(Q_KEY, JSON.stringify(list)); } catch (e) {}
    if (window.HomeFeed) HomeFeed.renderQuestions();
  }

  var answerEl = $('#hh-answer');
  function showAnswer(q, bodyHtml, cites, note) {
    answerEl.innerHTML =
      '<p class="hh__answer-q">Q. ' + esc(q) + '</p>' +
      '<div class="hh__answer-a">' + bodyHtml + '</div>' +
      (cites.length ? '<div class="hh__cites" aria-label="근거 리포트">' + cites.map(function (r) {
        return '<a class="hh__cite" href="reports.html?id=' + encodeURIComponent(r.id) + '">📄 ' + esc(r.title) + '</a>';
      }).join('') + '</div>' : '') +
      '<div class="hh__answer-foot"><span>' + esc(note) + '</span><button class="hh__answer-close" type="button">닫기 ×</button></div>';
    answerEl.hidden = false;
    hero.classList.add('has-answer');
    $('.hh__answer-close', answerEl).addEventListener('click', closeAnswer);
  }
  function closeAnswer() { answerEl.hidden = true; hero.classList.remove('has-answer'); }

  function answerPreset(p) {
    $$('button', presetList).forEach(function (b) { b.setAttribute('aria-current', b.dataset.preset === p.id); });
    var hits = matchReports(p);
    var body = hits.length
      ? '<p>' + esc(p.lead) + '</p><ul>' + hits.map(function (r) {
          return '<li><b>' + esc(r.title) + '</b> <span>(' + esc(String(r.published_at || '').replace(/-/g, '.')) + ')</span><br><span>' + esc(firstSentence(r.summary)) + '</span></li>';
        }).join('') + '</ul>'
      : '<p>지금 발간된 리포트 중에는 이 주제를 다룬 자료가 없어요. 새 리포트가 나오면 여기에 정리해 드릴게요.</p>';
    showAnswer(p.q, body, hits, reportsSample ? '예시 리포트 기준 · 유진 리서치센터 검수 질문' : '유진 리서치센터 리포트 요약 기준 · 검수 완료 질문');
    remember(p.q);
  }

  function ask(text) {
    text = String(text || '').trim();
    if (!text) return;
    var p = PRESETS.filter(function (x) { return x.q === text || text.indexOf(x.tag) > -1 || (x.keys && x.keys.test(text)); })[0];
    if (p) { answerPreset(p); return; }
    var words = text.split(/\s+/).filter(function (w) { return w.length >= 2; });
    var related = REPORTS.filter(function (r) { return words.some(function (w) { return String(r.title).indexOf(w) > -1; }); }).slice(0, 3);
    showAnswer(text,
      '<p>이 질문은 아직 검수된 답변이 없어요. 서버가 연결되면 리포트 원문을 근거로 답해 드릴게요. 지금은 왼쪽의 <b>검수 완료 질문</b>을 골라 주세요.</p>' +
      (related.length ? '<p style="margin-top:8px">제목이 비슷한 리포트를 찾았어요.</p>' : ''),
      related, '검수 전 질문 · 답변 대신 관련 자료만 보여드려요');
    remember(text);
  }

  /* ---------- 채팅 열기 · 입력 ---------- */
  var chat = $('#hh-chat'), openBtn = $('#hh-open'), input = $('#hh-input');
  function openChat(focus) {
    chat.hidden = false;
    hero.classList.add('is-chat');
    openBtn.setAttribute('aria-expanded', 'true');
    openBtn.hidden = true;
    if (focus !== false) input.focus();
  }
  openBtn.addEventListener('click', function () { openChat(); });
  chat.addEventListener('submit', function (e) { e.preventDefault(); ask(input.value); input.value = ''; });
  presetList.addEventListener('click', function (e) {
    var b = e.target.closest('[data-preset]');
    if (b) answerPreset(PRESETS.filter(function (p) { return p.id === b.dataset.preset; })[0]);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !answerEl.hidden) closeAnswer(); });

  /* ---------- 음성: 마이크(한 번 듣기) · '유리야' 호출 ---------- */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var mic = $('#hh-mic'), wake = $('#hh-wake'), wakeRec = null;
  function listenOnce() {
    if (!SR) { toast('이 브라우저는 음성 입력을 지원하지 않아요. Chrome이나 Edge에서 써 주세요.'); return; }
    var r = new SR(); r.lang = 'ko-KR'; r.interimResults = false;
    mic.setAttribute('aria-pressed', 'true'); hero.classList.add('is-listening');
    r.onresult = function (e) { var t = e.results[0][0].transcript; input.value = t; ask(t); };
    r.onerror = function (e) { if (e.error === 'not-allowed') toast('마이크 권한이 필요해요.'); };
    r.onend = function () { mic.setAttribute('aria-pressed', 'false'); hero.classList.remove('is-listening'); };
    try { r.start(); } catch (e) { r.onend(); }
  }
  mic.addEventListener('click', listenOnce);
  wake.addEventListener('click', function () {
    if (wakeRec) { wakeRec.onend = null; wakeRec.stop(); wakeRec = null; setWake(false); return; }
    if (!SR) { toast('이 브라우저는 음성 호출을 지원하지 않아요. Chrome이나 Edge에서 써 주세요.'); return; }
    wakeRec = new SR(); wakeRec.lang = 'ko-KR'; wakeRec.continuous = true; wakeRec.interimResults = true;
    wakeRec.onresult = function (e) {
      var t = e.results[e.results.length - 1][0].transcript;
      if (/유리/.test(t)) { wakeRec.onend = null; wakeRec.stop(); wakeRec = null; setWake(false); openChat(false); toast('네, 말씀하세요.'); setTimeout(listenOnce, 400); }
    };
    wakeRec.onerror = function (e) { if (e.error === 'not-allowed') { toast('마이크 권한이 필요해요.'); wakeRec = null; setWake(false); } };
    wakeRec.onend = function () { if (wakeRec) try { wakeRec.start(); } catch (e) {} };
    try { wakeRec.start(); setWake(true); toast("'유리야'라고 부르면 질문을 들을게요."); } catch (e) { wakeRec = null; }
  });
  function setWake(on) { wake.setAttribute('aria-pressed', on); wake.lastChild.textContent = on ? '유리 호출 끄기' : '유리 호출 켜기'; }

  /* ---------- 유진 Event — Orbit Books ---------- */
  var D = window.IL_EVENTS;
  if (window.OrbitBooks && D) {
    var upcoming = function (cat) {
      return D.EVENTS.filter(function (e) { return e.cat === cat && !D.isPast(e); })
        .sort(function (a, b) { return String(a.start).localeCompare(String(b.start)); });
    };
    OrbitBooks.mount($('#hm-orbit'), {
      books: D.CATS, center: 'Event.',
      info: function (c) {
        var up = upcoming(c.id), next = up[0];
        return {
          next: next ? 'NEXT · ' + (next.tba ? '일정 미확정' : D.md(next.start) + ' (' + D.dow(next.start) + ')') : 'NEXT · 추후 안내',
          title: next ? next.title : c.ko + ' 일정 준비 중', up: up.length,
          open: up.filter(function (e) { return D.status(e).can; }).length,
          meta: next ? '예정 ' + up.length + '건' : '예정 일정 없음'
        };
      },
      panel: function (c) {
        var up = upcoming(c.id).slice(0, 3);
        return '<p class="obp__k">' + esc(c.ed) + '</p><h3 class="obp__t">' + esc(c.label) + '<span>' + esc(c.ko) + '</span></h3>' +
          '<p class="obp__d">' + esc(c.desc || '') + '</p>' +
          '<p class="obp__h">' + (up.length ? '다가오는 일정' : '예정된 행사가 없어요') + '</p>' +
          (up.length ? '<ul class="obp__list">' + up.map(function (e) {
            return '<li><a href="conferences.html?event=' + encodeURIComponent(e.id) + '"><time>' + esc(D.dateLabel ? D.dateLabel(e) : e.start) + '</time><span><b>' + esc(e.title) + '</b>' +
              '<em>' + esc(D.status(e).label) + (D.isSample(e) ? ' · 예시' : '') + '</em></span></a></li>';
          }).join('') + '</ul>' : '<p class="obp__none">담당자에게 일정을 문의해 주세요.</p>') +
          '<div class="obp__acts"><a class="btn btn--primary btn--sm" href="conferences.html?cat=' + encodeURIComponent(c.id) + '">' + esc(c.ko) + ' 일정 보기 →</a></div>';
      }
    });
  }

  /* ---------- AI 앵커 — 최신 시황 브리핑 ---------- */
  var SNAP = { snapshot_date: '2026-06-23', kospi: '8,203.99', kospi_chg: '-9.99%', kosdaq: '891.50', kosdaq_chg: '-7.94%', usdkrw: '1,539.10', usdkrw_chg: '+0.50%',
    strong_sectors: [{ name: '통신서비스', chg: '+1.20%' }], weak_sectors: [{ name: '반도체', chg: '-14.20%' }],
    flows: { kospi: { foreign: '-21,480억', inst: '-6,210억', retail: '+27,350억' } } };
  function signed(v) { v = String(v == null ? '' : v).trim(); return /^[+-]/.test(v) || !v || v === '0' ? v : '+' + v; }
  function drawAnchor(d, b, sample) {
    if (!window.renderAnchor) return;
    var f = (d.flows && d.flows.kospi) || {}, st = (d.strong_sectors || [])[0] || {}, wk = (d.weak_sectors || [])[0] || {};
    renderAnchor($('#hm-anchor-card'), {
      kind: 'market', sample: sample, eyebrow: String(d.snapshot_date).replace(/-/g, '.') + ' · 오늘의 시황',
      title: b && b.title || 'KOSPI ' + d.kospi + ' (' + signed(d.kospi_chg) + ') 마감 브리핑',
      caption: b && b.caption || 'KOSPI · KOSDAQ 마감과 투자자별 수급, 업종 흐름, 환율을 한 번에 정리해요.',
      videoUrl: b && b.video_url || '', poster: b && b.thumbnail_url || '',
      chapters: [
        { title: 'KOSPI ' + d.kospi + ' (' + signed(d.kospi_chg) + ')', sub: 'KOSDAQ ' + d.kosdaq + ' (' + signed(d.kosdaq_chg) + ')', time: '0:00' },
        { title: '투자자별 순매수', sub: '외국인 ' + signed(f.foreign) + ' · 기관 ' + signed(f.inst) + ' · 개인 ' + signed(f.retail), time: '0:20' },
        { title: '업종 흐름', sub: '강세 1위 ' + (st.name || '-') + ' ' + (st.chg || '') + ' · 약세 1위 ' + (wk.name || '-') + ' ' + (wk.chg || ''), time: '0:42' },
        { title: '환율', sub: 'USD/KRW ' + d.usdkrw + ' (' + signed(d.usdkrw_chg) + ')', time: '1:02' }
      ]
    });
  }
  drawAnchor(SNAP, null, true);

  /* ---------- Supabase 덮어쓰기 ---------- */
  if (!sb) return;
  var q = function (p) { return Promise.resolve(p).catch(function () { return { data: null }; }); };
  Promise.all([
    q(sb.from('reports').select('id,kind,category,title,summary,company,analyst,published_at').order('published_at', { ascending: false }).limit(200)),
    q(sb.from('market_snapshot').select('*').order('snapshot_date', { ascending: false }).limit(1)),
    q(sb.from('ai_briefings').select('kind,brief_date,title,caption,video_url,thumbnail_url').eq('kind', 'market').order('brief_date', { ascending: false }).limit(1))
  ]).then(function (r) {
    if (r[0].data && r[0].data.length) { REPORTS = r[0].data; reportsSample = false; }
    var d = r[1].data && r[1].data[0];
    if (d) {
      var b = (r[2].data || []).filter(function (x) { return x.brief_date === d.snapshot_date; })[0] || null;
      drawAnchor(d, b, false);
    }
  }).catch(function (e) { console.warn('[home] Supabase 조회 실패 — 예시 값을 유지해요', e); });
})();
