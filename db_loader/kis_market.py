# -*- coding: utf-8 -*-
"""국내 시황 → market_snapshot (한국투자증권 Open API, 최근 N거래일).

날짜별: KOSPI · KOSDAQ 종가/등락 · USD/KRW · 투자자별 순매수(억원, KOSPI/KOSDAQ) · 업종 등락 상위/하위 4개
ai_summary: market.py 와 같은 규칙 (claude_api_key 있으면 최신일만 Claude 요약, 나머지는 숫자 문장)
kis_app_key 가 없으면 market.py(네이버) 로 대신 수집한다.
"""
import datetime as dt

import kis
import market
from common import eok, today

# 코스피 업종 지수 (idxcode.mst) — 규모별 · 제조 같은 묶음 지수는 뺀다
SECTORS = {"0005": "음식료·담배", "0006": "섬유·의류", "0007": "종이·목재", "0008": "화학", "0009": "제약", "0010": "비금속",
           "0011": "금속", "0012": "기계·장비", "0013": "전기·전자", "0014": "의료·정밀기기", "0015": "운송장비·부품",
           "0016": "유통", "0017": "전기·가스", "0018": "건설", "0019": "운송·창고", "0020": "통신", "0021": "금융",
           "0024": "증권", "0025": "보험", "0026": "일반서비스", "0028": "부동산", "0029": "IT 서비스", "0030": "오락·문화"}


def _closes(bars, key):
    """[최신→과거] 봉 → {날짜(YYYY-MM-DD): (종가, 전일 대비 %)}"""
    out = {}
    for i, b in enumerate(bars[:-1]):
        c, p = float(b[key]), float(bars[i + 1][key])
        if p:
            d = b["stck_bsop_date"]
            out[f"{d[:4]}-{d[4:6]}-{d[6:]}"] = (c, (c / p - 1) * 100)
    return out


def _flows(cli, market_code, date):
    try:
        rows = cli.investor_by_market(market_code, date)
    except kis.KISError as e:
        print("  (투자자 동향 생략:", e, ")")
        return {"foreign": None, "inst": None, "retail": None}
    ymd = date.replace("-", "")
    r = next((x for x in rows if x.get("stck_bsop_date") == ymd), rows[0] if rows else {})
    f = lambda k: eok(float(r[k]) / 100) if r.get(k) not in (None, "") else None     # 백만원 → 억원
    return {"foreign": f("frgn_ntby_tr_pbmn"), "inst": f("orgn_ntby_tr_pbmn"), "retail": f("prsn_ntby_tr_pbmn")}


def crawl(days=7):
    cli = kis.client_or_none()
    if not cli:
        print("  → 네이버(market.py)로 대신 수집")
        return market.crawl(days)
    end, start = today(), today() - dt.timedelta(days=days * 2 + 10)
    kospi = _closes(cli.index_chart("0001", start, end)[1], "bstp_nmix_prpr")
    kosdaq = _closes(cli.index_chart("1001", start, end)[1], "bstp_nmix_prpr")
    try:
        fx = _closes(cli.overseas_index_chart("FX@KRW", start, end, kind="X")[1], "ovrs_nmix_prpr")
    except kis.KISError as e:
        print("  (환율 생략:", e, ")"); fx = {}
    sec = {}
    for code, name in SECTORS.items():
        try:
            sec[name] = _closes(cli.index_chart(code, start, end)[1], "bstp_nmix_prpr")
        except kis.KISError as e:
            print(f"  ({name} 업종 생략: {e})")
    num2 = lambda v: f"{v:,.2f}"
    pct = lambda v: f"{v:+.2f}%"
    rows = []
    for i, d in enumerate(sorted(kospi, reverse=True)[:days]):
        fk, fq = _flows(cli, "KSP", d), _flows(cli, "KSQ", d)
        day = sorted(((n, s[d][1]) for n, s in sec.items() if d in s), key=lambda x: x[1], reverse=True)
        fmt = lambda x: {"name": x[0], "chg": pct(x[1])}
        s = {
            "snapshot_date": d,
            "kospi": num2(kospi[d][0]), "kospi_chg": pct(kospi[d][1]),
            "kosdaq": num2(kosdaq[d][0]) if d in kosdaq else None, "kosdaq_chg": pct(kosdaq[d][1]) if d in kosdaq else None,
            "usdkrw": num2(fx[d][0]) if d in fx else None, "usdkrw_chg": pct(fx[d][1]) if d in fx else None,
            "flows": {"kospi": fk, "kosdaq": fq},
            "foreign_net": market._sum(fk["foreign"], fq["foreign"]), "inst_net": market._sum(fk["inst"], fq["inst"]),
            "retail_net": market._sum(fk["retail"], fq["retail"]),
            "strong_sectors": [fmt(x) for x in day[:4]], "weak_sectors": [fmt(x) for x in day[-4:][::-1]],
        }
        s["ai_summary"] = market._summary(s) if i == 0 else (
            f"코스피 {s['kospi']}({s['kospi_chg']}), 코스닥 {s['kosdaq']}({s['kosdaq_chg']})로 마감했어요. "
            f"코스피 기준 외국인 {fk['foreign']}, 기관 {fk['inst']} 순매수예요.")
        rows.append(s)
    print(f"  {len(rows)}거래일 · 최신 {rows[0]['snapshot_date'] if rows else '—'}")
    return rows


def push(sb, rows):
    return sb.upsert("market_snapshot", rows, on_conflict="snapshot_date")


if __name__ == "__main__":
    from common import save_preview
    r = crawl(7)
    save_preview("market_snapshot", r)
    print(len(r), "일 → out/market_snapshot.json")
