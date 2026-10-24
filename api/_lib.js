// Shared server code for the hackathon live system.
// Storage: Upstash Redis when env is present, otherwise an in-memory store (local dev only).
// The event itself (judges, missions, times, capacity) comes from public/assets/event.js, the same file the pages read.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { EVENT, JUDGES, MISSIONS } from '../public/assets/event.js';

export { EVENT };
export const VCS = JUDGES.map(({ key, name }) => ({ key, name }));

export const DEFAULT_CONFIG = {
  capacity: EVENT.capacity,
  threshold: EVENT.threshold,
  buildStart: EVENT.times.buildStart,
  submitOpenAt: EVENT.times.submitOpenAt,
  submitDeadline: EVENT.times.submitDeadline,
  topicDeadline: EVENT.times.topicDeadline,
  topicsRevealed: false,
  submitPaused: false,
  test: false,
  bulkLines: EVENT.bulkLines,
  topics: MISSIONS,
};

// ---------- storage ----------
let _store;
const DEV_FILE = path.join(process.cwd(), '.data', 'dev-store.json');

class MemStore {
  constructor() {
    this.d = {};
    try { this.d = JSON.parse(fs.readFileSync(DEV_FILE, 'utf8')); } catch {}
  }
  _save() {
    try { fs.mkdirSync(path.dirname(DEV_FILE), { recursive: true }); fs.writeFileSync(DEV_FILE, JSON.stringify(this.d)); } catch {}
  }
  async get(k) { const v = this.d[k]; return typeof v === 'string' ? v : v == null ? null : String(v); }
  async set(k, v) { this.d[k] = String(v); this._save(); return 'OK'; }
  async mget(...ks) { return Promise.all(ks.map(k => this.get(k))); }
  async incr(k) { const n = Number(this.d[k] || 0) + 1; this.d[k] = String(n); this._save(); return n; }
  _h(k) { if (!this.d[k] || typeof this.d[k] !== 'object' || Array.isArray(this.d[k])) this.d[k] = {}; return this.d[k]; }
  async hget(k, f) { return this._h(k)[f] ?? null; }
  async hset(k, obj) { Object.assign(this._h(k), obj); this._save(); return 1; }
  async hsetnx(k, f, v) { const h = this._h(k); if (f in h) return 0; h[f] = v; this._save(); return 1; }
  async hgetall(k) { const h = this.d[k]; return h && typeof h === 'object' && Object.keys(h).length ? { ...h } : null; }
  async hdel(k, ...fs_) { const h = this._h(k); fs_.forEach(f => delete h[f]); this._save(); return 1; }
  async lpush(k, v) { if (!Array.isArray(this.d[k])) this.d[k] = []; this.d[k].unshift(v); this._save(); return this.d[k].length; }
  async ltrim(k, a, b) { if (Array.isArray(this.d[k])) this.d[k] = this.d[k].slice(a, b + 1); this._save(); return 'OK'; }
  async lrange(k, a, b) { return Array.isArray(this.d[k]) ? this.d[k].slice(a, b + 1) : []; }
  async del(...ks) { ks.forEach(k => delete this.d[k]); this._save(); return ks.length; }
}

const redisEnv = () => ({ url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL, token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN });
// 'redis' or 'memory': the admin state reports it so the demo seed never wipes a real database
export const storageKind = () => { const { url, token } = redisEnv(); return url && token ? 'redis' : 'memory'; };

export async function store() {
  if (_store) return _store;
  const { url, token } = redisEnv();
  if (url && token) {
    const { Redis } = await import('@upstash/redis');
    const r = new Redis({ url, token, automaticDeserialization: false });
    // with automaticDeserialization off, HGETALL comes back as a flat [field, value, ...] array
    const hgetall = r.hgetall.bind(r);
    r.hgetall = async k => {
      const v = await hgetall(k);
      if (!v) return null;
      if (!Array.isArray(v)) return v;
      if (!v.length) return null;
      const o = {};
      for (let i = 0; i < v.length; i += 2) o[v[i]] = v[i + 1];
      return o;
    };
    _store = r;
  } else {
    if (process.env.VERCEL) console.error('No Redis env configured; using in-memory store (data will not persist).');
    _store = new MemStore();
  }
  return _store;
}

// ---------- helpers ----------
export const J = (s, fallback = null) => { if (s == null) return fallback; if (typeof s === 'object') return s; try { return JSON.parse(s); } catch { return fallback; } };
export const S = v => JSON.stringify(v);
export const now = () => Date.now();
export const ms = iso => new Date(iso).getTime();

// One password runs an event: whatever is not set explicitly (EMAIL_SALT, VC_KEYS) is derived from ADMIN_KEY.
// Changing ADMIN_KEY mid-event therefore changes the judge links and the salt; set those two explicitly to pin them.
const fromAdminKey = label => crypto.createHmac('sha256', process.env.ADMIN_KEY).update(label).digest('base64url').slice(0, 16);

