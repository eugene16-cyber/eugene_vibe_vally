
import json, os, sys, urllib.parse, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
NEW = os.environ.get('supabase_url', '').rstrip('/')
KEY = os.environ.get('supabase_service_key', '')
if not NEW or not KEY:
    sys.exit('supabase_url, supabase_service_key 환경변수를 먼저 넣어 주세요. (README.md 2단계)')
OLD_PUBLIC = 'https://zvnnpwdfeaakhxklcjfk.supabase.co/storage/v1/object/public/'
NEW_PUBLIC = NEW + '/storage/v1/object/public/'
H = {'apikey': KEY, 'Authorization': 'Bearer ' + KEY}

# 부모 → 자식 순서 (외래키는 없지만 읽기 쉬운 순서)
ORDER = ['stocks', 'reports', 'card_news', 'market_snapshot', 'ai_briefings', 'insights', 'events',
         'themes', 'theme_constituents', 'theme_news', 'theme_signals',
         'global_indices', 'global_research', 'global_sectors', 'global_highs', 'global_quotes', 'global_deep_research',
         'quant_theme_constituents', 'quant_stock_stats', 'quant_factor_returns', 'quant_factor_meta', 'quant_tearsheets']
CONFLICT = {'market_snapshot': 'snapshot_date', 'ai_briefings': 'kind,brief_date', 'global_indices': 'symbol',
            'global_sectors': 'symbol', 'global_highs': 'ticker', 'global_quotes': 'ticker', 'global_deep_research': 'ticker',
            'stocks': 'code', 'quant_theme_constituents': 'theme_name,code', 'quant_stock_stats': 'code',
            'quant_factor_returns': 'factor_id,month', 'quant_factor_meta': 'factor_id', 'quant_tearsheets': 'key'}

def call(method, path, body=None, headers=None, raw=None):
    data = raw if raw is not None else (json.dumps(body, ensure_ascii=False).encode('utf-8') if body is not None else None)
    req = urllib.request.Request(NEW + path, data=data, method=method, headers={**H, **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()

# 1) Storage 업로드
uploaded = set()
sroot = os.path.join(HERE, 'storage')
for bucket in sorted(os.listdir(sroot)) if os.path.isdir(sroot) else []:
    for name in sorted(os.listdir(os.path.join(sroot, bucket))):
        p = os.path.join(sroot, bucket, name)
        ctype = {'.mp4': 'video/mp4', '.webp': 'image/webp', '.html': 'text/html; charset=utf-8'}.get(os.path.splitext(name)[1], 'application/octet-stream')
        st, msg = call('POST', f'/storage/v1/object/{bucket}/{urllib.parse.quote(name)}',
                       raw=open(p, 'rb').read(), headers={'Content-Type': ctype, 'x-upsert': 'true'})
        if st in (200, 201):
            uploaded.add(f'{bucket}/{name}')
        else:
            print(f'  ! 업로드 실패 {bucket}/{name}: {st} {msg[:120]!r}')
print(f'Storage 업로드 {len(uploaded)}개')

def fix_url(v):
    """옛 Storage 주소 → 새 주소 (이번에 올린 파일만. 나머지는 옛 주소 그대로 둠)"""
    if isinstance(v, str) and v.startswith(OLD_PUBLIC):
        rel = urllib.parse.unquote(v[len(OLD_PUBLIC):].split('?')[0])
        if rel in uploaded:
            return NEW_PUBLIC + v[len(OLD_PUBLIC):].split('?')[0]
    return v

# 2) 테이블 upsert (500행씩)
total = 0
for t in ORDER:
    f = os.path.join(HERE, 'data', t + '.json')
    if not os.path.exists(f):
        continue
    rows = [{k: fix_url(v) for k, v in r.items()} for r in json.load(open(f, encoding='utf-8'))]
    q = f'?on_conflict={CONFLICT[t]}' if t in CONFLICT else ''
    ok = 0
    for i in range(0, len(rows), 500):
        st, msg = call('POST', f'/rest/v1/{t}{q}', rows[i:i + 500],
                       {'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=minimal'})
        if st in (200, 201, 204):
            ok += len(rows[i:i + 500])
        else:
            print(f'  ! {t} {i}~: {st} {msg[:200]!r}')
    total += ok
    print(f'{t:28s} {ok}/{len(rows)}')
print(f'완료: {total}행. 이제 SQL Editor에서 3_after_import.sql을 실행하세요.')