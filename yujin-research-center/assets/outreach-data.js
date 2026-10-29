// 신규 유입 발굴 데이터 — window.IL_OUTREACH_DATA (시연용 가상 데이터)
// 실제 회사 · 실제 담당자를 넣지 않는다(조직 지침 2 · 3). 메일 주소는 예약 도메인(.example)만 쓴다.
// day: 시연 시계에서 '발굴 엔진이 이 신호를 처음 잡는 날'. 0이면 처음부터 보인다.
(function () {
  'use strict';

  // 유입 경로(발굴 채널) — 엔진이 매일 훑는 곳. weight는 처음 우선순위, 성과(회신 · 유입)에 따라 자동으로 다시 매겨진다.
  var SOURCES = [
    { id: 'dart', label: 'DART 공시', desc: '신규 펀드 등록 · 대량보유 · 자기주식 취득 공시', weight: 1.0 },
    { id: 'fss', label: '금감원 신규 등록', desc: '자산운용사 · 투자자문사 신규 인가 · 등록', weight: 1.1 },
    { id: 'event', label: '행사 참석자', desc: '콥데이 · 컨퍼런스에 온 비고객 기관', weight: 1.2 },
    { id: 'web', label: '사이트 방문', desc: 'Insight Lab 리포트 · 카드뉴스를 본 회사 도메인', weight: 0.9 },
    { id: 'referral', label: '고객 소개', desc: '기존 고객사가 소개한 기관', weight: 1.3 },
    { id: 'hiring', label: '채용 공고', desc: '운용역 · 리서치 인력 채용 = 리서치 수요 신호', weight: 0.8 }
  ];

  var P = function (id, day, name, seg, kind, aum, founded, sectors, src, signal, contact) {
    return { id: id, day: day, name: name, seg: seg, kind: kind, aum: aum, founded: founded, sectors: sectors, src: src, signal: signal,
      contact: { name: contact[0], title: contact[1], email: contact[2] } };
  };

  var PROSPECTS = [
    P('p01', 0, '누리자산운용(가상)', 'newfin', '신생 자산운용사', '약 900억 원', 2024, ['반도체', 'AI 인프라'], 'fss',
      '2026-10 전문사모운용사 등록 · 첫 공모펀드 출시 준비', ['가상 담당자 A', 'CIO', 'cio@nuri-am.example']),
    P('p02', 0, '하람투자자문(가상)', 'newfin', '신생 투자자문사', '약 120억 원', 2023, ['배당·인컴', '금리·채권'], 'hiring',
      '리서치 애널리스트 채용 공고 2건 — 내부 리서치 인력 부족', ['가상 담당자 B', '대표', 'ceo@haram-ia.example']),
    P('p03', 0, '청람자산운용(가상)', 'fin', '자산운용사', '약 2.3조 원', 2011, ['2차전지', '자동차'], 'event',
      '2026 3분기 Corporate Day 2개 세션 참석(비고객)', ['가상 담당자 C', '주식운용본부장', 'equity@chungram-am.example']),
    P('p04', 0, '가온테크(가상)', 'listed', '상장 법인 · 반도체 장비', '여유자금 약 1,500억 원', 2006, ['반도체'], 'dart',
      '자기주식 취득 · 단기금융상품 운용 확대 공시', ['가상 담당자 D', 'IR팀장', 'ir@gaon-tech.example']),
    P('p05', 1, '바름공제회(가상)', 'fin', '공제회', '약 5.4조 원', 1994, ['금리·채권', '거시·시황'], 'referral',
      '기존 고객 새솔공제회(가상)가 소개 — 국내 주식 위탁 운용사 재선정 예정', ['가상 담당자 E', '투자전략팀장', 'strategy@bareum.example']),
    P('p06', 1, '미르바이오(가상)', 'listed', '상장 법인 · 바이오', '여유자금 약 600억 원', 2014, ['바이오'], 'web',
      '바이오 인뎁스 리포트 · 카드뉴스 5회 열람(회사 도메인)', ['가상 담당자 F', 'CFO', 'cfo@mir-bio.example']),
    P('p07', 2, '새벽파트너스(가상)', 'newfin', '신기술·벤처 투자사', '약 400억 원', 2022, ['AI 인프라', '조선·방산'], 'dart',
      '신기술투자조합 2호 결성 공시', ['가상 담당자 G', '파트너', 'partner@saebyeok.example']),
    P('p08', 2, '단비산업(가상)', 'corp', '일반 법인 · 제조', '여유자금 약 300억 원', 2001, ['자동차', '거시·시황'], 'event',
      'IPO · 비상장 투자 설명회 참석 — 향후 상장 검토', ['가상 담당자 H', '재무팀장', 'finance@danbi-ind.example']),
    P('p09', 3, '윤슬자산운용(가상)', 'fin', '자산운용사', '약 7,800억 원', 2016, ['반도체', '소비재·유통'], 'web',
      '반도체 섹터 리포트 · 퀀트 테마 로테이션 반복 방문', ['가상 담당자 I', '리서치팀장', 'research@yunseul-am.example']),
    P('p10', 3, '도담캐피탈(가상)', 'fin', '캐피탈', '약 1.1조 원', 2008, ['금융', '금리·채권'], 'hiring',
      '고유자산 운용역(주식) 채용 공고', ['가상 담당자 J', '자금운용부장', 'treasury@dodam-cap.example']),
    P('p11', 4, '나래로보틱스(가상)', 'listed', '상장 법인 · 로봇', '여유자금 약 250억 원', 2017, ['AI 인프라', '자동차'], 'dart',
      '최대주주 변경 · IR 강화 계획 공시', ['가상 담당자 K', 'IR 담당', 'ir@narae-robotics.example']),
    P('p12', 5, '한결투자자문(가상)', 'newfin', '신생 투자자문사', '약 60억 원', 2025, ['반도체', '2차전지'], 'fss',
      '2026-10 투자자문업 신규 등록', ['가상 담당자 L', '대표', 'ceo@hangyeol-ia.example']),
    P('p13', 6, '여울에너지(가상)', 'corp', '일반 법인 · 에너지', '여유자금 약 800억 원', 1999, ['AI 인프라', '금리·채권'], 'referral',
      '거래 법인이 소개 — 전력기기 업황 점검 수요', ['가상 담당자 M', '경영기획실장', 'planning@yeoul-energy.example']),
    P('p14', 7, '라온자산운용(가상)', 'fin', '자산운용사', '약 3,200억 원', 2019, ['조선·방산', '반도체'], 'event',
      'AI 컨퍼런스 참석 · 질의 2회', ['가상 담당자 N', '펀드매니저', 'pm@raon-am.example'])
  ];

  window.IL_OUTREACH_DATA = { SOURCES: SOURCES, PROSPECTS: PROSPECTS, NOTE: '시연용 가상 데이터 · 실제 회사 · 담당자 아님' };
})();
