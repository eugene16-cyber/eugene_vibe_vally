# -*- coding: utf-8 -*-
"""퀀트 랩 → quant_stock_stats · quant_factor_returns · quant_factor_meta (KIS 월봉 + DART 재무 + KIS 배당).

종목 통계(quant_stock_stats, 종목당 최대 100개월 수정주가 월봉)
  cagr · vol(연환산) · mdd : 소수(0.12 = 12%) — 사이트가 ×100 해서 표시
  beta_mkt · r2            : 코스피 월수익률 회귀
  idio_cagr · idio_vol     : 시장 몫(β×코스피)을 뺀 잔차 수익률 · idio_share = 1 − r2
  div                      : 최근 12개월 주당배당금 ÷ 종가 (%, KIS 예탁원 배당일정)
팩터 월수익률(quant_factor_returns, 롱온리 · 동일가중 · 매월 리밸런싱)
  매월 말 시가총액 상위 500종목(종가 × 현재 상장주식수 근사) 안에서 상위 20%를 골라 다음 달 수익률을 평균
  value 저PBR · qual 고ROE (DART 사업보고서, 결산 다음 해 4월부터 사용) · mom 12-1개월 · lowvol 12개월 변동성 하위
  div 배당수익률 · size 시총 하위 20% · BENCHMARK 코스피
  한계: 현재 상장 종목만 사용(생존 편향) · 과거 시총은 현재 주식수로 근사 — meta.rule 에 그대로 적는다.
code 는 6자리 (quant.html 이 quant_theme_constituents.code 와 맞춰 조회).
"""
import calendar
import datetime as dt
import math

import dart
import kis
from common import today

TOP_N, PICK = 500, 0.2
META = [
    ("value", "가치 (Value)", "저PER·저PBR", "PBR(월말 시총 ÷ 직전 사업보고서 자본총계) 하위 20%"),
    ("mom", "모멘텀 (Momentum)", "최근 추세 강세", "직전 1개월을 뺀 12개월 수익률 상위 20%"),
    ("qual", "퀄리티 (Quality)", "고ROE", "ROE(당기순이익 ÷ 자본총계, 직전 사업보고서) 상위 20%"),
    ("lowvol", "저변동성", "변동성 하위", "최근 12개월 월수익률 표준편차 하위 20%"),
    ("div", "배당 (Dividend)", "고배당 우량주", "최근 12개월 주당배당금 ÷ 월말 종가 상위 20%"),
    ("size", "소형주 (Size)", "중소형 성장", "시가총액 상위 500종목 중 하위 20%"),
    ("BENCHMARK", "코스피", "벤치마크", "코스피 지수 월수익률"),
]
COMMON_RULE = (" · 공통: 매월 말 시가총액 상위 500종목(종가×현재 상장주식수 근사) 안에서 선정, 다음 달 동일가중 수익률."
               " 현재 상장 종목만 사용해 상장폐지 종목이 빠진 생존 편향이 있음. 데이터: 한국투자증권 수정주가 월봉 · DART 사업보고서 · 예탁원 배당일정.")


def _mkey(ymd):
    return ymd[:4] + "-" + ymd[4:6]


def _mend(mk):
    y, m = int(mk[:4]), int(mk[5:])
    return f"{mk}-{calendar.monthrange(y, m)[1]:02d}"


def _std(x):
    if len(x) < 2:
        return None
    m = sum(x) / len(x)
    return math.sqrt(sum((v - m) ** 2 for v in x) / (len(x) - 1))


def _monthly(cli, code, start, end, index=False):
    """{YYYY-MM: 종가} — 이번 달(미완성 월)은 뺀다."""
    _, bars = (cli.index_chart if index else cli.stock_chart)(code, start, end, "M")
    while index and len(bars) % 50 == 0 and bars:              # 지수 월봉은 한 번에 50개까지 → 앞쪽을 이어 받는다
        last = bars[-1]["stck_bsop_date"]
        upto = dt.date(int(last[:4]), int(last[4:6]), 1) - dt.timedelta(days=1)
        if upto < start:
            break
        more = cli.index_chart(code, start, upto, "M")[1]
        if not more:
            break
        bars += more
    key = "bstp_nmix_prpr" if index else "stck_clpr"
    cur = end.strftime("%Y-%m")
    return {_mkey(b["stck_bsop_date"]): float(b[key]) for b in bars
            if float(b.get(key) or 0) > 0 and _mkey(b["stck_bsop_date"]) != cur}


