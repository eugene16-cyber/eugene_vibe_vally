-- 가입 상담용 법인 디렉터리 (corp_directory.py 가 채운다) — Supabase SQL Editor 에서 한 번 실행
create extension if not exists pg_trgm;

create table if not exists public.corp_directory (
  corp_code     text primary key,          -- DART 고유번호 8자리
  name          text not null,             -- 표시 이름 (상장사는 종목명, 그 외는 공시 회사명에서 (주) 제거)
  name_key      text not null,             -- 검색 키: (주)·주식회사·공백 제거, 소문자
  name_eng      text,
  alias         text[] default '{}',       -- 공시 회사명 · 영문명 · 종목명
  search_key    text,                      -- 이름 · 별칭 검색 키를 | 로 이은 것 → search_key=ilike.*입력*
  stock_code    text,                      -- 상장사 6자리
  market        text,                      -- KOSPI · KOSDAQ · KONEX · 비상장
  kind          text,                      -- 자산운용 · 투자자문 · 보험 · 은행 · 연기금·공제회 · 증권 · 캐피탈 · 금융지주 · 일반 법인
  type          text,                      -- 가입 채팅 기업 분류: 자산운용사 · 투자자문사 · 연기금·보험·은행 · 일반 법인
  induty_code   text,                      -- 한국표준산업분류
  industry      text,
  sectors       text[] default '{}',       -- 가입 채팅 섹터 칩으로 바꾼 본업 섹터 (금융사는 비움)
  founded       int,
  est_date      date,
  fiscal_month  int,
  region        text,                      -- 시/도
  homepage      text,
  fin_year      int,                       -- 재무 기준 사업연도
  assets_eok    bigint,
  equity_eok    bigint,
  sales_eok     bigint,
  op_income_eok bigint,
  aum           text,                      -- DART에 없음 — 대화로 확인
  aum_bucket    text,
  note          text,
  updated_at    timestamptz default now()
);

create index if not exists corp_directory_search_key_trgm on public.corp_directory using gin (search_key gin_trgm_ops);
create index if not exists corp_directory_stock_code on public.corp_directory (stock_code);

alter table public.corp_directory enable row level security;
drop policy if exists "corp_directory read" on public.corp_directory;
create policy "corp_directory read" on public.corp_directory for select to anon, authenticated using (true);
