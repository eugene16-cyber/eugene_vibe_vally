// 사용: node extract.mjs <사이트 폴더> <출력 json>
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { extractFile, idOf } from './copylib.mjs';

const root = process.argv[2], outPath = process.argv[3];
const PAGE_ORDER = ['index', 'signup', 'home', 'market', 'reports', 'global', 'conferences', 'events', 'desk', 'cardnews', 'quant', 'mypage', 'lounge', 'ask', 'admin'];
const DATA = new Set(['assets/events-data.js', 'assets/outreach-data.js', 'assets/disclosure-data.js', 'assets/conf-records.js']);
const SKIP = new Set(['assets/config.js', 'assets/config.local.js']);

const html = readdirSync(root).filter((f) => f.endsWith('.html'));
html.sort((a, b) => (PAGE_ORDER.indexOf(a.slice(0, -5)) + 99) % 100 - (PAGE_ORDER.indexOf(b.slice(0, -5)) + 99) % 100);
const pages = {};
const usedBy = {};
for (const f of html) {
  const src = readFileSync(join(root, f), 'utf8');
  const title = (src.match(/<title>([^<]*)<\/title>/) || [])[1] || f;
  const redirect = /http-equiv="refresh"/.test(src);
  pages[f] = { title: title.replace(/\s*·\s*유진 Insight Lab\s*$/, ''), redirect };
  for (const m of src.matchAll(/<script[^>]*src="(assets\/[^"?]+)/g)) (usedBy[m[1]] ||= []).push(f);
}
const js = [...readdirSync(join(root, 'assets')).filter((f) => f.endsWith('.js')).map((f) => 'assets/' + f),
  ...(existsSync(join(root, 'assets/cardnews')) ? readdirSync(join(root, 'assets/cardnews')).filter((f) => f.endsWith('.js')).map((f) => 'assets/cardnews/' + f) : [])];
const files = [...html.filter((f) => !pages[f].redirect), ...js.filter((f) => !SKIP.has(f))];

const byText = new Map();
const fileMeta = [];
for (const f of files) {
  const src = readFileSync(join(root, f), 'utf8');
  const segs = extractFile(f, src);
  let n = 0;
  for (const s of segs) {
    let e = byText.get(s.text);
    if (!e) { e = { id: idOf(s.text), text: s.text, file: f, locs: [], logic: false }; byText.set(s.text, e); n++; }
    e.locs.push({ f, l: s.line, c: s.ctx, k: s.kind });
    if (s.logic) e.logic = true;
  }
  const label = f.endsWith('.html') ? pages[f].title : (usedBy[f] || []).filter((p) => !pages[p]?.redirect).map((p) => pages[p].title).join(' · ') || '공용';
  fileMeta.push({ f, label, page: f.endsWith('.html') ? f.replace(/\.html$/, '') : null, data: DATA.has(f), shared: !f.endsWith('.html') && (usedBy[f] || []).length > 2, count: n });
}
const entries = [...byText.values()];
writeFileSync(outPath, JSON.stringify({ base: 'https://eugene-insightlab.pages.dev/', files: fileMeta, entries }));
console.log('files', fileMeta.length, 'entries', entries.length, 'logic', entries.filter((e) => e.logic).length);
for (const m of fileMeta) console.log(m.f.padEnd(34), String(m.count).padStart(5), m.label, m.data ? '[data]' : '');
