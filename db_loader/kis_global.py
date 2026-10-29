# -*- coding: utf-8 -*-
"""해외 시황 → global_indices · global_sectors · global_highs · global_research(overnight) · global_quotes
(한국투자증권 해외시세 API).

- 지수 10개: KIS 해외지수 · 환율 · 국채 기간별시세 (KIS 코드로 못 받으면 그 지수만 yfinance 로 대신)
- 섹터 ETF 11개 + 테마 8개: KIS 해외주식 일봉 (거래소는 KIS 해외 종목 마스터에서 찾음)
- 신고가 스크리너(global_highs): S&P 500 구성종목 일봉 약 300일 + 월봉 100개월
    is_20d: 직전 20거래일 종가 최고치 돌파 · is_ath: 조회 가능한 기간(약 8년) 종가 최고치 돌파
    ath_streak: 최근 20거래일 중 최고치 갱신 일수 · vol_ratio: 20일 평균 대비 거래량 · ma20_gap: 20일선 이격(%)
- 밤사이 요약 · 실적 일정은 global_market.py 와 같은 함수 (실적 일정은 KIS에 없어 yfinance)
kis_app_key 가 없으면 global_market.py(yfinance) 로 대신 수집한다.
"""
import csv
import datetime as dt
import io

import global_market as gm
import kis
from common import get_bytes, today

# symbol → (KIS 구분, KIS 코드)  N 해외지수 · X 환율 · I 국채
INDEX_CODES = {"IXIC": ("N", "COMP"), "GSPC": ("N", "SPX"), "DJI": ("N", ".DJI"), "RUT": ("N", "RUT"),
               "N225": ("N", "JP#NI225"), "HSI": ("N", "HK#HS"), "SSEC": ("N", "SHANG"), "VIX": ("N", "VIX"),
               "TNX": ("I", "Y0202"), "DXY": ("N", "DXY")}
SP500 = "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv"
GICS_KO = {"Information Technology": "기술", "Communication Services": "커뮤니케이션", "Consumer Discretionary": "경기소비재",
           "Industrials": "산업재", "Financials": "금융", "Materials": "소재", "Health Care": "헬스케어", "Real Estate": "부동산",
           "Consumer Staples": "필수소비재", "Energy": "에너지", "Utilities": "유틸리티"}


def _bars(cli, excd, sym, pages=1):
    """해외주식 일봉 [최신→과거] (pages×100개)"""
    out, upto = [], None
    for _ in range(pages):
        b = cli.overseas_chart(excd, sym, upto)
        if not b:
            break
        out += b
        upto = dt.date(int(b[-1]["xymd"][:4]), int(b[-1]["xymd"][4:6]), int(b[-1]["xymd"][6:])) - dt.timedelta(days=1)
        if len(b) < 100:
            break
    return out


def _chg(c, back):
    return round((c[0] / c[back] - 1) * 100, 2) if len(c) > back and c[back] else None


def _iso(ymd):
    return f"{ymd[:4]}-{ymd[4:6]}-{ymd[6:]}"


def _indices(cli, now):
    out, miss = [], []
    end, start = today(), today() - dt.timedelta(days=20)
    for sym, (kind, code) in INDEX_CODES.items():
        try:
            _, bars = cli.overseas_index_chart(code, start, end, kind=kind)
            c = [float(b["ovrs_nmix_prpr"]) for b in bars if float(b.get("ovrs_nmix_prpr") or 0)]
        except kis.KISError:
            c, bars = [], []
        if len(c) < 2:
            miss.append(sym); continue
        chg = (c[0] - c[1]) if sym == "TNX" else _chg(c, 1)          # 미 10년물은 %p 변화
        out.append({"symbol": sym, "name": gm.NAMES[sym], "price": round(c[0], 2), "change_pct": round(chg, 3),
                    "as_of": _iso(bars[0]["stck_bsop_date"]), "updated_at": now})
    if miss:                                                          # KIS 코드가 안 맞는 지수만 yfinance
        print("  KIS 지수 코드 미확인 → yfinance:", ", ".join(miss))
        try:
            import yfinance as yf
            h = gm._hist(yf, [gm.INDICES[s] for s in miss])
            for s in miss:
                v = h.get(gm.INDICES[s])
                if v is None:
                    continue
                chg = (float(v.iloc[-1]) - float(v.iloc[-2])) if s == "TNX" else gm._chg(v, 1)
                out.append({"symbol": s, "name": gm.NAMES[s], "price": round(float(v.iloc[-1]), 2),
                            "change_pct": round(chg, 3), "as_of": str(v.index[-1].date()), "updated_at": now})
        except ImportError:
            print("  (yfinance 미설치 — 해당 지수 생략)")
    return out


