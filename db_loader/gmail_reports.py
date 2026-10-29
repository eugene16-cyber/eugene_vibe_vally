# -*- coding: utf-8 -*-
"""유진투자증권 리서치 메일(research@eugenefn.com) → reports.

Gmail(읽기 전용) 에서 리서치센터 발송 메일만 검색한다 — 다른 메일은 열지 않는다.
  제목 "[유진/애널리스트(-공동)]리포트 제목"  →  analyst · title
  본문 PDF 링크 파일명 "YYYYMMDD_<구분>_<작성자>_<번호>.pdf"
     <구분> 6자리 종목코드 → company(기업분석) · B+숫자 → sector(산업분석) · B → macro(투자전략)
  PDF 1쪽 → 첫 요약 문단(summary) · 투자의견 · 목표주가
  투자의견 · 목표주가는 기본값으로 비워 둔다(해커톤 지침: 실제 종목 추천으로 읽힐 표현 금지).
  넣으려면 python run.py --with-ratings
id = 발간일(YYYYMMDD) × 10^6 + 파일명 crc32 끝 6자리 (다시 실행해도 중복되지 않게)
인증: 프로젝트 루트 gmail_token.json 의 refresh_token (gmail.readonly)
"""
import base64
import datetime as dt
import json
import os
import re
import zlib

import requests

from common import get_bytes, KST, today

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
G = "https://gmail.googleapis.com/gmail/v1/users/me"
SENDER = "research@eugenefn.com"
RATING = {"STRONG BUY": "적극매수", "STRONGBUY": "적극매수", "BUY": "매수", "OUTPERFORM": "매수", "HOLD": "중립",
          "NEUTRAL": "중립", "MARKETPERFORM": "중립", "REDUCE": "비중축소", "UNDERPERFORM": "비중축소", "SELL": "매도"}
BULLET = re.compile(r"[▪●•■]")


def _token():
    t = json.load(open(os.path.join(ROOT, "gmail_token.json"), encoding="utf-8"))
    r = requests.post(t["token_uri"], timeout=30, data={"client_id": t["client_id"], "client_secret": t["client_secret"],
                                                        "refresh_token": t["refresh_token"], "grant_type": "refresh_token"})
    d = r.json()
    if "access_token" not in d:
        raise RuntimeError(f"Gmail 토큰 갱신 실패: {d.get('error_description') or d.get('error')}")
    return d["access_token"]


def _messages(h, days):
    q = f"from:{SENDER} after:{(today() - dt.timedelta(days=days)).strftime('%Y/%m/%d')}"
    ids, pt = [], None
    while True:
        d = requests.get(G + "/messages", headers=h, params={"q": q, "maxResults": 100, "pageToken": pt}, timeout=30).json()
        ids += [m["id"] for m in d.get("messages") or []]
        pt = d.get("nextPageToken")
        if not pt:
            return ids


def _parts(p):
    yield p
    for c in p.get("parts") or []:
        yield from _parts(c)


def _mail(h, mid):
    m = requests.get(G + f"/messages/{mid}", headers=h, params={"format": "full"}, timeout=30).json()
    hd = {x["name"].lower(): x["value"] for x in m["payload"]["headers"]}
    html = "".join(base64.urlsafe_b64decode(p["body"]["data"]).decode("utf-8", "ignore")
                   for p in _parts(m["payload"]) if p.get("mimeType") == "text/html" and p.get("body", {}).get("data"))
    pdf = re.search(r"https?://[^\"'\s>]+/amail/[^\"'\s>]+\.pdf", html)
    return hd.get("subject", ""), pdf.group(0) if pdf else None, int(m["internalDate"])


def _first_page(url):
    try:
        import pymupdf
        doc = pymupdf.open(stream=get_bytes(url), filetype="pdf")
        return doc[0].get_text() if doc.page_count else ""
    except Exception as e:
        print("    (PDF 읽기 생략:", str(e)[:60], ")")
        return ""


def _after(label, text):
    m = re.search(label + r"\s*\n\s*([^\n]+)", text)
    return m.group(1).strip() if m else None


