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


_corp = None


def corp_codes():
    """상장사 {종목코드6: corp_code8}"""
    global _corp
    if _corp is None:
        r = requests.get(API + "corpCode.xml", params={"crtfc_key": key()}, timeout=60)
        z = zipfile.ZipFile(io.BytesIO(r.content))
        root = ET.fromstring(z.read(z.namelist()[0]))
        _corp = {}
        for el in root.iter("list"):
            sc = (el.findtext("stock_code") or "").strip()
            if sc:
                _corp[sc] = el.findtext("corp_code").strip()
    return _corp


# 다중회사 주요계정에서 쓰는 계정명 → 키
ACCOUNTS = {"자본총계": "equity", "당기순이익": "net_income", "당기순이익(손실)": "net_income",
            "매출액": "sales", "영업이익": "op_income", "영업이익(손실)": "op_income"}


def multi_accounts(year, stock_codes, reprt_code="11011"):
    """사업보고서(11011) 기준 {종목코드: {equity, net_income, sales, op_income}} (원). 연결(CFS) 우선, 없으면 별도(OFS)."""
    cc = corp_codes()
    pairs = [(s, cc[s]) for s in stock_codes if s in cc]
    out = {}
    for i in range(0, len(pairs), 100):
        chunk = pairs[i:i + 100]
        d = call("fnlttMultiAcnt.json", corp_code=",".join(c for _, c in chunk), bsns_year=str(year), reprt_code=reprt_code)
        by = {}
        for it in (d or {}).get("list") or []:
            k = ACCOUNTS.get((it.get("account_nm") or "").replace(" ", ""))
            v = num(it.get("thstrm_amount"))
            if not k or v is None:
                continue
            slot = by.setdefault(it["stock_code"], {}).setdefault(it.get("fs_div"), {})
            slot.setdefault(k, v)
        for sc, fs in by.items():
            out[sc] = {**fs.get("OFS", {}), **fs.get("CFS", {})}
    return out
