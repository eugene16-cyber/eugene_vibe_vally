// 가입 상담용 공시 스냅샷 — window.IL_DISCLOSURE (시연용 가상 데이터)
// 실제 DART 조회는 서버(키 보관)가 있어야 해서, 시연에서는 가상 회사의 '공시로 알 수 있는 정보'만 미리 넣어 둔다.
// 공시로 알 수 있는 것: 기업 분류 · 운용(자금) 규모 · 설립연도 · 공시상 주요 보유 섹터. 투자 성향 · 관심 서비스는 공시에 없어 대화로 묻는다.
(function () {
  'use strict';
  var COMPANIES = [
    { name: '황소자산운용', alias: ['황소', '황소운용'], type: '자산운용사', aum: '약 1.2조 원', aumBucket: '1조 이상', founded: 2015,
      sectors: ['반도체', 'IT 하드웨어'], note: '주식형 펀드 중심 · 공시상 반도체 · IT 하드웨어 비중이 높아요' },
    { name: 'A자문사', alias: ['A투자자문', 'a자문사'], type: '투자자문사', aum: '약 10억 원', aumBucket: '100억 미만', founded: 2021,
      sectors: ['반도체'], note: '일임 계약 소규모 · 공시상 반도체 종목 위주로 보유해요' },
    { name: 'B법인', alias: ['B', 'b법인', 'B주식회사'], type: '일반 법인', aum: null, aumBucket: null, founded: 2009,
      sectors: [], note: '제조업 · 여유자금 운용 규모와 보유 섹터는 공시에 나오지 않아요' },
    { name: '한빛자산운용', alias: ['한빛'], type: '자산운용사', aum: '약 4,800억 원', aumBucket: '1,000억~1조', founded: 2012,
      sectors: ['AI 인프라', '2차전지'], note: '테마형 · 성장주 펀드 중심이에요' },
    { name: '온결투자자문', alias: ['온결'], type: '투자자문사', aum: '약 650억 원', aumBucket: '100억~1,000억', founded: 2017,
      sectors: ['금리·채권', '배당'], note: '고객 일임 · 인컴형 운용 비중이 높아요' },
    { name: '새솔공제회', alias: ['새솔'], type: '연기금·보험·은행', aum: '약 3.1조 원', aumBucket: '1조 이상', founded: 1998,
      sectors: ['금리·채권'], note: '대체투자 · 채권 비중이 높고 국내 주식은 위탁 운용해요' }
  ];
  var norm = function (s) { return String(s || '').replace(/\(가상\)|㈜|\(주\)|주식회사|\s/g, '').toLowerCase(); };
  function lookup(text) {
    var q = norm(text);
    if (!q) return null;
    return COMPANIES.filter(function (c) {
      return [c.name].concat(c.alias).some(function (n) { var k = norm(n); return k === q || (q.length >= 2 && (k.indexOf(q) > -1 || q.indexOf(k) > -1) && k.length >= 2); });
    })[0] || null;
  }
  window.IL_DISCLOSURE = { COMPANIES: COMPANIES, lookup: lookup, SOURCE: 'DART 공시 스냅샷 · 시연용 가상 데이터' };
})();
