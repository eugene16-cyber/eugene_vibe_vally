// 신규 유입 자동 발굴 · 맞춤 제안 메일 — window.ILOutreach (어드민 전용)
// 매일(시연 시계 1틱 = 하루) 유입 경로를 훑어 타깃을 찾고 → 적합도를 매기고 → 고객 구분 · 신호에 맞는 서비스로 제안 메일을 만들고
// → 검토 후(또는 자동) 발송 → D+3 리마인드 · D+7 마지막 안내 → 열람 · 회신 · 가입 상담 유입을 경로별로 집계해 다음 탐색 우선순위를 다시 매긴다.
// · 시연에서는 실제로 메일을 보내지 않는다(발송함에만 기록). 열람 · 회신은 결정적 가상값, '가입 상담 유입'만 실제 링크 클릭(index.html?ref=)으로 잡힌다.
// · 문구는 규칙 기반이 기본, /api/yuri(task 'pitch')가 있으면 Gemini로 다듬는다. 어느 쪽이든 투자 권유 표현 검사를 통과해야 발송된다.
(function () {
  'use strict';

  var KEY = 'il.outreach-v1', INBOUND = 'il.inbound';
  var D = window.IL_OUTREACH_DATA, F = window.IL_SIGNUP_FLOW, EV = window.IL_EVENTS;
  var SOURCES = D.SOURCES.concat([{ id: 'manual', label: '어드민 직접 지정', desc: '컨택하고 싶은 회사를 직접 추가', weight: 1.0 }]);
  var SEQ = [{ step: 0, label: '1차 제안', after: 0 }, { step: 1, label: '리마인드', after: 3 }, { step: 2, label: '마지막 안내', after: 4 }];
  var BANNED = /매수\s?(추천|하세요|권유)|매도\s?(추천|하세요|권유)|목표\s?주가|목표가|수익(을|이)?\s?보장|원금\s?보장|확정\s?수익|추천\s?종목|급등|대박|무조건\s?(오르|수익)/;
  var STATUS = {
    hold: ['적합도 미달', 'muted'], draft: ['검토 대기', 'sample'], blocked: ['표현 검사 걸림', 'up'], sent: ['발송 중', 'brand'],
    opened: ['열람', 'brand'], replied: ['회신', 'point'], inbound: ['가입 상담 유입', 'point'], closed: ['시퀀스 종료', 'muted'], skipped: ['보류', 'muted']
  };
  // 고객 구분별 먼저 제안할 서비스(어드민 기본) — 신호 경로가 앞에 끼어든다
  var SEG_SVC = { fin: ['indepth', 'corpday', 'ndr'], newfin: ['indepth', 'qa', 'seminar'], listed: ['corpday', 'seminar', 'indepth'],
    corp: ['seminar', 'cardnews', 'conf'], pro: ['qa', 'indepth', 'cardnews'] };
  var SRC_SVC = { event: 'conf', web: 'indepth', hiring: 'qa', dart: null, fss: 'seminar', referral: null, manual: null };
  var SVC_WHY = {
    seminar: '관심 섹터로 애널리스트 세미나를 요청하실 수 있어요', corpday: '상장사 경영진을 소규모로 만나는 분기 IR 행사예요',
    ndr: '기업 IR팀과 1:1 · 소그룹 미팅을 연결해 드려요', conf: '산업 전망을 한 번에 정리하는 리서치센터 대형 행사예요',
    indepth: '관심 섹터 심층 리포트를 한곳에 모아 드려요', cardnews: '리포트 핵심을 카드 한 장으로 받아 보실 수 있어요',
    qa: '리포트를 근거로 질문에 바로 답하는 AI Q&A예요'
  };
  var SECTOR_PT = { '반도체': 12, 'AI 인프라': 12, '2차전지': 10, '조선·방산': 8, '바이오': 8, '금리·채권': 6, '배당·인컴': 6 };
  var SEG_PT = { newfin: 34, fin: 30, listed: 26, pro: 22, corp: 20 };
  var SEG_LABEL = function (k) { return (F && F.segments[k] && F.segments[k].label) || k; };
  var svcOf = function (id) { return (F ? F.services : []).filter(function (s) { return s.id === id; })[0] || { id: id, label: id }; };
  var srcOf = function (id) { return SOURCES.filter(function (s) { return s.id === id; })[0] || SOURCES[SOURCES.length - 1]; };

  /* ---------- 상태 ---------- */
  function fresh() { return { v: 1, day: 0, mode: 'review', threshold: 60, cap: 4, auto: false, items: {}, order: [], custom: [], log: [] }; }
  var st = (function () { try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s && s.v === 1 ? s : fresh(); } catch (e) { return fresh(); } })();
  var save = function () { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
  var log = function (text) { st.log.unshift({ day: st.day, text: text }); st.log = st.log.slice(0, 40); };
  var inbound = function () { try { return JSON.parse(localStorage.getItem(INBOUND) || '[]'); } catch (e) { return []; } };

  // 결정적 0~1 값(같은 회사 · 같은 단계면 늘 같은 결과)
  function rnd(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 1000) / 1000; }

  /* ---------- 유입 경로 성과 → 우선순위 ---------- */
  function channelStats() {
    var by = {};
    SOURCES.forEach(function (s) { by[s.id] = { src: s, found: 0, sent: 0, opened: 0, replied: 0, inbound: 0 }; });
    st.order.forEach(function (id) {
      var it = st.items[id], c = by[it.src]; if (!c) return;
      c.found++;
      if (it.mails.length) c.sent++;
      if (it.openedAt != null) c.opened++;
      if (it.repliedAt != null) c.replied++;
      if (it.status === 'inbound') c.inbound++;
    });
    Object.keys(by).forEach(function (k) {
      var c = by[k];
      // 회신 · 유입이 나온 경로는 올리고, 보내도 반응이 없는 경로는 조금씩 내린다
      c.weight = Math.round(c.src.weight * (1 + 0.35 * c.replied + 0.6 * c.inbound) / (1 + 0.08 * Math.max(0, c.sent - c.replied)) * 100) / 100;
    });
    return by;
  }

  /* ---------- 적합도 ---------- */
  function aumPt(aum) {
    var m = String(aum || '').match(/([\d.,]+)\s*(조|억)/); if (!m) return 6;
    var eok = parseFloat(m[1].replace(/,/g, '')) * (m[2] === '조' ? 10000 : 1);
    return eok >= 10000 ? 18 : eok >= 1000 ? 14 : eok >= 100 ? 10 : 6;
  }
  function score(p, weights) {
    var sec = p.sectors.map(function (s) { return SECTOR_PT[s] || 4; }).sort(function (a, b) { return b - a; });
    var secPt = Math.min(18, (sec[0] || 0) + 3 * Math.max(0, sec.length - 1));
    var w = (weights[p.src] && weights[p.src].weight) || 1;
    var parts = [
      ['고객 구분', SEG_PT[p.seg] || 20], ['관심 섹터 커버리지', secPt], ['운용 · 자금 규모', aumPt(p.aum)], ['발굴 신호 · 경로 성과', Math.round(12 * w)]
    ];
    return { fit: Math.min(99, parts.reduce(function (a, x) { return a + x[1]; }, 0)), parts: parts };
  }

  /* ---------- 맞춤 제안 구성 ---------- */
  function offerFor(p) {
    var ids = [SRC_SVC[p.src]].concat(SEG_SVC[p.seg] || SEG_SVC.corp).filter(function (x, i, a) { return x && a.indexOf(x) === i; }).slice(0, 2);
    var ev = null;
    if (EV) {
      var want = ids.indexOf('corpday') > -1 ? 'corp' : ids.indexOf('conf') > -1 ? 'ai' : p.seg === 'corp' || p.seg === 'listed' ? 'ipo' : null;
      var up = EV.EVENTS.filter(function (e) { return EV.phaseOf(e) !== 'past' && (e.elig || []).some(function (x) { return x !== 'wm'; }); })
        .sort(function (a, b) { return (a.cat === want ? 0 : 1) - (b.cat === want ? 0 : 1) || (a.start < b.start ? -1 : 1); });
      if (up[0]) ev = { id: up[0].id, title: up[0].title, when: up[0].tba || EV.dateLabel(up[0]) };
    }
    return { services: ids, event: ev };
  }

  function hookOf(p) {
    return {
      fss: p.signal + ' 소식을 보고 연락드려요. 초기에 리서치 체계를 갖추시는 데 도움이 될 것 같아요.',
      hiring: '리서치 · 운용 인력을 찾고 계신다는 공고를 보고 연락드려요.',
      event: '지난 리서치센터 행사에 함께해 주셔서 감사해요.',
      dart: '최근 공시(' + p.signal.split(' — ')[0] + ')를 보고 연락드려요.',
      web: 'Insight Lab 리포트를 꾸준히 봐 주셔서 감사해요.',
      referral: '저희 고객사의 소개로 연락드려요.',
      manual: p.signal ? p.signal + ' — 이 부분에 도움이 될 것 같아 연락드려요.' : '귀사의 리서치 수요에 도움이 될 것 같아 연락드려요.'
    }[p.src] || '';
  }
  var linkOf = function (p) { return location.origin + location.pathname.replace(/[^/]*$/, '') + 'index.html?ref=' + p.id + '&src=outreach'; };
  var footer = function (p) {
    return '\n\n▶ AI 상담으로 맞춤 구성 받아 보기(약 2분)\n' + linkOf(p) +
      '\n\n※ 본 메일은 리서치 서비스 안내이며 특정 종목 · 상품의 매매를 권유하지 않아요. 수신을 원하지 않으시면 회신으로 알려 주세요.\n※ 시연용 가상 메일 — 실제로 발송되지 않아요.';
  };

  function compose(p, step) {
    var o = p.offer, s1 = svcOf(o.services[0]), s2 = o.services[1] ? svcOf(o.services[1]) : null;
    var hi = [p.contact.name, p.contact.title].filter(Boolean).join(' ') + '님, 안녕하세요.\n유진투자증권 리서치센터예요.\n\n';
    var sec = p.sectors.length ? p.sectors.join(' · ') : '관심 분야';
    var evLine = o.event ? '\n\n다가오는 행사: ' + o.event.title + ' (' + o.event.when + ')' : '';
    if (step === 0) {
      return {
        subject: '[유진투자증권 리서치센터] ' + p.name.replace('(가상)', '') + ' 맞춤 ' + s1.label + (s2 ? ' · ' + s2.label : '') + ' 제안',
        body: hi + hookOf(p) + '\n\n' + sec + ' 관심에 맞춰 아래 서비스를 먼저 제안드려요.\n' +
          '· ' + s1.label + ' — ' + (SVC_WHY[s1.id] || s1.desc) + '\n' + (s2 ? '· ' + s2.label + ' — ' + (SVC_WHY[s2.id] || s2.desc) + '\n' : '') +
          '· 유진 Insight Lab — 고객 유형별 맞춤 라운지에서 리포트 · 행사 · 근거형 Q&A를 한곳에서 보실 수 있어요.' + evLine +
          '\n\n링크에서 AI 상담으로 필요한 것만 골라 주시면 담당자가 맞춤 구성으로 안내드릴게요.\n\n감사합니다.\n유진투자증권 리서치센터 법인영업 드림'
      };
    }
    if (step === 1) {
      return {
        subject: 'Re: ' + s1.label + ' 제안 — ' + sec + ' 최근 자료 함께 보내드려요',
        body: hi + '지난번 안내드린 ' + s1.label + ' 관련해 한 번 더 연락드려요.\n' + sec + ' 최근 리포트 요약을 Insight Lab에서 카드뉴스로 바로 보실 수 있어요.' + evLine +
          '\n\n편하실 때 링크로 둘러봐 주세요.\n\n유진투자증권 리서치센터 법인영업 드림'
      };
    }
    return {
      subject: '마지막 안내 — ' + p.name.replace('(가상)', '') + ' 맞춤 라운지 준비해 두었어요',
      body: hi + sec + ' 중심으로 맞춤 라운지 구성을 미리 만들어 두었어요. 필요하실 때 언제든 링크로 열어 보실 수 있어요.\n이후로는 먼저 연락드리지 않을게요.\n\n유진투자증권 리서치센터 법인영업 드림'
    };
  }
  function check(mail) { var m = (mail.subject + '\n' + mail.body).match(BANNED); return m ? m[0] : null; }

  // Gemini로 다듬기 — 키 · 서버가 없으면 규칙 기반 문구 그대로
  var aiReady = null;
  function aiAvailable() {
    if (aiReady) return aiReady;
    aiReady = fetch('/api/yuri', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : {}; }).then(function (j) { return !!j.ai; }).catch(function () { return false; });
    return aiReady;
  }
  function polish(p, step, base) {
    return aiAvailable().then(function (ok) {
      if (!ok) return null;
      return fetch('/api/yuri', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        task: 'pitch', step: step, draft: base,
        prospect: { name: p.name, kind: p.kind, segment: SEG_LABEL(p.seg), sectors: p.sectors, signal: p.signal, contact: [p.contact.name, p.contact.title].filter(Boolean).join(' ') },
        services: p.offer.services.map(function (id) { var s = svcOf(id); return s.label + ': ' + (SVC_WHY[id] || s.desc); }), event: p.offer.event
      }) }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { return j && j.subject && j.body ? j : null; }).catch(function () { return null; });
    });
  }

  /* ---------- 엔진 ---------- */
  function draftFor(it, step) {
    var m = compose(it, step);
    m.body += footer(it); m.step = step; m.ai = false;
    it.pending = m;
    var bad = check(m);
    it.status = bad ? 'blocked' : 'draft'; it.bad = bad || null;
  }
  function discover() {
    var w = channelStats(), n = 0;
    D.PROSPECTS.concat(st.custom).forEach(function (p) {
      if (st.items[p.id] || p.day > st.day) return;
      var it = JSON.parse(JSON.stringify(p)), sc = score(p, w);
      it.fit = sc.fit; it.parts = sc.parts; it.offer = offerFor(p); it.mails = []; it.foundAt = st.day; it.openedAt = it.repliedAt = null;
      st.items[p.id] = it; st.order.push(p.id); n++;
      if (it.fit < st.threshold) { it.status = 'hold'; log(it.name + ' 발굴 — 적합도 ' + it.fit + '점, 기준 미달로 보류'); }
      else { draftFor(it, 0); log(it.name + ' 발굴(' + srcOf(it.src).label + ') — 적합도 ' + it.fit + '점, 맞춤 제안 초안 작성'); }
    });
    return n;
  }
  function send(it) {
    var m = it.pending; if (!m || it.bad) return false;
    m.at = st.day; it.mails.push(m); it.pending = null;
    it.status = it.openedAt != null ? 'opened' : 'sent';
    var nx = SEQ[m.step + 1]; it.due = nx ? st.day + nx.after : null;
    log(it.name + '에 ' + SEQ[m.step].label + ' 메일 발송(시연 — 발송함 기록만)');
    return true;
  }
  function engage() {
    var inb = inbound().map(function (x) { return x.ref; });
    st.order.forEach(function (id) {
      var it = st.items[id];
      if (inb.indexOf(id) > -1 && it.status !== 'inbound') { it.status = 'inbound'; it.due = null; log(it.name + ' — 메일 링크로 가입 상담 유입'); return; }
      if (!it.mails.length || ['replied', 'inbound', 'closed', 'skipped'].indexOf(it.status) > -1) return;
      var last = it.mails[it.mails.length - 1];
      if (st.day <= last.at) return;
      if (it.openedAt == null && rnd(id + last.step + 'o') < 0.35 + it.fit / 220) { it.openedAt = st.day; it.status = 'opened'; log(it.name + ' — ' + SEQ[last.step].label + ' 메일 열람'); }
      else if (it.openedAt != null && it.openedAt < st.day && rnd(id + last.step + 'r') < 0.12 + it.fit / 500 + (it.src === 'referral' || it.src === 'event' ? 0.12 : 0)) {
        it.repliedAt = st.day; it.status = 'replied'; it.due = null; log(it.name + ' — 회신 도착 · 담당자 미팅 요청으로 넘김');
      }
    });
  }
  function sequence() {
    st.order.forEach(function (id) {
      var it = st.items[id];
      if (it.due == null || it.due > st.day || it.pending || ['replied', 'inbound', 'skipped'].indexOf(it.status) > -1) return;
      var lastStep = it.mails[it.mails.length - 1].step;
      if (lastStep >= SEQ.length - 1) { it.due = null; it.status = 'closed'; log(it.name + ' — 시퀀스 종료(반응 없음)'); return; }
      draftFor(it, lastStep + 1);
    });
  }
  function autoSend() {
    if (st.mode !== 'auto') return;
    var sent = 0;
    st.order.map(function (id) { return st.items[id]; }).filter(function (it) { return it.status === 'draft' && it.pending; })
      .sort(function (a, b) { return b.fit - a.fit; }).forEach(function (it) { if (sent < st.cap && send(it)) sent++; });
  }
  function tick() {
    st.day++;
    engage(); sequence(); discover(); autoSend();
    save(); render();
  }

  /* ---------- 화면 ---------- */
  var host, timer, filter = 'all';
  var FILTERS = [['all', '전체'], ['draft', '검토 대기'], ['live', '발송 중'], ['win', '회신 · 유입'], ['off', '보류 · 종료']];
  var inFilter = function (it) {
    return filter === 'all' || (filter === 'draft' && (it.status === 'draft' || it.status === 'blocked')) ||
      (filter === 'live' && (it.status === 'sent' || it.status === 'opened')) || (filter === 'win' && (it.status === 'replied' || it.status === 'inbound')) ||
      (filter === 'off' && ['hold', 'closed', 'skipped'].indexOf(it.status) > -1);
  };
  var badge = function (s) { var b = STATUS[s] || [s, 'muted']; return '<span class="badge badge--' + b[1] + '">' + esc(b[0]) + '</span>'; };

  var VIEWS = [['pipe', '파이프라인'], ['outbox', '발송함'], ['channel', '유입 경로 · 설정']], view = 'pipe';
  var SEG_KIND = function (it) { return it.kind.indexOf(SEG_LABEL(it.seg)) === 0 ? it.kind : SEG_LABEL(it.seg) + ' · ' + it.kind; };
  var pct = function (a, b) { return b ? Math.round(a / b * 100) : 0; };

  function viewPipe(items) {
    var waiting = items.filter(function (i) { return i.status === 'draft'; }).length;
    var rows = items.filter(inFilter).sort(function (a, b) { return b.fit - a.fit; });
    var cnt = function (k) { var keep = filter; filter = k; var n = items.filter(inFilter).length; filter = keep; return n; };
    return '<div class="ob-head"><div class="tabs ob-filter" role="tablist" aria-label="상태 필터">' +
        FILTERS.map(function (f) { return '<button role="tab" data-filter="' + f[0] + '" aria-selected="' + (filter === f[0]) + '">' + f[1] + ' <span class="num">' + cnt(f[0]) + '</span></button>'; }).join('') + '</div>' +
        '<div class="ob-ctl">' + (waiting ? '<button class="btn btn--sm btn--primary" data-act="approve-all">검토 대기 ' + waiting + '건 모두 발송</button>' : '') +
        '<button class="btn btn--sm btn--secondary" data-act="add">+ 컨택 회사 추가</button></div></div>' +
      (rows.length ? '<div class="tbl-wrap"><table class="tbl ob-tbl"><thead><tr><th>회사</th><th>발굴 경로 · 신호</th><th class="num">적합도</th><th>맞춤 제안</th><th>상태</th><th></th></tr></thead><tbody>' +
        rows.map(function (it) {
          var last = it.mails[it.mails.length - 1];
          return '<tr><td><b>' + esc(it.name) + '</b><small>' + esc(SEG_KIND(it)) + '</small></td>' +
            '<td><span class="ob-src">' + esc(srcOf(it.src).label) + '</span><small>' + esc(it.signal) + '</small></td>' +
            '<td class="num"><span class="ob-fit' + (it.fit < st.threshold ? ' is-low' : '') + '"><i style="width:' + it.fit + '%"></i></span>' + it.fit + '</td>' +
            '<td><small>' + it.offer.services.map(function (id) { return esc(svcOf(id).label); }).join(' · ') + ' · Insight Lab</small></td>' +
            '<td>' + badge(it.status) + (last ? '<small>' + SEQ[last.step].label + ' D+' + last.at + '</small>' : '') + '</td>' +
            '<td><button class="btn btn--sm btn--secondary" data-open="' + it.id + '">' + (it.status === 'draft' ? '검토' : '메일') + '</button></td></tr>';
        }).join('') + '</tbody></table></div>' :
        '<p class="ob-empty">' + (items.length ? '이 상태의 타깃이 없어요.' : '"하루 진행"이나 "자동 운영"을 누르면 발굴을 시작해요.') + '</p>');
  }

  function viewOutbox(items) {
    var mails = [];
    items.forEach(function (it) { it.mails.forEach(function (m) { mails.push({ it: it, m: m }); }); });
    mails.sort(function (a, b) { return b.m.at - a.m.at || b.m.step - a.m.step; });
    if (!mails.length) return '<p class="ob-empty">아직 보낸 메일이 없어요. 파이프라인에서 검토 대기 메일을 승인하거나 자동 발송으로 바꿔 보세요.</p>';
    return '<p class="ad-note" style="margin:0 0 10px">시연 발송함 — 실제로 발송되지 않고 여기에만 기록돼요.</p><ul class="ob-outbox">' + mails.map(function (x) {
      var it = x.it;
      var tag = it.status === 'inbound' ? badge('inbound') : it.repliedAt != null ? badge('replied') : it.openedAt != null ? badge('opened') : '<span class="badge badge--muted">미열람</span>';
      return '<li><button data-open="' + it.id + '"><span class="ob-ob-d num">D+' + x.m.at + '</span><span class="ob-ob-m"><b>' + esc(x.m.subject) + '</b>' +
        '<small>' + esc(it.name) + ' · ' + esc(it.contact.email) + ' · ' + SEQ[x.m.step].label + (x.m.ai ? ' · AI 문구' : '') + '</small></span>' + tag + '</button></li>';
    }).join('') + '</ul>';
  }

  function viewChannel(ch) {
    var chRows = Object.keys(ch).map(function (k) { return ch[k]; }).sort(function (a, b) { return b.weight - a.weight; });
    var maxW = Math.max.apply(null, chRows.map(function (c) { return c.weight; }));
    return '<div class="ob-two"><section><h3>유입 경로 성과 · 다음 탐색 순서</h3><p class="ad-note" style="margin:0 0 12px">회신 · 유입이 나온 경로는 가중치가 오르고, 보내도 반응이 없으면 내려가요. 가중치는 새로 발굴하는 회사의 적합도에 반영돼요.</p>' +
        '<div class="tbl-wrap"><table class="tbl ob-chtbl"><thead><tr><th>#</th><th>경로</th><th class="num">발굴</th><th class="num">발송</th><th class="num">열람</th><th class="num">회신</th><th class="num">유입</th><th>가중치</th></tr></thead><tbody>' +
        chRows.map(function (c, i) {
          return '<tr><td class="num">' + (i + 1) + '</td><td><b>' + esc(c.src.label) + '</b><small>' + esc(c.src.desc) + '</small></td>' +
            [c.found, c.sent, c.opened, c.replied, c.inbound].map(function (n) { return '<td class="num">' + n + '</td>'; }).join('') +
            '<td><span class="ob-bar"><i style="width:' + Math.round(c.weight / maxW * 100) + '%"></i></span><span class="num ob-w">×' + c.weight.toFixed(2) + '</span></td></tr>';
        }).join('') + '</tbody></table></div></section>' +
      '<section class="ob-set"><h3>발송 설정</h3>' +
        '<label class="field"><span class="field__label">발송 방식</span><select class="input" data-set="mode"><option value="review"' + (st.mode === 'review' ? ' selected' : '') + '>검토 후 발송</option>' +
          '<option value="auto"' + (st.mode === 'auto' ? ' selected' : '') + '>자동 발송</option></select><span class="ad-note" style="display:block;margin-top:6px">' +
          (st.mode === 'auto' ? '적합도 높은 순으로 하루 한도만큼 바로 나가요.' : '어드민이 메일을 검토 · 승인해야 나가요.') + '</span></label>' +
        '<label class="field"><span class="field__label">적합도 기준 <b class="num">' + st.threshold + '점</b></span><input type="range" min="40" max="85" step="5" value="' + st.threshold + '" data-set="threshold"></label>' +
        '<label class="field"><span class="field__label">자동 발송 하루 한도 <b class="num">' + st.cap + '통</b></span><input type="range" min="1" max="10" value="' + st.cap + '" data-set="cap"></label>' +
        '<p class="field__label" style="margin-top:4px">후속 메일 시퀀스</p><ol class="ob-seq">' + SEQ.map(function (s, i) { return '<li><b>' + s.label + '</b><span>' + (i ? '앞 메일 D+' + s.after + ' · 회신 · 유입 없을 때' : '발굴 · 승인 즉시') + '</span></li>'; }).join('') + '</ol>' +
        '<p class="ad-note">모든 메일은 투자 권유 표현 검사를 통과해야 나가고, 수신 거부 안내가 자동으로 붙어요.</p>' +
        '<button class="btn btn--text" data-act="reset">기록 지우고 처음부터</button></section></div>';
  }

  function render() {
    if (!host) return;
    var items = st.order.map(function (id) { return st.items[id]; });
    var ch = channelStats();
    var n = {
      found: items.length, sent: items.filter(function (i) { return i.mails.length; }).length, opened: items.filter(function (i) { return i.openedAt != null; }).length,
      replied: items.filter(function (i) { return i.repliedAt != null; }).length, inbound: items.filter(function (i) { return i.status === 'inbound'; }).length
    };
    var funnel = [['발굴', n.found, null], ['제안 발송', n.sent, n.found], ['열람', n.opened, n.sent], ['회신', n.replied, n.opened], ['가입 상담 유입', n.inbound, n.sent]];
    var waiting = items.filter(function (i) { return i.status === 'draft'; }).length;
    var blocked = items.filter(function (i) { return i.status === 'blocked'; }).length;
    var todo = [];
    if (waiting) todo.push('<button data-go="draft">검토 대기 메일 <b class="num">' + waiting + '</b>건</button>');
    if (n.replied) todo.push('<button data-go="win">회신 <b class="num">' + n.replied + '</b>건 — 담당자 미팅 연결</button>');
    if (blocked) todo.push('<button data-go="draft">표현 검사 걸림 <b class="num">' + blocked + '</b>건 — 다시 쓰기</button>');
    var badgeEl = document.getElementById('ad-ob-count');
    if (badgeEl) { badgeEl.textContent = waiting; badgeEl.hidden = !waiting; }

    host.innerHTML =
      '<header class="ob-top"><div><p class="ad-k">ADMIN · 시연용</p><h2>신규 유입 관리</h2><p class="ad-note">매일 유입 경로 ' + D.SOURCES.length + '곳에서 컨택할 회사를 찾고, 고객 구분 · 발굴 신호에 맞춘 제안 메일을 보내요.</p></div>' +
        '<div class="ob-ctl"><span class="ob-day num">시연 D+' + st.day + (st.mode === 'auto' ? ' · 자동 발송' : ' · 검토 후 발송') + '</span>' +
        '<button class="btn btn--sm ' + (st.auto ? 'btn--primary' : 'btn--secondary') + '" data-act="auto" aria-pressed="' + st.auto + '">' + (st.auto ? '● 자동 운영 중' : '▶ 자동 운영') + '</button>' +
        '<button class="btn btn--sm btn--secondary" data-act="tick">하루 진행</button></div></header>' +
      '<ol class="ob-funnel">' + funnel.map(function (f) {
        return '<li><span>' + f[0] + '</span><b class="num">' + f[1] + '</b>' + (f[2] != null ? '<small class="num">' + (f[0] === '가입 상담 유입' ? '발송 대비 ' : '') + pct(f[1], f[2]) + '%</small>' : '<small>누적</small>') + '</li>';
      }).join('') + '</ol>' +
      '<div class="ob-today"><div class="ob-todo"><b>오늘 할 일</b>' + (todo.length ? todo.join('') : '<span class="muted">처리할 일이 없어요.</span>') + '</div>' +
        '<div class="ob-recent"><b>최근 활동</b><ul class="ob-log">' + (st.log.length ? st.log.slice(0, 3).map(function (l) { return '<li><span class="num">D+' + l.day + '</span>' + esc(l.text) + '</li>'; }).join('') : '<li class="muted">아직 기록이 없어요.</li>') + '</ul></div></div>' +
      '<section class="card ob-main"><div class="ob-views" role="tablist" aria-label="신규 유입 보기">' + VIEWS.map(function (v) { return '<button role="tab" data-view="' + v[0] + '" aria-selected="' + (view === v[0]) + '">' + v[1] + '</button>'; }).join('') + '</div>' +
        '<div class="card__body">' + (view === 'pipe' ? viewPipe(items) : view === 'outbox' ? viewOutbox(items) : viewChannel(ch)) + '</div></section>';
  }

  function openAdd() {
    var html = '<div class="ob-mail"><p class="ad-k">컨택 회사 추가</p><h2 class="ob-mtitle">컨택하고 싶은 회사를 알려 주세요</h2><form class="ob-form">' +
      '<label class="field"><span class="field__label">회사명</span><input class="input" name="name" required maxlength="30" placeholder="예: 가상운용(가상)"></label>' +
      '<label class="field"><span class="field__label">고객 구분</span><select class="input" name="seg">' + Object.keys(SEG_PT).map(function (k) { return '<option value="' + k + '">' + esc(SEG_LABEL(k)) + '</option>'; }).join('') + '</select></label>' +
      '<fieldset class="field"><legend class="field__label">관심 섹터</legend><div class="ad-chips ob-secs">' + (F ? F.sectors : []).map(function (s) { return '<label><input type="checkbox" name="sec" value="' + esc(s.label) + '"><span>' + esc(s.label) + '</span></label>'; }).join('') + '</div></fieldset>' +
      '<label class="field"><span class="field__label">컨택 이유(선택) — 메일 첫 문장이 돼요</span><input class="input" name="why" maxlength="60" placeholder="예: 신규 펀드 출시 준비"></label>' +
      '<label class="field"><span class="field__label">담당자 메일</span><input class="input" name="email" type="email" required placeholder="name@company.example"></label>' +
      '<button class="btn btn--primary btn--block">추가하고 맞춤 제안 만들기</button><p class="ad-note">시연에서는 가상 회사만 넣어 주세요. 실제로 발송되지 않아요.</p></form></div>';
    var md = openModal(html, { width: 520, label: '컨택 회사 추가' });
    md.el.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target.elements, secs = [].slice.call(e.target.querySelectorAll('[name=sec]:checked')).map(function (x) { return x.value; });
      var p = { id: 'c' + Date.now().toString(36), day: st.day, name: f.name.value.trim(), seg: f.seg.value, kind: SEG_LABEL(f.seg.value), aum: null, founded: null,
        sectors: secs, src: 'manual', signal: f.why.value.trim() || '어드민이 컨택 대상으로 지정',
        contact: { name: '', title: '담당자', email: f.email.value.trim() } };
      if (!p.name) return;
      st.custom.push(p); discover(); save(); md.close();
      var it = st.items[p.id];
      view = 'pipe'; filter = 'all'; render();
      toast(p.name + ' — 적합도 ' + it.fit + '점, ' + (it.status === 'hold' ? '기준 미달이라 보류했어요' : '맞춤 제안 초안을 만들었어요'));
    });
  }

  // 기준 점수가 바뀌면 아직 안 보낸 회사만 다시 나눈다
  function rethreshold() {
    st.order.forEach(function (id) {
      var it = st.items[id];
      if (it.mails.length) return;
      if (it.status === 'hold' && it.fit >= st.threshold) draftFor(it, 0);
      else if ((it.status === 'draft' || it.status === 'blocked') && it.fit < st.threshold) { it.status = 'hold'; it.pending = null; }
    });
  }

  function openMail(id) {
    var it = st.items[id]; if (!it) return;
    var m = it.pending || it.mails[it.mails.length - 1] || (function () { var x = compose(it, 0); x.body += footer(it); x.step = 0; return x; })();
    var bad = check(m);
    var hist = it.mails.map(function (x) { return '<li>' + SEQ[x.step].label + ' · D+' + x.at + ' — ' + esc(x.subject) + (x.ai ? ' <span class="badge badge--brand">AI</span>' : '') + '</li>'; }).join('');
    var html = '<div class="ob-mail"><p class="ad-k">' + (it.pending ? '보낼 메일 · ' + SEQ[m.step].label : '보낸 메일') + (m.ai ? ' · Gemini가 다듬은 문구' : ' · 규칙 기반 문구') + '</p>' +
      '<dl><dt>받는 사람</dt><dd>' + esc([it.contact.name, it.contact.title].filter(Boolean).join(' ')) + ' &lt;' + esc(it.contact.email) + '&gt;</dd><dt>제목</dt><dd><b>' + esc(m.subject) + '</b></dd></dl>' +
      '<pre class="ob-body">' + esc(m.body) + '</pre>' +
      '<p class="ob-guard ' + (bad ? 'is-bad' : '') + '">' + (bad ? '✕ 투자 권유로 읽힐 표현("' + esc(bad) + '")이 있어 발송할 수 없어요.' : '✓ 투자 권유 표현 검사 통과 · 수신 거부 안내 포함') + '</p>' +
      '<p class="ad-note">적합도 ' + it.fit + '점 = ' + it.parts.map(function (x) { return esc(x[0]) + ' ' + x[1]; }).join(' + ') + '</p>' +
      (hist ? '<ul class="ob-hist">' + hist + '</ul>' : '') +
      '<div class="ob-acts">' + (it.pending && !bad ? '<button class="btn btn--primary" data-m="send">승인하고 발송</button>' : '') +
        (it.pending ? '<button class="btn btn--secondary" data-m="ai">AI로 다시 쓰기</button>' : '') +
        '<a class="btn btn--secondary" href="' + esc(linkOf(it)) + '" target="_blank" rel="noopener">메일 링크 열기(유입 테스트)</a>' +
        (['replied', 'inbound', 'skipped', 'closed'].indexOf(it.status) < 0 ? '<button class="btn btn--text" data-m="skip">보류</button>' : '') + '</div></div>';
    var md = openModal(html, { width: 680, label: it.name + ' 제안 메일' });
    var box = md.el;
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-m]'); if (!b) return;
      var act = b.getAttribute('data-m'), close = md.close;
      if (act === 'send') { send(it); save(); render(); close(); toast(it.name + '에 발송했어요(시연 — 실제 발송 없음)'); }
      if (act === 'skip') { it.status = 'skipped'; it.pending = null; it.due = null; log(it.name + ' — 어드민이 보류'); save(); render(); close(); }
      if (act === 'ai') {
        b.disabled = true; b.textContent = '다듬는 중…';
        var base = compose(it, it.pending.step);
        polish(it, it.pending.step, base).then(function (j) {
          if (!j) { toast('AI 서버가 연결되지 않아 규칙 기반 문구를 그대로 써요.'); b.disabled = false; b.textContent = 'AI로 다시 쓰기'; return; }
          var step = it.pending.step;
          it.pending = { subject: String(j.subject).slice(0, 80), body: String(j.body).slice(0, 1200) + footer(it), step: step, ai: true };
          it.bad = check(it.pending) || null; it.status = it.bad ? 'blocked' : 'draft';
          save(); render(); close(); openMail(id);
        });
      }
    });
    return md;
  }

  function setAuto(on) {
    st.auto = on; save(); clearInterval(timer);
    if (on) timer = setInterval(tick, 2500);
  }

  function mount(el) {
    host = el;
    if (!st.order.length) discover();
    engage(); save(); render();
    if (st.auto) setAuto(true);
    host.addEventListener('click', function (e) {
      var t = e.target.closest('[data-act],[data-open],[data-filter],[data-view],[data-go]'); if (!t) return;
      if (t.hasAttribute('data-view')) { view = t.getAttribute('data-view'); return render(); }
      if (t.hasAttribute('data-go')) { view = 'pipe'; filter = t.getAttribute('data-go'); return render(); }
      if (t.hasAttribute('data-open')) return openMail(t.getAttribute('data-open'));
      if (t.hasAttribute('data-filter')) { filter = t.getAttribute('data-filter'); return render(); }
      var a = t.getAttribute('data-act');
      if (a === 'auto') { setAuto(!st.auto); render(); if (st.auto) tick(); }
      if (a === 'tick') tick();
      if (a === 'add') openAdd();
      if (a === 'reset' && confirm('발굴 · 발송 기록을 모두 지우고 처음부터 시작할까요?')) { clearInterval(timer); st = fresh(); try { localStorage.removeItem(INBOUND); } catch (x) {} discover(); save(); render(); }
      if (a === 'approve-all') {
        var n = 0; st.order.forEach(function (id) { var it = st.items[id]; if (it.status === 'draft' && send(it)) n++; });
        save(); render(); toast(n + '건 발송했어요(시연 — 실제 발송 없음)');
      }
    });
    host.addEventListener('change', function (e) {
      var k = e.target.getAttribute('data-set'); if (!k) return;
      if (k === 'mode') { st.mode = e.target.value; log('발송 방식 → ' + (st.mode === 'auto' ? '자동 발송' : '검토 후 발송')); }
      if (k === 'threshold') { st.threshold = +e.target.value; rethreshold(); log('적합도 기준 → ' + st.threshold + '점'); }
      if (k === 'cap') { st.cap = +e.target.value; }
      save(); render();
    });
    window.addEventListener('storage', function (e) { if (e.key === INBOUND) { engage(); save(); render(); } });
  }

  window.ILOutreach = { mount: mount, tick: tick, state: function () { return st; } };
})();
