// Shared by the Node scripts: keys and the base URL come from the environment, then .env.local, then the local dev keys
// (the same 'dev-admin' / 'dev-<vc key>' the API accepts when ADMIN_KEY and VC_KEYS are not set).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JUDGES } from '../public/assets/event.js';

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let file = '';
try { file = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8'); } catch {}
const fromFile = Object.fromEntries(file.split('\n').map(l => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^"|"$/g, '')]));
export const ENV = { ...fromFile, ...process.env };
export const ADMIN_KEY = ENV.ADMIN_KEY || 'dev-admin';
export const VC_KEYS = (() => { try { return JSON.parse(ENV.VC_KEYS); } catch { return null; } })() || Object.fromEntries(JUDGES.map(v => [v.key, 'dev-' + v.key]));
export const DEFAULT_BASE = `http://localhost:${ENV.PORT || 4400}`;
// first argument that looks like a URL, else the local dev server
export const baseFrom = argv => (argv.find(a => /^https?:\/\//.test(a)) || DEFAULT_BASE).replace(/\/$/, '');