export function hashEmail(email) {
  const salt = process.env.EMAIL_SALT || (process.env.ADMIN_KEY ? fromAdminKey('email-salt') : 'dev-salt');
  return crypto.createHash('sha256').update(salt + String(email || '').trim().toLowerCase()).digest('hex');
}

export function send(res, status, body, cache = 'no-store') {
  res.setHeader('Cache-Control', cache);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(status).send(JSON.stringify(body));
}
export const bad = (res, msg, status = 400) => send(res, status, { ok: false, error: msg });

export function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

// Without ADMIN_KEY / VC_KEYS the local dev keys work ('dev-admin', 'dev-<vc key>'), but never on Vercel,
// so a deploy that forgot its keys stays locked instead of opening to the keys printed in this repo.
const devKeys = () => !process.env.VERCEL;

export function isAdmin(req) {
  const k = req.headers['x-key'] || req.query?.key;
  if (process.env.ADMIN_KEY) return k === process.env.ADMIN_KEY;
  return devKeys() && k === 'dev-admin';
}

// each judge's link key: VC_KEYS when set, otherwise derived from ADMIN_KEY (the console lists the links), else local dev keys
export function judgeKeys() {
  const set = J(process.env.VC_KEYS, null);
  if (set) return set;
  if (process.env.ADMIN_KEY) return Object.fromEntries(VCS.map(v => [v.key, fromAdminKey('judge:' + v.key)]));
  return devKeys() ? Object.fromEntries(VCS.map(v => [v.key, 'dev-' + v.key])) : {};
}

export function vcFromKey(k) {
  if (!k) return null;
  const hit = Object.entries(judgeKeys()).find(([, key]) => key === k);
  return hit ? hit[0] : null;
}

export function githubRepo(url) {
  const m = String(url || '').trim().match(/^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?(?:[#?].*)?$/);
  return m ? { owner: m[1], repo: m[2], url: `https://github.com/${m[1]}/${m[2]}` } : null;
}

export async function gh(pathname, { raw = false } = {}) {
  const headers = { 'Accept': 'application/vnd.github+json', 'User-Agent': 'bloom-hackathon-kit' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const r = await fetch(`https://api.github.com${pathname}`, { headers });
  if (raw) return r;
  if (!r.ok) throw new Error(`GitHub ${r.status} ${pathname}`);
  return r.json();
}

// Token-free GitHub access: public commit atom feed (latest ~20 commits) and a public-page check.
export async function ghAtom(owner, repo) {
  const r = await fetch(`https://github.com/${owner}/${repo}/commits.atom`, { headers: { 'User-Agent': 'bloom-hackathon-kit' } });
  if (!r.ok) throw new Error(`atom ${r.status}`);
  const xml = await r.text();
  const out = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1];
    const sha = (e.match(/Commit\/([0-9a-f]{7,40})/) || [])[1];
    const at = Date.parse((e.match(/<updated>([^<]+)<\/updated>/) || [])[1]);
    const title = ((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim();
    if (sha) out.push({ sha, at, msg: title.split('\n')[0].slice(0, 90) });
  }
  return out; // newest first
}
export async function ghIsPublic(owner, repo) {
  const r = await fetch(`https://github.com/${owner}/${repo}`, { method: 'HEAD', redirect: 'follow', headers: { 'User-Agent': 'bloom-hackathon-kit' } });
  if (r.status === 404) return false;
  if (r.ok) return true;
  return null; // unknown (rate limited etc.)
}

export async function discord(which, content, muted = false) {
  if (muted) return { ok: false, muted: true };
  const url = which === 'result' ? process.env.DISCORD_WEBHOOK_RESULT : process.env.DISCORD_WEBHOOK_SUBMIT;
  if (!url) return { ok: false, skipped: true };
  try {
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content.slice(0, 1990), allowed_mentions: { parse: [] } }),
    });
    return { ok: r.ok, status: r.status };
  } catch (e) { console.error('discord', e); return { ok: false }; }
}

export async function pushEvent(s, ev) {
  await s.lpush('hk:events', S({ at: now(), ...ev }));
  await s.ltrim('hk:events', 0, 199);
}
export const bump = s => s.incr('hk:ver');

// ---------- snapshot ----------
const HASHES = { teams: 'hk:teams', topics: 'hk:topics', subs: 'hk:subs', votes: 'hk:votes', dec: 'hk:dec', matches: 'hk:matches' };

function parseHash(h) {
  const out = {};
  for (const [k, v] of Object.entries(h || {})) out[k] = J(v);
  return out;
}

