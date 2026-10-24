#!/usr/bin/env python3
"""Q&A watch: poll the participant room, the ops room and their active threads every 20s and print one JSON line per new
human question, so an AI operator (e.g. Claude Code with a background monitor) can answer it with ops/say.py. Read-only.
Messages from staff (STAFF_USER_IDS), bots and webhooks, and short acknowledgements ("넵", "감사합니다") are skipped.
env: DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, PARTICIPANT_CHANNEL_ID, OPS_CHANNEL_ID
optional: STAFF_USER_IDS (comma-separated Discord user ids), OPS_STATE_DIR (~/.hackathon-ops, remembers the last message seen)"""
import json, os, re, sys, time, urllib.request
E = os.environ.get
def need(k):
    v = E(k)
    if not v: sys.exit(f'{k} is not set (see .env.example)')
    return v
TOK = need('DISCORD_BOT_TOKEN')
G = need('DISCORD_GUILD_ID')
CH = {need('PARTICIPANT_CHANNEL_ID'): '참가자방', need('OPS_CHANNEL_ID'): '운영방'}
SKIP_AUTHORS = set(x.strip() for x in E('STAFF_USER_IDS', '').split(',') if x.strip())
STATE_DIR = os.path.expanduser(E('OPS_STATE_DIR', '~/.hackathon-ops')); os.makedirs(STATE_DIR, exist_ok=True)
STATE = os.path.join(STATE_DIR, 'qna_state.json')
ACK = re.compile(r'^[\s!.~ㅎㅋㅠㅜ^]*(넵|네|넹|예|감사|고맙|확인|좋아요|알겠|ok|okay|thx|thanks|👍|🙏|🙇)[^?？]{0,14}$', re.I)
H = {'Authorization': 'Bot ' + TOK, 'User-Agent': 'DiscordBot (bloom-hackathon-kit, 1)'}
def get(u):
    return json.load(urllib.request.urlopen(urllib.request.Request('https://discord.com/api/v10' + u, headers=H), timeout=20))
first = not os.path.exists(STATE)
st = json.load(open(STATE)) if not first else {}
fails = 0
while True:
    try:
        chans = dict(CH)
        for t in get(f'/guilds/{G}/threads/active').get('threads', []):
            if t.get('parent_id') in CH: chans[t['id']] = CH[t['parent_id']] + ' › ' + t.get('name', '')
        for cid, cname in chans.items():
            last = st.get(cid)
            if last is None:
                ms = get(f'/channels/{cid}/messages?limit=1'); st[cid] = ms[0]['id'] if ms else '0'
                if cid in CH or first: continue  # first run: start from now
                last = '0'
            ms = get(f'/channels/{cid}/messages?limit=50&after={last}')
            for m in sorted(ms, key=lambda m: int(m['id'])):
                st[cid] = m['id']
                a = m['author']
                if a.get('bot') or m.get('webhook_id') or a['id'] in SKIP_AUTHORS: continue
                txt = re.sub(r'\s+', ' ', m.get('content', '')).strip()
                if m.get('attachments'): txt += f" [첨부 {len(m['attachments'])}개]"
                if not txt or (len(txt) <= 20 and ACK.match(txt)): continue
                ref = (m.get('message_reference') or {}).get('message_id', '')
                print(json.dumps({'ch': cname, 'cid': cid, 'mid': m['id'], 'uid': a['id'], 'name': (m.get('member') or {}).get('nick') or a.get('global_name') or a['username'], 'reply_to': ref, 'text': txt[:600]}, ensure_ascii=False), flush=True)
        json.dump(st, open(STATE, 'w')); first = False
        fails = 0
    except Exception as e:
        fails += 1
        if fails in (3, 20): print(json.dumps({'error': f'discord poll failing x{fails}: {e}'}), flush=True)
    time.sleep(20)
