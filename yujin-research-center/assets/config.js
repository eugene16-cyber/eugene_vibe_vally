// 서버 주소 · Supabase 연결 정보 — 이 파일 한 곳에서만 바꾼다 (3장)
// anon key는 git에 넣지 않고 tools/make-config.mjs가 환경변수(supabase_api_anon_key)로 assets/config.local.js를 만든다.
window.IL_CONFIG = Object.assign({
  apiBase: '',        // lounge_api 주소 — 이번 범위에서는 서버 없음(정적 스냅샷)
  jarvisUrl: '',      // Jarvis 홀로그램 — 이번 범위에서는 CSS 오브
  supabaseUrl: 'https://cowwkddihelfgkftfqxr.supabase.co',
  supabaseAnonKey: ''
}, window.IL_CONFIG || {});
