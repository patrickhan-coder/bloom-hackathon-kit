// Builds public/feedback.json, the data behind the /feedback archive, from the full state after the event:
// every VC one-liner without VC names or memos, shuffled per team with a fixed seed (same input, same order).
// usage: node scripts/build-feedback.mjs [baseUrl] [--from state.json] [--out public/feedback.json] [--no-links teamId,teamId]
//   baseUrl   the live app (default http://localhost:4400); reads GET /api/state?scope=admin with ADMIN_KEY
//             (env, then .env.local, then the dev key)
//   --from    a saved admin state instead, e.g. a snapshot from ops/backup.py
//   --no-links  teams that asked not to publish their demo, PDF and repo links
import fs from 'node:fs';
import path from 'node:path';
import { EVENT, JUDGES, HOSTS } from '../public/assets/event.js';
import { ROOT, ADMIN_KEY, baseFrom } from './_env.mjs';

const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const base = baseFrom(args.filter((a, i) => !['--from', '--out', '--no-links'].includes(args[i - 1])));
const out = path.resolve(opt('--out') || path.join(ROOT, 'public', 'feedback.json'));
const hide = new Set((opt('--no-links') || '').split(',').map(s => s.trim()).filter(Boolean));

let s;
if (opt('--from')) s = JSON.parse(fs.readFileSync(opt('--from'), 'utf8'));
else {
  const r = await fetch(`${base}/api/state?scope=admin`, { headers: { 'x-key': ADMIN_KEY } });
  s = await r.json().catch(() => ({}));
  if (!r.ok || s.ok === false) { console.error(`state ${r.status}: ${s.error || 'failed'} (${base})`); process.exit(1); }
}

// a fixed-seed shuffle per team (FNV-1a of the team id → mulberry32): the order says nothing about who voted when
const seedOf = str => { let h = 2166136261; for (const ch of String(str)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function shuffle(list, key) {
  let a = seedOf(key);
  const rnd = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const o = [...list];
  for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  return o;
}

const vcs = s.vcs?.length ? s.vcs : JUDGES;
const vcName = k => vcs.find(v => v.key === k)?.name || JUDGES.find(v => v.key === k)?.name || k;
const names = Object.fromEntries((s.teamsFull || s.teams || []).map(t => [t.id, t.name]));
const teamMatch = s.led?.teamMatch || {};
// links that point at this app itself (the demo PDFs) stay relative, so the archive works wherever it is served
const local = u => (u && u.startsWith(base + '/') ? u.slice(base.length) : u);
const done = (s.subs || []).filter(x => ['pass', 'fail', 'closed'].includes(x.status));
const open = (s.subs || []).length - done.length;

const teams = done.sort((a, b) => a.no - b.no).map(x => {
  const counted = x.dec && x.status !== 'closed';
  const cs = (x.votes?.length ? x.votes.map(v => v.comment) : x.dec?.comments || []).map(c => String(c || '').trim()).filter(Boolean);
  const links = hide.has(x.teamId) ? {} : Object.fromEntries([['demo', x.demoUrl], ['pdf', x.pdfUrl], ['repo', x.repo]].filter(([, u]) => u).map(([k, u]) => [k, local(u)]));
  return {
    no: x.no, m: x.topic || s.topics?.[x.teamId]?.topic || null, team: names[x.teamId] || x.teamId, svc: x.serviceName || '', one: x.oneLiner || '',
    status: x.status, p: counted ? x.dec.pass : null, f: counted ? x.dec.fail : null, vc: teamMatch[x.teamId] ? vcName(teamMatch[x.teamId]) : null,
    cs: shuffle(cs, x.teamId), links,
  };
});

const doc = {
  event: { name: EVENT.name, dateLabel: EVENT.dateLabel, venue: EVENT.venue, partners: HOSTS.map(h => h.name), channel: EVENT.discord?.participants || '' },
  capacity: s.config?.capacity ?? EVENT.capacity, vcCount: vcs.length, prize: EVENT.prize || null,
  hero: EVENT.media?.archiveHero || null, photos: EVENT.media?.archivePhotos || [],
  missions: (s.config?.topics || []).map(t => ({ id: t.id, title: t.title, vc: t.vc ? vcName(t.vc) : null })),
  teams,
};
fs.writeFileSync(out, JSON.stringify(doc, null, 1) + '\n');

// comments are free text: flag any that name a judge or a firm, so they can be edited before publishing
const who = [...JUDGES.flatMap(v => [v.name, v.person]), ...vcs.map(v => v.name)].filter(x => x && x.length > 1);
const named = teams.flatMap(t => t.cs.filter(c => who.some(w => c.includes(w))).map(c => `#${t.no} ${t.team}: ${c}`));
console.log(`${out.startsWith(ROOT) ? path.relative(ROOT, out) : out} · ${teams.length} teams · ${teams.reduce((a, t) => a + t.cs.length, 0)} comments · ${teams.filter(t => t.vc).length} follow-up meetings`);
if (open) console.log(`note: ${open} submission(s) still being judged were left out`);
if (named.length) console.log(`check these comments, they name a judge:\n  ${named.join('\n  ')}`);
