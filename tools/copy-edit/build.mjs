// 사용: node build.mjs <strings.json> <스냅샷 표기> <출력 html>
import { readFileSync, writeFileSync } from 'node:fs';
const [, , src, snap, out] = process.argv;
const d = JSON.parse(readFileSync(src, 'utf8'));
d.snapshot = snap;
for (const e of d.entries) for (const l of e.locs) { l.c = l.c.slice(0, 140); delete l.k; }
const json = JSON.stringify(d).replace(/</g, '\u003c');
writeFileSync(out, readFileSync(new URL('./editor.tpl.html', import.meta.url), 'utf8').replace('__DATA__', () => json));
console.log('bytes', Buffer.byteLength(readFileSync(out)));
