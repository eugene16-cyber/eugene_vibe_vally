// 유리 가입 상담 엔진 — 슬롯(저장 항목) 먼저, 분기는 Q1에서 한 번만 (window.IL_SIGNUP_FLOW · window.YuriFlow)
// · Q0: 호칭. Q1: 공시 대상 기업인지(공시 / 비공시 법인 / 개인) → 법인명 → 공시 DB 조회로 고객 구분 판별, 못 찾으면 구분을 고른다.
// · 이후: 비어 있는 슬롯만 묻는다. 질문은 '제목 한 줄 + 보조 설명'으로 짧게. Gemini(/api/yuri)는 문구 다듬기 · 자유 입력 추출만.
// · 자유 입력 한 번으로 여러 슬롯을 채운다. ④는 지금 열린 행사 · 최근 리포트로 유도, ⑤는 ④의 답에 따라 달라진다.
// · 마지막: 이름 · 회사 메일 → 가입 신청(승인 대기). 추천 = 어드민 기본값 < 답변 기반 판단.
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
    { id: 'seminar', label: '섹터 세미나', pillar: '행사', href: 'conferences.html#seminar', desc: '원하는 섹터로 애널리스트 세미나 요청', kw: /세미나|강연|설명회/ },
    { id: 'corpday', label: '콥데이', pillar: '행사', href: 'conferences.html?cat=corp', desc: '상장사 경영진과 소규모 미팅', kw: /콥데이|corporate\s?day|기업\s?설명/i },
    { id: 'ndr', label: 'NDR · 기업 탐방', pillar: '행사', href: 'conferences.html?cat=ndr', desc: '기업 IR팀과 1:1 · 소그룹 미팅', kw: /NDR|탐방|미팅|경영진|방문/i },
    { id: 'conf', label: '컨퍼런스', pillar: '행사', href: 'conferences.html?cat=ai', desc: '산업 전망 대형 행사', kw: /컨퍼런스|포럼/ },
    { id: 'indepth', label: '인뎁스 리포트', pillar: '리서치', href: 'reports.html', desc: '관심 섹터 심층 리포트 모아 보기', kw: /리포트|보고서|인뎁스|심층|자료/ },
    { id: 'cardnews', label: '카드뉴스', pillar: '리서치', href: 'market.html#cardnews', desc: '리포트 핵심을 카드 한 장으로', kw: /카드|요약|짧게|한\s?장/ },
    { id: 'qa', label: '근거형 Q&A', pillar: '리서치', href: 'reports.html', desc: '리포트를 근거로 질문에 답변', kw: /Q\s?&?\s?A|질문|물어|문의/i }
  ];
  // 고객 구분 — Q1에서 한 번만 나뉘고, 구분마다 ②③ 보기와 라운지 구성이 다르다
  var SEGMENTS = {
    fin: { label: '금융사', kw: /금융|운용|자문|일임|보험|은행|증권|연기금|공제|캐피탈/,
      identity: { title: '어떤 금융사인가요?', options: [
        { label: '자산운용사', kw: /운용사|자산운용/ }, { label: '투자자문·일임사', kw: /자문|일임/ },
        { label: '보험·연기금·공제회', kw: /보험|연기금|연금|공제/ }, { label: '은행·증권·캐피탈', kw: /은행|증권|캐피탈/ }] },
      purpose: { title: '리서치는 어디에 쓰세요?', hint: '운용 규모도 함께 적어 주시면 더 정확해요', options: [
        { label: '고객 자산 운용', desc: '펀드 · 일임', kw: /고객|펀드|일임|위탁/ }, { label: '고유자산 운용', desc: '자기자본 · 본부 운용', kw: /고유|자기자본|본부/ },
        { label: '리서치 소싱', desc: '투자위원회 · 내부 보고', kw: /소싱|위원회|리서치/ }] } },
    newfin: { label: '신생 운용사·자문사', kw: /신생|신규|설립|스타트업|소형/,
      identity: { title: '어떤 곳인가요?', options: [
        { label: '신생 자산운용사', kw: /운용/ }, { label: '신생 투자자문·일임사', kw: /자문|일임/ }, { label: '신기술·벤처 투자사', kw: /신기술|벤처|VC/i }] },
      purpose: { title: '리서치는 어디에 쓰세요?', hint: '운용 규모도 함께 적어 주시면 더 정확해요', options: [
        { label: '고객 자산 운용', desc: '펀드 · 일임', kw: /고객|펀드|일임|위탁/ }, { label: '고유자산 운용', desc: '자기자본 운용', kw: /고유|자기자본/ },
        { label: '리서치 체계 만들기', desc: '내부 리서치 인력이 부족해요', kw: /체계|인력|부족|만들/ }] } },
    listed: { label: '상장 법인', kw: /상장|공시|코스피|코스닥|외감/,
      identity: { title: '업종을 알려 주세요', options: [
        { label: '제조', kw: /제조|공장|부품/ }, { label: 'IT·플랫폼', kw: /IT|플랫폼|소프트웨어|인터넷/i },
        { label: '바이오·헬스케어', kw: /바이오|제약|헬스/ }, { label: '소비재·유통', kw: /소비|유통|리테일/ }, { label: '기타', kw: /기타/ }] },
      purpose: { title: '리서치를 어떤 목적으로 쓰실 건가요?', hint: '여유자금 규모가 있다면 함께 알려 주세요', options: [
        { label: '여유자금 운용', kw: /여유|자금|운용|굴리/ }, { label: 'IR · 자본시장 소통', desc: '기관 투자자 접점', kw: /IR|자본시장|주주|소통/i },
        { label: '산업 · 경쟁사 동향', kw: /동향|경쟁|업황|산업/ }] } },
    corp: { label: '일반 법인', kw: /법인|회사|기업|비상장|중소/,
      identity: { title: '업종을 알려 주세요', options: [
        { label: '제조', kw: /제조|공장|부품/ }, { label: 'IT·플랫폼', kw: /IT|플랫폼|소프트웨어/i },
        { label: '건설·부동산', kw: /건설|부동산|시행/ }, { label: '소비재·유통', kw: /소비|유통|리테일/ }, { label: '기타', kw: /기타/ }] },
      purpose: { title: '회사 자금은 어떤 목적으로 운용하세요?', hint: '대략적인 규모도 함께 알려 주세요', options: [
        { label: '여유자금 운용', kw: /여유|자금|운용|굴리/ }, { label: '업황 · 거시 점검', kw: /업황|거시|경기|점검/ },
        { label: '향후 상장 준비', desc: 'IPO', kw: /상장|IPO|공모/i }] } },
    pro: { label: '전문투자자', kw: /전문투자자|DMA|트레이더|전업/i,
      identity: { title: '어떤 방식으로 투자하세요?', options: [
        { label: 'DMA 직접 주문', desc: '전문투자자 등록', kw: /DMA|직접|주문|API/i }, { label: '법인 대표 개인 투자', kw: /대표|오너|법인/ },
        { label: '전업 투자', kw: /전업|트레이딩|매매/ }] },
      purpose: { title: '리서치에서 가장 필요한 건요?', hint: '운용 자산 규모도 함께 적어 주셔도 돼요', options: [
        { label: '매매 아이디어', kw: /매매|아이디어|단기|타이밍/ }, { label: '중장기 포트폴리오', kw: /중장기|포트|장기/ },
        { label: '해외 · 환율 대응', kw: /해외|환율|미국|달러/ }] } },
    wm: { label: 'WM 고객', kw: /WM|PB|개인|자산가|VIP/i,
      identity: { title: '어떤 분이신가요?', hint: '가장 가까운 걸 골라 주세요', options: [
        { label: '기업 오너·임원', kw: /오너|대표|임원|창업/ }, { label: '전문직', kw: /의사|변호사|회계사|전문직/ },
        { label: '자산 승계 준비', kw: /승계|증여|상속|가족/ }, { label: '은퇴 준비', kw: /은퇴|노후|연금/ }] },
      purpose: { title: '자산 운용에서 가장 중요한 건요?', hint: '운용 자산 규모도 함께 알려 주셔도 돼요', options: [
        { label: '자산 증식', kw: /증식|성장|수익/ }, { label: '안정적 인컴', kw: /인컴|배당|이자|안정/ }, { label: '승계 · 절세', kw: /승계|절세|세금|증여|상속/ }] } }
  };
  // Q1 — 공시 대상 기업인지(분기의 시작)
  var Q1 = { title: '공시 대상 기업인가요?', hint: '상장사 · 금융사는 대부분 공시 대상이에요', options: [
    { label: '네, 공시 기업이에요', desc: '법인명으로 공시 정보를 찾아 채울게요', act: 'disc' },
    { label: '아니요, 비공시 법인이에요', desc: '신생 운용사 · 자문사, 일반 법인', act: 'nodisc' },
    { label: '개인 투자자예요', desc: '전문투자자 · WM 고객', act: 'person' }] };
  var PICK = { disc: ['fin', 'listed'], nodisc: ['newfin', 'corp'], person: ['pro', 'wm'] };
  // ⑤ 심화 — ④에서 고른 서비스(첫 번째)에 따라
  var DEEP = {
    seminar: { title: function (s) { return (s.sectors[0] || '관심 섹터') + ' 세미나, 어떤 형태가 좋으세요?'; }, hint: '얼마나 자주 듣고 싶은지도 적어 주세요',
      options: [{ label: '오프라인 소규모', kw: /오프라인|대면|소규모/ }, { label: '온라인 웨비나', kw: /온라인|웨비나|줌|zoom/i }, { label: '애널리스트 1:1 콜', kw: /1:1|콜|개별|전화/ }] },
    corpday: { title: function () { return '콥데이에서 누구를 만나고 싶으세요?'; }, hint: '기업명을 직접 적어 주셔도 돼요', free: true,
      options: [{ label: '관심 섹터 대표 기업', kw: /대표|대형|주요/ }, { label: '중소형 성장 기업', kw: /중소|성장|스몰/ }, { label: '아직 정하지 않았어요', kw: /아직|미정|모르/ }] },
    ndr: { title: function () { return 'NDR · 탐방, 어떤 방식이 편하세요?'; }, hint: '희망 기업이 있으면 적어 주세요', free: true,
      options: [{ label: '1:1 미팅', kw: /1:1|단독|개별/ }, { label: '소그룹 미팅', kw: /소그룹|그룹|여럿/ }, { label: '현장 탐방', kw: /현장|공장|방문/ }] },
    conf: { title: function () { return '컨퍼런스에서 듣고 싶은 주제는요?'; },
      options: [{ label: '내년 산업 전망', kw: /전망|내년|산업/ }, { label: 'AI 밸류체인', kw: /AI|밸류체인/i }, { label: '자산배분 전략', kw: /자산배분|전략|포트/ }] },
    indepth: { title: function () { return '리포트는 어떻게 받아 보실래요?'; },
      options: [{ label: '발간 즉시 알림', kw: /즉시|바로|알림/ }, { label: '주간 모아 보기', kw: /주간|매주|모아/ }, { label: '회의용 요약본', kw: /요약|회의|브리핑/ }] },
    cardnews: { title: function () { return '카드뉴스는 누구와 보세요?'; },
      options: [{ label: '내부 보고용', kw: /내부|보고|경영진/ }, { label: '고객 전달용', kw: /고객|전달|설명/ }, { label: '혼자 빠르게 확인', kw: /혼자|개인|빠르/ }] },
    qa: { title: function () { return 'Q&A로 주로 무엇을 확인하세요?'; },
      options: [{ label: '실적 · 이익 전망', kw: /실적|이익|어닝/ }, { label: '업황 · 수급', kw: /업황|수급|사이클/ }, { label: '밸류에이션 근거', kw: /밸류|가치|목표/ }] }
  };
  var ADMIN_BASE = { corpday: 3, indepth: 3, seminar: 2, cardnews: 2, qa: 2, conf: 1, ndr: 1 };

  var FLOW = {
    version: '2026-10-29b',
    slots: [
      { id: 'name', no: '0', label: '호칭', how: 'Q0 — 뭐라고 불러 드릴까요?' },
      { id: 'segment', no: '①', label: '고객 구분', how: 'Q1 공시 대상 여부(공시 / 비공시 법인 / 개인) → 법인명 → 공시 DB 조회 · 없으면 선택 (분기는 여기서 한 번)' },
      { id: 'identity', no: '②', label: '고객 정체성', how: '금융사 종류 · 업종 · 투자 방식 (DB에 있으면 묻지 않음)' },
      { id: 'scale', no: '③', label: '운용 규모', how: '공시 · DB 값 우선, 없으면 ③ 질문의 자유 입력에서 추출' },
      { id: 'purpose', no: '③', label: '운용 목적', how: '구분별 보기 3개' },
      { id: 'sectors', no: '④', label: '관심 분야', how: 'DB 업종 · 보유 섹터 우선, 없으면 질문' },
      { id: 'services', no: '④', label: '원하는 서비스', how: '지금 열린 행사 · 최근 인뎁스 리포트로 유도' },
      { id: 'deep', no: '⑤', label: '심화', how: '④에서 고른 서비스별 질문' },
      { id: 'contact', no: '✓', label: '이름 · 회사 메일', how: '가입 신청 → 승인 대기 (시연은 "시연 모드로 보기")' }
    ],
    q1: Q1, segments: SEGMENTS, sectors: SECTORS, services: SERVICES, deep: DEEP, adminBase: ADMIN_BASE
  };
  window.IL_SIGNUP_FLOW = FLOW;

  /* ================= 데이터 조회 ================= */
  var cfg = window.IL_CONFIG || {};
  function rest(path) {
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return Promise.resolve(null);
    var ctl = window.AbortController ? new AbortController() : null, t = ctl && setTimeout(function () { ctl.abort(); }, 8000);
    return fetch(cfg.supabaseUrl + '/rest/v1/' + path, { headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + cfg.supabaseAnonKey }, signal: ctl && ctl.signal })
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
      .then(function (j) { if (t) clearTimeout(t); return j; });
  }
  var FIN_SECTOR = /은행|증권|보험|금융|캐피탈|지주|카드/;
  var bucketSmall = function (b) { return b === '100억 미만' || b === '100억~1,000억'; };
  // 실제 기업 DB(corp_directory · DART 기업개황)를 먼저 보고, 없으면 시연용 가상 스냅샷 → 상장사 DB 순서
  var CORP_COLS = 'name,type,kind,industry,founded,market,stock_code,aum,aum_bucket,sectors,assets_eok';
  function corpLookup(q) {
    if (q.length < 2) return Promise.resolve(null);
    return rest('corp_directory?select=' + CORP_COLS + '&name_key=eq.' + encodeURIComponent(q) + '&limit=1').then(function (rows) {
      if (rows && rows.length) return rows[0];
      return rest('corp_directory?select=' + CORP_COLS + '&search_key=ilike.*' + encodeURIComponent(q.toLowerCase()) + '*&limit=8').then(function (r2) {
        if (!r2 || !r2.length) return null;
        return r2.filter(function (r) { return r.name === q; })[0] || r2.sort(function (a, b) { return a.name.length - b.name.length; })[0];
      });
    }).then(function (c) {
      if (!c) return null;
      var finType = c.type !== '일반 법인';
      var seg = !finType ? (c.stock_code ? 'listed' : 'corp') : (c.founded >= 2019 || bucketSmall(c.aum_bucket)) ? 'newfin' : 'fin';
      var idMap = seg === 'newfin' ? { '자산운용사': '신생 자산운용사', '투자자문사': '신생 투자자문·일임사' } : { '자산운용사': '자산운용사', '투자자문사': '투자자문·일임사', '연기금·보험·은행': /보험|연기금|공제/.test(c.kind || '') ? '보험·연기금·공제회' : '은행·증권·캐피탈' };
      var sectors = (c.sectors || []).filter(function (x) { return SECTORS.some(function (s) { return s.label === x; }); });
      var eok = c.assets_eok, size = c.aum || (eok ? '자산 약 ' + (eok >= 10000 ? (Math.round(eok / 1000) / 10).toLocaleString('ko-KR') + '조 원' : Math.round(eok).toLocaleString('ko-KR') + '억 원') : null);
      return { name: c.name, src: 'DART 기업개황 · 기업 DB', segment: seg, identity: finType ? (idMap[c.type] || null) : (c.industry || null),
        scale: c.aum || null, sectors: sectors,
        facts: [['구분', SEGMENTS[seg].label + (c.market ? ' · ' + c.market : '')], ['업종', c.industry || c.kind || '-'], ['설립', c.founded ? c.founded + '년' : '-'], [finType ? '운용 규모' : '규모', size || '공시에 없음 · 대화로 확인']] };
    });
  }
  function lookup(name) {
    var q = String(name || '').replace(/\(가상\)|㈜|\(주\)|주식회사|\s/g, '');
    return corpLookup(q).then(function (real) { return real || lookupDemo(q); });
  }
  function lookupDemo(q) {
    var D = window.IL_DISCLOSURE, v = D && D.lookup(q);
    if (v) {
      var finType = v.type !== '일반 법인';
      // 설립 5년 안팎 · 소규모 금융사는 '신생 운용사·자문사'로 본다
      var seg = !finType ? 'corp' : (v.founded >= 2019 || bucketSmall(v.aumBucket)) ? 'newfin' : 'fin';
      var idMap = seg === 'newfin' ? { '자산운용사': '신생 자산운용사', '투자자문사': '신생 투자자문·일임사' } : { '자산운용사': '자산운용사', '투자자문사': '투자자문·일임사', '연기금·보험·은행': '보험·연기금·공제회' };
      return Promise.resolve({ name: v.name, src: 'DART 공시 스냅샷(가상)', segment: seg, identity: idMap[v.type] || null,
        scale: v.aum, sectors: v.sectors.slice(), virtual: true,
        facts: [['구분', SEGMENTS[seg].label], ['운용 규모', v.aum || '공시 없음'], ['설립', v.founded + '년'], ['공시상 섹터', v.sectors.join(' · ') || '공시 없음']] });
    }
    if (q.length < 2) return Promise.resolve(null);
    return rest('stocks?select=code,name,sector,market,market_cap_bil&name=ilike.*' + encodeURIComponent(q) + '*&limit=8').then(function (rows) {
      if (!rows || !rows.length) return null;
      var hit = rows.filter(function (r) { return r.name === q; })[0] || rows.sort(function (a, b) { return a.name.length - b.name.length; })[0];
      var fin = FIN_SECTOR.test(hit.sector || '');
      var b = hit.market_cap_bil, mcap = b ? '시가총액 약 ' + (b >= 10000 ? (Math.round(b / 1000) / 10).toLocaleString('ko-KR') + '조 원' : Math.round(b).toLocaleString('ko-KR') + '억 원') : null;
      var sec = SECTORS.filter(function (s) { return s.kw.test(hit.sector || ''); }).map(function (s) { return s.label; });
      return rest('events?select=name,kind,detail,ref_date&name=eq.' + encodeURIComponent(hit.name) + '&order=ref_date.desc&limit=1').then(function (ev) {
        var issue = ev && ev[0] ? ev[0].ref_date + ' · ' + String(ev[0].detail || '').slice(0, 48) : null;
        return { name: hit.name, src: 'Supabase 상장사 DB', segment: fin ? 'fin' : 'listed',
          identity: fin ? '은행·증권·캐피탈' : (hit.sector || null), scale: mcap, sectors: sec,
          facts: [['구분', (fin ? '금융사' : '상장 법인') + ' · ' + (hit.market || '상장')], ['업종', hit.sector || '-'], ['규모', mcap || '-'], ['최근 공시', issue || '최근 이벤트 없음']] };
      });
    });
  }

  /* ================= Gemini (서버 함수 /api/yuri — 키는 서버에만) ================= */
  var aiState = { ok: null };
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
      .catch(function () { return null; })
      .finally(function () { if (t) clearTimeout(t); });
  }

  /* ================= 엔진 ================= */
  var FREE_MAIL = /@(gmail|naver|daum|hanmail|kakao|nate|hotmail|outlook|yahoo|icloud)\./i;
  var STEP_LABEL = { q0: '호칭', q1: '① 고객 구분', q1name: '① 고객 구분', segment: '① 고객 구분', identity: '② 고객 정체성', purpose: '③ 운용 규모·목적',
    sectors: '④ 관심 분야', services: '④ 원하는 서비스', deep: '⑤ 심화', contact: '가입 신청' };
  var ORDER = ['q0', 'q1', 'q1name', 'segment', 'identity', 'purpose', 'sectors', 'services', 'deep', 'contact'];

  function create() {
    var st = { name: '', company: '', branch: null, db: null, email: '',
      slots: { segment: null, identity: null, scale: null, purpose: null, sectors: [], services: [], deep: null },
      src: {}, freq: null, asked: 0, retries: 0, cur: null, phase: 'q0', added: null };
    var reportsP = rest('reports?select=id,title,category,company,published_at&order=published_at.desc&limit=150').then(function (r) { return r || []; });
    var filled = function (id) { var v = st.slots[id]; return Array.isArray(v) ? v.length > 0 : !!v; };
    var set = function (id, v, src) { st.slots[id] = v; st.src[id] = src; };
    var labelsOf = function (opts) { return opts.map(function (o) { return o.label; }); };
    var svcLabel = function (id) { return (SERVICES.filter(function (s) { return s.id === id; })[0] || {}).label || id; };
    var SLOT_LABEL = { identity: '고객 정체성', scale: '운용 규모', purpose: '운용 목적', sectors: '관심 분야', services: '원하는 서비스' };

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
        if (k === 'sectors' && filled(k)) {
          // 방금 말한 섹터를 앞에 — ⑤ 심화 · 인뎁스 추천의 기준
          var add = v.filter(function (x) { return st.slots.sectors.indexOf(x) < 0; });
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

    // 다음 질문 — {slot, title, hint, options[{label, desc}], multi, input, form}
    function node() {
      var s = st.slots, seg = s.segment && SEGMENTS[s.segment];
      if (st.phase === 'q0') return { slot: 'q0', title: '반가워요, 유리예요. 뭐라고 불러 드릴까요?', hint: '닉네임도 괜찮아요', options: [], input: '이름 또는 닉네임', base: true };
      if (st.phase === 'q1') return { slot: 'q1', title: Q1.title, hint: Q1.hint, options: Q1.options, base: true };
      if (st.phase === 'q1name') return { slot: 'q1name', title: '법인명을 알려 주세요', hint: st.branch === 'disc' ? '공시로 확인되는 정보는 다시 묻지 않을게요' : '등록된 정보가 있으면 먼저 채워 드릴게요',
        options: (st.branch === 'disc' ? [{ label: '유진자산운용', desc: '공시 기업 예시 · 실제 기업 DB 조회' }] : [{ label: 'A자문사', desc: '예시 · 가상 신생 자문사' }, { label: 'B법인', desc: '예시 · 가상 일반 법인' }]),
        input: '법인명', base: true };
      if (!s.segment) {
        var keys = PICK[st.branch] || Object.keys(SEGMENTS);
        return { slot: 'segment', title: st.branch === 'person' ? '어느 쪽에 가까우세요?' : '어떤 법인인가요?',
          hint: st.company && st.branch !== 'person' ? '‘' + st.company + '’은(는) 등록된 정보가 없어요' : '',
          options: keys.map(function (k) { return { label: SEGMENTS[k].label, key: k, kw: SEGMENTS[k].kw }; }), base: true };
      }
      if (!filled('identity')) return { slot: 'identity', title: seg.identity.title, hint: seg.identity.hint || '', options: seg.identity.options };
      if (!filled('purpose')) return { slot: 'purpose', title: seg.purpose.title, hint: filled('scale') ? '' : seg.purpose.hint, options: seg.purpose.options };
      if (!filled('sectors')) return { slot: 'sectors', multi: true, title: '요즘 관심 있는 분야는요?', hint: '"바이오 쪽 세미나 자주 듣고 싶어요"처럼 적어도 돼요', options: SECTORS };
      if (!filled('services')) return { slot: 'services', multi: true, title: '어떤 서비스가 필요하세요?', hint: '여러 개 골라도 돼요', options: SERVICES, offer: true };
      if (!s.deep) { var d = DEEP[s.services[0]] || DEEP.indepth; return { slot: 'deep', title: d.title(s), hint: d.hint || '', options: d.options, free: d.free }; }
      if (!st.email) return { slot: 'contact', title: '마지막으로 가입 정보를 알려 주세요', hint: '승인 결과를 회사 메일로 알려 드려요', options: [], form: true, base: true };
      return null;
    }
    // ④ — 지금 열린 행사 · 관심 섹터의 최근 리포트
    function offerings() {
      var E = window.IL_EVENTS, ev = [];
      if (E) ev = E.EVENTS.filter(function (e) { return !E.isPast(e) && E.status(e).key !== 'closed'; })
        .sort(function (a, b) { return String(a.start).localeCompare(String(b.start)); }).slice(0, 2)
        .map(function (e) { return { title: e.title, when: e.tba ? '일정 미확정' : E.md(e.start) }; });
      return reportsP.then(function (rs) {
        var secs = st.slots.sectors;
        var rp = rs.filter(function (r) { return secs.some(function (x) { var k = SECTORS.filter(function (s) { return s.label === x; })[0]; return k && k.kw.test([r.title, r.category, r.company].join(' ')); }); })[0] || null;
        return { events: ev, report: rp && { id: rp.id, title: rp.title, date: rp.published_at, sector: secs[0] } };
      });
    }

    var api = {
      FLOW: FLOW,
      next: function () {
        var n = node();
        st.cur = n; st.retries = 0;
        if (!n) return Promise.resolve(null);
        if (n.slot !== 'q0') st.asked++;
        var pre = n.offer ? offerings().then(function (o) { n.offers = o; }) : Promise.resolve();
        return pre.then(function () {
          if (n.base) return n;
          return ai('ask', { slot: n.slot, title: n.title, hint: n.hint, options: labelsOf(n.options), profile: api.profile(), offers: n.offers || null }).then(function (j) {
            if (j && j.title && j.title.length <= 40) { n.title = j.title; n.hint = (j.hint || '').slice(0, 60); n.byAi = true; }
            return n;
          });
        });
      },
      current: function () { return st.cur; },
      stepLabel: function () { return st.cur ? STEP_LABEL[st.cur.slot] : '가입 신청 완료'; },
      stepRatio: function () { return st.cur ? (ORDER.indexOf(st.cur.slot) + 1) / ORDER.length : 1; },
      name: function () { return st.name; },
      // 답 받기 → {notes:[], retry?, card?, error?}
      answer: function (text, picks, act) {
        var n = st.cur, notes = [];
        text = String(text || '').trim();
        if (!n) return Promise.resolve({ notes: notes });
        if (n.slot === 'q0') { st.name = (text || '고객').slice(0, 12); st.phase = 'q1'; return Promise.resolve({ notes: [st.name + '님, 반가워요. 몇 가지만 여쭤볼게요.'] }); }
        if (n.slot === 'q1') {
          var a = act || (Q1.options.filter(function (o) { return o.label === text; })[0] || {}).act;
          if (!a) { if (/개인|WM|PB|전문/i.test(text)) a = 'person'; else if (/아니|비공시|비상장/.test(text)) a = 'nodisc'; else if (/네|예|공시|상장/.test(text)) a = 'disc'; }
          if (!a) return Promise.resolve({ notes: notes, retry: '아래에서 골라 주세요.' });
          st.branch = a; st.phase = a === 'person' ? 'go' : 'q1name';
          return Promise.resolve({ notes: notes });
        }
        if (n.slot === 'q1name') {
          if (!text) return Promise.resolve({ notes: notes, retry: '법인명을 적어 주세요.' });
          st.company = text; st.phase = 'go';
          return lookup(text).then(function (db) {
            if (!db) return { notes: [] };
            st.db = db; st.company = db.name;
            set('segment', db.segment, 'DB');
            if (db.identity) set('identity', db.identity, 'DB');
            if (db.scale) set('scale', db.scale, 'DB');
            if (db.sectors.length) set('sectors', db.sectors, 'DB');
            var known = ['identity', 'scale', 'sectors'].filter(filled).length + 1;
            return { card: db, notes: ['공시 · DB로 ' + known + '가지를 채웠어요.\n나머지만 짧게 여쭤볼게요.'] };
          });
        }
        if (n.slot === 'contact') return Promise.resolve({ notes: notes });

        var chosen = (picks || []).map(function (i) { return n.options[i]; }).filter(Boolean);
        if (n.slot === 'segment' && chosen[0]) set('segment', chosen[0].key, '대화');
        else if (n.slot === 'services' && chosen.length) set('services', chosen.map(function (o) { return o.id; }), '대화');
        else if (n.slot === 'sectors' && chosen.length) set('sectors', labelsOf(chosen), '대화');
        else if (n.slot === 'deep' && chosen[0]) st.slots.deep = chosen[0].label;
        else if (chosen[0]) set(n.slot, chosen[0].label, '대화');
        if (n.slot === 'segment' && !st.slots.segment && text) {
          var sk = (PICK[st.branch] || Object.keys(SEGMENTS)).filter(function (k) { return SEGMENTS[k].kw.test(text); })[0];
          if (sk) set('segment', sk, '대화');
        }
        if (n.slot === 'deep' && !st.slots.deep && text) {
          var dk = n.options.filter(function (o) { return o.kw.test(text); })[0];
          st.slots.deep = dk ? dk.label : (n.free ? text.slice(0, 40) : null);
        }
        // 칩만 눌렀으면 추출하지 않는다(보기 이름의 낱말이 다른 슬롯을 잘못 채우지 않게)
        var typed = text && !(chosen.length && text === labelsOf(chosen).join(', '));
        if (!typed) text = '';
        st.added = null;
        var before = {};
        Object.keys(st.slots).forEach(function (k) { before[k] = filled(k); });
        var rules = text ? extractRules(text) : {};
        if (!chosen.length && n.slot !== 'deep' && rules[n.slot]) { var one = {}; one[n.slot] = rules[n.slot]; merge(one, '대화', false); }
        merge(rules, '대화', true);
        var aiP = text && text.length > 3 && st.slots.segment ? ai('extract', { text: text, segment: st.slots.segment,
          schema: { identity: labelsOf(SEGMENTS[st.slots.segment].identity.options), purpose: labelsOf(SEGMENTS[st.slots.segment].purpose.options),
            sectors: labelsOf(SECTORS), services: SERVICES.map(function (s) { return s.id + ':' + s.label; }) } }) : Promise.resolve(null);
        return aiP.then(function (j) {
          if (j && j.slots) {
            var f = j.slots, clean = {}, segO = SEGMENTS[st.slots.segment];
            if (f.identity && labelsOf(segO.identity.options).indexOf(f.identity) > -1) clean.identity = f.identity;
            if (f.purpose && labelsOf(segO.purpose.options).indexOf(f.purpose) > -1) clean.purpose = f.purpose;
            if (Array.isArray(f.sectors)) clean.sectors = f.sectors.filter(function (x) { return labelsOf(SECTORS).indexOf(x) > -1; });
            if (Array.isArray(f.services)) clean.services = f.services.filter(function (x) { return SERVICES.some(function (s) { return s.id === x; }); });
            if (f.scale) clean.scale = String(f.scale).slice(0, 30);
            if (f.freq) clean.freq = '자주';
            if (merge(clean, 'AI', true).length) st.aiFilled = true;
          }
          var extra = ['identity', 'scale', 'purpose', 'sectors', 'services'].filter(function (k) { return k !== n.slot && ((!before[k] && filled(k)) || (k === 'sectors' && st.added)); });
          if (extra.length) notes.push(extra.map(function (k) {
            var v = k === 'sectors' && before[k] && st.added ? st.added : st.slots[k];
            return SLOT_LABEL[k] + ' ‘' + (k === 'services' ? v.map(svcLabel).join(', ') : Array.isArray(v) ? v.join(', ') : v) + '’';
          }).join('\n') + '\n함께 채웠어요.' + (extra.some(function (k) { return !before[k]; }) ? ' 그 질문은 건너뛸게요.' : ''));
          var ok = n.slot === 'deep' ? !!st.slots.deep : n.slot === 'segment' ? !!st.slots.segment : filled(n.slot);
          if (!ok) {
            st.retries++;
            if (st.retries >= 2 && n.slot === 'deep') { st.slots.deep = '추후 상담'; return { notes: notes }; }
            return { notes: notes, retry: st.retries < 2 ? '잘 이해했는지 모르겠어요.\n아래에서 골라 주시거나 조금 더 구체적으로 적어 주세요.' : '아래 보기 중 가장 가까운 걸 골라 주세요.' };
          }
          return { notes: notes };
        });
      },
      // 마지막 — 이름 · 회사 메일 (법인은 개인 메일 도메인을 받지 않는다)
      contact: function (name, email) {
        name = String(name || '').trim(); email = String(email || '').trim();
        if (!name) return { error: '이름을 적어 주세요.' };
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: '메일 주소 형식을 확인해 주세요.' };
        var person = st.slots.segment === 'wm' || st.slots.segment === 'pro';
        if (!person && FREE_MAIL.test(email)) return { error: '회사 메일 주소로 적어 주세요. (개인 메일 도메인은 받을 수 없어요)' };
        st.name = name.slice(0, 20); st.email = email.slice(0, 80);
        return { ok: true };
      },
      profile: function () {
        var s = st.slots;
        return { company: st.company, segment: s.segment && SEGMENTS[s.segment].label, cls: s.segment, identity: s.identity, scale: s.scale, purpose: s.purpose,
          sectors: s.sectors, services: s.services.map(svcLabel), deep: s.deep, freq: st.freq, src: st.src };
      },
      result: function () {
        var s = st.slots, score = {}, why = {};
        Object.keys(ADMIN_BASE).forEach(function (k) { score[k] = ADMIN_BASE[k]; why[k] = []; });
        var add = function (k, v, r) { score[k] += v; if (r && why[k].indexOf(r) < 0) why[k].push(r); };
        s.services.forEach(function (id, i) { add(id, 5 - i, '‘' + svcLabel(id) + '’을(를) 원하셨어요'); });
        if (st.freq && s.services.indexOf('seminar') > -1) add('seminar', 2, '세미나를 자주 듣고 싶다고 하셨어요');
        if (s.sectors.length) add('indepth', 1, s.sectors.slice(0, 2).join(' · ') + ' 관심');
        if (s.sectors.some(function (x) { return /반도체|AI/.test(x); })) add('conf', 1, 'AI · 반도체 관심');
        if (s.segment === 'fin') { add('corpday', 1, '금융사 · 경영진 접점'); add('ndr', 1); }
        if (s.segment === 'newfin') { add('indepth', 1, '신생사 · 리서치 보강'); add('seminar', 1, '신생사 · 애널리스트 접점'); }
        if (s.segment === 'listed') add('ndr', 1, 'IR · 기관 접점');
        if (s.segment === 'corp' || s.segment === 'wm' || s.segment === 'pro') { add('cardnews', 1, '핵심 위주 확인'); add('qa', 1); score.ndr -= 1; }
        if (s.purpose && /IR/.test(s.purpose)) add('ndr', 2, 'IR · 자본시장 소통 목적');
        if (s.purpose && /고객/.test(s.purpose)) add('cardnews', 1, '고객 설명용 자료');
        if (s.deep && /1:1|미팅/.test(s.deep)) add('ndr', 1, s.deep);
        var rank = function (sc) { return Object.keys(sc).sort(function (a, b) { return sc[b] - sc[a] || ADMIN_BASE[b] - ADMIN_BASE[a]; }); };
        var admin = rank(ADMIN_BASE).slice(0, 4), mine = rank(score).slice(0, 4), sec = s.sectors[0];
        var items = mine.map(function (id) {
          var c = Object.assign({}, SERVICES.filter(function (x) { return x.id === id; })[0]);
          if (id === 'indepth' && sec) { c.href = 'reports.html?q=' + encodeURIComponent(sec.replace(/·.*/, '')); c.label = sec + ' 인뎁스 리포트'; }
          c.why = why[id].slice(0, 2); c.moved = admin.indexOf(id) < 0 ? 'new' : admin.indexOf(id) > mine.indexOf(id) ? 'up' : '';
          return c;
        });
        return { items: items, adminOrder: admin.map(svcLabel), changed: mine.filter(function (k, i) { return admin[i] !== k; }).length, ai: aiState.ok === true };
      },
      // 2장 세션 형식 + 프로필 · 추천 — 가입 신청 직후는 승인 대기(pending)
      session: function () {
        var s = st.slots, r = api.result(), seg = s.segment;
        var persona = seg === 'wm' ? 'hnw' : seg === 'pro' ? 'dma' : (seg === 'fin' || seg === 'newfin') ? (/운용/.test(s.identity || '') ? 'am' : /자문|일임/.test(s.identity || '') ? 'ia' : 'etc') : 'etc';
        var ses = { role: 'customer', name: st.name || '고객', seg: persona === 'hnw' ? 'WM' : '법인', cust_type: SEGMENTS[seg].label + (s.identity ? ' · ' + s.identity : ''),
          persona: persona, status: 'pending', via: 'email', email: st.email, profile: api.profile(),
          recs: r.items.map(function (c) { return { id: c.id, name: c.label, href: c.href, pillar: c.pillar, why: c.why }; }),
          onboarding: { by: 'yuri', ai: r.ai, at: new Date().toISOString() } };
        if (persona === 'hnw') ses.branch = '강남금융센터(가상)'; else if (st.company) ses.org = st.company + (st.db && st.db.virtual ? '(가상)' : '');
        return ses;
      }
    };
    return api;
  }
  window.YuriFlow = { create: create, FLOW: FLOW };
})();
