# -*- coding: utf-8 -*-
"""국내 시황 → market_snapshot (네이버 증권 모바일 공개 API, 최근 N거래일).

날짜별: KOSPI · KOSDAQ 종가/등락 · USD/KRW · 투자자별 순매수(억원, KOSPI/KOSDAQ)
최신일만: 업종 등락 상위/하위 4개(strong/weak_sectors) — 업종 API가 당일 값만 줌
ai_summary: claude_api_key 가 있으면 Claude 1~2문장 요약, 없으면 숫자로 만든 문장
"""
from common import get_json, num, pct, eok, env

M = "https://m.stock.naver.com"


def _index_hist(code, n):
    rows = get_json(f"{M}/api/index/{code}/price", {"pageSize": n, "page": 1}) or []
    return {r["localTradedAt"]: (r["closePrice"], pct(r["fluctuationsRatio"])) for r in rows}


def _fx_hist(n):
    d = get_json(f"{M}/front-api/marketIndex/prices", {"category": "exchange", "reutersCode": "FX_USDKRW", "page": 1, "pageSize": n}) or {}
    return {r["localTradedAt"]: (r["closePrice"], pct(r["fluctuationsRatio"])) for r in d.get("result") or []}


def _flows(code, date):
    d = get_json(f"{M}/api/index/{code}/trend", {"bizdate": date.replace("-", "")}) or {}
    return {"foreign": eok(d.get("foreignValue")), "inst": eok(d.get("institutionalValue")), "retail": eok(d.get("personalValue"))}


def _sectors():
    d = get_json(f"{M}/api/stocks/industry", {"page": 1, "pageSize": 100}) or {}
    g = [x for x in d.get("groups") or [] if (x.get("totalCount") or 0) >= 5]   # 종목 수 너무 적은 업종 제외
    g.sort(key=lambda x: num(x["changeRate"]) or 0, reverse=True)
    fmt = lambda x: {"name": x["name"], "chg": pct(x["changeRate"])}
    return [fmt(x) for x in g[:4]], [fmt(x) for x in g[-4:][::-1]]


def _sum(a, b):
    va, vb = num(a), num(b)
    return eok((va or 0) + (vb or 0)) if va is not None or vb is not None else None


def _summary(s):
    base = (f"코스피 {s['kospi']}({s['kospi_chg']}), 코스닥 {s['kosdaq']}({s['kosdaq_chg']})로 마감했어요. "
            f"코스피 기준 외국인 {s['flows']['kospi']['foreign']}, 기관 {s['flows']['kospi']['inst']}, 개인 {s['flows']['kospi']['retail']} 순매수예요.")
    if s.get("strong_sectors"):
        base += f" 업종은 {s['strong_sectors'][0]['name']}({s['strong_sectors'][0]['chg']})가 가장 강했고 {s['weak_sectors'][0]['name']}({s['weak_sectors'][0]['chg']})가 가장 약했어요."
    if env("claude_api_key") or env("anthropic_api_key"):
        try:
            import anthropic
            c = anthropic.Anthropic(api_key=env("claude_api_key") or env("anthropic_api_key"))
            m = c.messages.create(model="claude-opus-5-5", max_tokens=300,
                                  system="너는 증권사 리서치센터 시황 에디터다. 주어진 숫자만 써서 국내 증시 마감 시황을 해요체 2문장으로 요약한다. 숫자를 바꾸거나 전망·투자 권유를 덧붙이지 않는다.",
                                  messages=[{"role": "user", "content": base}])
            txt = "".join(b.text for b in m.content if b.type == "text").strip()
            if txt:
                return txt
        except Exception as e:
            print("  (Claude 요약 생략:", str(e)[:80], ")")
    return base


def crawl(days=7):
    n = days + 3
    kospi, kosdaq, fx = _index_hist("KOSPI", n), _index_hist("KOSDAQ", n), _fx_hist(n)
    dates = sorted(kospi, reverse=True)[:days]
    strong, weak = _sectors()
    rows = []
    for i, d in enumerate(dates):
        fk, fq = _flows("KOSPI", d), _flows("KOSDAQ", d)
        s = {
            "snapshot_date": d,
            "kospi": kospi[d][0], "kospi_chg": kospi[d][1],
            "kosdaq": (kosdaq.get(d) or (None, None))[0], "kosdaq_chg": (kosdaq.get(d) or (None, None))[1],
            "usdkrw": (fx.get(d) or (None, None))[0], "usdkrw_chg": (fx.get(d) or (None, None))[1],
            "flows": {"kospi": fk, "kosdaq": fq},
            "foreign_net": _sum(fk["foreign"], fq["foreign"]), "inst_net": _sum(fk["inst"], fq["inst"]),
            "retail_net": _sum(fk["retail"], fq["retail"]),
            "strong_sectors": strong if i == 0 else [], "weak_sectors": weak if i == 0 else [],
        }
        s["ai_summary"] = _summary(s) if i == 0 else None
        rows.append(s)
    # 과거 날짜는 숫자 문장만 (Claude 호출은 최신일 1회)
    for s in rows[1:]:
        s["ai_summary"] = (f"코스피 {s['kospi']}({s['kospi_chg']}), 코스닥 {s['kosdaq']}({s['kosdaq_chg']})로 마감했어요. "
                           f"코스피 기준 외국인 {s['flows']['kospi']['foreign']}, 기관 {s['flows']['kospi']['inst']} 순매수예요.")
    return rows


def push(sb, rows):
    return sb.upsert("market_snapshot", rows, on_conflict="snapshot_date")


if __name__ == "__main__":
    from common import save_preview
    r = crawl(7)
    save_preview("market_snapshot", r)
    print(len(r), "일 → out/market_snapshot.json")