#!/usr/bin/env python3
"""Backup: save the full state (teams, topics, submissions, votes, decisions, matches) to BACKUP_DIR, so nothing is lost even
if the database has trouble. Run it every 5 minutes on the day (cron or launchd; launchd can't write into ~/Documents, so keep
BACKUP_DIR outside it). The snapshots also feed scripts/build-feedback.mjs --from <file>.
env: ADMIN_KEY, HACKATHON_BASE_URL; optional BACKUP_DIR (~/.hackathon-ops/backups), STOP_AFTER (YYYY-MM-DD: do nothing after that day)"""
import json, os, sys, datetime, urllib.request
E = os.environ.get
if E('STOP_AFTER') and datetime.date.today() > datetime.date.fromisoformat(E('STOP_AFTER')): raise SystemExit
key = E('ADMIN_KEY') or sys.exit('ADMIN_KEY is not set (see .env.example)')
base = E('HACKATHON_BASE_URL', 'http://localhost:4400').rstrip('/')
req = urllib.request.Request(base + '/api/state?scope=admin', headers={'x-key': key, 'User-Agent': 'hackathon-backup'})
data = urllib.request.urlopen(req, timeout=30).read()
json.loads(data)  # only keep valid snapshots
d = os.path.expanduser(E('BACKUP_DIR', '~/.hackathon-ops/backups')); os.makedirs(d, exist_ok=True)
out = os.path.join(d, 'state-' + datetime.datetime.now().strftime('%m%d-%H%M') + '.json')
open(out, 'wb').write(data)
