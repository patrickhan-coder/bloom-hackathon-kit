import { store, getRaw, derive, send, bad, body, vcFromKey, S, bump, pushEvent } from './_lib.js';

// POST /api/match {k, teamIds: [team on stage] | []} — a VC offers a follow-up meeting to the team that just finished its Q&A,
// or passes; if several VCs offer, the team chooses one on stage
export default async function handler(req, res) {
  if (req.method !== 'POST') return bad(res, 'POST only', 405);
  const b = body(req);
  const vc = vcFromKey(b.k);
  if (!vc) return bad(res, '심사 링크가 올바르지 않아요.', 401);
  const s = await store();
  const raw = await getRaw(s);
  const d = derive(raw);
  const led = raw.led || {}, teamMatch = led.teamMatch || {}, offer = led.offer || {};
  // per-team offers (changed on the day, 18:33): after each Q&A every VC says yes or pass to the team on stage; a VC may end up
  // with several teams (18:45), a team with one VC
  if (!offer.open) return bad(res, '지금은 제안을 받는 시간이 아니에요. 팀 질의응답이 끝나면 열려요.', 409);
  if (teamMatch[offer.teamId]) return bad(res, '이 팀은 이미 매칭이 끝났어요.', 409);
  const ids = (b.teamIds || []).filter(id => id === offer.teamId).slice(0, 1);
  await s.hset('hk:matches', { [vc]: S(ids) });
  await pushEvent(s, { type: 'match', vc, text: `${vc} 매칭 ${ids.length}팀` });
  await bump(s);
  return send(res, 200, { ok: true, teamIds: ids });
}
