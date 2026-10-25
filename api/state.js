import { store, getRaw, derive, send, bad, isAdmin, vcFromKey, judgeKeys, VCS, commitFlags, windowState, publicTeam, now, storageKind } from './_lib.js';

// GET /api/state?scope=public|judge|admin  (judge: &k=VC_KEY, admin: header x-key)
export default async function handler(req, res) {
  const scope = req.query.scope || 'public';
  const s = await store();
  const raw = await getRaw(s);
  const d = derive(raw);
  const { cfg } = d;
  const commits = raw.commits || { perTeam: {}, feed: [] };
  const win = windowState(cfg);

  const teamView = (id) => {
    const t = raw.teams[id];
    const topic = raw.topics[id];
    const c = commits.perTeam?.[id];
    return {
      ...publicTeam(t),
      topic: topic ? { topic: topic.topic, idea: topic.idea, market: topic.market, repo: topic.repo, at: topic.at } : null,
      commits: c ? { count: c.count, countPlus: !!c.countPlus, lastAt: c.lastAt, firstAt: c.firstAt, firstAdditions: c.firstAdditions, history: !!c.history } : null,
    };
  };
  // Judging is shown in submission order: only the first 3 undecided submissions show their votes on
  // public screens; later ones look untouched until their turn, even if some VCs already voted on them.
  const TURN = 3;
  const front = new Set(d.subs.filter(x => !x.dec && (x.status === 'queued' || x.status === 'reviewing')).sort((a, b) => a.no - b.no).slice(0, TURN).map(x => x.teamId));
  const inTurn = x => !!x.dec || front.has(x.teamId);
  const publicSub = (x, hide = true) => hide && !inTurn(x) ? { ...publicSubRaw(x), voters: 0, pass: 0, fail: 0, ready: false, waiting: true } : publicSubRaw(x);
  const publicSubRaw = (x) => ({
    teamId: x.teamId, no: x.no, at: x.at, serviceName: x.serviceName, oneLiner: x.oneLiner, market: x.market,
    demoUrl: x.demoUrl, pdfUrl: x.pdfUrl, status: x.status, passNo: x.passNo,
    voters: x.votes.length,
    // live tally: PASS/FAIL counts are public while judging; comments stay hidden until the result
    pass: x.votes.filter(v => v.vote === 'pass').length, fail: x.votes.filter(v => v.vote === 'fail').length,
    // decided by the VCs but not announced yet: says *that* a result exists, never which one
    ready: !!x.auto?.result && !x.dec,
    // the result and VC comments only become public once the operator announces it
    result: x.dec ? { result: x.dec.result, pass: x.dec.pass, fail: x.dec.fail, comments: x.dec.comments || [], at: x.dec.at, revived: !!x.dec.revived } : null,
  });

  const base = {
    ok: true, serverNow: now(), vcs: VCS,
    config: {
      capacity: cfg.capacity, threshold: cfg.threshold, buildStart: cfg.buildStart, submitOpenAt: cfg.submitOpenAt,
      submitDeadline: cfg.submitDeadline, topicDeadline: cfg.topicDeadline, topicsRevealed: cfg.topicsRevealed,
      test: cfg.test, submitPaused: cfg.submitPaused, rotate: cfg.rotate || null,
      topics: cfg.topicsRevealed || scope !== 'public' ? cfg.topics : [],
    },
    windows: win, counts: d.counts, full: d.full, passList: d.passList,
    teams: Object.keys(raw.teams).map(teamView).sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    subs: d.subs.map(x => publicSub(x)),
    led: raw.led || {},
    feed: (commits.feed || []).slice(0, 30),
    commitsAt: commits.at || null,
    events: (raw.events || []).filter(e => e.public).slice(0, 30),
    matches: (raw.led?.matchReveal ? raw.matches : {}) || {},
    // how many VCs have answered the open offer; never what they answered
    matchNeed: VCS.length,
    matchCount: VCS.filter(v => Object.prototype.hasOwnProperty.call(raw.matches || {}, v.key)).length,
  };

  if (scope === 'public') return send(res, 200, base, 's-maxage=2, stale-while-revalidate=5');

  if (scope === 'judge') {
    const vc = vcFromKey(req.query.k);
    if (!vc) return bad(res, '심사 링크가 올바르지 않아요.', 401);
    const subs = d.subs.map(x => {
      const mine = x.votes.find(v => v.vc === vc) || null;
      const decided = !!x.dec || !!x.auto.result;
      return {
        ...publicSub(x, false),
        builtToday: x.builtToday, demoGuide: x.demoGuide, usedExisting: x.usedExisting, existingNote: x.existingNote, repoSha: x.repoSha,
        mine, decided,
        votes: decided ? x.votes.map(v => ({ vc: v.vc, vote: v.vote, comment: v.comment })) : x.votes.map(v => ({ vc: v.vc })),
        auto: decided ? { result: x.auto.result, pass: x.auto.pass, fail: x.auto.fail } : null,
        flags: commitFlags(commits.perTeam?.[x.teamId], cfg),
      };
    });
    return send(res, 200, { ...base, vc, subs, myMatches: raw.matches?.[vc] || [], mySubmitted: Object.prototype.hasOwnProperty.call(raw.matches || {}, vc), allMatches: undefined });
  }

  if (scope === 'admin') {
    if (!isAdmin(req)) return bad(res, 'unauthorized', 401);
    const subs = d.subs.map(x => ({ ...x, flags: commitFlags(commits.perTeam?.[x.teamId], cfg) }));
    return send(res, 200, {
      ...base, config: cfg, subs, matches: raw.matches || {}, storage: storageKind(),
      judgeKeys: judgeKeys(), // the console turns these into each VC's judge link
      teamsFull: Object.values(raw.teams).map(t => ({ ...teamView(t.id), hashes: (t.emailHashes || []).length })),
      topics: raw.topics, commits, events: (raw.events || []).slice(0, 80),
    });
  }
  return bad(res, 'unknown scope');
}
