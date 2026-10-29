# -*- coding: utf-8 -*-
"""시연용 데이터 수집 → 새 Supabase 적재 (한 번에 실행).

  python run.py --dry-run                 # 적재 없이 수집만 → out/*.json 으로 확인 (Supabase 키 불필요)
  python run.py                           # 최근 7일 수집 + 적재 (카드뉴스 6건 포함, claude_api_key 있을 때)
  python run.py --days 14 --cardnews 9    # 기간 · 카드뉴스 개수 바꾸기
  python run.py --only reports,market     # 일부만 (reports stocks market themes global events quant cardnews)

데이터 출처
  reports  Gmail 리서치 메일(research@eugenefn.com) + PDF 1쪽      gmail_reports.py
  stocks   KIS 종목 마스터(공개 파일) + KIS 주봉                    stocks.py
  market   KIS 지수 · 업종 · 투자자 · 환율 (키 없으면 네이버)         kis_market.py
  themes   네이버 테마 (KIS · DART에 테마 데이터가 없음)             themes.py
  global   KIS 해외시세 + 신고가 스크리너 (키 없으면 yfinance)        kis_global.py
  events   DART 공시 + KIS 공시 후 주가 변동                         events.py
  quant    KIS 월봉 · 배당 + DART 사업보고서                        quant.py
  예전 네이버 리포트 수집기(reports.py)는 --only reports_naver 로 따로 돌릴 수 있다.
  가입 상담용 법인 디렉터리(DART 기업개황 · 약 3천 건 호출)는 자주 바뀌지 않아 --only corps 로 따로 돌린다.  corp_directory.py
"""
import argparse
import time

import gmail_reports
import reports
import stocks
import kis_market
import themes
import kis_global
import corp_directory
import events
import quant
from common import save_preview

STEPS = ["reports", "stocks", "market", "themes", "global", "events", "quant", "cardnews"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=7)
    ap.add_argument("--cardnews", type=int, default=6, help="새로 만들 카드뉴스 최대 개수 (0이면 생략)")
    ap.add_argument("--only", default=",".join(STEPS))
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--with-ratings", action="store_true", help="리포트 투자의견 · 목표주가까지 적재 (기본: 비움)")
    a = ap.parse_args()
    only = [s.strip() for s in a.only.split(",") if s.strip()]
    sb = None
    if not a.dry_run:
        from common import Supabase
        sb = Supabase()

    def step(name, fn_crawl, fn_push, preview):
        if name not in only:
            return
        t0 = time.time()
        print(f"\n▶ {name}")
        try:
            data = fn_crawl()
        except Exception as e:
            print(f"  ✗ 수집 실패: {e}")
            return
        if data is None:
            return
        if a.dry_run:
            for k, v in preview(data).items():
                save_preview(k, v)
            print(f"  → out/ 저장 ({time.time() - t0:.0f}s)")
        else:
            n = fn_push(sb, data)
            print(f"  → Supabase {n}행 적재 ({time.time() - t0:.0f}s)")

    step("reports", lambda: gmail_reports.crawl(a.days, a.with_ratings), gmail_reports.push, lambda d: {"reports": d})
    step("reports_naver", lambda: reports.crawl(a.days), reports.push, lambda d: {"reports_naver": d})
    step("stocks", stocks.crawl, stocks.push, lambda d: {"stocks": d})
    step("market", lambda: kis_market.crawl(a.days), kis_market.push, lambda d: {"market_snapshot": d})
    step("themes", themes.crawl, themes.push, lambda d: {"themes": d[0], "theme_constituents": d[1]})
    step("global", kis_global.crawl, kis_global.push,
         lambda d: {"global_indices": d[0], "global_sectors": d[1], "global_research": d[2], "global_quotes": d[3], "global_highs": d[4]})
    step("events", lambda: events.crawl(a.days), events.push, lambda d: {"events": d})
    step("corps", corp_directory.crawl, corp_directory.push, lambda d: {"corp_directory": d})
    step("quant", quant.crawl, quant.push,
         lambda d: {"quant_stock_stats": d[0], "quant_factor_returns": d[1], "quant_factor_meta": d[2]} if d else {})
    if "cardnews" in only and a.cardnews > 0:
        print("\n▶ cardnews")
        if a.dry_run:
            print("  (dry-run에서는 생략 — 적재된 reports를 읽어 만들기 때문)")
        else:
            import cardnews
            print(f"  → 카드뉴스 {cardnews.run(sb, a.days, a.cardnews)}건 적재")
    print("\n완료.")


if __name__ == "__main__":
    main()