# -*- coding: utf-8 -*-
"""가입 상담용 법인 디렉터리 → corp_directory (DART 전자공시).

가입 채팅(signup-chat.js)에서 회사명을 입력하면 이 표에서 찾아 '공시로 알 수 있는 정보'를 먼저 채우고,
비어 있는 것만 질문한다. 행 모양은 disclosure-data.js 의 COMPANIES(name · alias · type · aum · aumBucket · founded · sectors · note)와 맞췄다.

대상 (하루 2만 건 제한 안에서 약 3천 건 호출)
  · 코스피 · 코스닥 상장사 전체 (KIS 종목 마스터 기준)
  · 비상장 기관: 이름에 자산운용 · 투자자문/일임 · 보험 · 은행 · 공제회/연금 · 증권 · 캐피탈 · 금융지주가 들어가고
    2020년 이후 DART 등록 정보가 바뀐 회사 (유동화 SPC · 펀드 · 리츠는 뺀다)
수집: 고유번호(corpCode.xml) → 기업개황(company.json: 업종코드 · 설립일 · 결산월 · 홈페이지 · 소재지)
      → 다중회사 주요계정(사업보고서: 자산 · 자본 · 매출 · 영업이익, 직전 사업연도)
대표자 이름 · 상세 주소는 가입 질문에 필요 없어 저장하지 않는다(시/도만).
운용 규모(AUM)는 DART에 없어 비워 두고 대화로 묻는다.
"""
import datetime as dt
import json
import os
import re
import time

import dart
import kis
from common import today

INST = re.compile(r"자산운용|투자자문|투자일임|생명보험|손해보험|화재해상|재보험|보험(주식)?회사|은행|공제회|공제조합|연금공단|증권|캐피탈|금융지주")
SPC = re.compile(r"유동화|제\d+차|\d+차$|투자회사|증권투자|펀드|사모|리츠|위탁관리|부동산투자|신탁제|기업인수목적|스팩|보험중개|보험대리|손해사정|대부")
CORP_CLS = {"Y": "KOSPI", "K": "KOSDAQ", "N": "KONEX", "E": "비상장"}

# 기관 세부 분류 → 가입 채팅의 기업 분류(TYPES)
KIND_TYPE = {"자산운용": "자산운용사", "투자자문": "투자자문사", "보험": "연기금·보험·은행", "은행": "연기금·보험·은행",
             "연기금·공제회": "연기금·보험·은행", "증권": "연기금·보험·은행", "캐피탈": "연기금·보험·은행",
             "금융지주": "연기금·보험·은행", "일반 법인": "일반 법인"}

# 한국표준산업분류(앞자리) → 가입 채팅의 섹터 칩(SECTORS). 금융사는 본업으로 섹터를 알 수 없어 비운다.
KSIC_SECTOR = [("261", "반도체"), ("28202", "2차전지"), ("262", "IT 하드웨어"), ("263", "IT 하드웨어"), ("264", "IT 하드웨어"),
               ("265", "IT 하드웨어"), ("266", "IT 하드웨어"), ("27", "IT 하드웨어"), ("582", "AI 인프라"), ("62", "AI 인프라"),
               ("631", "AI 인프라"), ("21", "바이오"), ("7011", "바이오"), ("311", "조선·방산"), ("313", "조선·방산"), ("252", "조선·방산")]
KSIC_NAME = {"64201": "집합투자업", "66192": "투자자문업", "641": "은행", "6411": "중앙은행", "6412": "은행", "64992": "금융지주회사",
             "651": "보험업", "6511": "생명보험업", "6512": "손해보험업", "6513": "재보험업", "653": "연금 및 공제업", "65301": "공제업",
             "6612": "증권 및 선물 중개업", "66121": "증권 중개업", "64911": "여신금융업", "84620": "사회보장 행정"}


def kind_of(name, induty):
    i = induty or ""
    if "자산운용" in name or i.startswith("64201"):
        return "자산운용"
    if re.search(r"투자자문|투자일임", name) or i.startswith("66192"):
        return "투자자문"
    if "금융지주" in name:                          # 64992(지주회사)는 LG · GS 같은 일반 지주회사도 포함이라 이름으로만
        return "금융지주"
    if re.search(r"보험", name) or i.startswith(("651", "652")):
        return "보험"
    if re.search(r"공제회|공제조합|연금", name) or i.startswith(("653", "8462")):
        return "연기금·공제회"
    if "은행" in name or i.startswith("641"):
        return "은행"
    if "증권" in name or i.startswith("6612"):
        return "증권"
    if "캐피탈" in name or i.startswith("6491"):
        return "캐피탈"
    return "일반 법인"


def sectors_of(induty):
    out = []
    for p, s in KSIC_SECTOR:
        if (induty or "").startswith(p) and s not in out:
            out.append(s)
    return out


def norm(s):
    """채팅 입력과 맞추는 검색 키 — (주) · 주식회사 · 공백 · 대소문자 무시"""
    return re.sub(r"\(가상\)|㈜|\(주\)|주식회사|\s", "", s or "").lower()


def jo(won):
    """원 → '약 1.2조 원' / '약 4,800억 원'"""
    if not won:
        return None
    e = won / 1e8
    return f"약 {e / 1e4:,.1f}조 원" if e >= 1e4 else f"약 {e:,.0f}억 원"


def targets():
    master = {m["code"]: m for m in kis.stock_master()}
    out = []
    for c in dart.all_corps():
        if c["stock_code"] in master:
            out.append({**c, "_m": master[c["stock_code"]]})
        elif not c["stock_code"] and c["modify_date"] >= "20200101" and INST.search(c["corp_name"]) and not SPC.search(c["corp_name"]):
            out.append({**c, "_m": None})
    return out


CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".cache", "dart_company.json")


def _load_cache():
    try:
        return json.load(open(CACHE, encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _save_cache(cache):
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    json.dump(cache, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False)


def companies(ts, max_fail=15):
    """기업개황 — 받은 건 .cache 에 남겨 다음 실행에서 이어 받는다.
    한꺼번에 몰아 부르면 DART가 IP 연결을 끊으므로 한 건씩 0.35초 간격, 연속 실패가 쌓이면 멈춘다."""
    cache, fail = _load_cache(), 0
    todo = [t for t in ts if t["corp_code"] not in cache]
    print(f"  기업개황 캐시 {len(ts) - len(todo)}개 · 새로 받을 {len(todo)}개")
    for n, t in enumerate(todo, 1):
        d = dart.call("company.json", corp_code=t["corp_code"])
        if d and d.get("corp_name"):
            cache[t["corp_code"]], fail = d, 0
        else:
            fail += 1
            if fail >= max_fail:
                print(f"  ! 연속 {fail}건 실패 — DART 호출 제한으로 보고 멈춤 (다시 실행하면 이어 받음)")
                break
            time.sleep(2)
        time.sleep(0.25)
        if n % 200 == 0:
            _save_cache(cache)
            print(f"    {n}/{len(todo)}")
    _save_cache(cache)
    return cache


def crawl():
    ts = targets()
    print(f"  대상 {len(ts)}개 · 상장 {sum(1 for t in ts if t['_m'])} · 비상장 기관 {sum(1 for t in ts if not t['_m'])}")
    cache = companies(ts)
    info = [(t, cache[t["corp_code"]]) for t in ts if t["corp_code"] in cache]
    fy = today().year - 1 if today().month >= 4 else today().year - 2   # 사업보고서는 3월 말까지 나온다
    fin = dart.multi_accounts_by_corp(fy, [c["corp_code"] for c, _ in info])
    print(f"  기업개황 {len(info)}/{len(ts)}개 · {fy} 사업보고서 재무 {len(fin)}개")
    rows = []
    for c, d in info:
        if not d.get("corp_name"):
            continue
        m, f = c["_m"], fin.get(c["corp_code"], {})
        name = (m or {}).get("name") or re.sub(r"\s*(주식회사|㈜|\(주\))\s*", " ", d.get("corp_name") or c["corp_name"]).strip()   # 상장사는 종목명(SK하이닉스)
        induty = d.get("induty_code") or None
        kind = kind_of(name, induty)
        market = (m or {}).get("market") or CORP_CLS.get(d.get("corp_cls"), "비상장")
        est = d.get("est_dt") or ""
        founded = int(est[:4]) if re.fullmatch(r"\d{8}", est) else None
        sec = [] if kind != "일반 법인" else sectors_of(induty)
        industry = (m or {}).get("sector") if m and kind == "일반 법인" else None
        industry = industry or next((KSIC_NAME[induty[:n]] for n in (5, 4, 3) if induty and induty[:n] in KSIC_NAME), None)
        size = jo(f.get("assets"))
        bits = [market if market != "비상장" else "비상장", industry, f"자산총계 {size}({fy} 사업보고서)" if size else None]
        if kind in ("자산운용", "투자자문"):
            bits.append("운용 규모(AUM)는 공시에 없어 대화로 확인해요")
        elif kind == "일반 법인":
            bits.append("여유자금 운용 규모 · 관심 섹터는 공시에 없어 대화로 확인해요" if not sec else "여유자금 운용 규모는 공시에 없어 대화로 확인해요")
        eng = (d.get("corp_name_eng") or c.get("corp_eng_name") or "").strip()
        alias = [x for x in {(m or {}).get("name"), d.get("stock_name"), eng, d.get("corp_name")} if x and x != name]
        rows.append({
            "corp_code": c["corp_code"], "name": name, "name_key": norm(name), "name_eng": eng or None, "alias": alias,
            "search_key": "|".join(dict.fromkeys(norm(x) for x in [name] + alias)),       # 이름 · 별칭 어느 쪽으로 쳐도 찾게
            "stock_code": c["stock_code"] or None, "market": market, "kind": kind, "type": KIND_TYPE[kind],
            "induty_code": induty, "industry": industry, "sectors": sec, "founded": founded,
            "est_date": f"{est[:4]}-{est[4:6]}-{est[6:]}" if founded else None,
            "fiscal_month": int(d["acc_mt"]) if (d.get("acc_mt") or "").isdigit() else None,
            "region": (d.get("adres") or "").split(" ")[0] or None, "homepage": d.get("hm_url") or None,
            "fin_year": fy if f else None,
            **{k + "_eok": round(f[k] / 1e8) if f.get(k) is not None else None for k in ("assets", "equity", "sales", "op_income")},
            "aum": None, "aum_bucket": None,
            "note": " · ".join(b for b in bits if b),
            "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        })
    print(f"  {len(rows)}개 · " + " · ".join(f"{k} {sum(1 for r in rows if r['kind'] == k)}" for k in KIND_TYPE))
    return rows


def push(sb, rows):
    return sb.upsert("corp_directory", rows, on_conflict="corp_code")


if __name__ == "__main__":
    from common import save_preview
    r = crawl()
    save_preview("corp_directory", r)
    for x in [x for x in r if x["kind"] != "일반 법인"][:5] + r[:3]:
        print(x["name"], x["market"], x["type"], x["sectors"], "|", x["note"])
