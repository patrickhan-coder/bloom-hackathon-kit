#!/usr/bin/env python3
"""First submission: wait for the first one, then ping @everyone in the ops room (VCs + staff only can see it).
env: DISCORD_BOT_TOKEN, OPS_CHANNEL_ID, HACKATHON_BASE_URL"""
import json, os, sys, time, urllib.request
E = os.environ.get
tok = E('DISCORD_BOT_TOKEN') or sys.exit('DISCORD_BOT_TOKEN is not set (see .env.example)')
ops = E('OPS_CHANNEL_ID') or sys.exit('OPS_CHANNEL_ID is not set (see .env.example)')
base = E('HACKATHON_BASE_URL', 'http://localhost:4400').rstrip('/')
while True:
    try:
        s = json.load(urllib.request.urlopen(f'{base}/api/state?scope=public&t={time.time()}', timeout=20))
        if s['subs']:
            x = sorted(s['subs'], key=lambda x: x['no'])[0]
            team = next((t['name'] for t in s['teams'] if t['id'] == x['teamId']), '')
            more = f" (지금까지 {len(s['subs'])}팀)" if len(s['subs']) > 1 else ''
            txt = (f"@everyone **첫 제출이 들어왔어요!**{more}\n"
                   f"**#{x['no']:02d} {team}** · {x.get('serviceName', '')}\n"
                   "메일로 받으신 심사 페이지를 열면 바로 보여요. 제출된 순서대로, 미션과 상관없이 모든 팀을 심사해 주세요.")
            body = {'content': txt, 'allowed_mentions': {'parse': ['everyone']}}
            r = urllib.request.Request(f'https://discord.com/api/v10/channels/{ops}/messages', data=json.dumps(body).encode(), method='POST',
                headers={'Authorization': 'Bot ' + tok, 'User-Agent': 'DiscordBot (bloom-hackathon-kit, 1)', 'Content-Type': 'application/json'})
            m = json.load(urllib.request.urlopen(r, timeout=20))
            print('posted', m['id'], 'mention_everyone', m.get('mention_everyone'), team, flush=True)
            break
    except Exception as e:
        print('err', e, flush=True)
    time.sleep(15)
