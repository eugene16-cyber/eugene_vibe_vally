# -*- coding: utf-8 -*-
"""DART 전자공시 OpenAPI 공용 — 고유번호(corp_code) 매핑 · 다중회사 주요계정 · 공시 목록.

키: 환경변수 dart_api (또는 dart_api_key) — https://opendart.fss.or.kr 무료 발급, 하루 2만 건 제한.
"""
import io
import time
import xml.etree.ElementTree as ET
import zipfile

import requests

from common import env, get_json, num

API = "https://opendart.fss.or.kr/api/"
REF = "https://opendart.fss.or.kr/"


def key():
    return env("dart_api_key")


def call(path, **params):
    d = get_json(API + path, {"crtfc_key": key(), **params}, referer=REF)
    time.sleep(0.1)                       # 분당 1,000건 제한보다 여유 있게
    if not d:
        return None
    if d.get("status") not in ("000", "013"):   # 013 = 조회된 데이터 없음
        print("  DART 오류:", path, d.get("status"), d.get("message"))
        return None
    return d


_all = None


def all_corps():
    """DART 고유번호 전체 [{corp_code, corp_name, corp_eng_name, stock_code, modify_date}] — 비상장 · 기관 포함 약 12만 개"""
    global _all
    if _all is None:
        r = requests.get(API + "corpCode.xml", params={"crtfc_key": key()}, timeout=60)
        z = zipfile.ZipFile(io.BytesIO(r.content))
        root = ET.fromstring(z.read(z.namelist()[0]))
        _all = [{k: (el.findtext(k) or "").strip() for k in ("corp_code", "corp_name", "corp_eng_name", "stock_code", "modify_date")}
                for el in root.iter("list")]
    return _all


def corp_codes():
    """상장사 {종목코드6: corp_code8}"""
    return {c["stock_code"]: c["corp_code"] for c in all_corps() if c["stock_code"]}


# 다중회사 주요계정에서 쓰는 계정명 → 키
ACCOUNTS = {"자산총계": "assets", "자본총계": "equity", "당기순이익": "net_income", "당기순이익(손실)": "net_income",
            "매출액": "sales", "영업이익": "op_income", "영업이익(손실)": "op_income"}


def multi_accounts(year, stock_codes, reprt_code="11011"):
    """사업보고서(11011) 기준 {종목코드: {assets, equity, net_income, sales, op_income}} (원). 연결(CFS) 우선, 없으면 별도(OFS)."""
    cc, want = corp_codes(), set(stock_codes)
    by = multi_accounts_by_corp(year, [cc[s] for s in want if s in cc], reprt_code)
    return {s: by[c] for s, c in cc.items() if c in by and s in want}


def multi_accounts_by_corp(year, corps, reprt_code="11011"):
    """비상장사도 쓰는 corp_code 판 — {corp_code: {...}}. 사업보고서를 내지 않는 회사는 빠진다."""
    out = {}
    for i in range(0, len(corps), 100):
        d = call("fnlttMultiAcnt.json", corp_code=",".join(corps[i:i + 100]), bsns_year=str(year), reprt_code=reprt_code)
        by = {}
        for it in (d or {}).get("list") or []:
            k = ACCOUNTS.get((it.get("account_nm") or "").replace(" ", ""))
            v = num(it.get("thstrm_amount"))
            if not k or v is None:
                continue
            by.setdefault(it["corp_code"], {}).setdefault(it.get("fs_div"), {}).setdefault(k, v)
        for c, fs in by.items():
            out[c] = {**fs.get("OFS", {}), **fs.get("CFS", {})}
    return out
