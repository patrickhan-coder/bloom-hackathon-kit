import { store, getRaw, derive, send, bad, body, vcFromKey, S, now, bump, pushEvent } from './_lib.js';

// POST /api/vote {k, teamId, vote: 'pass'|'fail', comment, memo}
export default async function handler(req, res) {
  if (req.method !== 'POST') return bad(res, 'POST only', 405);
  const b = body(req);
  const vc = vcFromKey(b.k);
  if (!vc) return bad(res, '심사 링크가 올바르지 않아요.', 401);
  if (!['pass', 'fail'].includes(b.vote)) return bad(res, 'PASS 또는 FAIL을 골라 주세요.');
  const s = await store();
  const d = derive(await getRaw(s));
  const sub = d.subs.find(x => x.teamId === b.teamId);
  if (!sub) return bad(res, '제출을 찾지 못했어요.', 404);
  if (sub.dec) return bad(res, '이미 결과가 발표된 팀이에요.', 409);
  if (sub.status === 'closed') return bad(res, '본선이 마감되어 심사가 끝났어요.', 409);
  const mine = sub.votes.find(v => v.vc === vc);
  if (sub.auto.result && !sub.auto.counted.some(v => v.vc === vc)) return bad(res, `이미 ${d.cfg.threshold}표가 모여 결정됐어요.`, 409);
  const rec = { vote: b.vote, comment: String(b.comment || '').trim().slice(0, 140), memo: String(b.memo || '').trim().slice(0, 400), at: mine?.at || now(), updatedAt: now() };
  // keep the original vote time so the "first to threshold" order stays stable when a VC edits a comment
  if (mine && mine.vote !== b.vote) rec.at = now();
  await s.hset('hk:votes', { [`${b.teamId}|${vc}`]: S(rec) });
  await pushEvent(s, { type: 'vote', teamId: b.teamId, vc, text: `${vc} → #${sub.no} ${b.vote}` });
  await bump(s);
  return send(res, 200, { ok: true });
}
