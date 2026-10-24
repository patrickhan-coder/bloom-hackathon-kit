import { store, getRaw, derive, send, bad, body, findTeamByCred, publicTeam, windowState } from './_lib.js';

// POST /api/lookup {email} -> the team this email belongs to, plus its current topic/submission
export default async function handler(req, res) {
  if (req.method !== 'POST') return bad(res, 'POST only', 405);
  const b = body(req);
  if (!b.email && !(b.teamName && b.member)) return bad(res, '이메일, 또는 팀 이름과 내 이름을 넣어 주세요.');
  const s = await store();
  const raw = await getRaw(s);
  const team = findTeamByCred(raw.teams, b);
  if (!team) return bad(res, b.email ? '등록된 팀에서 이 이메일을 찾지 못했어요. 아래 "팀 이름으로 찾기"를 써 보거나 운영진에게 알려주세요.' : '팀 이름과 팀원 이름이 맞지 않아요. 신청서에 적은 이름 그대로 넣어 주세요.', 404);
  const d = derive(raw);
  const sub = d.subs.find(x => x.teamId === team.id);
  return send(res, 200, {
    ok: true, team: publicTeam(team), topic: raw.topics[team.id] || null,
    submission: sub ? { no: sub.no, at: sub.at, serviceName: sub.serviceName, status: sub.status } : null,
    windows: { ...windowState(d.cfg), ...(d.cfg.grace?.[team.id] && !d.cfg.submitPaused && Date.now() <= new Date(d.cfg.grace[team.id]).getTime() ? { submit: true } : {}) }, full: d.full,
  });
}
