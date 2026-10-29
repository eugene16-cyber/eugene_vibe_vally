# -*- coding: utf-8 -*-
"""해외 시황 → global_indices · global_sectors · global_research(overnight) · global_quotes (yfinance).

- 지수 10개: 나스닥 · S&P 500 · 다우 · 러셀 2000 · 닛케이 · 항셍 · 상해종합 · VIX · 미 10년물 · 달러 인덱스
- 섹터 ETF 11개 + 테마 지수 8개의 1일 · 1주 · 1개월 등락
- 밤사이 요약(overnight): 숫자로 만든 문장 (사이트는 asof가 4일 넘게 지나면 예시로 취급)
- 실적(global_quotes): 빅테크 등 14종목의 직전 · 다음 실적일, EPS 실제/컨센서스/서프라이즈
"""
import datetime as dt

from common import today

INDICES = {"IXIC": "^IXIC", "GSPC": "^GSPC", "DJI": "^DJI", "RUT": "^RUT", "N225": "^N225", "HSI": "^HSI",
           "SSEC": "000001.SS", "VIX": "^VIX", "TNX": "^TNX", "DXY": "DX-Y.NYB"}
NAMES = {"IXIC": "나스닥", "GSPC": "S&P 500", "DJI": "다우", "RUT": "러셀 2000", "N225": "닛케이 225", "HSI": "항셍",
         "SSEC": "상해종합", "VIX": "VIX", "TNX": "미 10년물", "DXY": "달러 인덱스"}
SECTORS = [("XLK", "기술", "sector"), ("XLC", "커뮤니케이션", "sector"), ("XLY", "경기소비재", "sector"), ("XLI", "산업재", "sector"),
           ("XLF", "금융", "sector"), ("XLB", "소재", "sector"), ("XLV", "헬스케어", "sector"), ("XLRE", "부동산", "sector"),
           ("XLP", "필수소비재", "sector"), ("XLE", "에너지", "sector"), ("XLU", "유틸리티", "sector"),
           ("SOX", "필라델피아 반도체", "theme"), ("NDX", "나스닥 100", "theme"), ("IGV", "소프트웨어", "theme"),
           ("GRID", "전력 인프라", "theme"), ("URA", "우라늄·원전", "theme"), ("ITA", "방산·항공우주", "theme"),
           ("BOTZ", "로봇·AI", "theme"), ("XBI", "바이오", "theme")]
YF = {"SOX": "^SOX", "NDX": "^NDX"}
QUOTES = [("ORCL", "Oracle", "AI 관련주"), ("FDX", "FedEx", "운송"), ("MU", "Micron Technology", "반도체"), ("NKE", "Nike", "소비재"),
          ("JPM", "JPMorgan Chase", "금융"), ("GE", "GE Aerospace", "산업재"), ("TSLA", "Tesla", "자동차 관련주"),
          ("INTC", "Intel", "반도체"), ("GOOGL", "Alphabet", "빅테크 7"), ("MSFT", "Microsoft", "빅테크 7"),
          ("META", "Meta Platforms", "빅테크 7"), ("AAPL", "Apple", "빅테크 7"), ("AMZN", "Amazon", "빅테크 7"), ("NVDA", "NVIDIA", "빅테크 7")]


def _hist(yf, tickers, period="2mo"):
    df = yf.download(tickers, period=period, interval="1d", auto_adjust=False, progress=False, group_by="ticker", threads=True)
    out = {}
    for t in tickers:
        try:
            s = (df[t]["Close"] if len(tickers) > 1 else df["Close"]).dropna()
            if len(s) >= 2:
                out[t] = s
        except Exception:
            pass
    return out


def _chg(s, back):
    return round((float(s.iloc[-1]) / float(s.iloc[-1 - back]) - 1) * 100, 2) if len(s) > back else None


