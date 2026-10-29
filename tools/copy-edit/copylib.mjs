// 사이트 문구 추출 · 반영 공용 로직
// extractFile(rel, src) → [{text, start, end, kind, quote, line, ctx, logic}]
import * as acorn from 'acorn';
import { createHash } from 'node:crypto';

const HANGUL = /[가-힣]/;
const TAG = /<[^>]*>|\$\{[^}]*\}/g;

export const idOf = (text) => createHash('sha1').update(text).digest('hex').slice(0, 10);

function lineAt(src, pos) {
  let n = 1; for (let i = 0; i < pos; i++) if (src.charCodeAt(i) === 10) n++; return n;
}
function ctxAt(src, pos) {
  const a = src.lastIndexOf('\n', pos) + 1, b = src.indexOf('\n', pos);
  return src.slice(a, b < 0 ? undefined : b).trim().slice(0, 160);
}

// raw 문자열(태그 · ${} 포함)을 태그 사이 글자 조각으로 나눈다
function segments(raw, base, push) {
  let last = 0;
  const parts = [];
  raw.replace(TAG, (m, off) => {
    parts.push([last, off]); last = off + m.length;
    // 태그 안 속성값(aria-label · title · placeholder · alt)
    if (m[0] === '<') for (const a of m.matchAll(/\s(?:placeholder|title|aria-label|alt|data-label)=(["'])([^"']*)\1/g)) {
      if (!HANGUL.test(a[2])) continue;
      const s = off + a.index + a[0].indexOf(a[1]) + 1;
      push(a[2], base + s, base + s + a[2].length, true);
    }
    return m;
  });
  parts.push([last, raw.length]);
  for (const [a, b] of parts) {
    const piece = raw.slice(a, b);
    if (!HANGUL.test(piece)) continue;
    const lead = piece.length - piece.trimStart().length;
    const t = piece.trim();
    push(t, base + a + lead, base + a + lead + t.length);
  }
}

const LOGIC_OPS = new Set(['===', '==', '!==', '!=', 'in']);

function walkJs(code, offset, src, out) {
  let ast;
  try { ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true }); }
  catch (e) { try { ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module' }); } catch (e2) { out.err = e2.message; return; } }
  const visit = (node, parent, key) => {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'Literal' && typeof node.value === 'string' && HANGUL.test(node.raw)) {
      let logic = false;
      if (parent && parent.type === 'BinaryExpression' && LOGIC_OPS.has(parent.operator)) logic = true;
      if (parent && parent.type === 'SwitchCase' && key === 'test') logic = true;
      if (parent && parent.type === 'Property' && key === 'key') logic = true;
      if (parent && parent.type === 'MemberExpression' && key === 'property') logic = true;
      if (parent && parent.type === 'CallExpression' && parent.callee.type === 'MemberExpression' &&
          /^(indexOf|includes|startsWith|endsWith|match|split|replace|test|getItem|setItem|querySelector|querySelectorAll|getElementById)$/.test(parent.callee.property.name || '')) logic = true;
      if (parent && parent.type === 'CallExpression' && parent.callee.type === 'MemberExpression' &&
          parent.callee.object.name === 'console') return;
      const q = node.raw[0];
      const inner = node.raw.slice(1, -1);
      segments(inner, offset + node.start + 1, (t, s, e, attr) => out.push({ text: t, start: s, end: e, kind: 'js', quote: q, logic, attr }));
    }
    if (node.type === 'TemplateElement' && HANGUL.test(node.value.raw)) {
      segments(node.value.raw, offset + node.start, (t, s, e, attr) => out.push({ text: t, start: s, end: e, kind: 'js', quote: '`', logic: false, attr }));
    }
    for (const k of Object.keys(node)) {
      if (k === 'type' || k === 'start' || k === 'end') continue;
      const v = node[k];
      if (Array.isArray(v)) v.forEach((c) => visit(c, node, k));
      else if (v && typeof v.type === 'string') visit(v, node, k);
    }
  };
  visit(ast, null, null);
}

function walkHtml(src, out) {
  // 인라인 script / style 범위
  const skip = [];
  src.replace(/<(script|style)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (m, tag, attrs, body, off) => {
    const bodyStart = off + m.indexOf('>') + 1;
    skip.push([off, off + m.length]);
    if (tag.toLowerCase() === 'script' && !/\bsrc=/.test(attrs) && !/type="(application\/(ld\+)?json|text\/template)"/.test(attrs)) {
      walkJs(body, bodyStart, src, out);
    }
    return m;
  });
  src.replace(/<!--[\s\S]*?-->/g, (m, off) => { skip.push([off, off + m.length]); return m; });
  const inSkip = (p) => skip.some(([a, b]) => p >= a && p < b);
  // 텍스트 노드
  src.replace(/>([^<>]+)</g, (m, body, off) => {
    const s = off + 1;
    if (inSkip(s) || !HANGUL.test(body)) return m;
    segments(body, s, (t, a, b, attr) => out.push({ text: t, start: a, end: b, kind: attr ? 'attr' : 'html', quote: '"', logic: false }));
    return m;
  });
  // 속성값
  src.replace(/\s(placeholder|title|aria-label|alt|content|value|label|data-[\w-]+)="([^"]*)"/gi, (m, name, val, off) => {
    const s = off + m.indexOf('"') + 1;
    if (inSkip(s) || !HANGUL.test(val)) return m;
    const t = val.trim();
    const lead = val.length - val.trimStart().length;
    out.push({ text: t, start: s + lead, end: s + lead + t.length, kind: 'attr', quote: '"', logic: false });
    return m;
  });
}

export function extractFile(rel, src) {
  const out = [];
  if (rel.endsWith('.html')) walkHtml(src, out); else walkJs(src, 0, src, out);
  for (const o of out) { o.line = lineAt(src, o.start); o.ctx = ctxAt(src, o.start); }
  out.sort((a, b) => a.start - b.start);
  return out;
}

// 새 문구를 원래 자리의 따옴표 규칙에 맞게 이스케이프
export function escapeFor(o, text) {
  if (o.attr) text = text.replace(/"/g, '&quot;');
  if (o.kind === 'js') {
    if (o.quote === '`') return text.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
    return text.replace(new RegExp('(?<!\\\\)' + o.quote, 'g'), '\\' + o.quote).replace(/\r?\n/g, '\\n');
  }
  if (o.kind === 'attr') return text.replace(/"/g, '&quot;');
  return text;
}
