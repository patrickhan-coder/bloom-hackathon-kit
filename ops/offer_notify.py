#!/usr/bin/env python3
"""Shark tank: when the console opens VC offers for a team, nudge the ops (VC) room once so nobody misses it.
Runs for 3 hours (set OFFER_NOTIFY_HOURS to change).
env: DISCORD_BOT_TOKEN, OPS_CHANNEL_ID, HACKATHON_BASE_URL; optional OPS_NAME (Bloom Ops)"""
import json, os, sys, time, urllib.request
E = os.environ.get
B = E('HACKATHON_BASE_URL', 'http://localhost:4400').rstrip('/')
OPS = E('OPS_CHANNEL_ID') or sys.exit('OPS_CHANNEL_ID is not set (see .env.example)')
tok = E('DISCORD_BOT_TOKEN') or sys.exit('DISCORD_BOT_TOKEN is not set (see .env.example)')
NAME = E('OPS_NAME', 'Bloom Ops')
H = {'Authorization': 'Bot ' + tok, 'User-Agent': 'DiscordBot (bloom-hackathon-kit, 1)', 'Content-Type': 'application/json'}
def post(text):
    r = urllib.request.Request(f'https://discord.com/api/v10/channels/{OPS}/messages', data=json.dumps({'content': text, 'allowed_mentions': {'parse': []}}).encode(), method='POST', headers=H)
    return json.load(urllib.request.urlopen(r, timeout=20))['id']
seen = set(); end = time.time() + float(E('OFFER_NOTIFY_HOURS', '3')) * 3600
while time.time() < end:
    try:
        led = json.load(urllib.request.urlopen(B + '/api/led', timeout=10))['led']; of = led.get('offer') or {}
        key = f"{of.get('teamId')}|{of.get('at')}"
        if of.get('open') and key not in seen:
            seen.add(key)
            st = json.load(urllib.request.urlopen(B + '/api/state?scope=public', timeout=10))
            name = next((t['name'] for t in st['teams'] if t['id'] == of['teamId']), of['teamId'])
            mid = post(f"**[지금 제안 받는 중] {name}** · 심사 페이지 **'샤크탱크 제안'** 탭에서 **만나고 싶어요 / 패스**를 눌러 주세요. 화면이 안 바뀌면 새로고침해 주세요.\n-# {NAME}")
            print(time.strftime('%H:%M:%S'), 'nudged', name, mid, flush=True)
    except Exception as e:
        print('err', str(e)[:100], flush=True)
    time.sleep(2)
