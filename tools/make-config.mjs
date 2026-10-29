// 환경변수 supabase_api_anon_key → yujin-research-center/assets/config.local.js (git 제외)
// 사용: node tools/make-config.mjs
import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const NAME = 'supabase_api_anon_key';
let key = process.env[NAME] || '';
if (!key && process.platform === 'win32') {
  // setx 직후라 이 프로세스 환경에 아직 없으면 사용자 레지스트리에서 읽는다
  try {
    const out = execSync(`reg query HKCU\\Environment /v ${NAME}`, { encoding: 'utf8' });
    key = (out.match(new RegExp(`${NAME}\\s+REG_\\w+\\s+(\\S+)`)) || [])[1] || '';
  } catch {}
}
if (!key) { console.error(`${NAME} 환경변수를 찾지 못했어요.`); process.exit(1); }

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'yujin-research-center', 'assets', 'config.local.js');
writeFileSync(out, `// 자동 생성 — 커밋하지 않음 (tools/make-config.mjs)\nwindow.IL_CONFIG.supabaseAnonKey = ${JSON.stringify(key)};\n`);
console.log('작성:', out);
