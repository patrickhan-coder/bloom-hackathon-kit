#!/usr/bin/env python3
"""Auto-reveal (added on the day): results go out on the LED and Discord as soon as the VCs decide, no operator click.
FAIL goes out as soon as it is decided (no seat involved). PASS goes out in SUBMISSION order so the final seats fill fairly:
a PASS waits only while an earlier-numbered team is still undecided or an earlier PASS is still waiting.
The lowest-numbered team without a result is the head of the queue. Its result goes out as soon as the VCs decide it
(3 PASS or 3 FAIL); later teams that are already decided wait ("곧 결과 공개" on the LED) until the head is announced.
Reveals are >= 22s apart. If the head stays undecided while decided teams wait behind it, the VC room gets a nudge (every 10 min).
Repechage (패자부활): after the submit deadline, once every submitted team has a result (an hour later at the latest),
open seats go to FAIL teams with at least one PASS: most PASS first, then earlier submission.

env: ADMIN_KEY, HACKATHON_BASE_URL, DISCORD_BOT_TOKEN, PARTICIPANT_CHANNEL_ID, OPS_CHANNEL_ID
optional: DRY_RUN=1 (print instead of posting), REVEAL_GAP_SEC (22), REVEAL_SHOW_MS (21000), OPS_NAME (Bloom Ops),
          REPECHAGE_AT / REPECHAGE_HARD_AT / AUTOREVEAL_STOP_AT (ISO times; default: submit deadline, +1h, +3h)"""
import json, os, sys, time, urllib.request, datetime
E = os.environ.get
def need(k):
    v = E(k)
    if not v: sys.exit(f'{k} is not set (see .env.example)')
    return v
DRY = bool(E('DRY_RUN'))
KEY = need('ADMIN_KEY')
B = E('HACKATHON_BASE_URL', 'http://localhost:4400').rstrip('/')
TOK = '' if DRY else need('DISCORD_BOT_TOKEN')
PARTICIPANTS, OPS = ('', '') if DRY else (need('PARTICIPANT_CHANNEL_ID'), need('OPS_CHANNEL_ID'))
NAME = E('OPS_NAME', 'Bloom Ops')
GAP = float(E('REVEAL_GAP_SEC', '22')); SHOW_MS = int(E('REVEAL_SHOW_MS', '21000'))
H = {'x-key': KEY, 'User-Agent': 'hackathon-autoreveal', 'content-type': 'application/json'}
def get_state():
    return json.load(urllib.request.urlopen(urllib.request.Request(B + '/api/state?scope=admin', headers=H), timeout=20))
def admin(action, tid):
    r = urllib.request.Request(B + '/api/admin', data=json.dumps({'action': action, 'teamId': tid}).encode(), method='POST', headers=H)
    return json.load(urllib.request.urlopen(r, timeout=20))
def post(ch, txt):
    if DRY: print('[dry post]', 'participants' if ch == PARTICIPANTS else 'ops', txt.replace('\n', ' | ')[:160], flush=True); return
    r = urllib.request.Request(f'https://discord.com/api/v10/channels/{ch}/messages', data=json.dumps({'content': txt, 'allowed_mentions': {'parse': []}}).encode(), method='POST',
        headers={'Authorization': 'Bot ' + TOK, 'User-Agent': 'DiscordBot (bloom-hackathon-kit, 1)', 'Content-Type': 'application/json'})
    urllib.request.urlopen(r, timeout=20)
def when(s):  # ISO time -> aware datetime (a time without an offset is local)
    d = datetime.datetime.fromisoformat(s.replace('Z', '+00:00'))
    return d if d.tzinfo else d.astimezone()
now = lambda: datetime.datetime.now(datetime.timezone.utc)
while True:
    try: s0 = get_state(); break
    except Exception as e: print('waiting for', B, e, flush=True); time.sleep(10)
