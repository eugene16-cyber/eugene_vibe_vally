# -*- coding: utf-8 -*-
"""공용: 환경변수 · HTTP(재시도) · Supabase upsert/삭제 · 숫자 형식.

환경변수 (setx 로 등록한 소문자 이름 그대로 · Windows는 대소문자 구분 없음)
  supabase_url          새 Supabase 프로젝트 URL            (적재할 때 필수)
  supabase_service_key  service_role 키 — 사이트 코드 · git에 절대 넣지 않는다
  claude_api_key        (선택) 카드뉴스 생성 · 시황 요약
  dart_api_key          (선택) 종목 이벤트(DART 공시)
"""
import datetime as dt
import json
import os
import re
import sys
import time

import requests

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"
KST = dt.timezone(dt.timedelta(hours=9))


# 같은 키를 다른 이름으로 setx 해 둔 경우 (앞에서부터 찾음)
ALIASES = {
    "supabase_service_key": ("supabase_service_key", "supabase_service_role"),
    "dart_api_key": ("dart_api_key", "dart_api"),
    "kis_app_key": ("kis_app_key", "kis_appkey"),
    "kis_app_secret": ("kis_app_secret", "kis_appsecret"),
}
SUPABASE_URL = "https://cowwkddihelfgkftfqxr.supabase.co"   # 공개 주소 (키 아님)


def env(name):
    """os.environ → (Windows) setx로 저장했지만 현재 프로세스에 아직 없는 사용자 환경변수 순으로 찾는다."""
    if name in ALIASES:
        return next((v for v in map(_env1, ALIASES[name]) if v), None)
    return _env1(name)


def _env1(name):
    for k in (name, name.upper(), name.lower()):
        if os.environ.get(k):
            return os.environ[k].strip()
    if os.name == "nt":
        try:
            import winreg
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as key:
                for k in (name, name.upper(), name.lower()):
                    try:
                        v, _ = winreg.QueryValueEx(key, k)
                        if v:
                            return str(v).strip()
                    except FileNotFoundError:
                        pass
        except OSError:
            pass
    return None


def today():
    return dt.datetime.now(KST).date()


# ───────── HTTP ─────────
_session = requests.Session()
_session.headers.update({"User-Agent": UA})


def get_json(url, params=None, referer="https://m.stock.naver.com/", tries=3, timeout=20):
    for i in range(tries):
        try:
            r = _session.get(url, params=params, headers={"Referer": referer}, timeout=timeout)
            if r.status_code == 200:
                return r.json()
            if r.status_code in (400, 404, 410):
                return None
        except (requests.RequestException, ValueError):
            pass
        time.sleep(1.5 * (i + 1))
    return None


def get_bytes(url, timeout=60):
    r = _session.get(url, timeout=timeout)
    r.raise_for_status()
    return r.content


# ───────── 숫자 형식 (사이트 표시 규칙과 같게) ─────────
def num(x):
    """'1,234.5' · '+3,316' · 12 → float (실패 시 None)"""
    if x is None:
        return None
    try:
        return float(re.sub(r"[^0-9.+\-]", "", str(x)))
    except ValueError:
        return None


def pct(x, d=2):
    """-2.64 → '-2.64%' · 1.2 → '+1.20%'"""
    v = num(x)
    return None if v is None else f"{v:+.{d}f}%"


def eok(x):
    """'+3,316' → '+3,316억' (단위: 억원)"""
    v = num(x)
    return None if v is None else f"{v:+,.0f}억"


def strip_html(s):
    s = re.sub(r"<br\s*/?>|</p>", " ", s or "")
    s = re.sub(r"<[^>]+>", "", s)
    s = s.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"')
    return re.sub(r"\s+", " ", s).strip()


# ───────── Supabase ─────────
class Supabase:
    def __init__(self):
        self.url = (env("supabase_url") or SUPABASE_URL).rstrip("/")
        self.key = env("supabase_service_key")
        if not self.key:
            sys.exit("환경변수 supabase_service_role(또는 supabase_service_key)이 없어요.")

    def _h(self, extra=None):
        h = {"apikey": self.key, "Authorization": "Bearer " + self.key, "Content-Type": "application/json"}
        h.update(extra or {})
        return h

    def upsert(self, table, rows, on_conflict=None, batch=500):
        if not rows:
            return 0
        q = f"?on_conflict={on_conflict}" if on_conflict else ""
        ok = 0
        for i in range(0, len(rows), batch):
            chunk = rows[i:i + batch]
            r = requests.post(f"{self.url}/rest/v1/{table}{q}", data=json.dumps(chunk, ensure_ascii=False).encode("utf-8"),
                              headers=self._h({"Prefer": "resolution=merge-duplicates,return=minimal"}), timeout=120)
            if r.status_code in (200, 201, 204):
                ok += len(chunk)
            else:
                print(f"  ! {table} upsert 실패 {r.status_code}: {r.text[:300]}")
        return ok

    def delete_all(self, table, col="id"):
        """교체 적재용: 기존 행을 모두 지운다 (사이트가 week 구분 없이 전체를 읽는 테이블)."""
        r = requests.delete(f"{self.url}/rest/v1/{table}?{col}=not.is.null", headers=self._h(), timeout=60)
        if r.status_code not in (200, 204):
            print(f"  ! {table} 삭제 실패 {r.status_code}: {r.text[:200]}")

    def select(self, table, params):
        r = requests.get(f"{self.url}/rest/v1/{table}", params=params, headers=self._h(), timeout=60)
        r.raise_for_status()
        return r.json()


def save_preview(name, rows):
    """--dry-run 용: out/<name>.json 에 저장해 눈으로 확인."""
    d = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, name + ".json"), "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=1, default=str)