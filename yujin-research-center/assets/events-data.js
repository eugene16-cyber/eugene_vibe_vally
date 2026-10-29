// 행사 데이터 — window.IL_EVENTS = {CATS, EVENTS, TODAY, ...헬퍼} (9장 · 7-6)
// 2026 행사내역은 조직 지침에 따라 가상 기업 · 가상 이름으로 바꾼 예시 데이터예요(PLAN A-7).
// source: 'roster'(행사내역) | 'notice'(공지) | 'pattern'(반복 패턴으로 예상한 일정) | 없음(시연 예시)
(function () {
  'use strict';

  // KST 오늘 (YYYY-MM-DD)
  var TODAY = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

  var CATS = [
    { id: 'corp', label: 'Corporate Day', ko: '콥데이', color: '#0b2e6b', ink: '#fff', ed: 'QUARTERLY · IR', mk: 'Q.', foot: 'CORPORATE ACCESS',
      desc: '분기마다 열리는 기업 IR. 날짜별 A/B 세션으로 상장사 경영진을 소규모로 만나요.' },
    { id: 'ipo', label: 'IPO', ko: 'IPO·비상장 투자', color: '#1b74e4', ink: '#fff', ed: 'PRIMARY MARKET', mk: 'I.', foot: 'ROADSHOW',
      desc: '공모 기업 설명회·딜 로드쇼와 비상장기업 투자 · M&A 동향 설명회. IPO와 비상장 투자 시장을 함께 다뤄요.' },
    { id: 'earnings', label: 'Earnings Call', ko: '실적 콜', color: '#9e2f3b', ink: '#fff', ed: 'QUARTERLY RESULTS', mk: 'E.', foot: 'EARNINGS',
      desc: '분기 실적 발표 직후 담당 애널리스트의 리뷰 콜과 어닝 시즌 결산.' },
    { id: 'ndr', label: 'NDR', ko: 'NDR', color: '#eef3fa', ink: '#0b2e6b', ed: 'NON-DEAL ROADSHOW', mk: 'N.', foot: 'BY INVITATION',
      desc: '기업 IR팀이 기관을 직접 찾아가는 1:1·소그룹 미팅. 초청 기반이며 참여는 담당자 문의로 진행해요.' },
    { id: 'ai', label: 'AI Conference', ko: 'AI 컨퍼런스', color: '#17181b', ink: '#fff', ed: 'INDUSTRY OUTLOOK', mk: 'AI', foot: 'CONFERENCE',
      desc: 'AI 밸류체인과 다음 해 산업 전망을 다루는 리서치센터 대형 컨퍼런스.' },
    { id: 'wm', label: 'WM Seminar', ko: 'WM 세미나', color: '#cfe6fb', ink: '#0b2e6b', ed: 'WEALTH MANAGEMENT', mk: 'W.', foot: 'BRANCH · ONLINE',
      desc: '자산배분·절세·연금 전략을 다루는 WM 고객 대상 투자 세미나.' }
  ];

  var ELIG = { inst: '기관 투자자', corp: '상장 기업', wm: 'WM 고객' };

  // 매월 열린 M&A 동향 설명회 (행사내역)
  function mna(date, src) {
    return {
      id: 'mna-' + date.replace(/-/g, ''), cat: 'ipo', source: src || 'roster', title: 'M&A 동향 설명회', start: date,
      time: '', place: '', format: '', analysts: ['서지우'], elig: ['inst', 'corp'], cond: '', mode: src === 'pattern' ? 'tba' : 'roster',
      intro: '비상장기업 투자와 M&A 시장 흐름을 한 달 단위로 정리하는 정례 설명회예요.',
      tags: ['M&A', '비상장']
    };
  }

  var EVENTS = [
    /* ---------- 2026 행사내역 (가상화) ---------- */
    { id: 'corp-260122', cat: 'corp', source: 'roster', title: '가상 종합상사 A사 VIP 기업설명회', start: '2026-01-22', time: '', place: '', format: '',
      analysts: ['한도윤'], elig: ['inst'], cond: '', mode: 'roster', intro: '종합상사 A사(가상) 경영진이 사업 포트폴리오와 중장기 전략을 소개한 VIP 대상 설명회예요.' },
    { id: 'ipo-260122', cat: 'ipo', source: 'roster', title: '비상장기업 투자 및 M&A 동향 설명회', start: '2026-01-22', time: '', place: '', format: '',
      analysts: ['서지우'], elig: ['inst', 'corp'], cond: '', mode: 'roster', intro: '비상장기업 투자 시장과 M&A 흐름을 함께 정리한 연초 설명회예요.' },
    { id: 'wm-260206', cat: 'wm', source: 'roster', title: '토큰증권(STO) 오픈 세미나', start: '2026-02-06', time: '', place: '', format: '',
      analysts: ['정하린'], elig: ['wm'], cond: '', mode: 'roster', intro: '토큰증권 제도와 시장 구조를 WM 고객 눈높이로 풀어 본 세미나예요.' },
    mna('2026-02-26'),
    { id: 'ai-260310', cat: 'ai', source: 'roster', title: 'AI × BIO', start: '2026-03-10', time: '', place: '', format: '',
      analysts: ['서지우', '윤태오'], elig: ['inst', 'wm'], cond: '', mode: 'roster', intro: 'AI가 신약 개발·바이오 산업에 미치는 영향을 두 애널리스트가 함께 짚었어요.' },
    { id: 'corp-260316', cat: 'corp', source: 'roster', title: '1분기 온라인 콥데이', start: '2026-03-16', end: '2026-03-20', time: '', place: '온라인', format: '온라인',
      analysts: ['리서치센터'], elig: ['inst'], cond: '', mode: 'roster', intro: '닷새 동안 상장사 IR을 온라인으로 이어서 진행한 1분기 콥데이예요.' },
    mna('2026-03-26'),
    mna('2026-04-23'),
    { id: 'ai-260511', cat: 'ai', source: 'roster', title: '해외 운용사 협업 세미나', start: '2026-05-11', time: '', place: '', format: '',
      analysts: ['해외 협업 연사(가상)', '강서진', '오민재', '정하린'], elig: ['inst', 'wm'], cond: '', mode: 'roster',
      intro: '해외 ETF 운용사(가상)와 함께 글로벌 테마 투자 흐름을 다룬 협업 세미나예요.' },
    mna('2026-05-28'),
    { id: 'corp-260608', cat: 'corp', source: 'roster', title: '2분기 온라인 콥데이', start: '2026-06-08', end: '2026-06-11', time: '', place: '온라인', format: '온라인',
      analysts: ['리서치센터'], elig: ['inst'], cond: '', mode: 'roster', intro: '나흘 동안 진행한 2분기 온라인 콥데이예요.' },
    mna('2026-06-25'),
    mna('2026-07-23'),
    mna('2026-08-27'),
    { id: 'corp-260907', cat: 'corp', source: 'notice', title: '2026 3분기 Corporate Day', start: '2026-09-07', end: '2026-09-10',
      time: '09:30 · 10:30 · 13:30', place: '온라인 · Zoom', format: '온라인', analysts: ['리서치센터'], elig: ['inst'], cond: '기관 투자자 대상',
      mode: 'roster', intro: '날짜별로 A/B 두 기업이 같은 시간에 세션을 열고, 원하는 세션을 골라 들어가는 방식으로 진행했어요.',
      days: [
        { date: '2026-09-07', sessions: [['09:30', '가상 반도체부품 A사', '가상 양극재 B사'], ['10:30', '가상 백화점 C사', '가상 철강지주 D사'], ['13:30', '가상 화학지주 E사', '가상 콘텐츠 F사']] },
        { date: '2026-09-08', sessions: [['09:30', '가상 편의점 G사', '가상 전지소재 H사'], ['10:30', '가상 위성통신 I사', '가상 레저 J사'], ['13:30', '가상 IT서비스 K사', '가상 로봇 L사']] },
        { date: '2026-09-09', sessions: [['09:30', '가상 연료전지 M사', '가상 배터리재활용 N사'], ['10:30', '가상 방산 O사', '가상 유통 P사'], ['13:30', '가상 철강 Q사', '가상 항공우주 R사']] },
        { date: '2026-09-10', sessions: [['09:30', '가상 화학 S사', '가상 2차전지장비 T사'], ['10:30', '가상 건설 U사', '가상 IT서비스 V사'], ['13:30', '가상 반도체장비 W사', '가상 자동차부품 X사']] }
      ] },
    mna('2026-09-17'),
    { id: 'ai-260918', cat: 'ai', source: 'roster', title: 'From AI to AX: 금융권에 도입된 Agentic AI', start: '2026-09-18', time: '', place: '', format: '',
      analysts: ['이도현'], elig: ['inst', 'wm'], cond: '', mode: 'roster', intro: '금융권이 실제로 도입한 에이전트형 AI 사례와 업무 변화(AX)를 정리했어요.' },
    mna('2026-10-22'),

    /* ---------- 예정 (반복 패턴 · 일정 미확정) ---------- */
    mna('2026-11-26', 'pattern'),
    { id: 'corp-2612', cat: 'corp', source: 'pattern', title: '4분기 온라인 콥데이', start: '2026-12-01', tba: true, time: '', place: '온라인', format: '온라인',
      analysts: ['리서치센터'], elig: ['inst'], cond: '기관 투자자 대상', mode: 'tba',
      intro: '분기마다 열린 온라인 콥데이 패턴에 따라 12월 중 진행을 예상하고 있어요. 일정이 확정되면 관심 등록한 분께 먼저 안내해요.' },

    /* ---------- 시연 예시 ---------- */
    { id: 'ipo-261105', cat: 'ipo', title: 'IPO 기업설명회 · 2차전지 소재 A사', start: '2026-11-05', time: '15:00–16:30', place: '여의도 본사', format: '오프라인',
      analysts: ['서지우', '한도윤'], elig: ['inst'], cond: '기관 투자자 · 사전 신청자', mode: 'apply', deadline: '2026-11-03', cap: 40, seats: 9,
      intro: '상장을 앞둔 2차전지 소재 A사(가상)의 사업 구조와 공모 개요를 경영진이 직접 설명해요.',
      program: [['15:00', '회사 소개 · 사업 현황', 'A사 IR 담당'], ['15:40', '공모 구조와 자금 사용 계획', 'A사 CFO'], ['16:10', '질의응답', '서지우']],
      tags: ['IPO', '2차전지'] },
    { id: 'earn-261104', cat: 'earnings', title: '3분기 실적 리뷰 콜 · 반도체/IT', start: '2026-11-04', time: '16:30–17:10', place: '온라인 웹캐스트', format: '온라인',
      analysts: ['윤태오'], elig: ['inst'], cond: '기관 투자자', mode: 'apply', deadline: '2026-11-04', cap: 100, seats: 61,
      intro: '반도체·IT 주요 기업의 3분기 실적 발표 직후, 담당 애널리스트가 핵심 숫자와 체크포인트를 정리해요.', tags: ['실적', '반도체'] },
    { id: 'wm-261111', cat: 'wm', title: '2027 자산배분 전략 세미나', start: '2026-11-11', time: '14:00–15:30', place: '강남 WM센터', format: '오프라인',
      analysts: ['정하린'], elig: ['wm'], cond: 'WM 고객', mode: 'apply', deadline: '2026-11-09', cap: 60, seats: 8,
      intro: '내년 금리·환율 시나리오별 자산배분 방법을 사례 중심으로 살펴봐요.',
      program: [['14:00', '2027 매크로 시나리오', '정하린'], ['14:40', '시나리오별 자산배분 예시', '강서진'], ['15:10', '질의응답', '']],
      tags: ['자산배분'] },
    { id: 'earn-261113', cat: 'earnings', title: '3분기 어닝 시즌 결산 콜', start: '2026-11-13', time: '10:00–10:50', place: '온라인 웹캐스트', format: '온라인',
      analysts: ['리서치센터'], elig: ['inst'], cond: '기관 투자자', mode: 'apply', deadline: '2026-11-12', cap: 120, seats: 88,
      intro: '업종별 3분기 실적을 한 번에 돌아보고, 4분기에 확인할 지표를 정리해요.', tags: ['실적'] },
    { id: 'ndr-261117', cat: 'ndr', title: 'NDR · 가상 2차전지 소재 C사', start: '2026-11-17', end: '2026-11-18', time: '기관별 1시간', place: '방문 미팅', format: '1:1 · 소그룹',
      analysts: ['한도윤'], elig: ['inst'], cond: '초청 기관', mode: 'apply',
      intro: 'C사(가상) IR팀이 기관을 직접 방문하는 1:1·소그룹 미팅이에요. 초청 기반이라 참여는 담당자 문의로 진행해요.', tags: ['NDR'] },
    { id: 'ipo-261124', cat: 'ipo', title: 'IPO 딜 로드쇼 · AI 반도체 설계 B사', start: '2026-11-24', time: '10:00–11:00', place: '온라인', format: '온라인',
      analysts: ['윤태오'], elig: ['inst'], cond: '기관 투자자', mode: 'apply', deadline: '2026-11-21', cap: 80, seats: 52,
      intro: 'AI 반도체 설계 B사(가상)의 기술 로드맵과 공모 일정을 온라인으로 소개해요.', tags: ['IPO', 'AI 반도체'] },
    { id: 'wm-261126', cat: 'wm', title: '연말 절세·연금 전략 세미나', start: '2026-11-26', time: '19:00–20:00', place: '온라인', format: '온라인',
      analysts: ['정하린'], elig: ['wm'], cond: 'WM 고객', mode: 'apply', deadline: '2026-11-24', cap: 150, seats: 0,
      intro: '연말 전에 확인할 절세 계좌·연금 납입 체크리스트를 정리해요.', tags: ['절세', '연금'] },
    { id: 'ai-261203', cat: 'ai', title: '2027 AI 산업전망 컨퍼런스', start: '2026-12-03', time: '13:00–17:30', place: '여의도 컨퍼런스홀', format: '하이브리드',
      analysts: ['윤태오', '이도현', '서지우'], elig: ['inst', 'wm'], cond: '기관 · WM 고객', mode: 'apply', deadline: '2026-11-28', cap: 300, seats: 142,
      intro: 'AI 인프라·반도체·소프트웨어로 이어지는 밸류체인을 따라 2027년 산업 전망을 나눠요.',
      program: [['13:00', '개회 · 2027 AI 투자 사이클', '윤태오'], ['14:00', '전력·인프라 병목', '서지우'], ['15:10', '금융권 AX 사례', '이도현'], ['16:20', '패널 토론 · 질의응답', '']],
      tags: ['AI', '전망'] },
    { id: 'ndr-261208', cat: 'ndr', title: 'NDR · 가상 플랫폼 D사', start: '2026-12-08', time: '기관별 1시간', place: '방문 미팅', format: '1:1 · 소그룹',
      analysts: ['오민재'], elig: ['inst'], cond: '초청 기관', mode: 'apply',
      intro: '플랫폼 D사(가상) 경영진과의 소그룹 미팅이에요. 초청 기반이라 담당자 문의로 참여를 안내해요.', tags: ['NDR'] }
  ];

  /* ---------- 헬퍼 ---------- */
  var DOW = ['일', '월', '화', '수', '목', '금', '토'];
  var parse = function (d) { var p = d.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  var catOf = function (id) { return CATS.filter(function (c) { return c.id === id; })[0] || null; };
  var byId = function (id) { return EVENTS.filter(function (e) { return e.id === id; })[0] || null; };
  var lastDay = function (ev) { return ev.end || ev.start; };
  var isPast = function (ev) { return !ev.tba && lastDay(ev) < TODAY; };
  var isSample = function (ev) { return !ev.source; };
  var dow = function (d) { return DOW[parse(d).getDay()]; };
  // '11.05 (수)' · 기간이면 '09.07 (월) – 09.10 (목)' · 미확정이면 '12월 중'
  function dateLabel(ev, withYear) {
    var one = function (d) { var p = d.split('-'); return (withYear ? p[0] + '.' : '') + p[1] + '.' + p[2] + ' (' + dow(d) + ')'; };
    if (ev.tba) return (+ev.start.slice(5, 7)) + '월 중 · 일정 미확정';
    return ev.end ? one(ev.start) + ' – ' + one(ev.end) : one(ev.start);
  }
  // 상태 — 신청 여부는 화면에서 덧입힌다
  function status(ev) {
    if (isPast(ev)) return { key: 'done', label: '종료' };
    if (ev.tba || ev.mode === 'tba') return { key: 'tba', label: '일정 미확정' };
    if (ev.cat === 'ndr') return { key: 'invite', label: '초청 기반' };
    if (ev.mode !== 'apply') return { key: 'planned', label: '예정' };
    if (ev.seats === 0 || (ev.deadline && ev.deadline < TODAY)) return { key: 'closed', label: '마감' };
    return { key: 'open', label: '신청 가능' };
  }

  window.IL_EVENTS = {
    CATS: CATS, EVENTS: EVENTS, TODAY: TODAY, ELIG: ELIG, DOW: DOW,
    catOf: catOf, byId: byId, isPast: isPast, isSample: isSample, dateLabel: dateLabel, status: status, parse: parse, dow: dow
  };
})();
