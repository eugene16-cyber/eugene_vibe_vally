# -*- coding: utf-8 -*-
"""한국투자증권 Open API 공용 클라이언트 + 종목 마스터(공개 파일) 파서.

환경변수
  kis_app_key · kis_app_secret   KIS Developers에서 발급 (모든 시세 조회에 필요)
  kis_env                        real(기본, 실전투자) | vts(모의투자 — 초당 2건 제한)
토큰: 프로젝트 루트 kis_token.json 을 재사용하고, 만료됐으면 새로 받아 같은 파일에 덮어쓴다(하루 1회 발급 권장).
종목 마스터(kospi_code.mst 등)는 키 없이 받는 공개 파일이라 kis_app_key 가 없어도 동작한다.
"""
import datetime as dt
import io
import json
import os
import time
import zipfile

import requests

from common import env, KST, UA

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOKEN_FILE = os.path.join(ROOT, "kis_token.json")
MASTER = "https://new.real.download.dws.co.kr/common/master/"
HOSTS = {"real": "https://openapi.koreainvestment.com:9443", "vts": "https://openapivts.koreainvestment.com:29443"}


class KISError(RuntimeError):
    pass


class KIS:
    def __init__(self):
        self.key, self.secret = env("kis_app_key"), env("kis_app_secret")
        if not self.key or not self.secret:
            raise KISError("환경변수 kis_app_key, kis_app_secret 이 없어요 (KIS Developers 앱키 · 앱시크릿).")
        mode = (env("kis_env") or "real").lower()
        self.host = HOSTS.get(mode, HOSTS["real"])
        self.gap = 0.55 if mode == "vts" else 0.07          # 실전 초당 20건 · 모의 초당 2건 제한보다 여유 있게
        self._last = 0.0
        self.token = self._token()
        self.s = requests.Session()

    # ───────── 토큰 ─────────
    def _token(self):
        try:
            t = json.load(open(TOKEN_FILE, encoding="utf-8"))
            if dt.datetime.fromisoformat(t["expires_at"]) - dt.timedelta(minutes=30) > dt.datetime.now():
                return t["access_token"]
        except (OSError, ValueError, KeyError):
            pass
        r = requests.post(self.host + "/oauth2/tokenP", timeout=20,
                          json={"grant_type": "client_credentials", "appkey": self.key, "appsecret": self.secret})
        d = r.json()
        if "access_token" not in d:
            raise KISError(f"토큰 발급 실패: {d.get('error_description') or d}")
        exp = dt.datetime.strptime(d["access_token_token_expired"], "%Y-%m-%d %H:%M:%S")
        with open(TOKEN_FILE, "w", encoding="utf-8") as f:
            json.dump({"access_token": d["access_token"], "expires_at": exp.isoformat()}, f)
        return d["access_token"]

    # ───────── 호출 ─────────
    def get(self, path, tr_id, params, tries=3):
        h = {"content-type": "application/json; charset=utf-8", "authorization": "Bearer " + self.token,
             "appkey": self.key, "appsecret": self.secret, "tr_id": tr_id, "custtype": "P", "User-Agent": UA}
        for i in range(tries):
            wait = self._last + self.gap - time.time()
            if wait > 0:
                time.sleep(wait)
            self._last = time.time()
            try:
                r = self.s.get(self.host + path, params=params, headers=h, timeout=20)
                d = r.json()
            except (requests.RequestException, ValueError):
                time.sleep(1.0 * (i + 1)); continue
            if d.get("rt_cd") == "0":
                return d
            if d.get("msg_cd") == "EGW00201":            # 초당 거래건수 초과 → 잠깐 쉬고 다시
                time.sleep(1.0 * (i + 1)); continue
            raise KISError(f"{tr_id} {d.get('msg_cd')} {d.get('msg1')}")
        raise KISError(f"{tr_id} 응답 없음")

    # ───────── 국내 ─────────
    def stock_chart(self, code, start, end, period="D"):
        """국내주식 기간별시세(수정주가) → (요약 output1, [최신→과거 일/주/월봉]). 한 번에 최대 100개."""
        d = self.get("/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice", "FHKST03010100", {
            "FID_COND_MRKT_DIV_CODE": "J", "FID_INPUT_ISCD": code, "FID_INPUT_DATE_1": _ymd(start),
            "FID_INPUT_DATE_2": _ymd(end), "FID_PERIOD_DIV_CODE": period, "FID_ORG_ADJ_PRC": "0"})
        return d.get("output1") or {}, [r for r in d.get("output2") or [] if r.get("stck_bsop_date")]

    def index_chart(self, code, start, end, period="D"):
        """국내 업종(지수) 기간별시세 — code: 0001 코스피 · 1001 코스닥 · 0005~ 업종 (idxcode.mst)."""
        d = self.get("/uapi/domestic-stock/v1/quotations/inquire-daily-indexchartprice", "FHKUP03500100", {
            "FID_COND_MRKT_DIV_CODE": "U", "FID_INPUT_ISCD": code, "FID_INPUT_DATE_1": _ymd(start),
            "FID_INPUT_DATE_2": _ymd(end), "FID_PERIOD_DIV_CODE": period})
        return d.get("output1") or {}, [r for r in d.get("output2") or [] if r.get("stck_bsop_date")]

    def investor_by_market(self, market, date):
        """시장별 투자자매매동향(일별) — market: KSP | KSQ. 순매수 대금 단위: 백만원."""
        iscd = "0001" if market == "KSP" else "1001"
        d = self.get("/uapi/domestic-stock/v1/quotations/inquire-investor-daily-by-market", "FHPTJ04040000", {
            "FID_COND_MRKT_DIV_CODE": "U", "FID_INPUT_ISCD": iscd, "FID_INPUT_DATE_1": _ymd(date),
            "FID_INPUT_ISCD_1": market, "FID_INPUT_DATE_2": _ymd(date), "FID_INPUT_ISCD_2": iscd})
        out = d.get("output") or d.get("output1") or []
        return out if isinstance(out, list) else [out]

    def dividends(self, start, end):
        """예탁원 배당일정 (전 종목, 기간) → [{sht_cd, record_date, per_sto_divi_amt, ...}]"""
        rows, cts = [], ""
        for _ in range(200):
            d = self.get("/uapi/domestic-stock/v1/ksdinfo/dividend", "HHKDB669102C0", {
                "CTS": cts, "GB1": "0", "F_DT": _ymd(start), "T_DT": _ymd(end), "SHT_CD": "", "HIGH_GB": ""})
            rows += d.get("output1") or []
            cts = (d.get("ctx_area_fk100") or d.get("CTS") or "").strip()
            if not cts or not d.get("output1"):
                break
        return rows

    # ───────── 해외 ─────────
    def overseas_chart(self, excd, symb, upto=None):
        """해외주식 기간별시세(일봉, 수정주가) → [최신→과거] 최대 100개. excd: NAS · NYS · AMS"""
        d = self.get("/uapi/overseas-price/v1/quotations/dailyprice", "HHDFS76240000", {
            "AUTH": "", "EXCD": excd, "SYMB": symb, "GUBN": "0", "BYMD": _ymd(upto) if upto else "", "MODP": "1"})
        return [r for r in d.get("output2") or [] if r.get("xymd") and r.get("clos")]

    def overseas_index_chart(self, code, start, end, kind="N"):
        """해외지수(N) · 환율(X) · 국채(I) 기간별시세 → (output1, [최신→과거])"""
        d = self.get("/uapi/overseas-price/v1/quotations/inquire-daily-chartprice", "FHKST03030100", {
            "FID_COND_MRKT_DIV_CODE": kind, "FID_INPUT_ISCD": code, "FID_INPUT_DATE_1": _ymd(start),
            "FID_INPUT_DATE_2": _ymd(end), "FID_PERIOD_DIV_CODE": "D"})
        return d.get("output1") or {}, [r for r in d.get("output2") or [] if r.get("stck_bsop_date")]


