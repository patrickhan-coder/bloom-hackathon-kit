#!/usr/bin/env python3
"""Submission nudge: post the live numbers (submitted teams, open seats, time left) to the participant room.
Skips once the seats are full or after the deadline. Run it on a schedule during the build (e.g. every hour, then every 15 min).
env: DISCORD_BOT_TOKEN, PARTICIPANT_CHANNEL_ID, HACKATHON_BASE_URL; optional OPS_NAME (Bloom Ops)"""
import json, os, sys, urllib.request, datetime
E = os.environ.get
base = E('HACKATHON_BASE_URL', 'http://localhost:4400').rstrip('/')
s = json.load(urllib.request.urlopen(base + '/api/state?scope=public&t=' + str(datetime.datetime.now().timestamp()), timeout=20))
if s.get('full'): print('full, skip'); sys.exit()
dl = datetime.datetime.fromisoformat(s['config']['submitDeadline'].replace('Z', '+00:00'))
now = datetime.datetime.now(dl.tzinfo)
left = int((dl - now).total_seconds() // 60)
if left <= 0: print('closed, skip'); sys.exit()
subs = len(s['subs']); cap = s['config']['capacity']; rem = cap - len(s['passList'])
lt = f"{left // 60}시간 {left % 60}분" if left >= 60 else f"{left}분"
head = f"**[제출 현황 · {now.strftime('%H:%M')}]** 지금까지 **{subs}팀** 제출 · 본선 **{rem}/{cap}자리** 남음 · 마감까지 **{lt}**"
lines = [head]
if subs == 0: lines.append(f"- 아직 제출한 팀이 없어요. 먼저 내는 팀이 VC {len(s.get('vcs') or [])}곳에게 가장 먼저 심사를 받아요.")
else: lines.append("- 제출한 순서대로 VC가 바로 심사하고 있어요. 준비된 팀은 지금 내는 게 유리해요.")
lines.append(f"- 본선 자리는 먼저 PASS를 받은 팀이 가져가요. {cap}자리가 다 차면 그 뒤에 낸 팀은 심사를 받지 못해요.")
if left <= 25: lines.append(f"- {dl.strftime('%H:%M')} 정각에 제출이 닫혀요. 마지막 몇 분에는 접속이 몰릴 수 있으니 미리 내 주세요.")
lines.append("- 한 번만 낼 수 있어요. 데모 링크가 열리는지 확인하고 내 주세요.")
lines.append(f"제출 → {base}/submit · 실시간 현황 → {base}/live")
lines.append(f"-# {E('OPS_NAME', 'Bloom Ops')}")
tok = E('DISCORD_BOT_TOKEN') or sys.exit('DISCORD_BOT_TOKEN is not set (see .env.example)')
ch = E('PARTICIPANT_CHANNEL_ID') or sys.exit('PARTICIPANT_CHANNEL_ID is not set (see .env.example)')
r = urllib.request.Request(f'https://discord.com/api/v10/channels/{ch}/messages', data=json.dumps({'content': '\n'.join(lines), 'allowed_mentions': {'parse': []}, 'flags': 4}).encode(), method='POST',
    headers={'Authorization': 'Bot ' + tok, 'User-Agent': 'DiscordBot (bloom-hackathon-kit, 1)', 'Content-Type': 'application/json'})
print('posted', json.load(urllib.request.urlopen(r, timeout=20))['id'], head)
