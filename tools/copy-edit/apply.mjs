// 문구 편집실(Artifact)의 수정 대기 문구를 사이트 코드에 반영
// 사용: node apply.mjs <사이트 폴더> <edits json 폴더> [--dry]
//   edits json 폴더: ArtifactData list(out_dir)로 받은 edits/<id>.json
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as acorn from 'acorn';
import { extractFile, escapeFor, idOf } from './copylib.mjs';

const [, , root, editsDir, flag] = process.argv;
const dry = flag === '--dry';
const dir = existsSync(join(editsDir, 'edits')) ? join(editsDir, 'edits') : editsDir;
const edits = {};
for (const f of readdirSync(dir).filter((f) => /^[0-9a-f]{10}.json$/.test(f))) {
  const raw = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  const d = raw.data || raw;
  if (d.status === 'applied') continue;
  const id = f.replace(/\.json$/, '');
  if (idOf(d.orig) !== id) { console.warn('건너뜀(원문과 id 불일치):', id); continue; }
  edits[id] = { ...d, id, hits: 0, locked: 0 };
}
const ids = Object.keys(edits);
console.log('수정 대기', ids.length);

const files = [
  ...readdirSync(root).filter((f) => f.endsWith('.html')),
  ...readdirSync(join(root, 'assets')).filter((f) => f.endsWith('.js')).map((f) => 'assets/' + f),
  ...readdirSync(join(root, 'assets/cardnews')).filter((f) => f.endsWith('.js')).map((f) => 'assets/cardnews/' + f),
].filter((f) => !/config(\.local)?\.js$/.test(f));

const changed = [];
for (const f of files) {
  const path = join(root, f);
  let src = readFileSync(path, 'utf8');
  const segs = extractFile(f, src).filter((s) => edits[idOf(s.text)]);
  if (!segs.length) continue;
  segs.sort((a, b) => b.start - a.start);
  for (const s of segs) {
    const e = edits[idOf(s.text)];
    if (s.logic) { e.locked++; continue; }
    src = src.slice(0, s.start) + escapeFor(s, e.text) + src.slice(s.end);
    e.hits++;
  }
  // 문법 확인
  const scripts = f.endsWith('.html')
    ? [...src.matchAll(/<script\b(?![^>]*\bsrc=)(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1])
    : [src];
  for (const code of scripts) {
    try { acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script' }); }
    catch (err) { try { acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module' }); } catch (err2) { console.error('문법 오류 — 반영 중단:', f, err2.message); process.exit(1); } }
  }
  changed.push([f, segs.length]);
  if (!dry) writeFileSync(path, src);
}
console.log(dry ? '(미리보기)' : '반영', changed.map(([f, n]) => `${f}(${n})`).join(' '));
const miss = ids.filter((id) => !edits[id].hits);
for (const id of miss) console.log('못 찾음:', id, JSON.stringify(edits[id].orig), edits[id].locked ? '(잠금 위치만 있음)' : '');
writeFileSync(join(editsDir, 'apply-result.json'), JSON.stringify(ids.map((id) => ({ id, hits: edits[id].hits, locked: edits[id].locked })), null, 1));
