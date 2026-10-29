# -*- coding: utf-8 -*-
"""유진투자증권 리포트 → reports (네이버 증권 리서치 공개 API · 증권사 코드 63).

분류(네이버) → 사이트 kind/category
  company(종목분석) → company / 업종명(종목 프로필)   industry(산업분석) → sector / 산업분석
  invest(투자전략) · market(시황) · economy(경제) · debenture(채권) → macro / 투자전략
id = 네이버 nid (다시 실행해도 중복되지 않게), url = PDF 원문(stock.pstatic.net)
"""
import datetime as dt
import time

from common import get_json, strip_html, num, today

API = "https://stock.naver.com/api/stockSecurity/researches/v2"
REF = "https://stock.naver.com/research/company"
EUGENE = "63"
CATS = {"company": "company", "industry": "sector", "invest": "macro", "market": "macro",
        "economy": "macro", "debenture": "macro"}
RATING = {"buy": "매수", "strongbuy": "적극매수", "hold": "중립", "neutral": "중립", "sell": "매도", "reduce": "비중축소"}

_industry_cache = {}


def _industry(code):
    if not code:
        return None
    if code not in _industry_cache:
        p = get_json(f"https://stock.naver.com/api/stockSecurity/items/v2/domestic/{code}/profile", referer=REF)
        _industry_cache[code] = (p or {}).get("industryName")
    return _industry_cache[code]


def _list(cat, since):
    """since(date) 이후 유진 리포트 목록 (최신순, 날짜가 지나면 멈춤)."""
    out, idx = [], 0
    while idx < 20:
        d = get_json(f"{API}/{cat}", {"index": idx, "size": 30, "brokerCodes": EUGENE}, referer=REF)
        items = (d or {}).get("items") or []
        if not items:
            break
        for it in items:
            if dt.date.fromisoformat(it["writeDate"]) < since:
                return out
            out.append(it)
        if not d.get("hasNext"):
            break
        idx += 1
    return out


def crawl(days=7):
    since = today() - dt.timedelta(days=days)
    rows = []
    for cat, kind in CATS.items():
        items = _list(cat, since)
        print(f"  {cat:10s} {len(items)}건")
        for it in items:
            det = get_json(f"{API}/{cat}/{it['nid']}", referer=REF) or {}
            url = det.get("attachUrl")
            if not url:
                continue
            otype = (it.get("opinionType") or "").lower()
            gp = num(it.get("goalPrice"))
            rows.append({
                "id": int(it["nid"]),
                "kind": kind,
                "category": (_industry(it.get("itemCode")) or "기업분석") if cat == "company" else ("산업분석" if cat == "industry" else "투자전략"),
                "risk": None,
                "tone": "down" if otype in ("sell", "reduce") else "up",
                "title": it.get("title"),
                "summary": strip_html(det.get("content") or it.get("content"))[:220] or None,
                "company": it.get("itemName") or None,
                "rating": RATING.get(otype, it.get("opinionText")) if cat == "company" and it.get("opinionText") else None,
                "target_price": f"{gp:,.0f}원" if gp else None,
                "analyst": None,          # 네이버 API에 애널리스트 이름이 없음 (PDF 파일명: det['attachName'])
                "published_at": it["writeDate"],
                "url": url,
            })
            time.sleep(0.15)
    rows.sort(key=lambda r: (r["published_at"], r["id"]), reverse=True)
    return rows


def push(sb, rows):
    return sb.upsert("reports", rows, on_conflict="id")


if __name__ == "__main__":
    from common import save_preview
    r = crawl(7)
    save_preview("reports", r)
    print(len(r), "건 → out/reports.json")