def _rets(px):
    ks = sorted(px)
    return {k: px[k] / px[p] - 1 for p, k in zip(ks, ks[1:])}


def stock_stats(px, mkt_r):
    ks = sorted(px)
    if len(ks) < 13:
        return None
    r = _rets(px)
    rv = [r[k] for k in ks[1:]]
    n = len(ks)
    peak, mdd = 0, 0
    for k in ks:
        peak = max(peak, px[k]); mdd = min(mdd, px[k] / peak - 1)
    out = {"cagr": (px[ks[-1]] / px[ks[0]]) ** (12 / (n - 1)) - 1, "vol": _std(rv) * math.sqrt(12), "mdd": mdd, "months": n,
           "beta_mkt": None, "r2": None, "idio_cagr": None, "idio_vol": None, "idio_share": None, "idio_months": None}
    both = [k for k in ks[1:] if k in mkt_r]
    if len(both) >= 12:
        x, y = [mkt_r[k] for k in both], [r[k] for k in both]
        mx, my = sum(x) / len(x), sum(y) / len(y)
        sxx = sum((a - mx) ** 2 for a in x)
        sxy = sum((a - mx) * (b - my) for a, b in zip(x, y))
        syy = sum((b - my) ** 2 for b in y)
        beta = sxy / sxx if sxx else 0
        idio = [b - beta * a for a, b in zip(x, y)]
        g = 1.0
        for v in idio:
            g *= max(1 + v, 1e-9)
        r2 = (sxy * sxy / (sxx * syy)) if sxx and syy else 0
        out.update(beta_mkt=beta, r2=r2, idio_cagr=g ** (12 / len(idio)) - 1, idio_vol=_std(idio) * math.sqrt(12),
                   idio_share=1 - r2, idio_months=len(idio))
    return out


def _dividends(cli, codes, start, end):
    """{종목코드: [(기준일 YYYYMMDD, 주당배당금)]} — 종목별 조회 (전 종목 조회는 100건 제한)"""
    out, fail = {}, 0
    for i, code in enumerate(codes):
        try:
            rows = cli.dividends(code, start, end)
        except kis.KISError as e:
            fail += 1
            if fail >= 20 and not out:
                print("  (배당일정 조회 실패 → 배당 팩터 · div 생략:", e, ")")
                return {}
            continue
        out[code] = [(r.get("record_date", "").replace("/", ""), float(r.get("per_sto_divi_amt") or 0))
                     for r in rows if float(r.get("per_sto_divi_amt") or 0) > 0]
        if (i + 1) % 500 == 0:
            print(f"  배당 {i + 1}/{len(codes)}")
    return out


def _ttm_div(divs, mk):
    """mk(YYYY-MM) 월말 기준 최근 12개월 주당배당금 합"""
    end = _mend(mk).replace("-", "")
    y, m = int(mk[:4]) - 1, int(mk[5:])
    start = f"{y}{m:02d}99"
    return sum(a for d, a in divs if start < d <= end)


