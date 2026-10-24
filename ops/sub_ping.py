#!/usr/bin/env python3
"""Submission ping: every new submission becomes an @everyone line in the ops room (VCs + staff), with the team's mission.
Teams already announced are remembered in OPS_STATE_DIR/sub_seen.json, so a restart never pings twice.
Stops 2 hours after the submit deadline (late manual entries still get a ping), or at SUB_PING_UNTIL.
env: DISCORD_BOT_TOKEN, OPS_CHANNEL_ID, HACKATHON_BASE_URL; optional OPS_STATE_DIR (~/.hackathon-ops), SUB_PING_UNTIL (ISO time)"""
import json, os, sys, time, urllib.request, datetime
E = os.environ.get
tok = E('DISCORD_BOT_TOKEN') or sys.exit('DISCORD_BOT_TOKEN is not set (see .env.example)')
ops = E('OPS_CHANNEL_ID') or sys.exit('OPS_CHANNEL_ID is not set (see .env.example)')
base = E('HACKATHON_BASE_URL', 'http://localhost:4400').rstrip('/')
d = os.path.expanduser(E('OPS_STATE_DIR', '~/.hackathon-ops')); os.makedirs(d, exist_ok=True)
P = os.path.join(d, 'sub_seen.json')
seen = set(json.load(open(P))) if os.path.exists(P) else set()
when = lambda s: (lambda x: x if x.tzinfo else x.astimezone())(datetime.datetime.fromisoformat(s.replace('Z', '+00:00')))
until = None
while until is None or datetime.datetime.now(datetime.timezone.utc) < until:
    try:
        s = json.load(urllib.request.urlopen(f'{base}/api/state?scope=public&t={time.time()}', timeout=20))
        if until is None: until = when(E('SUB_PING_UNTIL')) if E('SUB_PING_UNTIL') else when(s['config']['submitDeadline']) + datetime.timedelta(hours=2)
        names = {t['id']: t['name'] for t in s['teams']}
        VCN = {v['key']: v['name'] for v in s.get('vcs') or []}
        tops = {o['id']: o for o in s['config']['topics']}
        def mission(tid):
            t = next((t for t in s['teams'] if t['id'] == tid), {}); tp = tops.get((t.get('topic') or {}).get('topic'))
            return (f"{VCN.get(tp['vc'], tp['vc'])} · {tp['title']}" if tp.get('vc') else f"와일드카드 · {tp.get('short') or tp['title']}") if tp else '주제 선언 없음'
        fresh = sorted([x for x in s['subs'] if x['teamId'] not in seen], key=lambda x: x['no'])
        for x in fresh:
            total = len(s['subs'])
            txt = f"@everyone **새 제출 #{x['no']:02d} {names.get(x['teamId'], '')}** · {x.get('serviceName', '')}\n미션: {mission(x['teamId'])}\n지금까지 {total}팀 제출 · 본선 {len(s['passList'])}/{s['config']['capacity']} · 심사 페이지 목록 맨 위에 떠요."
            r = urllib.request.Request(f'https://discord.com/api/v10/channels/{ops}/messages', data=json.dumps({'content': txt, 'allowed_mentions': {'parse': ['everyone']}}).encode(), method='POST',
                headers={'Authorization': 'Bot ' + tok, 'User-Agent': 'DiscordBot (bloom-hackathon-kit, 1)', 'Content-Type': 'application/json'})
            urllib.request.urlopen(r, timeout=20)
            seen.add(x['teamId']); json.dump(sorted(seen), open(P, 'w'))
            print('posted', x['no'], names.get(x['teamId']), flush=True)
            time.sleep(1.5)
    except Exception as e:
        print('err', e, flush=True)
    time.sleep(15)
