// 단계 확인 도구 — 페이지마다 1440·390px로 열어 콘솔 오류 · 가로 스크롤을 검사하고 스크린샷을 남긴다.
// 사용: node check.mjs [페이지...] [--persona=am|ia|dma|etc|hnw] [--base=http://localhost:4210]
//   예) node check.mjs index.html home.html --persona=hnw
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => a.slice(2).split('=')));
const pages = args.filter(a => !a.startsWith('--'));
if (!pages.length) pages.push('index.html');
const BASE = (opt.base || 'http://localhost:4210').replace(/\/$/, '');
const WIDTHS = [1440, 390];
const OUT = join(HERE, 'shots');
mkdirSync(OUT, { recursive: true });

// 시연 세션 (2장 고객 유형) — --persona 없으면 세션 없이 연다
const DEMO = {
  am:  { name: '김민준', seg: '법인', cust_type: '자산운용사', org: '한빛자산운용(가상)' },
  ia:  { name: '이서연', seg: '법인', cust_type: '투자자문·일임사', org: '온결투자자문(가상)' },
  dma: { name: '박지훈', seg: '법인', cust_type: 'DMA 전문투자자', org: '개인 전문투자자(가상)' },
  etc: { name: '김민준', seg: '법인', cust_type: '기타 기관', org: '한빛자산운용(가상)' },
  hnw: { name: '최은정', seg: 'WM', cust_type: '고액자산가', branch: '강남금융센터(가상)' },
};
const session = opt.persona && DEMO[opt.persona]
  ? { role: 'customer', persona: opt.persona, status: 'approved', via: 'demo', ...DEMO[opt.persona] }
  : null;

const browser = await chromium.launch({ channel: 'msedge' });
let fail = 0;
for (const page of pages) {
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w > 500 ? 900 : 844 }, deviceScaleFactor: 1 });
    if (session) await ctx.addInitScript(s => localStorage.setItem('il.session', s), JSON.stringify(session));
    const p = await ctx.newPage();
    const errors = [];
    p.on('console', m => { if (m.type() === 'error') errors.push(`${m.text()} ${m.location()?.url || ''}`.trim()); });
    p.on('pageerror', e => errors.push(String(e)));
    p.on('requestfailed', r => errors.push(`요청 실패 ${r.url()} (${r.failure()?.errorText})`));
    const res = await p.goto(`${BASE}/${page}`, { waitUntil: 'networkidle' }).catch(e => (errors.push(String(e)), null));
    await p.waitForTimeout(400);
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth).catch(() => 0);
    const shot = join(OUT, `${page.replace(/[^\w.-]/g, '_')}@${w}.png`);
    await p.screenshot({ path: shot, fullPage: true }).catch(() => {});
    const ok = res && res.ok() && !errors.length && overflow <= 0;
    if (!ok) fail++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${page} @${w}px  상태 ${res?.status() ?? '-'} · 콘솔 오류 ${errors.length} · 가로 넘침 ${Math.max(overflow, 0)}px  → ${shot}`);
    errors.forEach(e => console.log('     · ' + e));
    await ctx.close();
  }
}
await browser.close();
process.exit(fail ? 1 : 0);
