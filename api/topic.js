import { store, getRaw, config, send, bad, body, findTeamByCred, windowState, githubRepo, ghIsPublic, S, now, bump, pushEvent, discord } from './_lib.js';

// POST /api/topic {email, topic, idea, market, repo}
export default async function handler(req, res) {
  if (req.method !== 'POST') return bad(res, 'POST only', 405);
  const b = body(req);
  const s = await store();
  const raw = await getRaw(s);
  const cfg = config(raw);
  const team = findTeamByCred(raw.teams, b);
  if (!team) return bad(res, '등록된 팀 이메일이 아니에요.', 404);
  if (!windowState(cfg).topic) return bad(res, '지금은 주제 선언 시간이 아니에요.', 403);
  if (raw.subs[team.id]) return bad(res, '이미 제출한 팀은 주제를 바꿀 수 없어요.', 409);
  const topic = cfg.topics.find(t => t.id === b.topic);
  if (!topic) return bad(res, '주제를 골라 주세요.');
  const idea = String(b.idea || '').trim().slice(0, 500);
  const market = String(b.market || '').trim().slice(0, 300);
  if (!idea) return bad(res, '한 줄 아이디어를 적어 주세요.');
  if (!market) return bad(res, '타깃 해외 시장(국가와 고객)을 적어 주세요.');
  const repo = githubRepo(b.repo);
  if (!repo) return bad(res, 'GitHub 레포 주소를 https://github.com/아이디/레포 형식으로 넣어 주세요.');
  // the repository must exist and be public
  try {
    if ((await ghIsPublic(repo.owner, repo.repo)) === false) return bad(res, '레포를 열 수 없어요. 주소가 맞는지, 공개(Public) 레포인지 확인해 주세요.');
  } catch (e) { console.error(e); /* GitHub hiccup: accept and check later */ }
  const prev = raw.topics[team.id];
  const rec = { topic: topic.id, topicTitle: topic.title, idea, market, repo: repo.url, at: prev?.at || now(), updatedAt: now() };
  await s.hset('hk:topics', { [team.id]: S(rec) });
  await pushEvent(s, { type: 'topic', teamId: team.id, public: !prev, text: `${team.name} 주제 선언: ${topic.title}` });
  await bump(s);
  if (!prev) await discord('submit', `[주제 선언] ${team.name} · ${topic.title}\n> ${idea}\n> 타깃: ${market} · ${repo.url}`, cfg.discordMuted);
  return send(res, 200, { ok: true, topic: rec });
}
