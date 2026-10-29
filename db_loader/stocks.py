# -*- coding: utf-8 -*-
"""상장 종목 → stocks (KIS 종목 마스터 + KIS 주봉 시세).

- 마스터(공개 파일, 키 불필요): 종목명 · 업종(KRX 지수업종) · 시장 · 시가총액(십억원) · 상장주식수 · 결산월 · 지수 편입
- 수익률(kis_app_key 있을 때): 주봉 100주 → 1주 · 1개월(4주) · 3개월(13주) · 12개월(52주) · 연초 대비
- fwd_pe / fwd_pb: 컨센서스(추정치) 데이터가 KIS · DART에 없어 비워 둔다(사이트는 '–' 표시).
code 는 사이트 규칙대로 'A' + 6자리 (home-feed.js 가 'A'+code 로 조회).
"""
import datetime as dt

import kis
from common import today


def _ret(c, back):
    return round((c[0] / c[back] - 1) * 100, 2) if len(c) > back and c[back] else None


def returns(cli, code):
    """주봉 종가(최신→과거)로 수익률 dict."""
    end = today()
    _, bars = cli.stock_chart(code, end - dt.timedelta(weeks=110), end, "W")
    c = [float(b["stck_clpr"]) for b in bars if float(b.get("stck_clpr") or 0) > 0]
    d = [b["stck_bsop_date"] for b in bars]
    ytd = next((i for i, x in enumerate(d) if x[:4] < str(end.year)), None)   # 작년 마지막 주봉
    return {"ret_1w": _ret(c, 1), "ret_1m": _ret(c, 4), "ret_3m": _ret(c, 13), "ret_12m": _ret(c, 52),
            "ret_ytd": _ret(c, ytd) if ytd is not None else None}


def crawl(with_returns=True):
    master = kis.stock_master()
    cli = kis.client_or_none() if with_returns else None
    rows = []
    for i, m in enumerate(master):
        r = {"code": "A" + m["code"], "name": m["name"], "sector": m["sector"], "market": m["market"],
             "market_cap_bil": m["mcap_bil"], "fiscal_month": m["fiscal_month"], "shares": m["shares"],
             "kospi200": m["kospi200"], "kosdaq150": m["kosdaq150"], "krx300": m["krx300"],
             "ret_1w": None, "ret_1m": None, "ret_3m": None, "ret_12m": None, "ret_ytd": None, "fwd_pe": None, "fwd_pb": None}
        if cli and not m["halt"]:
            try:
                r.update(returns(cli, m["code"]))
            except kis.KISError as e:
                print(f"  ({m['name']} 시세 생략: {e})")
        rows.append(r)
        if cli and (i + 1) % 300 == 0:
            print(f"  시세 {i + 1}/{len(master)}")
    print(f"  종목 {len(rows)}개 (수익률 {'포함' if cli else '없음 — kis_app_key 필요'})")
    return rows


def push(sb, rows):
    return sb.upsert("stocks", rows, on_conflict="code")


if __name__ == "__main__":
    from common import save_preview
    r = crawl()
    save_preview("stocks", r)
    print(len(r), "종목 → out/stocks.json")