def crawl():
    import yfinance as yf
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    h = _hist(yf, list(INDICES.values()))
    indices = []
    for sym, t in INDICES.items():
        s = h.get(t)
        if s is None:
            continue
        chg = (float(s.iloc[-1]) - float(s.iloc[-2])) if sym == "TNX" else _chg(s, 1)   # 미 10년물은 %p 변화
        indices.append({"symbol": sym, "name": NAMES[sym], "price": round(float(s.iloc[-1]), 2),
                        "change_pct": round(chg, 3) if chg is not None else None,
                        "as_of": str(s.index[-1].date()), "updated_at": now})
    tick = [YF.get(sym, sym) for sym, _, _ in SECTORS]
    hs = _hist(yf, tick)
    sectors = []
    for (sym, name, kind), t in zip(SECTORS, tick):
        s = hs.get(t)
        if s is None:
            continue
        sectors.append({"symbol": sym, "name": name, "kind": kind, "price": round(float(s.iloc[-1]), 2),
                        "chg_1d": _chg(s, 1), "chg_1w": _chg(s, 5), "chg_1m": _chg(s, 21),
                        "asof": str(s.index[-1].date()), "updated_at": now})

    research = overnight(indices, sectors)
    quotes = earnings(yf, now)
    print(f"  지수 {len(indices)} · 섹터/테마 {len(sectors)} · 실적 {sum(1 for q in quotes if q['last_earnings_date'])}/{len(quotes)}")
    return indices, sectors, research, quotes


def overnight(indices, sectors):
    """밤사이 요약(global_research kind=overnight) — 숫자만으로 만든 문장"""
    by = {i["symbol"]: i for i in indices}
    sec = sorted([s for s in sectors if s["kind"] == "sector" and s["chg_1d"] is not None], key=lambda s: s["chg_1d"])
    sox = next((s for s in sectors if s["symbol"] == "SOX"), None)
    rows = [{"name": NAMES[k], "chg": f"{by[k]['change_pct']:+.2f}%"} for k in ("GSPC", "IXIC") if k in by]
    if sox and sox["chg_1d"] is not None:
        rows.append({"name": "필라델피아 반도체", "chg": f"{sox['chg_1d']:+.2f}%"})
    up = sum(1 for s in sec if s["chg_1d"] > 0)
    note = (" · ".join(f"{r['name']} {r['chg']}" for r in rows) + ". "
            + (f"11개 섹터 중 {up}개 상승, {sec[-1]['name']}({sec[-1]['chg_1d']:+.2f}%)가 가장 강했고 {sec[0]['name']}({sec[0]['chg_1d']:+.2f}%)가 가장 약했어요." if sec else ""))
    lead = "상승" if by.get("GSPC", {}).get("change_pct", 0) >= 0 else "하락"
    title = f"미 증시 {lead}, {sec[-1]['name']} 강세" if sec else "밤사이 미국 증시"
    asof = by["GSPC"]["as_of"] if "GSPC" in by else str(today())
    research = [{"id": 1, "kind": "overnight", "title": title, "badge": "데이터 요약",
                 "body": {"asof": asof, "note": note, "rows": rows}}]
    return research


def earnings(yf, now):
    """실적 — yfinance 실적 일정 (종목별로 실패해도 넘어감)"""
    quotes = []
    for tk, name, sector in QUOTES:
        q = {"ticker": tk, "name": name, "sector": sector, "next_earnings_date": None, "last_earnings_date": None,
             "eps": None, "eps_estimate": None, "eps_surprise": None, "updated_at": now}
        try:
            ed = yf.Ticker(tk).get_earnings_dates(limit=8)
            if ed is not None and len(ed):
                ed = ed.sort_index()
                nowts = dt.datetime.now(ed.index.tz)
                past, fut = ed[ed.index <= nowts], ed[ed.index > nowts]
                if len(fut):
                    q["next_earnings_date"] = str(fut.index[0].date())
                if len(past):
                    r = past.iloc[-1]
                    q["last_earnings_date"] = str(past.index[-1].date())
                    rep, est = r.get("Reported EPS"), r.get("EPS Estimate")
                    q["eps"] = None if rep != rep else round(float(rep), 2)
                    q["eps_estimate"] = None if est != est else round(float(est), 2)
                    if q["eps"] is not None and q["eps_estimate"]:
                        q["eps_surprise"] = round((q["eps"] / q["eps_estimate"] - 1) * 100, 2)
        except Exception as e:
            print(f"  ({tk} 실적 일정 생략: {str(e)[:60]})")
        quotes.append(q)
    return quotes


def push(sb, data):
    indices, sectors, research, quotes = data
    return (sb.upsert("global_indices", indices, on_conflict="symbol") + sb.upsert("global_sectors", sectors, on_conflict="symbol")
            + sb.upsert("global_research", research, on_conflict="id") + sb.upsert("global_quotes", quotes, on_conflict="ticker"))


if __name__ == "__main__":
    from common import save_preview
    i, s, r, q = crawl()
    save_preview("global_indices", i); save_preview("global_sectors", s); save_preview("global_research", r); save_preview("global_quotes", q)
    print(r[0]["title"], "|", r[0]["body"]["note"])