// Cloudflare Pages Function — POST /api/yuri
// 유리 가입 상담의 AI 부분만 맡는다. Gemini 키는 Pages 시크릿 GEMINI_API_KEY에만 둔다(클라이언트 · git에 넣지 않음).
//   task 'ask'     : 어드민이 정한 질문을 고객에 맞게 '제목 30자 + 보조 40자'로 다듬는다. 보기(칩)는 바꾸지 않는다.
//   task 'extract' : 자유 입력 한 문장에서 여러 슬롯을 한 번에 뽑는다(정해진 보기 안에서만).
const MODEL = 'gemini-3.5-flash';            // 2026-10 기준 이 키로 호출되는 Flash 모델
const FALLBACK = 'gemini-3.5-flash-lite';     // 혼잡(5xx)일 때 한 번 더
const RULES = [
  '너는 유진투자증권 리서치센터의 법인 고객 가입 상담 AI "유리"다.',
  '말투는 해요체(~해요, ~세요). 한국어로만 답한다.',
  '특정 종목 매수 · 매도 권유, 수익 보장, 목표 수익률처럼 투자 권유로 읽힐 표현은 절대 쓰지 않는다.',
  '공시나 DB로 이미 확인된 정보는 다시 묻지 않는다.',
  '반드시 JSON 하나만 출력한다.'
].join('\n');

function prompt(body) {
  if (body.task === 'ask') {
    return [
      `다음 질문을 이 고객에게 맞게 다듬어 줘. 묻는 항목(${body.slot})과 의미는 그대로.`,
      '화면에 크게 보일 제목(title)은 한 문장 30자 이내의 짧은 질문, 보조 설명(hint)은 40자 이내(필요 없으면 빈 문자열).',
      `기본 제목: ${body.title}`,
      `기본 보조 설명: ${body.hint || ''}`,
      `고객이 고를 보기(바꾸지 말 것): ${(body.options || []).join(' / ')}`,
      `고객 프로필: ${JSON.stringify(body.profile || {})}`,
      body.offers ? `참고 — 지금 안내할 수 있는 행사 · 리포트(언급할 때는 이 안에서만): ${JSON.stringify(body.offers)}` : '',
      '출력 형식: {"title": "...", "hint": "..."}'
    ].filter(Boolean).join('\n');
  }
  if (body.task === 'qa') {
    // 근거형 Q&A — 주어진 리포트 원문 안에서만 답하고, 쓴 근거 번호를 남긴다
    const docs = (body.docs || []).slice(0, 5).map((d, i) => `[${i + 1}] ${d.title} (${d.date || ''})\n${String(d.text || '').slice(0, 900)}`).join('\n\n');
    return [
      '아래 리서치센터 리포트 원문만 근거로 고객 질문에 답해 줘. 원문에 없는 내용은 지어내지 말고, 없으면 "원문에서 확인되지 않아요"라고 해.',
      'answer는 2~3문장 해요체 요약, 문장 끝에 근거 번호를 [1]처럼 붙여. 종목 매수 · 매도 권유나 수익 전망 표현은 쓰지 마.',
      'points는 근거 항목 2~3개: title(20자 안팎 핵심), detail(원문 표현을 살린 한 문장), cite(근거 번호), fit(원문이 질문을 직접 뒷받침하면 "유효", 일부만 관련되면 "부분 유효").',
      `질문: ${String(body.question || '').slice(0, 200)}`,
      `원문:\n${docs}`,
      '출력 형식: {"answer": "...", "points": [{"title": "...", "detail": "...", "cite": 1, "fit": "유효"}]}'
    ].join('\n');
  }
  if (body.task === 'extract') {
    return [
      '고객의 답변에서 아래 항목을 찾아 줘. 각 항목은 주어진 보기 중에서만 고르고, 없으면 빼.',
      `답변: "${String(body.text || '').slice(0, 400)}"`,
      `보기: ${JSON.stringify(body.schema || {})}`,
      'services는 콜론 앞 id로 적어. scale은 금액이 나오면 "약 N억 원" 형식. 자주 · 정기적으로 원하면 freq: true.',
      '출력 형식: {"slots": {"identity": "", "purpose": "", "sectors": [], "services": [], "scale": "", "freq": false}}'
    ].join('\n');
  }
  if (body.task === 'pitch') {
    return [
      '아래 영업 메일 초안을 이 회사에 맞게 자연스럽게 다시 써 줘. 너는 이번에는 유진투자증권 리서치센터 법인영업 담당자로서 쓴다.',
      '사실은 주어진 정보 안에서만 쓰고, 없는 실적 · 수치 · 고객사 이름을 지어내지 마. 서비스와 행사는 아래 목록에 있는 것만.',
      '제목(subject)은 45자 이내, 본문(body)은 600자 이내. 인사 → 연락한 이유(발굴 신호) → 맞춤 서비스 2개 + 유진 Insight Lab → 마무리 순서.',
      '링크 · 수신 거부 안내 · 시연 표시는 시스템이 붙이니 본문에 쓰지 마.',
      `회사: ${JSON.stringify(body.prospect || {})}`,
      `제안 서비스: ${(body.services || []).join(' / ')}`,
      body.event ? `다가오는 행사: ${JSON.stringify(body.event)}` : '',
      `단계: ${['1차 제안', '리마인드(짧게)', '마지막 안내(짧게, 이후 먼저 연락하지 않는다고 밝힘)'][body.step] || '1차 제안'}`,
      `초안: ${JSON.stringify(body.draft || {})}`,
      '출력 형식: {"subject": "...", "body": "..."}'
    ].filter(Boolean).join('\n');
  }
  return null;
}

// GET — 키가 있는지만 알려 준다(클라이언트가 실패 요청 없이 규칙 기반으로 넘어가게)
export async function onRequestGet({ env }) {
  return new Response(JSON.stringify({ ai: !!env.GEMINI_API_KEY, model: MODEL }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export async function onRequestPost({ request, env }) {
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
  if (!env.GEMINI_API_KEY) return json({ error: 'no_key' }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const text = prompt(body);
  if (!text) return json({ error: 'bad_task' }, 400);
  const call = (model) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: RULES }] },
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: body.task === 'qa' ? 0.2 : 0.4, maxOutputTokens: body.task === 'qa' ? 700 : 400,
        // lite 모델은 thinkingConfig를 받지 않는다(400) — 기본 모델에만 붙인다
        ...(model === MODEL ? { thinkingConfig: { thinkingBudget: 0 } } : {}) }
    })
  });
  let r = await call(MODEL);
  // 혼잡(5xx) · 호출 한도 초과(429)면 가벼운 모델로 한 번 더 — 한도가 따로다
  if (r.status >= 500 || r.status === 429) r = await call(FALLBACK);
  // 그래도 안 되면 200 + ok:false — 화면은 규칙 기반으로 이어 가고, 브라우저 콘솔에 실패 요청이 남지 않게
  if (!r.ok) return json({ ok: false, error: 'upstream', status: r.status });
  const data = await r.json();
  const out = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  try { return json(JSON.parse(out)); } catch { return json({ ok: false, error: 'parse' }); }
}
