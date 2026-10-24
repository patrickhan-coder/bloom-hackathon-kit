import { store, getRaw, send, githubRepo, gh, ghAtom, S, J, now, bump } from './_lib.js';

const LOCKFILES = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|poetry\.lock|Cargo\.lock|Gemfile\.lock|composer\.lock|uv\.lock)$|(^|\/)(node_modules|\.next|dist|build|vendor)\//;
const MIN_INTERVAL = (process.env.GITHUB_TOKEN ? 150 : 100) * 1000; // 41 repos x ~3 calls stays well under 5,000/h

function lastPage(link) {
  const m = /<[^>]*[?&]page=(\d+)[^>]*>;\s*rel="last"/.exec(link || '');
  return m ? Number(m[1]) : null;
}

async function repoInfo(s, teamId, repoUrl, firstCache) {
  const r = githubRepo(repoUrl);
  if (!r) return null;
  const base = `/repos/${r.owner}/${r.repo}`;
  const head = await gh(`${base}/commits?per_page=1`, { raw: true });
  if (!head.ok) return { error: head.status };
  const headList = await head.json();
  const count = lastPage(head.headers.get('link')) || headList.length;
  const recent = count > 1 ? await gh(`${base}/commits?per_page=10`) : headList;
  let first = firstCache[teamId];
  // first commit is fixed forever once known (unless the repo history was rewritten: count dropped)
  if (!first || first.repo !== r.url) {
    const lp = lastPage(head.headers.get('link'));
    const firstList = lp ? await gh(`${base}/commits?per_page=1&page=${lp}`) : headList;
    const fc = firstList[firstList.length - 1];
    let additions = 0, files = 0;
    if (fc) {
      const detail = await gh(`${base}/commits/${fc.sha}`);
      for (const f of detail.files || []) { if (!LOCKFILES.test(f.filename)) { additions += f.additions || 0; files++; } }
    }
    first = { repo: r.url, sha: fc?.sha, at: fc ? new Date(fc.commit.committer?.date || fc.commit.author?.date).getTime() : null, additions, files };
    await s.hset('hk:first', { [teamId]: S(first) });
  }
  return {
    count,
    lastAt: recent[0] ? new Date(recent[0].commit.committer?.date || recent[0].commit.author?.date).getTime() : null,
    firstAt: first.at, firstAdditions: first.additions, firstFiles: first.files,
    recent: recent.map(c => ({ sha: c.sha.slice(0, 7), msg: (c.commit.message || '').split('\n')[0].slice(0, 90), at: new Date(c.commit.committer?.date || c.commit.author?.date).getTime() })),
  };
}

// Token-free path: the atom feed shows the latest ~20 commits. We remember every sha we've seen,
// and if the very first look already shows 20 commits the repo had history before today ('history' flag).
async function atomInfo(s, teamId, repoUrl, firstCache) {
  const r = githubRepo(repoUrl);
  if (!r) return null;
  const feed = await ghAtom(r.owner, r.repo);
  let first = firstCache[teamId];
  if (!first || first.repo !== r.url) {
    const full = feed.length >= 20;
    const oldest = feed[feed.length - 1];
    first = { repo: r.url, at: oldest?.at || null, sha: oldest?.sha || null, history: full, seen: [] };
  }
  const seen = new Set(first.seen || []);
  feed.forEach(c => seen.add(c.sha));
  if (!first.at && feed.length) first.at = feed[feed.length - 1].at;
  first.seen = [...seen].slice(-800);
  await s.hset('hk:first', { [teamId]: S(first) });
  return {
    count: seen.size, countPlus: !!first.history,
    lastAt: feed[0]?.at || null, firstAt: first.at, firstAdditions: null, history: !!first.history,
    recent: feed.slice(0, 10).map(c => ({ sha: c.sha.slice(0, 7), msg: c.msg, at: c.at })),
  };
}

// GET /api/commits — refreshes GitHub commit stats at most every ~75s, cached at the edge
export default async function handler(req, res) {
  const s = await store();
  const raw = await getRaw(s);
  const prev = raw.commits;
  if (prev && now() - prev.at < MIN_INTERVAL && !req.query.force) return send(res, 200, { ok: true, cached: true, at: prev.at }, 's-maxage=60');
  const firstCache = Object.fromEntries(Object.entries((await s.hgetall('hk:first')) || {}).map(([k, v]) => [k, J(v)]));
  const entries = Object.entries(raw.topics || {}).filter(([, t]) => t?.repo);
  const perTeam = {}, feed = [];
  // a repo GitHub can't serve right now keeps its last stats and commits, so a hiccup never blanks the board
  const keepFeed = id => (prev?.feed || []).filter(f => f.teamId === id).forEach(f => feed.push(f));
  await Promise.all(entries.map(async ([teamId, t]) => {
    try {
      const info = process.env.GITHUB_TOKEN ? await repoInfo(s, teamId, t.repo, firstCache) : await atomInfo(s, teamId, t.repo, firstCache);
      if (!info || info.error) { perTeam[teamId] = { ...(prev?.perTeam?.[teamId] || {}), error: info?.error || 'bad repo' }; keepFeed(teamId); return; }
      const { recent, ...rest } = info;
      perTeam[teamId] = rest;
      recent.forEach(c => feed.push({ teamId, team: raw.teams[teamId]?.name, ...c }));
    } catch (e) {
      perTeam[teamId] = { ...(prev?.perTeam?.[teamId] || {}), error: String(e.message || e).slice(0, 80) };
      keepFeed(teamId);
    }
  }));
  feed.sort((a, b) => b.at - a.at);
  await s.set('hk:commits', S({ at: now(), perTeam, feed: feed.slice(0, 60) }));
  await bump(s);
  return send(res, 200, { ok: true, teams: entries.length }, 's-maxage=60');
}