export async function getRaw(s, { force = false } = {}) {
  const [ver, snap] = await s.mget('hk:ver', 'hk:snap');
  const v = Number(ver || 0);
  const cached = J(snap);
  if (!force && cached && cached.ver === v) return cached.data;
  const entries = await Promise.all(Object.entries(HASHES).map(async ([name, key]) => [name, parseHash(await s.hgetall(key))]));
  const [led, config, commits] = await s.mget('hk:led', 'hk:config', 'hk:commits');
  const events = (await s.lrange('hk:events', 0, 99)).map(e => J(e)).filter(Boolean);
  const data = { ...Object.fromEntries(entries), led: J(led, {}), config: J(config, {}), commits: J(commits, null), events };
  await s.set('hk:snap', S({ ver: v, builtAt: now(), data }));
  return data;
}

export function config(raw) {
  return { ...DEFAULT_CONFIG, ...(raw.config || {}) };
}

// "First side to reach the threshold wins": walk votes in time order.
export function autoDecision(votes, threshold) {
  let pass = 0, fail = 0;
  const counted = [];
  for (const v of votes) {
    counted.push(v);
    if (v.vote === 'pass') pass++; else if (v.vote === 'fail') fail++;
    if (pass >= threshold) return { result: 'pass', pass, fail, lockedAt: v.at, counted };
    if (fail >= threshold) return { result: 'fail', pass, fail, lockedAt: v.at, counted };
  }
  return { result: null, pass, fail, lockedAt: null, counted };
}

export function derive(raw) {
  const cfg = config(raw);
  const teams = raw.teams || {};
  const votesByTeam = {};
  for (const [key, v] of Object.entries(raw.votes || {})) {
    const [teamId, vc] = key.split('|');
    if (!v) continue;
    (votesByTeam[teamId] ||= []).push({ vc, ...v });
  }
  Object.values(votesByTeam).forEach(list => list.sort((a, b) => a.at - b.at));
  const decs = raw.dec || {};
  const passList = Object.entries(decs).filter(([, d]) => d?.result === 'pass').sort((a, b) => a[1].at - b[1].at).map(([id]) => id);
  const full = passList.length >= cfg.capacity;
  const subs = Object.entries(raw.subs || {}).map(([teamId, sub]) => {
    const votes = votesByTeam[teamId] || [];
    const auto = autoDecision(votes, cfg.threshold);
    const dec = decs[teamId] || null;
    let status = 'queued';
    if (dec) status = dec.result;
    else if (full) status = 'closed';
    else if (votes.length) status = 'reviewing';
    return { teamId, ...sub, votes, auto, dec, status, passNo: dec?.result === 'pass' ? passList.indexOf(teamId) + 1 : null };
  }).sort((a, b) => (a.no || 9999) - (b.no || 9999));
  const counts = {
    teams: Object.keys(teams).length,
    declared: Object.keys(raw.topics || {}).length,
    submitted: subs.length,
    queued: subs.filter(s => s.status === 'queued').length,
    reviewing: subs.filter(s => s.status === 'reviewing').length,
    pass: passList.length,
    fail: subs.filter(s => s.status === 'fail').length,
    closed: subs.filter(s => s.status === 'closed').length,
  };
  counts.remaining = Math.max(0, cfg.capacity - counts.pass);
  return { cfg, teams, subs, passList, full, counts };
}

export function commitFlags(info, cfg) {
  const flags = [];
  if (!info) return flags;
  if (info.firstAt && info.firstAt < ms(cfg.buildStart)) flags.push('early');
  if ((info.firstAdditions || 0) >= cfg.bulkLines) flags.push('bulk');
  if (info.history) flags.push('history');
  return flags;
}

export function windowState(cfg, t = now()) {
  if (cfg.test) return { topic: true, submit: !cfg.submitPaused };
  return {
    topic: cfg.topicsRevealed && t <= ms(cfg.topicDeadline),
    submit: !cfg.submitPaused && t >= ms(cfg.submitOpenAt) && t <= ms(cfg.submitDeadline),
  };
}

// the same inbox written differently: Gmail ignores dots and +tags, other providers ignore +tags
export function canonEmail(email) {
  let [local = '', domain = ''] = String(email || '').trim().toLowerCase().split('@');
  local = local.split('+')[0];
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.replace(/\./g, '');
  return local + '@' + domain;
}

export function findTeamByEmail(teams, email) {
  const hs = [hashEmail(email), hashEmail(canonEmail(email))];
  return Object.values(teams || {}).find(t => (t.emailHashes || []).some(x => hs.includes(x))) || null;
}

// email, or team name + one member's name (the email on the application can differ from the one a team member types)
export function findTeamByCred(teams, b = {}) {
  if (b.email) return findTeamByEmail(teams, b.email);
  const norm = x => String(x || '').replace(/\s+/g, '').toLowerCase();
  if (!b.teamName || !b.member) return null;
  const t = Object.values(teams || {}).find(t => norm(t.name) === norm(b.teamName));
  return t && (t.members || []).some(m => norm(m) === norm(b.member)) ? t : null;
}

export function publicTeam(t) {
  return t ? { id: t.id, name: t.name, members: t.members || [] } : null;
}
