# -*- coding: utf-8 -*-
"""리포트 PDF → 카드뉴스 → card_news (Claude API · 선택).

키: 환경변수 claude_api_key (없으면 건너뜀 — Private Desk 카드뉴스가 비어 보임)
reports에서 카드뉴스가 없는 최근 리포트를 분류별로 고르게 골라(시황·전략 / 산업 / 기업) PDF를 Claude에 첨부,
cardnews/SCHEMA.md 형식 JSON을 받아 검증 → 실패 시 1회 수정 요청 → card_news upsert(id = 리포트 id).
숫자는 리포트 본문 문장 기준(차트 라벨 불신) — 원래 파이프라인과 같은 규칙.
"""
import base64
import json
import os
import re

from common import env, get_bytes

BASE = os.path.dirname(os.path.abspath(__file__))
DECK_DIR = os.path.join(BASE, "cardnews")
MODEL = os.environ.get("CARDNEWS_MODEL", "claude-opus-5-5")
MAX_PAGES = 30
BLOCK_TYPES = {"change", "stats", "hero", "bars", "flows", "updown", "gauge", "list", "takeaway", "kv", "note"}
CARD_CAT = {"macro": "투자전략", "sector": "산업분석", "company": "기업분석"}   # Private Desk 탭 분류와 맞춤


def _system():
    schema = open(os.path.join(DECK_DIR, "SCHEMA.md"), encoding="utf-8").read()
    example = open(os.path.join(DECK_DIR, "20261002_B_lee.jy_47.json"), encoding="utf-8").read()
    return ("너는 유진투자증권 리서치센터의 카드뉴스 에디터다. 첨부된 리포트 PDF를 읽고, "
            "일반 투자자가 1~2분에 핵심을 파악할 수 있는 카드뉴스를 아래 JSON 스키마로 작성한다.\n\n"
            "## 반드시 지킬 것\n"
            "- 모든 숫자는 리포트 **본문 문장**에 나온 값만 쓴다. 차트의 축 값·데이터 라벨은 쓰지 않는다. 본문과 표·차트가 다르면 본문을 따른다.\n"
            "- 리포트에 없는 전망·해석·투자 권유를 만들지 않는다. 투자의견·목표주가는 리포트에 적힌 그대로만.\n"
            "- 추천 종목 표·포트폴리오 편입 종목은 카드로 옮기지 않는다.\n"
            "- 6~9장. 첫 장은 cover, 마지막 장은 \"disc\": true. 한 장에 블록 2~4개, 제목은 줄당 14자 안팎(\\n 줄바꿈), 설명은 해요체.\n"
            "- 출력은 JSON 객체 하나만. 코드펜스·설명 문장 없이.\n\n"
            "## 스키마\n" + schema + "\n\n## 승인된 예시\n" + example)


def validate(deck):
    errs = []
    slides = deck.get("slides") or []
    if not deck.get("title"):
        errs.append("최상위 title 없음")
    if not 5 <= len(slides) <= 10:
        errs.append(f"슬라이드 {len(slides)}장 (6~9장 필요)")
    if slides and slides[0].get("type") != "cover":
        errs.append("첫 장이 cover가 아님")
    for i, s in enumerate(slides[1:], 2):
        blocks = s.get("blocks") or []
        if s.get("type") != "content" or not s.get("title"):
            errs.append(f"{i}장: type=content · title 필요")
        if not 1 <= len(blocks) <= 5:
            errs.append(f"{i}장: 블록 {len(blocks)}개")
        for j, b in enumerate(blocks, 1):
            if b.get("t") not in BLOCK_TYPES:
                errs.append(f"{i}장 블록{j}: 알 수 없는 t={b.get('t')}")
            elif b["t"] in ("stats", "bars", "flows", "list") and not b.get("items"):
                errs.append(f"{i}장 블록{j}: items 없음")
    return errs