def _ymd(d):
    return d.strftime("%Y%m%d") if hasattr(d, "strftime") else str(d).replace("-", "")


def client_or_none():
    try:
        return KIS()
    except KISError as e:
        print("  KIS 사용 불가:", e)
        return None


# ───────── 종목 마스터 (공개 파일 · 키 불필요) ─────────
_KOSPI_W = [2, 1, 4, 4, 4] + [1] * 26 + [9, 5, 5, 1, 1, 1, 2, 1, 1, 1, 2, 2, 2, 3, 1, 3, 12, 12, 8, 15, 21, 2, 7,
                                         1, 1, 1, 1, 1, 9, 9, 9, 5, 9, 8, 9, 3, 1, 1, 1]
_KOSPI_C = ["group", "cap_size", "idx_l", "idx_m", "idx_s", "mfg", "low_liq", "gov", "k200_sector", "k100", "k50", "krx",
            "etp", "elw", "krx100", "krx_auto", "krx_semi", "krx_bio", "krx_bank", "spac", "krx_energy", "krx_steel",
            "overheat", "krx_media", "krx_const", "non1", "krx_sec", "krx_ship", "krx_ins", "krx_trans", "sri", "base_px",
            "lot", "lot_ext", "halt", "liquidation", "admin", "warn", "warn_pre", "unfaithful", "backdoor", "lock",
            "par_chg", "cap_inc", "margin", "credit", "credit_days", "prev_vol", "par", "listed", "shares_k", "capital",
            "fiscal_month", "ipo_px", "pref", "short_overheat", "surge", "krx300", "kospi", "sales", "op_income",
            "ord_income", "net_income", "roe", "base_ym", "mcap_eok", "group_co", "credit_limit", "loan", "lend"]