def _summary(text):
    """첫 글머리 문단 → 없으면 이메일 줄 이후 첫 긴 문단."""
    parts = BULLET.split(text)
    if len(parts) > 1:
        cand = parts[1]
    else:
        cand = text.split("@eugenefn.com", 1)[-1]
    lines, buf = [l.strip() for l in cand.splitlines()], []
    for l in lines:
        if not l:
            if sum(map(len, buf)) >= 60:
                break
            buf = []
            continue
        buf.append(l)
    s = re.sub(r"\s+", " ", "".join(x if x.endswith((".", ",")) else x + " " for x in buf)).strip()
    s = re.sub(r"(\d) (월|일|년|%|조|억|만)", r"\1\2", s)      # PDF 추출 시 숫자 뒤에 끼는 공백
    s = re.sub(r"[-]", "", s).strip()              # 글머리 기호용 사용자 정의 문자
    return (s[:217] + "…") if len(s) > 220 else (s or None)


def parse(subject, url, ts, names, sectors, with_ratings=False):
    m = re.match(r"\s*\[유진/(?:[^\]/]+/)?([^\]]+)\]\s*(.+)", subject)
    if not m or not url:
        return None
    analyst, title = m.group(1).replace("-", ", "), m.group(2).strip()
    f = url.rsplit("/", 1)[-1][:-4]
    fp = f.split("_")
    pub = dt.datetime.fromtimestamp(ts / 1000, KST).date()
    if re.fullmatch(r"\d{8}", fp[0]):
        pub = dt.date(int(fp[0][:4]), int(fp[0][4:6]), int(fp[0][6:]))
    tag = fp[1] if len(fp) > 1 else "B"
    code = tag if re.fullmatch(r"\d{6}", tag) else (re.search(r"\((\d{6})", title) or [None, None])[1]
    kind = "company" if code else ("sector" if re.fullmatch(r"B\d+", tag) else "macro")
    company = names.get(code) if code else None
    if code and not company:                        # IPO 예정 등 마스터에 없는 종목 → 제목 앞부분
        company = re.split(r"[\s(\-]", title, 1)[0]
    page = _first_page(url)
    rating_raw = (_after("투자의견", page) or "").upper()
    rating_key = re.sub(r"\(.*", "", rating_raw).strip()
    tp = _after("목표주가", page)
    tp = re.match(r"[\d,]+원", tp).group(0) if tp and re.match(r"[\d,]+원", tp) else None
    rating = (RATING.get(rating_key) or RATING.get(rating_key.replace(" ", ""))) if kind == "company" else None
    if not with_ratings:
        rating = tp = None
    if kind == "company":
        category = sectors.get(code) or "기업분석"
    else:
        category = "산업분석" if kind == "sector" else "투자전략"
    return {
        "id": int(pub.strftime("%Y%m%d")) * 1_000_000 + zlib.crc32(f.encode()) % 1_000_000,
        "kind": kind, "category": category, "risk": None,
        "tone": "down" if rating in ("매도", "비중축소") else "up",
        "title": title, "summary": _summary(page), "company": company, "rating": rating, "target_price": tp,
        "analyst": analyst, "published_at": pub.isoformat(), "url": url,
    }


def crawl(days=7, with_ratings=False):
    import kis
    master = kis.stock_master()
    names = {m["code"]: m["name"] for m in master}
    sectors = {m["code"]: m["sector"] for m in master}
    h = {"Authorization": "Bearer " + _token()}
    ids = _messages(h, days)
    print(f"  리서치 메일 {len(ids)}건 (최근 {days}일)")
    rows, seen = [], set()
    for mid in ids:
        subject, url, ts = _mail(h, mid)
        if not url or url in seen:
            continue
        seen.add(url)
        r = parse(subject, url, ts, names, sectors, with_ratings)
        if r:
            rows.append(r)
    rows.sort(key=lambda r: (r["published_at"], r["id"]), reverse=True)
    print(f"  리포트 {len(rows)}건 · 기업 {sum(r['kind'] == 'company' for r in rows)} · 산업 {sum(r['kind'] == 'sector' for r in rows)}"
          f" · 전략 {sum(r['kind'] == 'macro' for r in rows)}")
    return rows


def push(sb, rows):
    return sb.upsert("reports", rows, on_conflict="id")


if __name__ == "__main__":
    import sys
    from common import save_preview
    r = crawl(int(sys.argv[1]) if len(sys.argv) > 1 else 7, "--with-ratings" in sys.argv)
    save_preview("reports", r)
    for x in r[:8]:
        print(x["published_at"], x["kind"], x["company"], x["rating"], x["target_price"], "|", x["title"][:30], "|", (x["summary"] or "")[:60])
