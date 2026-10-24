import { store, getRaw, derive, send, bad, body, findTeamByCred, windowState, githubRepo, ghAtom, S, now, bump, pushEvent, discord, VCS, EVENT } from './_lib.js';

const clean = (v, n) => String(v || '').trim().slice(0, n);
const isUrl = v => /^https?:\/\/\S+\.\S+/.test(v);

// POST /api/submit — one submission per team, numbered in arrival order
export default async function handler(req, res) {
  if (req.method !== 'POST') return bad(res, 'POST only', 405);
  const b = body(req);
  const s = await store();
  const raw = await getRaw(s);
  const d = derive(raw);
  const team = findTeamByCred(raw.teams, b);
  if (!team) return bad(res, '등록된 팀 이메일이 아니에요.', 404);
  // per-team grace (cfg.grace = { teamId: ISO time }) for a team blocked by an ops issue before the deadline
  const grace = d.cfg.grace?.[team.id];
  const inGrace = !!grace && !d.cfg.submitPaused && now() <= new Date(grace).getTime();
  if (!windowState(d.cfg).submit && !inGrace) return bad(res, '지금은 제출 시간이 아니에요.', 403);
  if (d.full) return bad(res, `본선 ${d.cfg.capacity}팀이 모두 정해져 제출이 마감됐어요.`, 403);
  if (raw.subs[team.id]) return bad(res, '이미 제출한 팀이에요. 제출은 팀당 한 번뿐이에요.', 409);
  const topic = raw.topics[team.id] || {};
  const f = {
    serviceName: clean(b.serviceName, 60), oneLiner: clean(b.oneLiner, 160), market: clean(b.market || topic.market || '', 300),
    demoUrl: clean(b.demoUrl, 400), pdfUrl: clean(b.pdfUrl, 600), builtToday: clean(b.builtToday, 400), demoGuide: clean(b.demoGuide, 1500),
    usedExisting: !!b.usedExisting, existingNote: clean(b.existingNote, 400),
  };
  if (!f.serviceName || !f.oneLiner) return bad(res, '서비스 이름과 한 줄 소개를 적어 주세요.');
  if (!isUrl(f.demoUrl)) return bad(res, '데모 링크를 http(s):// 로 시작하는 주소로 넣어 주세요.');
  if (!isUrl(f.pdfUrl)) return bad(res, '발표자료 PDF를 올려 주세요.');
  if (!f.builtToday) return bad(res, '오늘 새로 만든 부분을 한 줄로 적어 주세요.');
  if (!f.demoGuide) return bad(res, 'VC가 데모에서 먼저 볼 것을 적어 주세요.');
  if (f.usedExisting && !f.existingNote) return bad(res, '가져온 기존 코드나 제품이 무엇인지 적어 주세요.');
  // pin the repo state at submission time
  let repoSha = null;
  const repo = githubRepo(topic.repo);
  if (repo) { try { repoSha = (await ghAtom(repo.owner, repo.repo))[0]?.sha || null; } catch {} }
  const rec = { ...f, repo: topic.repo || null, repoSha, topic: topic.topic || null, topicTitle: topic.topicTitle || null, at: now(), no: null };
  const okNew = await s.hsetnx('hk:subs', team.id, S(rec));
  if (!okNew) return bad(res, '이미 제출한 팀이에요. 제출은 팀당 한 번뿐이에요.', 409);
  rec.no = await s.incr('hk:subseq');
  await s.hset('hk:subs', { [team.id]: S(rec) });
  await pushEvent(s, { type: 'submit', teamId: team.id, public: true, text: `#${rec.no} ${team.name} 제출` });
  await bump(s);
  const waiting = d.subs.filter(x => x.status === 'queued' || x.status === 'reviewing').length + 1;
  const t = new Date(rec.at).toLocaleTimeString('ko-KR', { timeZone: EVENT.timezone || 'Asia/Seoul', hour12: false });
  const tp = (d.cfg.topics || []).find(o => o.id === raw.topics?.[team.id]?.topic);
  const mission = tp ? (tp.vc ? `${VCS.find(v => v.key === tp.vc)?.name || tp.vc} · ${tp.title}` : `와일드카드 · ${tp.short || tp.title}`) : '주제 선언 없음';
  await discord('submit', `[접수] #${String(rec.no).padStart(2, '0')} · ${team.name} · ${t}\n> 미션: ${mission}\n> ${f.serviceName}: ${f.oneLiner}\n> 지금 심사 대기 ${waiting}팀 · 남은 본선 자리 ${d.counts.remaining}`, d.cfg.discordMuted);
  return send(res, 200, { ok: true, no: rec.no, at: rec.at });
}