_KOSDAQ_W = [2, 1, 4, 4, 4] + [1] * 21 + [9, 5, 5, 1, 1, 1, 2, 1, 1, 1, 2, 2, 2, 3, 1, 3, 12, 12, 8, 15, 21, 2, 7,
                                          1, 1, 1, 1, 9, 9, 9, 5, 9, 8, 9, 3, 1, 1, 1]
_KOSDAQ_C = ["group", "cap_size", "idx_l", "idx_m", "idx_s", "venture", "low_liq", "krx", "etp", "krx100", "krx_auto",
             "krx_semi", "krx_bio", "krx_bank", "spac", "krx_energy", "krx_steel", "overheat", "krx_media", "krx_const",
             "caution", "krx_sec", "krx_ship", "krx_ins", "krx_trans", "kosdaq150", "base_px", "lot", "lot_ext", "halt",
             "liquidation", "admin", "warn", "warn_pre", "unfaithful", "backdoor", "lock", "par_chg", "cap_inc", "margin",
             "credit", "credit_days", "prev_vol", "par", "listed", "shares_k", "capital", "fiscal_month", "ipo_px", "pref",
             "short_overheat", "surge", "krx300", "sales", "op_income", "ord_income", "net_income", "roe", "base_ym",
             "mcap_eok", "group_co", "credit_limit", "loan", "lend"]


GENERIC_IDX = ("제조", "대형주", "중형주", "소형주", "코스닥 대형주", "코스닥 중형주", "코스닥 소형주")


def _download(name):
    z = zipfile.ZipFile(io.BytesIO(requests.get(MASTER + name + ".zip", headers={"User-Agent": UA}, timeout=60).content))
    return z.read(z.namelist()[0]).decode("cp949", errors="replace")


def _parse(text, widths, cols):
    tail = sum(widths)
    out = []
    for line in text.splitlines():
        if len(line) <= tail:
            continue
        head, body = line[:-tail], line[-tail:]
        d, i = {"code": head[:9].strip(), "name": head[21:].strip()}, 0
        for w, c in zip(widths, cols):
            d[c] = body[i:i + w].strip(); i += w
        out.append(d)
    return out


def _int(s):
    try:
        return int(float(s))
    except (TypeError, ValueError):
        return None


def stock_master(common_only=True):
    """코스피 · 코스닥 상장 종목 → [{code, name, market, sector, mcap_bil, shares, fiscal_month, kospi200, kosdaq150,
    krx300, pref, roe, net_income_eok, ...}]  (common_only: 주권(ST)만 — ETF/ETN/리츠/스팩 제외)"""
    idx = {line[1:5]: line[5:].strip() for line in _download("idxcode.mst").splitlines() if len(line) > 5}
    rows = []
    for market, (w, c) in (("KOSPI", (_KOSPI_W, _KOSPI_C)), ("KOSDAQ", (_KOSDAQ_W, _KOSDAQ_C))):
        for d in _parse(_download(("kospi" if market == "KOSPI" else "kosdaq") + "_code.mst"), w, c):
            if common_only and (d["group"] != "ST" or d.get("spac") == "Y"):
                continue
            names = [idx[k] for k in (d["idx_m"], d["idx_s"], d["idx_l"]) if k and k != "0000" and idx.get(k)]
            sector = next((n for n in names if n not in GENERIC_IDX), names[0] if names else None)
            mcap = _int(d["mcap_eok"])
            rows.append({
                "code": d["code"], "name": d["name"], "market": market, "sector": sector,
                "mcap_bil": round(mcap / 10, 1) if mcap else None,          # 억 → 십억(bil)
                "shares": (_int(d["shares_k"]) or 0) * 1000 or None,
                "fiscal_month": d["fiscal_month"] or None,
                "kospi200": market == "KOSPI" and d.get("k200_sector") not in ("", "0"),
                "kosdaq150": market == "KOSDAQ" and d.get("kosdaq150") == "Y",
                "krx300": d.get("krx300") == "Y",
                "pref": d.get("pref") not in ("", "0"),
                "halt": d.get("halt") == "Y", "admin": d.get("admin") == "Y",
                "roe": _num(d.get("roe")), "base_ym": d.get("base_ym") or None,
            })
    return rows


def _num(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def overseas_master():
    """나스닥 · 뉴욕 · 아멕스 종목 마스터 → {symbol: (excd, 한글명, 영문명)}"""
    out = {}
    for excd, f in (("NAS", "nasmst"), ("NYS", "nysmst"), ("AMS", "amsmst")):
        z = zipfile.ZipFile(io.BytesIO(requests.get(MASTER + f + ".cod.zip", headers={"User-Agent": UA}, timeout=60).content))
        for line in z.read(z.namelist()[0]).decode("cp949", errors="replace").splitlines():
            p = line.split("\t")
            if len(p) > 7 and p[4]:
                out.setdefault(p[4].strip(), (excd, p[6].strip(), p[7].strip()))
    return out


def now_kst():
    return dt.datetime.now(KST)
