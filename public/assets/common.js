// Event, judges, missions and partners live in assets/event.js; VCS is the judge list under its old name.
import { EVENT, JUDGES, HOSTS, MISSIONS } from './event.js';
export { EVENT, JUDGES as VCS, HOSTS, MISSIONS };
export const vcName = k => JUDGES.find(v => v.key === k)?.name || k;
// the two halves of the event name: the LED and slides set the second one as the accent
export const NAME = EVENT.nameLines?.length ? EVENT.nameLines : [EVENT.name, ''];
// mission labels: "VC A · title" for a judge's mission, "와일드카드 · ..." for the team's own idea
export const missionLabel = tp => tp ? (tp.vc ? `${vcName(tp.vc)} · ${tp.title}` : `와일드카드 · ${tp.short || tp.title}`) : '';
export const missionTitle = tp => tp ? (tp.vc ? tp.title : tp.title.replace(/^와일드카드\s*[:·]\s*/, '')) : '';
export const $ = (s, el = document) => el.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let offset = 0; // server clock - local clock
// CDN-cached responses carry an older serverNow, so the freshest (largest) recent sample is the right offset; otherwise timers jump back and forth
const samples = [];
export const serverNow = () => Date.now() + offset;
export async function api(path, { method = 'GET', body, key } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (key) headers['x-key'] = key;
  const r = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  let j = {};
  try { j = await r.json(); } catch {}
  if (j.serverNow) { const t = Date.now(); samples.push([t, j.serverNow - t]); while (samples.length > 1 && t - samples[0][0] > 60000) samples.shift(); offset = Math.max(...samples.map(x => x[1])); }
  if (!r.ok || j.ok === false) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}
export function poll(fn, ms) {
  let stop = false;
  const tick = async () => { if (stop) return; try { await fn(); } catch (e) { console.warn(e); } setTimeout(tick, ms); };
  tick();
  return () => { stop = true; };
}
const KST = { timeZone: EVENT.timezone || 'Asia/Seoul', hour12: false };
export const hm = t => t ? new Date(t).toLocaleTimeString('ko-KR', { ...KST, hour: '2-digit', minute: '2-digit' }) : '';
export const hms = t => t ? new Date(t).toLocaleTimeString('ko-KR', { ...KST, hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
export function dur(msLeft, withHours = true) {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  const p = n => String(n).padStart(2, '0');
  return withHours && h ? `${h}:${p(m)}:${p(x)}` : `${p(m + (withHours ? 0 : h * 60))}:${p(x)}`;
}
export const ago = t => { const m = Math.round((serverNow() - t) / 60000); return m < 1 ? '방금' : m < 60 ? `${m}분 전` : `${Math.floor(m / 60)}시간 전`; };
export function toast(msg, ms = 2600) {
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; document.body.appendChild(d); setTimeout(() => d.remove(), ms);
}
export const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
export const STATUS_KO = { queued: '심사 대기', reviewing: '심사 중', pass: '본선 진출', fail: '탈락', closed: '마감' };