def _pdf(url):
    data = get_bytes(url)
    try:
        import fitz   # pymupdf — 긴 리포트는 앞 MAX_PAGES쪽만
        doc = fitz.open(stream=data, filetype="pdf")
        if doc.page_count > MAX_PAGES:
            part = fitz.open()
            part.insert_pdf(doc, from_page=0, to_page=MAX_PAGES - 1)
            return part.tobytes()
    except ImportError:
        pass
    return data


def _parse(text):
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    a, b = text.find("{"), text.rfind("}")
    return json.loads(text[a:b + 1])


def generate(client, system, rep):
    messages = [{"role": "user", "content": [
        {"type": "document", "source": {"type": "base64", "media_type": "application/pdf",
                                        "data": base64.standard_b64encode(_pdf(rep["url"])).decode()}},
        {"type": "text", "text": "이 리포트로 카드뉴스 JSON을 작성해 줘. 메타: " + json.dumps(
            {"published_at": rep["published_at"], "kind": rep["kind"], "category_hint": rep.get("category"), "company": rep.get("company")}, ensure_ascii=False)},
    ]}]
    for attempt in (1, 2):
        with client.messages.stream(model=MODEL, max_tokens=32000, system=system, messages=messages) as st:
            msg = st.get_final_message()
        if msg.stop_reason == "refusal":
            return None
        txt = "".join(b.text for b in msg.content if b.type == "text")
        try:
            deck = _parse(txt)
            errs = validate(deck)
        except ValueError as e:
            deck, errs = None, [f"JSON 파싱 실패: {e}"]
        if not errs:
            deck["report_url"] = rep["url"]
            deck["published_at"] = rep["published_at"]
            deck["slides"][-1]["disc"] = True
            return deck
        print(f"    [retry {attempt}]", "; ".join(errs[:4]))
        messages += [{"role": "assistant", "content": msg.content},
                     {"role": "user", "content": "다음 문제를 고쳐 전체 JSON만 다시 출력해 줘:\n- " + "\n- ".join(errs)}]
    return None


def run(sb, days=7, max_n=6):
    key = env("claude_api_key") or env("anthropic_api_key")
    if not key:
        print("  claude_api_key 없음 → 카드뉴스 건너뜀")
        return 0
    import anthropic
    client = anthropic.Anthropic(api_key=key, max_retries=3, timeout=300.0)
    import datetime as dt
    from common import today
    since = (today() - dt.timedelta(days=days)).isoformat()
    reps = sb.select("reports", {"select": "id,url,kind,category,company,published_at,title", "published_at": f"gte.{since}",
                                 "order": "published_at.desc,id.desc"})
    done = {r["report_id"] for r in sb.select("card_news", {"select": "report_id"})}
    todo, per = [], {"macro": 0, "sector": 0, "company": 0}
    for r in reps:                               # 분류별로 고르게 (탭마다 카드가 보이게)
        if r["id"] in done or per.get(r["kind"], 9) >= max(1, max_n // 3):
            continue
        per[r["kind"]] += 1
        todo.append(r)
    system = _system()
    ok = 0
    for r in todo[:max_n]:
        print(f"  카드뉴스: {r['published_at']} {r['title'][:30]}")
        try:
            deck = generate(client, system, r)
        except Exception as e:
            print("    실패:", str(e)[:120]); continue
        if not deck:
            continue
        row = {"id": r["id"], "report_id": r["id"], "report_url": r["url"], "title": deck.get("title") or r["title"],
               "category": CARD_CAT.get(r["kind"], "산업분석"), "analyst": deck.get("analyst"), "team": deck.get("team"),
               "published_at": r["published_at"], "deck": deck}
        ok += sb.upsert("card_news", [row], on_conflict="id")
        if deck.get("analyst"):   # 네이버 API엔 애널리스트 이름이 없어 PDF에서 읽은 이름으로 리포트도 채운다
            sb.upsert("reports", [{"id": r["id"], "analyst": deck["analyst"]}], on_conflict="id")
    return ok