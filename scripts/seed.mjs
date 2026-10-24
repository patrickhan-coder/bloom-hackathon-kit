// node scripts/seed.mjs [baseUrl] [--replace]   imports data/teams.seed.json (made by scripts/build-seed.py)
// The admin key comes from ADMIN_KEY, then .env.local, then the local dev key.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, ADMIN_KEY as key, baseFrom } from './_env.mjs';
const base = baseFrom(process.argv.slice(2));
const teams = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'teams.seed.json'), 'utf8'));
const r = await fetch(`${base}/api/admin`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-key': key }, body: JSON.stringify({ action: 'importTeams', teams, replace: process.argv.includes('--replace') }) });
console.log(r.status, await r.text(), `${teams.length} teams`);
