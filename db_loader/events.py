# -*- coding: utf-8 -*-
"""종목 이벤트 → events (DART 전자공시 OpenAPI · 최근 N일 · 유가증권/코스닥).

키: 환경변수 dart_api_key (https://opendart.fss.or.kr 무료 발급). 없으면 건너뛴다.
공시 제목 키워드로 유형 · 효과 · 신호 강도를 붙인다 (사이트 종목 이벤트 표 규칙과 같게).
id = 접수번호(rcept_no) · 사이트가 전체 행을 읽으므로 실행할 때마다 교체 적재.
"""
import datetime as dt
import time

from common import get_json, env, today

# (키워드, 유형, tone, 효과 문구, 신호, kind)
RULES = [
    ("자기주식취득", "자사주", "up", "수급 개선", "High", "action"),
    ("자기주식소각", "자사주", "up", "주주환원", "High", "action"),
    ("자기주식처분", "자사주", "down", "오버행 우려", "Medium", "action"),
    ("현금ㆍ현물배당", "배당", "up", "배당 매력", "Medium", "action"),
    ("현금·현물배당", "배당", "up", "배당 매력", "Medium", "action"),
    ("주식분할", "액면분할", "up", "거래 활성화", "Medium", "action"),
    ("무상증자", "무상증자", "up", "수급 기대", "Medium", "action"),
    ("유상증자", "유상증자", "down", "단기 희석", "High", "action"),
    ("회사합병", "합병", "up", "구조 변화", "High", "action"),
    ("회사분할", "분할", "up", "가치 재평가", "High", "action"),
    ("단일판매ㆍ공급계약", "공급계약", "up", "수주 모멘텀", "Medium", "action"),
    ("단일판매·공급계약", "공급계약", "up", "수주 모멘텀", "Medium", "action"),
    ("영업(잠정)실적", "실적", "up", "실적 발표", "Medium", "earnings"),
]


def crawl(days=7, limit=40):
    key = env("dart_api_key")
    if not key:
        print("  dart_api_key 없음 → 종목 이벤트 건너뜀 (사이트는 예시 데이터로 표시)")
        return None
    end, bgn = today(), today() - dt.timedelta(days=days)
    rows, seen = [], set()
    for ty in ("B", "I"):                     # B 주요사항보고 · I 거래소공시
        for page in range(1, 6):
            d = get_json("https://opendart.fss.or.kr/api/list.json", {
                "crtfc_key": key, "bgn_de": bgn.strftime("%Y%m%d"), "end_de": end.strftime("%Y%m%d"),
                "pblntf_ty": ty, "page_no": page, "page_count": 100}, referer="https://opendart.fss.or.kr/")
            if not d or d.get("status") != "000":
                if d and d.get("status") not in ("000", "013"):
                    print("  DART 오류:", d.get("status"), d.get("message"))
                break
            for it in d.get("list") or []:
                if it.get("corp_cls") not in ("Y", "K") or not it.get("stock_code"):
                    continue
                nm = it["report_nm"].replace(" ", "")
                rule = next((r for r in RULES if r[0].replace(" ", "") in nm), None)
                if not rule or (it["stock_code"], rule[1]) in seen:
                    continue
                seen.add((it["stock_code"], rule[1]))
                rows.append({"id": int(it["rcept_no"]), "kind": rule[5], "ticker": it["stock_code"], "name": it["corp_name"],
                             "sector": rule[1], "detail": it["report_nm"].strip(), "consensus": None, "actual": None,
                             "surprise": rule[3], "price_move": None, "ref_date": it["rcept_dt"][4:6] + "." + it["rcept_dt"][6:8],
                             "tone": rule[2], "signal": rule[4]})
            if page >= int(d.get("total_page") or 1):
                break
            time.sleep(0.3)
    rows.sort(key=lambda r: (r["signal"] != "High", -r["id"]))
    rows = rows[:limit]
    _price_moves(rows)
    print(f"  공시 이벤트 {len(rows)}건")
    return rows


def _price_moves(rows):
    """kis_app_key 가 있으면 공시 전일 종가 → 최근 종가 등락을 price_move 에 넣는다 (없으면 비워 둠)."""
    import kis
    cli = kis.client_or_none()
    if not cli:
        return
    for r in rows:
        rcept = str(r["id"])[:8]
        try:
            _, bars = cli.stock_chart(r["ticker"], dt.date.fromisoformat(f"{rcept[:4]}-{rcept[4:6]}-{rcept[6:]}") - dt.timedelta(days=7), today(), "D")
        except kis.KISError as e:
            print(f"  ({r['name']} 시세 생략: {e})"); continue
        before = [b for b in bars if b["stck_bsop_date"] < rcept]
        if bars and before and float(before[0]["stck_clpr"]):
            r["price_move"] = f"{(float(bars[0]['stck_clpr']) / float(before[0]['stck_clpr']) - 1) * 100:+.1f}%"


def push(sb, rows):
    if rows is None:
        return 0
    sb.delete_all("events")
    return sb.upsert("events", rows, on_conflict="id")


if __name__ == "__main__":
    from common import save_preview
    r = crawl(7)
    if r is not None:
        save_preview("events", r)
        for x in r[:6]:
            print(x["ref_date"], x["name"], x["sector"], x["detail"][:30])