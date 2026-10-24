#!/usr/bin/env python3
"""Post an AI operator reply. usage: say.py CHANNEL_ID [REPLY_TO_MESSAGE_ID] < text   (no @everyone/@here/role pings)
Every reply ends with a line saying it is an AI answer and that staff are reading along.
env: DISCORD_BOT_TOKEN; optional OPS_NAME (Bloom Ops)"""
import json, os, sys, urllib.request
tok = os.environ.get('DISCORD_BOT_TOKEN') or sys.exit('DISCORD_BOT_TOKEN is not set (see .env.example)')
cid = sys.argv[1]; ref = sys.argv[2] if len(sys.argv) > 2 else ''
text = sys.stdin.read().strip() + f"\n-# {os.environ.get('OPS_NAME', 'Bloom Ops')} AI 답변이에요 · 운영진도 함께 보고 있어요"
body = {'content': text[:1990], 'allowed_mentions': {'parse': ['users'], 'replied_user': True}}
if ref: body['message_reference'] = {'message_id': ref, 'fail_if_not_exists': False}
r = urllib.request.Request(f'https://discord.com/api/v10/channels/{cid}/messages', data=json.dumps(body).encode(), method='POST',
    headers={'Authorization': 'Bot ' + tok, 'User-Agent': 'DiscordBot (bloom-hackathon-kit, 1)', 'Content-Type': 'application/json'})
print('sent', json.load(urllib.request.urlopen(r, timeout=20))['id'])