def _sectors(cli, ex, now):
    out = []
    for sym, name, kind in gm.SECTORS:
        bars = []
        try:
            if sym in ("SOX", "NDX"):                                 # 지수
                _, ib = cli.overseas_index_chart(sym, today() - dt.timedelta(days=50), today())
                bars = [{"xymd": b["stck_bsop_date"], "clos": b["ovrs_nmix_prpr"]} for b in ib]
            elif sym in ex:
                bars = _bars(cli, ex[sym][0], sym)
        except kis.KISError as e:
            print(f"  ({sym} 생략: {e})")
        c = [float(b["clos"]) for b in bars if float(b.get("clos") or 0)]
        if len(c) < 2:
            continue
        out.append({"symbol": sym, "name": name, "kind": kind, "price": round(c[0], 2), "chg_1d": _chg(c, 1),
                    "chg_1w": _chg(c, 5), "chg_1m": _chg(c, 21), "asof": _iso(bars[0]["xymd"]), "updated_at": now})
    return out


def _high_row(t, name, sector, daily, monthly, now):
    c = [float(b["clos"]) for b in daily]
    v = [float(b.get("tvol") or 0) for b in daily]
    if len(c) < 60:
        return None
    hist_max = max([float(b["clos"]) for b in monthly[1:] if float(b.get("clos") or 0)] or [0])
    is_20d = c[0] > max(c[1:21])
    run = [i for i in range(20) if c[i] >= max(max(c[i + 1:]), hist_max)]   # 그날까지의 최고치 갱신일
    is_ath = 0 in run
    hi52 = max(c[:252])
    ma20 = sum(c[:20]) / 20
    avg20 = sum(v[1:21]) / 20
    if not (is_20d or is_ath):
        return None
    return {"ticker": t, "name": name, "sector": sector, "close": round(c[0], 2), "chg_pct": _chg(c, 1),
            "vol_ratio": round(v[0] / avg20, 2) if avg20 else None, "is_20d": is_20d, "is_ath": is_ath,
            "from_52w_high": round((c[0] / hi52 - 1) * 100, 1), "ath_streak": len(run) if is_ath else None,
            "ma20_gap": round((c[0] / ma20 - 1) * 100, 1), "next_earnings": None,
            "spark": [round(x, 2) for x in c[:60][::-1]], "asof": _iso(daily[0]["xymd"]), "updated_at": now}


def _highs(cli, ex, now, quotes):
    rows = list(csv.DictReader(io.StringIO(get_bytes(SP500).decode("utf-8"))))
    nxt = {q["ticker"]: q["next_earnings_date"] for q in quotes}
    out = []
    for i, r in enumerate(rows):
        t = r["Symbol"].replace(".", "/") if r["Symbol"] not in ex else r["Symbol"]
        if t not in ex:
            continue
        sector = "반도체" if "Semiconductor" in r["GICS Sub-Industry"] else GICS_KO.get(r["GICS Sector"], r["GICS Sector"])
        try:
            daily = _bars(cli, ex[t][0], t, pages=3)
            if len(daily) < 60 or float(daily[0]["clos"]) < max(float(b["clos"]) for b in daily[1:21]):
                continue                                              # 20일 신고가가 아니면 월봉 조회 생략
            monthly = cli.get("/uapi/overseas-price/v1/quotations/dailyprice", "HHDFS76240000", {
                "AUTH": "", "EXCD": ex[t][0], "SYMB": t, "GUBN": "2", "BYMD": "", "MODP": "1"}).get("output2") or []
        except kis.KISError as e:
            print(f"  ({t} 생략: {e})"); continue
        h = _high_row(r["Symbol"], r["Security"], sector, daily, monthly, now)
        if h:
            h["next_earnings"] = nxt.get(r["Symbol"])
            out.append(h)
        if (i + 1) % 100 == 0:
            print(f"  신고가 스캔 {i + 1}/{len(rows)} · 해당 {len(out)}")
    return out


def crawl():
    cli = kis.client_or_none()
    if not cli:
        print("  → yfinance(global_market.py)로 대신 수집 (신고가 스크리너 제외)")
        i, s, r, q = gm.crawl()
        return i, s, r, q, []
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    ex = kis.overseas_master()
    indices = _indices(cli, now)
    sectors = _sectors(cli, ex, now)
    research = gm.overnight(indices, sectors)
    try:
        import yfinance as yf
        quotes = gm.earnings(yf, now)
    except ImportError:
        print("  (yfinance 미설치 — 실적 일정 생략)"); quotes = []
    highs = _highs(cli, ex, now, quotes)
    print(f"  지수 {len(indices)} · 섹터/테마 {len(sectors)} · 신고가 {len(highs)} (ATH {sum(h['is_ath'] for h in highs)})"
          f" · 실적 {sum(1 for q in quotes if q['last_earnings_date'])}/{len(quotes)}")
    return indices, sectors, research, quotes, highs


def push(sb, data):
    indices, sectors, research, quotes, highs = data
    n = gm.push(sb, (indices, sectors, research, quotes))
    if highs:
        sb.delete_all("global_highs", "ticker")                       # 오늘 신고가가 아닌 종목은 지운다
        n += sb.upsert("global_highs", highs, on_conflict="ticker")
    return n


if __name__ == "__main__":
    from common import save_preview
    i, s, r, q, h = crawl()
    for k, v in (("global_indices", i), ("global_sectors", s), ("global_research", r), ("global_quotes", q), ("global_highs", h)):
        save_preview(k, v)
    print(r[0]["title"] if r else "—")