def crawl():
    cli = kis.client_or_none()
    if not cli:
        print("  퀀트는 KIS 월봉이 있어야 계산할 수 있어 건너뜀")
        return None
    end = today()
    start = dt.date(end.year - 9, 1, 1)
    master = [m for m in kis.stock_master() if not m["pref"] and not m["halt"]]
    print(f"  대상 {len(master)}종목 · 월봉 조회 (종목당 1회)")
    kospi = _monthly(cli, "0001", start, end, index=True)
    mkt_r = _rets(kospi)
    px = {}
    for i, m in enumerate(master):
        try:
            p = _monthly(cli, m["code"], start, end)
            if len(p) >= 13:
                px[m["code"]] = p
        except kis.KISError as e:
            print(f"  ({m['name']} 생략: {e})")
        if (i + 1) % 300 == 0:
            print(f"  월봉 {i + 1}/{len(master)}")
    divs = _dividends(cli, list(px), start, end)
    info = {m["code"]: m for m in master}
    now = dt.datetime.now(dt.timezone.utc).isoformat()

    stats = []
    for code, p in px.items():
        s = stock_stats(p, mkt_r)
        if not s:
            continue
        last = sorted(p)[-1]
        dps = _ttm_div(divs.get(code, []), last) if divs else None
        stats.append({"code": code, "name": info[code]["name"], "mcap_bil": info[code]["mcap_bil"],
                      "div": round(dps / p[last] * 100, 2) if dps is not None else None, "updated_at": now,
                      **{k: (round(v, 4) if isinstance(v, float) else v) for k, v in s.items()}})
    print(f"  종목 통계 {len(stats)}개")

    # ── 팩터 ──
    years = sorted({int(k[:4]) for p in px.values() for k in p})
    fin = {}
    for fy in range(years[0] - 2, end.year):
        fin[fy] = dart.multi_accounts(fy, list(px))
        print(f"  DART {fy} 사업보고서 {len(fin[fy])}개사")
    months = sorted(kospi)
    rets = {k: _rets(p) for k, p in px.items()}
    out = []
    for t, nxt in zip(months, months[1:]):
        uni = []
        for code, p in px.items():
            if t not in p or nxt not in rets[code]:
                continue
            uni.append((p[t] * (info[code]["shares"] or 0), code))
        uni = [c for _, c in sorted(uni, reverse=True)[:TOP_N]]
        if len(uni) < 100:
            continue
        mcap = {c: px[c][t] * (info[c]["shares"] or 0) for c in uni}
        fy = int(t[:4]) - 1 if int(t[5:]) >= 4 else int(t[:4]) - 2
        f = fin.get(fy, {})

        def prev(code, back):
            p = px[code]; kk = sorted(k for k in p if k <= t)
            return p[kk[-1 - back]] if len(kk) > back else None

        score = {"value": {}, "mom": {}, "qual": {}, "lowvol": {}, "div": {}, "size": {}}
        for c in uni:
            eq = (f.get(c) or {}).get("equity")
            ni = (f.get(c) or {}).get("net_income")
            if eq and eq > 0:
                score["value"][c] = -(mcap[c] / eq)                  # 높을수록 좋게(저PBR)
                if ni is not None:
                    score["qual"][c] = ni / eq
            p1, p12 = prev(c, 1), prev(c, 12)
            if p1 and p12:
                score["mom"][c] = p1 / p12 - 1
            r12 = [rets[c][k] for k in sorted(rets[c]) if k <= t][-12:]
            if len(r12) == 12:
                score["lowvol"][c] = -_std(r12)
            if divs:
                score["div"][c] = _ttm_div(divs.get(c, []), t) / px[c][t]
            score["size"][c] = -mcap[c]
        for fid, sc in score.items():
            if len(sc) < 50 or (fid == "div" and not divs):
                continue
            pick = [c for c, _ in sorted(sc.items(), key=lambda x: x[1], reverse=True)[:max(1, int(len(sc) * PICK))]]
            out.append({"factor_id": fid, "month": _mend(nxt), "ret": round(sum(rets[c][nxt] for c in pick) / len(pick), 6)})
        if nxt in mkt_r:
            out.append({"factor_id": "BENCHMARK", "month": _mend(nxt), "ret": round(mkt_r[nxt], 6)})
    meta = [{"factor_id": a, "name_ko": b, "description": c, "rule": d + ("" if a == "BENCHMARK" else COMMON_RULE), "updated_at": now}
            for a, b, c, d in META if a == "BENCHMARK" or any(r["factor_id"] == a for r in out)]
    print(f"  팩터 월수익률 {len(out)}행 ({len({r['month'] for r in out})}개월)")
    return stats, out, meta


def push(sb, data):
    if not data:
        return 0
    stats, rets, meta = data
    return (sb.upsert("quant_stock_stats", stats, on_conflict="code") + sb.upsert("quant_factor_returns", rets, on_conflict="factor_id,month")
            + sb.upsert("quant_factor_meta", meta, on_conflict="factor_id"))


if __name__ == "__main__":
    from common import save_preview
    d = crawl()
    if d:
        save_preview("quant_stock_stats", d[0]); save_preview("quant_factor_returns", d[1]); save_preview("quant_factor_meta", d[2])
