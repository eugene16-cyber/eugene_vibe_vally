// 유리 가입 상담 엔진 — 슬롯(저장 항목) 먼저, 분기는 Q1에서 한 번만 (window.IL_SIGNUP_FLOW · window.YuriFlow)
// · Q1: 법인명 → 공시 DB 조회(가상 금융사 공시 + Supabase stocks/events) → 고객 구분 판별. 못 찾으면 고객 구분을 직접 묻는다.
// · Q2~: 비어 있는 슬롯만 묻는다. 질문 문구는 Gemini(/api/yuri)가 고객에 맞춰 다듬고, 보기(칩)는 어드민 설정 그대로 쓴다.
// · 자유 입력 한 번으로 여러 슬롯을 채운다(규칙 + Gemini 추출). 채워진 슬롯의 질문은 건너뛴다.
// · ④ 원하는 서비스는 지금 열린 행사 · 최근 인뎁스 리포트로 유도하고, ⑤ 심화 질문은 ④의 답에 따라 달라진다.
// · 추천 = 어드민 기본값(adminBase) < 답변 기반 판단. 서버 AI가 없으면 규칙 기반으로 같은 흐름을 진행한다.
(function () {
  'use strict';

  /* ================= 어드민 설정 (질문 트리) ================= */
  var SECTORS = [
    { label: '반도체', kw: /반도체|메모리|HBM|파운드리|전기.?전자/i }, { label: 'AI 인프라', kw: /AI|인공지능|데이터센터|전력기기/i },
    { label: '2차전지', kw: /2차\s?전지|이차전지|배터리|양극재/ }, { label: '바이오', kw: /바이오|제약|헬스|의료/ },
    { label: '조선·방산', kw: /조선|방산|국방/ }, { label: '자동차', kw: /자동차|완성차|모빌리티/ },
    { label: '금융', kw: /은행|증권|보험|금융/ }, { label: '금리·채권', kw: /금리|채권|국채|크레딧/ }, { label: '배당·인컴', kw: /배당|인컴|리츠/ },
    { label: '소비재·유통', kw: /소비|유통|화장품|음식료|리테일/ }, { label: '거시·시황', kw: /거시|매크로|시황|경기|환율/ }
  ];
  var SERVICES = [
    { id: 'seminar', label: '섹터 세미나', pillar: '행사', href: 'conferences.html#seminar', desc: '원하는 섹터 · 애널리스트로 세미나를 요청해요', kw: /세미나|강연|설명회/ },
    { id: 'corpday', label: '콥데이', pillar: '행사', href: 'conferences.html?cat=corp', desc: '분기마다 상장사 경영진을 소규모로 만나요', kw: /콥데이|corporate\s?day|기업\s?설명/i },
    { id: 'ndr', label: 'NDR · 기업 탐방', pillar: '행사', href: 'conferences.html?cat=ndr', desc: '기업 IR팀과 1:1 · 소그룹 미팅을 연결해요', kw: /NDR|탐방|미팅|경영진|방문/i },
    { id: 'conf', label: '컨퍼런스', pillar: '행사', href: 'conferences.html?cat=ai', desc: '산업 전망을 다루는 리서치센터 대형 행사예요', kw: /컨퍼런스|포럼/ },
    { id: 'indepth', label: '인뎁스 리포트', pillar: '리서치', href: 'reports.html', desc: '관심 섹터의 심층 리포트를 모아 봐요', kw: /리포트|보고서|인뎁스|심층|자료/ },
    { id: 'cardnews', label: '카드뉴스', pillar: '리서치', href: 'desk.html#cardnews', desc: '리포트 핵심을 카드 한 장으로 받아요', kw: /카드|요약|짧게|한\s?장/ },
    { id: 'qa', label: '근거형 Q&A', pillar: '리서치', href: 'home.html#assistant', desc: '리포트를 근거로 답하는 질문 창구예요', kw: /Q\s?&?\s?A|질문|물어|문의/i }
  ];
  // Q1에서 한 번만 나누는 고객 구분 — 구분마다 ②③ 보기가 다르다
  var SEGMENTS = {
    fin: { label: '금융사', kw: /금융|운용|자문|일임|보험|은행|증권|연기금|공제|캐피탈/,
      identity: { ask: '어떤 금융사에 해당하세요?', options: [
        { label: '자산운용사', kw: /운용사|자산운용/ }, { label: '투자자문·일임사', kw: /자문|일임/ },
        { label: '보험·연기금·공제회', kw: /보험|연기금|연금|공제/ }, { label: '은행·증권·캐피탈', kw: /은행|증권|캐피탈/ }] },
      purpose: { ask: '리서치 자료는 주로 어떤 운용에 쓰세요?', scaleHint: '운용 규모도 함께 적어 주시면 더 정확해요.', options: [
        { label: '고객 자산 운용 (펀드·일임)', kw: /고객|펀드|일임|위탁/ }, { label: '고유자산 운용', kw: /고유|자기자본|본부/ },
        { label: '리서치 소싱 · 투자위원회', kw: /소싱|위원회|리서치/ }] } },
    listed: { label: '공시 대상 법인', kw: /상장|공시|코스피|코스닥|외감/,
      identity: { ask: '회사의 업종을 알려 주세요.', options: [
        { label: '제조', kw: /제조|공장|부품/ }, { label: 'IT·플랫폼', kw: /IT|플랫폼|소프트웨어|인터넷/i },
        { label: '바이오·헬스케어', kw: /바이오|제약|헬스/ }, { label: '소비재·유통', kw: /소비|유통|리테일/ }, { label: '기타', kw: /기타/ }] },
      purpose: { ask: '증권사 리서치를 어떤 목적으로 쓰실 계획이세요?', scaleHint: '여유자금 운용 규모가 있다면 함께 알려 주세요.', options: [
        { label: '여유자금 운용', kw: /여유|자금|운용|굴리/ }, { label: 'IR · 자본시장 소통', kw: /IR|자본시장|주주|소통/i },
        { label: '산업 · 경쟁사 동향 파악', kw: /동향|경쟁|업황|산업/ }] } },
    corp: { label: '일반 법인', kw: /법인|회사|기업|비상장|중소/,
      identity: { ask: '회사의 업종을 알려 주세요.', options: [
        { label: '제조', kw: /제조|공장|부품/ }, { label: 'IT·플랫폼', kw: /IT|플랫폼|소프트웨어/i },
        { label: '건설·부동산', kw: /건설|부동산|시행/ }, { label: '소비재·유통', kw: /소비|유통|리테일/ }, { label: '기타', kw: /기타/ }] },
      purpose: { ask: '회사 자금은 주로 어떤 목적으로 운용하세요?', scaleHint: '대략적인 규모도 함께 알려 주세요.', options: [
        { label: '여유자금 운용', kw: /여유|자금|운용|굴리/ }, { label: '업황 · 거시 점검', kw: /업황|거시|경기|점검/ },
        { label: '향후 상장(IPO) 준비', kw: /상장|IPO|공모/i }] } },
    wm: { label: 'WM VIP 고객', kw: /WM|PB|개인|자산가|VIP/i,
      identity: { ask: '어떤 분이신지 가장 가까운 걸 골라 주세요.', options: [
        { label: '기업 오너·임원', kw: /오너|대표|임원|창업/ }, { label: '전문직', kw: /의사|변호사|회계사|전문직/ },
        { label: '자산 승계 준비', kw: /승계|증여|상속|가족/ }, { label: '은퇴 준비', kw: /은퇴|노후|연금/ }] },
      purpose: { ask: '자산 운용에서 가장 중요하게 보시는 건 뭔가요?', scaleHint: '운용 자산 규모도 함께 알려 주셔도 돼요.', options: [
        { label: '자산 증식', kw: /증식|성장|수익/ }, { label: '안정적 인컴', kw: /인컴|배당|이자|안정/ }, { label: '승계 · 절세', kw: /승계|절세|세금|증여|상속/ }] } }
  };
  // ⑤ 심화 — ④에서 고른 서비스(첫 번째)에 따라
  var DEEP = {
    seminar: { ask: function (s) { return (s.sectors[0] || '관심 섹터') + ' 세미나는 어떤 형태가 좋으세요? 얼마나 자주 듣고 싶으신지도 알려 주세요.'; },
      options: [{ label: '오프라인 소규모', kw: /오프라인|대면|소규모/ }, { label: '온라인 웨비나', kw: /온라인|웨비나|줌|zoom/i }, { label: '애널리스트 1:1 콜', kw: /1:1|콜|개별|전화/ }] },
    corpday: { ask: function (s) { return '콥데이에서 만나고 싶은 기업이나 업종이 있으세요?'; }, free: true,
      options: [{ label: '관심 섹터 대표 기업', kw: /대표|대형|주요/ }, { label: '중소형 성장 기업', kw: /중소|성장|스몰/ }, { label: '아직 정하지 않았어요', kw: /아직|미정|모르/ }] },
    ndr: { ask: function (s) { return 'NDR · 탐방은 어떤 방식이 편하세요? 희망하는 기업이 있으면 적어 주세요.'; }, free: true,
      options: [{ label: '1:1 미팅', kw: /1:1|단독|개별/ }, { label: '소그룹 미팅', kw: /소그룹|그룹|여럿/ }, { label: '현장 탐방', kw: /현장|공장|방문/ }] },
    conf: { ask: function (s) { return '컨퍼런스에서 가장 듣고 싶은 주제는 뭔가요?'; },
      options: [{ label: '내년 산업 전망', kw: /전망|내년|산업/ }, { label: 'AI 밸류체인', kw: /AI|밸류체인/i }, { label: '자산배분 전략', kw: /자산배분|전략|포트/ }] },
    indepth: { ask: function (s) { return '인뎁스 리포트는 어떻게 받아 보시는 게 편하세요?'; },
      options: [{ label: '발간 즉시 알림', kw: /즉시|바로|알림/ }, { label: '주간 모아 보기', kw: /주간|매주|모아/ }, { label: '회의용 요약본', kw: /요약|회의|브리핑/ }] },
    cardnews: { ask: function (s) { return '카드뉴스는 주로 누구와 보실 건가요?'; },
      options: [{ label: '내부 보고용', kw: /내부|보고|경영진/ }, { label: '고객 전달용', kw: /고객|전달|설명/ }, { label: '혼자 빠르게 확인', kw: /혼자|개인|빠르/ }] },
    qa: { ask: function (s) { return '근거형 Q&A로 주로 확인하고 싶은 건 뭔가요?'; },
      options: [{ label: '실적 · 이익 전망', kw: /실적|이익|어닝/ }, { label: '업황 · 수급', kw: /업황|수급|사이클/ }, { label: '밸류에이션 근거', kw: /밸류|가치|목표/ }] }
  };
  // 어드민 기본 노출 점수 — 답변 기반 판단이 이 위에 더해진다
  var ADMIN_BASE = { corpday: 3, indepth: 3, seminar: 2, cardnews: 2, qa: 2, conf: 1, ndr: 1 };

  var FLOW = {
    version: '2026-10-29',
    slots: [
      { id: 'segment', no: '①', label: '고객 구분', how: 'Q1 법인명 → 공시 DB 조회로 판별 · 없으면 직접 선택 (분기는 여기서 한 번)' },
      { id: 'identity', no: '②', label: '고객 정체성', how: '금융사 종류 · 업종 · WM 자산가 유형 (DB에 있으면 묻지 않음)' },
      { id: 'scale', no: '③', label: '운용 규모', how: '공시 · DB 값 우선, 없으면 ③ 질문의 자유 입력에서 추출' },
      { id: 'purpose', no: '③', label: '운용 목적', how: '구분별 보기 3개' },
      { id: 'sectors', no: '④', label: '관심 분야', how: 'DB 업종 · 보유 섹터 우선, 없으면 질문' },
      { id: 'services', no: '④', label: '원하는 서비스', how: '지금 열린 행사 · 최근 인뎁스 리포트로 유도' },
      { id: 'deep', no: '⑤', label: '심화', how: '④에서 고른 서비스별 질문' }
    ],
    segments: SEGMENTS, sectors: SECTORS, services: SERVICES, deep: DEEP, adminBase: ADMIN_BASE
  };
  window.IL_SIGNUP_FLOW = FLOW;

  /* ================= 데이터 조회 ================= */
  var cfg = window.IL_CONFIG || {};
  function rest(path) {
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return Promise.resolve(null);
    return fetch(cfg.supabaseUrl + '/rest/v1/' + path, { headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + cfg.supabaseAnonKey } })
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  var FIN_SECTOR = /은행|증권|보험|금융|캐피탈|지주|카드/;
  function lookup(name) {
    var q = String(name || '').replace(/\(가상\)|㈜|\(주\)|주식회사|\s/g, '');
    var D = window.IL_DISCLOSURE, v = D && D.lookup(q);
    if (v) {
      var seg = v.type === '일반 법인' ? 'corp' : 'fin';
      var idMap = { '자산운용사': '자산운용사', '투자자문사': '투자자문·일임사', '연기금·보험·은행': '보험·연기금·공제회' };
      return Promise.resolve({ name: v.name, src: 'DART 공시 스냅샷(가상)', segment: seg, identity: idMap[v.type] || null,
        scale: v.aum, sectors: v.sectors.slice(), facts: [['구분', SEGMENTS[seg].label === v.type ? v.type : SEGMENTS[seg].label + ' · ' + v.type], ['운용 규모', v.aum || '공시 없음'], ['설립', v.founded + '년'], ['공시상 섹터', v.sectors.join(' · ') || '공시 없음']], note: v.note, virtual: true });
    }
    if (q.length < 2) return Promise.resolve(null);
    return rest('stocks?select=code,name,sector,market,market_cap_bil&name=ilike.*' + encodeURIComponent(q) + '*&limit=8').then(function (rows) {
      if (!rows || !rows.length) return null;
      var hit = rows.filter(function (r) { return r.name === q; })[0] || rows.sort(function (a, b) { return a.name.length - b.name.length; })[0];
      var fin = FIN_SECTOR.test(hit.sector || '');
      var b = hit.market_cap_bil, mcap = b ? '시가총액 약 ' + (b >= 10000 ? (Math.round(b / 1000) / 10).toLocaleString('ko-KR') + '조 원' : Math.round(b).toLocaleString('ko-KR') + '억 원') : null;
      var sec = SECTORS.filter(function (s) { return s.kw.test(hit.sector || ''); }).map(function (s) { return s.label; });
      return rest('events?select=name,kind,detail,ref_date,tone&name=eq.' + encodeURIComponent(hit.name) + '&order=ref_date.desc&limit=2').then(function (ev) {
        var issue = ev && ev[0] ? ev[0].ref_date + ' · ' + String(ev[0].detail || '').slice(0, 60) : null;
        return { name: hit.name, src: 'Supabase 상장사 DB · 공시 이벤트', segment: fin ? 'fin' : 'listed',
          identity: fin ? '은행·증권·캐피탈' : (hit.sector || null), scale: mcap, sectors: sec,
          facts: [['구분', (fin ? '금융사' : '공시 대상 법인') + ' · ' + (hit.market || '상장')], ['업종', hit.sector || '-'], ['규모', mcap || '-'], ['최근 공시 이슈', issue || '최근 이벤트 없음']],
          note: '공시로 확인되는 정보는 다시 묻지 않을게요.' };
      });
    });
  }

  /* ================= Gemini (서버 함수 /api/yuri — 키는 서버에만) ================= */
  var aiState = { ok: null };
  // 로컬 정적 서버엔 함수가 없으니 부르지 않는다. 배포본은 GET으로 키가 있는지 먼저 확인(없으면 규칙 기반, 실패 요청 없음)
  var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) || location.protocol === 'file:';
  var probe = local ? Promise.resolve(false) : fetch((cfg.apiBase || '') + '/api/yuri').then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) { return !!(j && j.ai); }).catch(function () { return false; });
  function ai(task, payload) {
    return probe.then(function (on) { if (!on) { aiState.ok = false; return null; } return callAi(task, payload); });
  }
  function callAi(task, payload) {
    if (aiState.ok === false) return Promise.resolve(null);
    var ctl = window.AbortController ? new AbortController() : null;
    var t = ctl && setTimeout(function () { ctl.abort(); }, 8000);
    return fetch((cfg.apiBase || '') + '/api/yuri', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ task: task }, payload)), signal: ctl && ctl.signal })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { aiState.ok = true; return j; })
      .catch(function () { if (aiState.ok !== true) aiState.ok = false; return null; })
      .finally(function () { if (t) clearTimeout(t); });
  }

  /* ================= 엔진 ================= */
  function create() {
    var st = { company: '', person: '', db: null, slots: { segment: null, identity: null, scale: null, purpose: null, sectors: [], services: [], deep: null },
      src: {}, freq: null, asked: 0, retries: 0, cur: null, phase: 'q1' };
    var reportsP = rest('reports?select=id,title,category,company,summary,published_at&order=published_at.desc&limit=150').then(function (r) { return r || []; });
    var filled = function (id) { var v = st.slots[id]; return Array.isArray(v) ? v.length > 0 : !!v; };
    var set = function (id, v, src) { st.slots[id] = v; st.src[id] = src; };
    var labelsOf = function (opts) { return opts.map(function (o) { return o.label; }); };

    // 자유 입력 한 번에서 비어 있는 슬롯을 최대한 채운다 (규칙)
    function extractRules(text) {
      var out = {};
      var sec = SECTORS.filter(function (s) { return s.kw.test(text); }).map(function (s) { return s.label; });
      if (sec.length) out.sectors = sec;
      var svc = SERVICES.filter(function (s) { return s.kw.test(text); }).map(function (s) { return s.id; });
      if (svc.length) out.services = svc;
      var m = String(text).replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(조|억)/);
      if (m) out.scale = '약 ' + m[1] + m[2] + ' 원';
      if (/자주|매주|매달|정기|꾸준/.test(text)) out.freq = '자주';
      var seg = st.slots.segment && SEGMENTS[st.slots.segment];
      if (seg) {
        var p = seg.purpose.options.filter(function (o) { return o.kw.test(text); })[0]; if (p) out.purpose = p.label;
        var i = seg.identity.options.filter(function (o) { return o.kw.test(text); })[0]; if (i) out.identity = i.label;
      }
      return out;
    }
    function merge(found, src, onlyEmpty) {
      var got = [];
      ['identity', 'scale', 'purpose', 'sectors', 'services'].forEach(function (k) {
        var v = found[k];
        if (!v || (Array.isArray(v) && !v.length)) return;
        // 관심 분야는 새로 말한 섹터를 더한다(공시 섹터 + 대화에서 말한 섹터)
        if (k === 'sectors' && filled(k)) {
          var add = v.filter(function (x) { return st.slots.sectors.indexOf(x) < 0; });
          // 방금 말한 섹터를 앞에 — ⑤ 심화 · 인뎁스 추천이 이 섹터를 기준으로 한다
          if (add.length) { st.slots.sectors = add.concat(st.slots.sectors); st.added = add; got.push(k); }
          return;
        }
        if (onlyEmpty && filled(k)) return;
        if (Array.isArray(v)) v = v.filter(function (x, i, a) { return a.indexOf(x) === i; });
        set(k, v, src); got.push(k);
      });
      if (found.freq) st.freq = found.freq;
      return got;
    }
    var SLOT_LABEL = { identity: '고객 정체성', scale: '운용 규모', purpose: '운용 목적', sectors: '관심 분야', services: '원하는 서비스' };
    var svcLabel = function (id) { return (SERVICES.filter(function (s) { return s.id === id; })[0] || {}).label || id; };

    // 다음 질문 노드 — 비어 있는 슬롯 순서대로
    function node() {
      var s = st.slots, seg = s.segment && SEGMENTS[s.segment];
      if (st.phase === 'q1') return { slot: 'q1', no: '①', text: '안녕하세요, 유진투자증권 리서치센터 AI 어시스턴트 유리예요. 법인명을 알려 주시면 공시로 확인되는 정보는 자동으로 채울게요. WM 개인 고객이시면 아래 버튼을 눌러 주세요.',
        options: [{ label: '황소자산운용' }, { label: 'A자문사' }, { label: 'B법인' }, { label: 'WM 개인 고객이에요', act: 'wm' }], placeholder: '법인명 (예시는 시연용 가상 회사)', base: true };
      if (!s.segment) return { slot: 'segment', no: '①', text: '공시 DB에서 ' + st.company + '을(를) 찾지 못했어요. 어느 쪽에 가장 가까우세요?',
        options: Object.keys(SEGMENTS).map(function (k) { return { label: SEGMENTS[k].label, key: k, kw: SEGMENTS[k].kw }; }), base: true };
      if (!filled('identity')) return { slot: 'identity', no: '②', text: seg.identity.ask, options: seg.identity.options };
      if (!filled('purpose')) return { slot: 'purpose', no: '③', text: seg.purpose.ask + (filled('scale') ? '' : ' ' + seg.purpose.scaleHint), options: seg.purpose.options };
      if (!filled('sectors')) return { slot: 'sectors', no: '④', multi: true, text: '요즘 가장 관심 있는 분야를 골라 주세요. "바이오 쪽 세미나 자주 듣고 싶어요"처럼 적어 주시면 서비스까지 한 번에 받을게요.', options: SECTORS };
      if (!filled('services')) return { slot: 'services', no: '④', multi: true, options: SERVICES, offer: true };
      if (!s.deep) { var d = DEEP[s.services[0]] || DEEP.indepth; return { slot: 'deep', no: '⑤', text: d.ask(s), options: d.options, free: d.free }; }
      return null;
    }
    // ④ 서비스 질문 — 지금 열린 행사 · 최근 관심 섹터 리포트로 유도
    function offerings() {
      var E = window.IL_EVENTS, ev = [];
      if (E) ev = E.EVENTS.filter(function (e) { return !E.isPast(e) && E.status(e).key !== 'closed'; })
        .sort(function (a, b) { return String(a.start).localeCompare(String(b.start)); }).slice(0, 3)
        .map(function (e) { return { title: e.title, when: e.tba ? '일정 미확정' : E.md(e.start), cat: e.cat }; });
      return reportsP.then(function (rs) {
        var secs = st.slots.sectors;
        var rp = rs.filter(function (r) { return secs.some(function (x) { var k = SECTORS.filter(function (s) { return s.label === x; })[0]; return k && k.kw.test([r.title, r.category, r.company].join(' ')); }); })[0] || null;
        return { events: ev, report: rp && { id: rp.id, title: rp.title, date: rp.published_at } };
      });
    }
    function offerText(o) {
      var parts = [];
      if (o.report) parts.push('최근 ' + st.slots.sectors[0] + ' 관련 리포트 ‘' + o.report.title + '’가 나왔어요. 이 주제로 애널리스트 세미나를 요청하실 수 있어요.');
      if (o.events.length) parts.push('지금 신청할 수 있는 행사로 ' + o.events.slice(0, 2).map(function (e) { return e.title + '(' + e.when + ')'; }).join(', ') + '이(가) 있어요.');
      parts.push('어떤 서비스가 필요하세요? 여러 개 골라도 돼요.');
      return parts.join(' ');
    }

    var api = {
      FLOW: FLOW,
      aiOn: function () { return aiState.ok === true; },
      // 다음 질문 — 어드민 문구를 Gemini가 고객에 맞게 다듬는다(실패하면 그대로)
      next: function () {
        var n = node();
        st.cur = n; st.retries = 0;
        if (!n) return Promise.resolve(null);
        st.asked++;
        n.index = st.asked;
        var textP = n.offer ? offerings().then(function (o) {
          n.offers = o;
          // 최근 리포트가 있으면 세미나를 맨 앞 보기로
          if (o.report) n.options = [SERVICES[0]].concat(SERVICES.slice(1));
          return offerText(o);
        }) : Promise.resolve(n.text);
        return textP.then(function (text) {
          n.text = text;
          if (n.base) return n;
          return ai('ask', { slot: n.slot, base: text, options: labelsOf(n.options), profile: api.profile(), offers: n.offers || null }).then(function (j) {
            if (j && j.question && j.question.length < 260) { n.text = j.question; n.byAi = true; }
            return n;
          });
        });
      },
      current: function () { return st.cur; },
      // 답 받기 → {notes:[], retry?:문구, card?:html}
      answer: function (text, picks, act) {
        var n = st.cur, notes = [];
        text = String(text || '').trim();
        if (!n) return Promise.resolve({ notes: notes });
        if (n.slot === 'q1') {
          if (act === 'wm') { set('segment', 'wm', '대화'); st.phase = 'go'; return Promise.resolve({ notes: ['WM VIP 고객으로 상담을 이어갈게요.'] }); }
          st.company = text; st.phase = 'go';
          return lookup(text).then(function (db) {
            if (!db) return { notes: [] };
            st.db = db; st.company = db.name;
            set('segment', db.segment, 'DB');
            if (db.identity) set('identity', db.identity, 'DB');
            if (db.scale) set('scale', db.scale, 'DB');
            if (db.sectors.length) set('sectors', db.sectors, 'DB');
            var known = ['identity', 'scale', 'sectors'].filter(filled).length + 1;
            return { card: db, notes: ['공시 · DB로 ' + known + '가지를 채웠어요. 공시로는 알 수 없는 내용만 여쭤볼게요.'] };
          });
        }
        // 1) 고른 보기
        var chosen = (picks || []).map(function (i) { return n.options[i]; }).filter(Boolean);
        if (n.slot === 'segment' && chosen[0]) set('segment', chosen[0].key, '대화');
        else if (n.slot === 'services' && chosen.length) set('services', chosen.map(function (o) { return o.id; }), '대화');
        else if (n.slot === 'sectors' && chosen.length) set('sectors', labelsOf(chosen), '대화');
        else if (n.slot === 'deep' && chosen[0]) st.slots.deep = chosen[0].label;
        else if (chosen[0]) set(n.slot, chosen[0].label, '대화');
        if (n.slot === 'segment' && !st.slots.segment && text) {
          var sk = Object.keys(SEGMENTS).filter(function (k) { return SEGMENTS[k].kw.test(text); })[0];
          if (sk) set('segment', sk, '대화');
        }
        if (n.slot === 'deep' && !st.slots.deep && text && (n.free || text.length > 1)) {
          var dk = n.options.filter(function (o) { return o.kw.test(text); })[0];
          st.slots.deep = dk ? dk.label : (n.free ? text.slice(0, 40) : null);
        }
        // 2) 자유 입력 — 규칙 추출 + Gemini 추출로 다른 슬롯까지
        var before = {};
        Object.keys(st.slots).forEach(function (k) { before[k] = filled(k); });
        // 칩만 눌렀으면(보낸 글 = 보기 이름) 추출하지 않는다 — 보기 이름의 낱말이 다른 슬롯을 잘못 채우지 않게
        var typed = text && !(chosen.length && text === labelsOf(chosen).join(', '));
        if (!typed) text = '';
        st.added = null;
        var rules = text ? extractRules(text) : {};
        if (!chosen.length && n.slot !== 'deep' && rules[n.slot]) merge((function () { var o = {}; o[n.slot] = rules[n.slot]; return o; })(), '대화', false);
        merge(rules, '대화', true);
        var aiP = text && text.length > 3 && st.slots.segment ? ai('extract', { text: text, segment: st.slots.segment,
          schema: { identity: labelsOf(SEGMENTS[st.slots.segment].identity.options), purpose: labelsOf(SEGMENTS[st.slots.segment].purpose.options),
            sectors: labelsOf(SECTORS), services: SERVICES.map(function (s) { return s.id + ':' + s.label; }) } }) : Promise.resolve(null);
        return aiP.then(function (j) {
          if (j && j.slots) {
            var f = j.slots, clean = {};
            var segO = SEGMENTS[st.slots.segment];
            if (f.identity && labelsOf(segO.identity.options).indexOf(f.identity) > -1) clean.identity = f.identity;
            if (f.purpose && labelsOf(segO.purpose.options).indexOf(f.purpose) > -1) clean.purpose = f.purpose;
            if (Array.isArray(f.sectors)) clean.sectors = f.sectors.filter(function (x) { return labelsOf(SECTORS).indexOf(x) > -1; });
            if (Array.isArray(f.services)) clean.services = f.services.filter(function (x) { return SERVICES.some(function (s) { return s.id === x; }); });
            if (f.scale) clean.scale = String(f.scale).slice(0, 30);
            if (f.freq) clean.freq = '자주';
            // 이미 채운 슬롯(DB · 앞선 답)은 덮어쓰지 않는다
            var got = merge(clean, 'AI', true);
            if (got.length) st.aiFilled = true;
          }
          // 다른 슬롯까지 채웠으면 알려 준다
          var extra = ['identity', 'scale', 'purpose', 'sectors', 'services'].filter(function (k) { return k !== n.slot && ((!before[k] && filled(k)) || (k === 'sectors' && st.added)); });
          if (extra.length) notes.push(extra.map(function (k) {
            var v = k === 'sectors' && before[k] && st.added ? st.added : st.slots[k];
            return SLOT_LABEL[k] + ' ‘' + (k === 'services' ? v.map(svcLabel).join(', ') : Array.isArray(v) ? v.join(', ') : v) + '’';
          }).join(', ') + '까지 함께 채웠어요.' + (extra.some(function (k) { return !before[k]; }) ? ' 그 질문은 건너뛸게요.' : ''));
          var ok = n.slot === 'deep' ? !!st.slots.deep : n.slot === 'segment' ? !!st.slots.segment : filled(n.slot);
          if (!ok) {
            st.retries++;
            if (st.retries >= 2 && n.slot === 'deep') { st.slots.deep = '추후 상담'; return { notes: notes }; }
            return { notes: notes, retry: st.retries < 2 ? '제가 정확히 이해했는지 모르겠어요. 아래에서 골라 주시거나 조금 더 구체적으로 적어 주세요.' : '아래 보기 중 가장 가까운 걸 골라 주세요.' };
          }
          return { notes: notes };
        });
      },
      profile: function () {
        var s = st.slots;
        return { company: st.company, segment: s.segment && SEGMENTS[s.segment].label, identity: s.identity, scale: s.scale, purpose: s.purpose,
          sectors: s.sectors, services: s.services.map(svcLabel), deep: s.deep, freq: st.freq, src: st.src };
      },
      progressLabel: function () { var n = st.cur; return n ? (n.no + ' ' + ({ q1: '고객 구분', segment: '고객 구분', identity: '고객 정체성', purpose: '운용 규모·목적', sectors: '관심 분야', services: '원하는 서비스', deep: '심화' })[n.slot]) : '추천 결과'; },
      progressRatio: function () { var order = ['q1', 'segment', 'identity', 'purpose', 'sectors', 'services', 'deep']; var n = st.cur; return n ? (order.indexOf(n.slot) + 1) / (order.length + 1) : 1; },
      db: function () { return st.db; },

      // 추천 — 어드민 기본값 < 답변 기반 판단
      result: function () {
        var s = st.slots, score = {}, why = {};
        Object.keys(ADMIN_BASE).forEach(function (k) { score[k] = ADMIN_BASE[k]; why[k] = []; });
        var add = function (k, v, r) { score[k] += v; if (r && why[k].indexOf(r) < 0) why[k].push(r); };
        s.services.forEach(function (id, i) { add(id, 5 - i, '‘' + svcLabel(id) + '’을(를) 원하셨어요'); });
        if (st.freq && s.services.indexOf('seminar') > -1) add('seminar', 2, '세미나를 자주 듣고 싶다고 하셨어요');
        if (s.sectors.length) add('indepth', 1, s.sectors.slice(0, 2).join(' · ') + ' 관심');
        if (s.sectors.some(function (x) { return /반도체|AI/.test(x); })) add('conf', 1, 'AI · 반도체 관심');
        if (s.segment === 'fin') { add('corpday', 1, '금융사 · 경영진 접점'); add('ndr', 1); }
        if (s.segment === 'listed') { add('ndr', 1, 'IR · 기관 접점'); }
        if (s.segment === 'corp' || s.segment === 'wm') { add('cardnews', 1, '핵심 위주 확인'); add('qa', 1); score.ndr -= 1; }
        if (s.purpose && /IR/.test(s.purpose)) add('ndr', 2, 'IR · 자본시장 소통 목적');
        if (s.purpose && /고객/.test(s.purpose)) add('cardnews', 1, '고객 설명용 자료');
        if (s.deep && /1:1|미팅/.test(s.deep)) add('ndr', 1, s.deep);
        var rank = function (sc) { return Object.keys(sc).sort(function (a, b) { return sc[b] - sc[a] || ADMIN_BASE[b] - ADMIN_BASE[a]; }); };
        var admin = rank(ADMIN_BASE).slice(0, 4), mine = rank(score).slice(0, 4);
        var sec = s.sectors[0];
        var items = mine.map(function (id) {
          var c = Object.assign({}, SERVICES.filter(function (x) { return x.id === id; })[0]);
          if (id === 'indepth' && sec) { c.href = 'reports.html?q=' + encodeURIComponent(sec.replace(/·.*/, '')); c.label = sec + ' 인뎁스 리포트'; }
          c.why = why[id].slice(0, 2); c.moved = admin.indexOf(id) < 0 ? 'new' : admin.indexOf(id) > mine.indexOf(id) ? 'up' : '';
          return c;
        });
        var changed = mine.filter(function (k, i) { return admin[i] !== k; }).length;
        return { items: items, adminOrder: admin.map(svcLabel), changed: changed, ai: aiState.ok === true };
      },
      // 2장 세션 형식 + 프로필 · 추천
      session: function (name) {
        var s = st.slots, r = api.result();
        var persona = s.segment === 'wm' ? 'hnw' : s.segment === 'fin' ? (/운용/.test(s.identity || '') ? 'am' : /자문|일임/.test(s.identity || '') ? 'ia' : 'etc') : 'etc';
        var DEMO = { am: '김민준', ia: '이서연', etc: '김민준', hnw: '최은정' };
        var ses = { role: 'customer', name: name || DEMO[persona], seg: persona === 'hnw' ? 'WM' : '법인', cust_type: (s.segment && SEGMENTS[s.segment].label) + (s.identity ? ' · ' + s.identity : ''),
          persona: persona, status: 'approved', via: 'demo', profile: api.profile(),
          recs: r.items.map(function (c) { return { id: c.id, name: c.label, href: c.href, pillar: c.pillar, why: c.why }; }),
          onboarding: { by: 'yuri', ai: r.ai, at: new Date().toISOString() } };
        if (persona === 'hnw') ses.branch = '강남금융센터(가상)'; else ses.org = st.company + (st.db && st.db.virtual ? '(가상)' : '');
        return ses;
      }
    };
    return api;
  }
  window.YuriFlow = { create: create, FLOW: FLOW };
})();