DEADLINE = when(E('REPECHAGE_AT') or s0['config']['submitDeadline'])
HARD = when(E('REPECHAGE_HARD_AT')) if E('REPECHAGE_HARD_AT') else DEADLINE + datetime.timedelta(hours=1)
STOP = when(E('AUTOREVEAL_STOP_AT')) if E('AUTOREVEAL_STOP_AT') else DEADLINE + datetime.timedelta(hours=3)
rep = {'announced': False, 'done_note': False}
last, blocked_since, nudged_at = 0, {}, {}
print('auto-reveal (submission order) on', datetime.datetime.now().strftime('%H:%M:%S'), '· repechage from', DEADLINE.astimezone().strftime('%H:%M'), flush=True)
while now() < STOP:
    try:
        s = get_state()
        names = {t['id']: t['name'] for t in s['teams']}
        fl = (s.get('led') or {}).get('flash')
        showing = bool(fl) and s['serverNow'] - (fl.get('at') or 0) < SHOW_MS
        pending = sorted([x for x in s['subs'] if not x.get('dec') and x.get('status') != 'closed'], key=lambda x: x['no'])
        res_of = lambda x: (x.get('auto') or {}).get('result')
        eligible = []
        for i, x in enumerate(pending):
            # FAIL goes out right away, but only for teams whose turn it is (first 3 in submission order, same as the screens)
            if res_of(x) == 'fail' and i < 3: eligible.append(x)
            elif res_of(x) == 'pass' and all(res_of(y) == 'fail' for y in pending[:i]): eligible.append(x)
        if eligible and not showing and time.time() - last >= GAP:
            x = eligible[0]
            if res_of(x) == 'pass' and s.get('full'):
                print('full; skip', x['no'], flush=True)
            else:
                r = admin('reveal', x['teamId']); last = time.time()
                print(datetime.datetime.now().strftime('%H:%M:%S'), f"#{x['no']:02d}", names.get(x['teamId']), res_of(x).upper(), r, flush=True)
        # repechage: after the deadline once every submitted team has a result (or at HARD at the latest),
        # fill the open seats with FAIL teams that had at least 1 PASS: most PASS first, then earlier submission.
        # Seats are kept for teams still being judged, so a late decision never loses its seat to a revived team.
        undecided = [x for x in pending if not res_of(x)]
        cap = s['config']['capacity']
        if now() >= DEADLINE and not eligible and (not undecided or now() >= HARD) and len(s['passList']) < cap:
            cands = sorted([x for x in s['subs'] if (x.get('dec') or {}).get('result') == 'fail' and not x['dec'].get('revived') and (x['dec'].get('pass') or 0) >= 1],
                           key=lambda x: (-(x['dec'].get('pass') or 0), x['no']))
            # seats stay reserved for teams still being judged and for PASS results waiting their turn
            open_seats = cap - len(s['passList']) - len([x for x in pending if res_of(x) != 'fail'])
            if not rep['announced'] and cands and open_seats > 0:
                txt = (f"**[패자부활 시작]** 본선 자리가 {cap - len(s['passList'])}개 남아 패자부활로 최대 {open_seats}자리를 채워요" + (" (아직 심사 중인 팀 몫은 남겨 둬요)" if open_seats < cap - len(s['passList']) else "") + ".\n"
                       "기준: 1차 심사에서 PASS를 1표 이상 받은 팀 중 **PASS가 많은 순**, 같으면 **제출이 빠른 순**이에요. 지금부터 한 팀씩 현장 화면과 이 채널에 발표돼요.")
                post(PARTICIPANTS, txt + f"\n-# {NAME}"); post(OPS, txt); rep['announced'] = True; last = time.time() - GAP / 2
                print('repechage announced', flush=True)
            elif rep['announced'] and cands and open_seats > 0 and not showing and time.time() - last >= GAP:
                x = cands[0]
                r = admin('revive', x['teamId']); last = time.time()
                print(datetime.datetime.now().strftime('%H:%M:%S'), 'REVIVE', f"#{x['no']:02d}", names.get(x['teamId']), x['dec'].get('pass'), r, flush=True)
            elif not cands and not undecided and not rep['done_note']:
                left_seats = cap - len(s['passList'])
                txt = f"**[패자부활 종료]** PASS를 1표 이상 받은 팀을 모두 올렸어요. 본선은 **{len(s['passList'])}팀**으로 진행해요." if left_seats > 0 else ''
                if txt: post(PARTICIPANTS, txt + f"\n-# {NAME}"); post(OPS, txt)
                rep['done_note'] = True; print('repechage done', len(s['passList']), flush=True)
        if pending:
            head = next((x for x in pending if res_of(x) != 'fail'), None)
            if head is None or res_of(head):
                if head: blocked_since.pop(head['teamId'], None)
            else:
                waiting = [x for x in pending if x['no'] > head['no'] and res_of(x) == 'pass']
                if waiting:
                    t0 = blocked_since.setdefault(head['teamId'], time.time())
                    if time.time() - t0 >= 480 and time.time() - nudged_at.get(head['teamId'], 0) >= 600:
                        # no tallies and no hint about which later team passed: judges only ever see "n/N 투표"
                        post(OPS, f"**[심사 순서 안내]** 결과는 제출 순서대로 공개돼요. **#{head['no']:02d} {names.get(head['teamId'])}**의 결과가 나와야 그 뒤 팀 결과가 공개돼요.\n"
                             f"지금 {len(head.get('votes') or [])}/{len(s.get('vcs') or [])}곳이 이 팀을 심사했어요. 아직 이 팀을 보지 않으셨다면 먼저 봐 주세요. 이미 보셨다면 넘어가셔도 돼요.")
                        nudged_at[head['teamId']] = time.time()
                        print('nudged for', head['no'], flush=True)
                else:
                    blocked_since.pop(head['teamId'], None)
    except Exception as e:
        print('err', e, flush=True)
    time.sleep(4)
