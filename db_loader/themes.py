# -*- coding: utf-8 -*-
"""테마 로테이션 → themes · theme_constituents (네이버 증권 테마 공개 API).

1. 테마 목록(당일 등락률)에서 종목 수 8개 이상인 테마 중 상승 상위 8 + 하락 상위 7 = 15개
2. 테마별 거래대금 상위 10종목 → 종목 일별 시세로 1주 · 1개월 수익률 계산
3. 테마 1개월 수익률 = 구성 종목 평균, 집중도 = 테마 거래대금 순위(1~10), 국면(state) = 수익률로 분류
사이트가 week 구분 없이 전체 행을 읽으므로 실행할 때마다 기존 행을 지우고 새로 넣는다(교체).
"""
import time

from common import get_json, num, today

M = "https://m.stock.naver.com"
_px = {}


def _ret(code):
    """(1주, 1개월) 수익률 % — 일별 종가 기준."""
    if code not in _px:
        rows = get_json(f"{M}/api/stock/{code}/price", {"pageSize": 23, "page": 1}) or []
        c = [num(r["closePrice"]) for r in rows]
        r1w = (c[0] / c[5] - 1) * 100 if len(c) > 5 and c[5] else None
        r1m = (c[0] / c[21] - 1) * 100 if len(c) > 21 and c[21] else None
        _px[code] = (r1w, r1m)
        time.sleep(0.08)
    return _px[code]


def _state(r1d, r1m):
    if r1m is None:
        return "Emerging"
    if r1m >= 10:
        return "Leadership" if r1d >= 0 else "Crowded"
    if r1m >= 0:
        return "Acceleration" if r1d >= 1 else "Emerging"
    return "Reversal" if r1d > 0 else "Cooling"


def crawl(n_up=8, n_down=7, per_theme=10):
    allg = []
    for page in range(1, 6):
        d = get_json(f"{M}/api/stocks/theme", {"page": page, "pageSize": 100}) or {}
        allg += d.get("groups") or []
        if len(d.get("groups") or []) < 100:
            break
    skip = ("SPAC", "스팩", "신규상장", "우선주", "관리종목")          # 산업 테마가 아닌 묶음
    groups = [g for g in allg if (g.get("totalCount") or 0) >= 8 and not any(k in g["name"] for k in skip)]
    groups.sort(key=lambda g: num(g["changeRate"]) or 0, reverse=True)
    picked = groups[:n_up] + groups[-n_down:]
    week = today().isoformat()
    themes, cons, tv = [], [], {}
    for g in picked:
        det = get_json(f"{M}/api/stocks/theme/{g['no']}", {"page": 1, "pageSize": 40}) or {}
        stocks = sorted(det.get("stocks") or [], key=lambda s: num(s.get("accumulatedTradingValue")) or 0, reverse=True)[:per_theme]
        r1ms = []
        for s in stocks:
            r1w, r1m = _ret(s["itemCode"])
            if r1m is not None:
                r1ms.append(r1m)
            cons.append({"id": g["no"] * 1_000_000 + int(s["itemCode"]) if s["itemCode"].isdigit() else None,
                         "theme_name": g["name"], "stock_name": s["stockName"], "stock_code": s["itemCode"],
                         "ret_1d": num(s.get("fluctuationsRatio")),
                         "ret_1w": round(r1w, 2) if r1w is not None else None, "week_of": week})
        tv[g["no"]] = sum(num(s.get("accumulatedTradingValue")) or 0 for s in stocks)
        r1d = num(g["changeRate"]) or 0
        r1m = round(sum(r1ms) / len(r1ms), 2) if r1ms else None
        themes.append({"id": g["no"], "name": g["name"], "ret_1m": r1m, "state": _state(r1d, r1m), "week_of": week, "_r1d": r1d})
        print(f"  {g['name'][:16]:16s} 1D {r1d:+.2f}%  1M {r1m if r1m is not None else '—'}%  종목 {len(stocks)}")
    # 집중도: 거래대금 순위 → 1.0~10.0 · 위치: 1개월 수익률 → 가로, 집중도 → 세로 (화면에서 겹침 없이 다시 배치됨)
    order = sorted(tv, key=tv.get)
    rets = [t["ret_1m"] for t in themes if t["ret_1m"] is not None] or [0]
    lo, hi = min(rets), max(rets)
    for t in themes:
        t["concentration"] = round(1 + 9 * order.index(t["id"]) / max(1, len(order) - 1), 1)
        rm = t["ret_1m"] if t["ret_1m"] is not None else 0
        t["pos_x"] = round(12 + 76 * ((rm - lo) / ((hi - lo) or 1)), 1)
        t["pos_y"] = round(85 - 70 * (t["concentration"] - 1) / 9, 1)
        t.pop("_r1d")
    cons = [c for c in cons if c["id"] is not None]
    return themes, cons


def push(sb, data):
    themes, cons = data
    sb.delete_all("theme_constituents")
    sb.delete_all("themes")
    return sb.upsert("themes", themes, on_conflict="id") + sb.upsert("theme_constituents", cons, on_conflict="id")


if __name__ == "__main__":
    from common import save_preview
    t, c = crawl()
    save_preview("themes", t); save_preview("theme_constituents", c)
    print(len(t), "테마 ·", len(c), "구성종목 → out/")