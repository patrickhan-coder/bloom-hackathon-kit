# Build data/teams.seed.json from the team-registration sheet export (Drive JSON or CSV), then import it with scripts/seed.mjs.
# usage: python3 scripts/build-seed.py <sheet.csv | drive-export.json> [out.json]
# Columns: 팀명, 이름 (one per member), 이메일... (any column starting with 이메일), 참석 승인 여부 (TRUE = approved).
# Only approved teams. Emails are stored as salted SHA-256 only; EMAIL_SALT comes from the environment or .env.local
# and must match the server's (the API falls back to 'dev-salt' when it is not set, so this does too).
import csv, io, json, os, sys, hashlib, re, base64
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
src = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(root, 'data', 'teams.seed.json')
raw = open(src, encoding='utf-8').read()
try:
    d = json.loads(raw); c = d['content']
    try: raw = base64.b64decode(c).decode('utf-8')
    except Exception: raw = c
except json.JSONDecodeError:
    pass
env = {}
if os.path.exists(os.path.join(root, '.env.local')):
    env = dict(l.strip().split('=', 1) for l in open(os.path.join(root, '.env.local')) if '=' in l and not l.startswith('#'))
salt = os.environ.get('EMAIL_SALT') or env.get('EMAIL_SALT', '').strip('"') or 'dev-salt'
rows = list(csv.reader(io.StringIO(raw))); hdr = rows[0]
idx = lambda h: [i for i, x in enumerate(hdr) if x == h]
ti = idx('팀명')[0]; ni = idx('이름'); ei = [i for i, x in enumerate(hdr) if x.startswith('이메일')]; ai = idx('참석 승인 여부')[0]
teams, seen = [], {}
for r in rows[1:]:
    r = r + [''] * (len(hdr) - len(r))
    if r[ai].strip().upper() != 'TRUE': continue
    name = r[ti].strip()
    members = [r[i].strip() for i in ni if r[i].strip()]
    emails = [r[i].strip().lower() for i in ei if '@' in r[i]]
    tid = re.sub(r'[^a-z0-9가-힣]+', '-', name.lower()).strip('-')[:40] or 'team'
    if tid in seen: seen[tid] += 1; tid = f'{tid}-{seen[tid]}'
    else: seen[tid] = 1
    teams.append({'id': tid, 'name': name, 'members': members, 'emailHashes': [hashlib.sha256((salt + e).encode()).hexdigest() for e in emails]})
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
json.dump(teams, open(out, 'w'), ensure_ascii=False, indent=1)
print(len(teams), 'teams,', sum(len(t['members']) for t in teams), 'people,', sum(len(t['emailHashes']) for t in teams), 'email hashes ->', out)
print('no-email teams:', [t['name'] for t in teams if not t['emailHashes']])
