#!/usr/bin/env python3
"""Topic declaration status per mission, for the VCs.
  topic_report.py post [final]   -> posts the status to the ops room
  topic_report.py json           -> prints per-mission data (for VC emails)
env: ADMIN_KEY, HACKATHON_BASE_URL; for post also DISCORD_BOT_TOKEN, OPS_CHANNEL_ID"""
import json, os, sys, urllib.request, datetime
E = os.environ.get
key = E('ADMIN_KEY') or sys.exit('ADMIN_KEY is not set (see .env.example)')
base = E('HACKATHON_BASE_URL', 'http://localhost:4400').rstrip('/')
s = json.load(urllib.request.urlopen(urllib.request.Request(base + '/api/state?scope=admin', headers={'x-key': key, 'User-Agent': 'hackathon-report'}), timeout=30))
tf = s.get('teamsFull') or s['teams']; teams = {t['id']: t for t in (tf.values() if isinstance(tf, dict) else tf)}
topics = s['config']['topics']; dec = s.get('topics') or {}
VCN = {v['key']: v['name'] for v in s.get('vcs') or []}
by = {t['id']: [] for t in topics}
for tid, r in dec.items():
    by.setdefault(r['topic'], []).append({'team': teams.get(tid, {}).get('name', tid), 'idea': r.get('idea', ''), 'market': r.get('market', ''), 'repo': r.get('repo', ''), 'at': r.get('at')})
for v in by.values(): v.sort(key=lambda x: x['at'] or 0)
missing = sorted(t['name'] for tid, t in teams.items() if tid not in dec)
if len(sys.argv) < 2 or sys.argv[1] not in ('post', 'json'): sys.exit(__doc__)
if sys.argv[1] == 'json':
    print(json.dumps({'declared': len(dec), 'total': len(teams), 'missions': [{'id': t['id'], 'vc': t.get('vc'), 'vcName': VCN.get(t.get('vc'), '와일드카드'), 'title': t['title'], 'teams': by.get(t['id'], [])} for t in topics], 'missing': missing}, ensure_ascii=False, indent=1)); sys.exit()
final = len(sys.argv) > 2 and sys.argv[2] == 'final'
now = datetime.datetime.now().strftime('%H:%M')
dl = datetime.datetime.fromisoformat(s['config']['topicDeadline'].replace('Z', '+00:00'))
head = f"**주제 선언 {'마감' if final else '현황'} · {now}** · {len(dec)}/{len(teams)}팀 선언" + ('' if final else f" ({dl.strftime('%H:%M')} 마감)")
lines = [head]
for t in topics:
    names = ', '.join(x['team'] for x in by.get(t['id'], [])) or '-'
    lines.append(f"- **{VCN.get(t.get('vc'), '와일드카드')}** · {t['title']} → {len(by.get(t['id'], []))}팀: {names}")
if missing: lines.append(f"\n{'선언하지 않은 팀' if final else '아직 선언 안 한 팀'} {len(missing)}: " + ', '.join(missing))
msg = '\n'.join(lines)
tok = E('DISCORD_BOT_TOKEN') or sys.exit('DISCORD_BOT_TOKEN is not set (see .env.example)')
ops = E('OPS_CHANNEL_ID') or sys.exit('OPS_CHANNEL_ID is not set (see .env.example)')
chunks, cur = [], ''
for l in msg.split('\n'):
    if len(cur) + len(l) + 1 > 1900: chunks.append(cur); cur = ''
    cur += l + '\n'
chunks.append(cur)
for c in chunks:
    r = urllib.request.Request(f'https://discord.com/api/v10/channels/{ops}/messages', data=json.dumps({'content': c, 'allowed_mentions': {'parse': []}}).encode(), method='POST',
        headers={'Authorization': 'Bot ' + tok, 'User-Agent': 'DiscordBot (bloom-hackathon-kit, 1)', 'Content-Type': 'application/json'})
    urllib.request.urlopen(r, timeout=20)
print('posted', len(chunks), 'msg ·', head)
