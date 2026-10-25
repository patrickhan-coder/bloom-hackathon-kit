import { store, getRaw, derive, send, bad, body, isAdmin, S, J, now, bump, pushEvent, discord, hashEmail, VCS, EVENT } from './_lib.js';

const rid = () => Math.random().toString(36).slice(2, 10);
const slug = s => String(s).trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || rid();

export default async function handler(req, res) {
  if (req.method !== 'POST') return bad(res, 'POST only', 405);
  if (!isAdmin(req)) return bad(res, 'unauthorized', 401);
  const b = body(req);
  const s = await store();
  const raw = await getRaw(s);
  const d = derive(raw);
  const led = raw.led || {};
  const setLed = async patch => { await s.set('hk:led', S({ ...led, ...patch })); };
  const team = id => raw.teams[id];

  switch (b.action) {
    case 'importTeams': {
      // teams: [{id, name, members, emailHashes}]; replace=true wipes teams first
      if (!Array.isArray(b.teams)) return bad(res, 'teams[] required');
      if (b.replace) await s.del('hk:teams');
      const obj = {};
      for (const t of b.teams) obj[t.id || slug(t.name)] = S({ id: t.id || slug(t.name), name: t.name, members: t.members || [], emailHashes: t.emailHashes || [] });
      if (Object.keys(obj).length) await s.hset('hk:teams', obj);
      break;
    }
    case 'upsertTeam': {
      const t = b.team || {};
      const id = t.id || slug(t.name);
      const prev = team(id) || {};
      const extra = (t.emails || []).filter(Boolean).map(hashEmail);
      await s.hset('hk:teams', { [id]: S({ id, name: t.name || prev.name, members: t.members || prev.members || [], emailHashes: [...new Set([...(prev.emailHashes || []), ...extra])] }) });
      break;
    }
    case 'deleteTeam': await s.hdel('hk:teams', b.id); break;
    case 'setConfig': await s.set('hk:config', S({ ...(raw.config || {}), ...(b.patch || {}) })); break;
    case 'setLed': await setLed(b.patch || {}); break;
    case 'reveal': {
      const sub = d.subs.find(x => x.teamId === b.teamId);
      if (!sub) return bad(res, 'no submission');
      if (sub.dec) return bad(res, '이미 발표됨');
      const result = b.result || sub.auto.result;
      if (!result) return bad(res, `아직 ${d.cfg.threshold}표가 모이지 않았어요. 강제로 발표하려면 결과를 직접 고르세요.`);
      if (result === 'pass' && d.full) return bad(res, '본선 자리가 이미 다 찼어요.');
      const counted = sub.auto.result ? sub.auto.counted : sub.votes;
      const tally = { pass: counted.filter(v => v.vote === 'pass').length, fail: counted.filter(v => v.vote === 'fail').length };
      const comments = sub.votes.map(v => v.comment).filter(Boolean);
      const dec = { result, ...tally, comments, at: now(), override: !!b.result && b.result !== sub.auto.result };
      if (!(await s.hsetnx('hk:dec', b.teamId, S(dec)))) return bad(res, '이미 발표됨');
      const t = team(b.teamId);
      const passCount = d.passList.length + (result === 'pass' ? 1 : 0);
      const remaining = Math.max(0, d.cfg.capacity - passCount);
      await setLed({ flash: { id: rid(), teamId: b.teamId, at: now() } });
      await pushEvent(s, { type: 'result', teamId: b.teamId, public: true, text: `#${sub.no} ${t?.name} ${result === 'pass' ? '본선 진출' : '탈락'}` });
      const head = result === 'pass' ? `[본선 진출 ${passCount}/${d.cfg.capacity}]` : '[탈락]';
      const lines = [`${head} #${String(sub.no).padStart(2, '0')} ${t?.name} (${(t?.members || []).join(', ')})`, `> ${sub.serviceName}: ${sub.oneLiner}`, `> PASS ${tally.pass} : FAIL ${tally.fail}`];
      comments.slice(0, 3).forEach(c => lines.push(`> "${c}"`));
      lines.push(`남은 본선 자리 ${remaining}`);
      if (result === 'pass' && EVENT.finalistNotice) lines.push(EVENT.finalistNotice);
      await discord('result', lines.join('\n'), d.cfg.discordMuted);
      if (result === 'pass' && remaining === 0) {
        await pushEvent(s, { type: 'closed', public: true, text: `본선 ${d.cfg.capacity}팀 확정` });
        await discord('result', `[마감] 본선 ${d.cfg.capacity}팀이 모두 정해졌어요. 지금부터 제출은 받지 않아요. 저녁 샤크탱크에서 만나요.`, d.cfg.discordMuted);
      }
      break;
    }
    case 'revive': {
      // 패자부활 (repechage): a team that was announced FAIL takes a remaining final seat.
      // The VC tally stays as it was; only the outcome changes, and it is marked as revived.
      const sub = d.subs.find(x => x.teamId === b.teamId);
      if (!sub || sub.dec?.result !== 'fail') return bad(res, '탈락으로 발표된 팀만 패자부활할 수 있어요.');
      if (d.full) return bad(res, '본선 자리가 이미 다 찼어요.');
      const dec = { ...sub.dec, result: 'pass', revived: true, failedAt: sub.dec.at, at: now() };
      await s.hset('hk:dec', { [b.teamId]: S(dec) });
      const t = team(b.teamId);
      const passCount = d.passList.length + 1;
      const remaining = Math.max(0, d.cfg.capacity - passCount);
      await setLed({ flash: { id: rid(), teamId: b.teamId, at: now() } });
      await pushEvent(s, { type: 'result', teamId: b.teamId, public: true, text: `#${sub.no} ${t?.name} 패자부활 · 본선 진출` });
      await discord('result', [`[패자부활 · 본선 진출 ${passCount}/${d.cfg.capacity}] #${String(sub.no).padStart(2, '0')} ${t?.name} (${(t?.members || []).join(', ')})`, `> ${sub.serviceName}: ${sub.oneLiner}`, `> 1차 심사 PASS ${dec.pass} : FAIL ${dec.fail}`, `남은 본선 자리 ${remaining}`, EVENT.finalistNotice].filter(Boolean).join('\n'), d.cfg.discordMuted);
      if (remaining === 0) {
        await pushEvent(s, { type: 'closed', public: true, text: `본선 ${d.cfg.capacity}팀 확정` });
        await discord('result', `[마감] 본선 ${d.cfg.capacity}팀이 모두 정해졌어요. 저녁 샤크탱크에서 만나요.`, d.cfg.discordMuted);
      }
      break;
    }
    case 'revoke': await s.hdel('hk:dec', b.teamId); await pushEvent(s, { type: 'revoke', teamId: b.teamId, text: `발표 취소 ${team(b.teamId)?.name}` }); break;
    case 'clearFlash': await setLed({ flash: null }); break;
    case 'addSubmission': {
      // manual entry when a team can't use the form
      const rec = { ...(b.fields || {}), at: now(), manual: true, no: null };
      if (!(await s.hsetnx('hk:subs', b.teamId, S(rec)))) return bad(res, '이미 제출한 팀');
      rec.no = await s.incr('hk:subseq');
      await s.hset('hk:subs', { [b.teamId]: S(rec) });
      await pushEvent(s, { type: 'submit', teamId: b.teamId, public: true, text: `#${rec.no} ${team(b.teamId)?.name} 제출` });
      break;
    }
    case 'deleteSubmission': {
      await s.hdel('hk:subs', b.teamId);
      await s.hdel('hk:dec', b.teamId);
      const keys = Object.keys(raw.votes || {}).filter(k => k.startsWith(b.teamId + '|'));
      if (keys.length) await s.hdel('hk:votes', ...keys);
      break;
    }
    case 'setTopic': {
      // manual topic entry: {teamId, topic: {topic, topicTitle, idea, market, repo}}
      await s.hset('hk:topics', { [b.teamId]: S({ ...(raw.topics[b.teamId] || {}), ...(b.topic || {}), at: raw.topics[b.teamId]?.at || now(), updatedAt: now() }) });
      break;
    }
    case 'setVote': {
      if (!VCS.some(v => v.key === b.vc)) return bad(res, 'bad vc');
      if (b.vote === null) await s.hdel('hk:votes', `${b.teamId}|${b.vc}`);
      else await s.hset('hk:votes', { [`${b.teamId}|${b.vc}`]: S({ vote: b.vote, comment: b.comment || '', memo: 'entered by admin', at: now() }) });
      break;
    }
    case 'demo': {
      const demo = { order: d.passList, idx: 0, phase: 'idle', endsAt: null, left: null, pitchSec: EVENT.sharkTank?.pitchSec || 180, qaSec: EVENT.sharkTank?.qaSec || 420, view: 'intro', page: 0, ...(led.demo || {}) };
      const t0 = now();
      if (b.op === 'order') demo.order = b.order;
      if (b.op === 'go') Object.assign(demo, { idx: Math.max(0, Math.min(b.idx, demo.order.length - 1)), phase: 'idle', endsAt: null, left: null, view: 'intro', page: 0 });
      if (b.op === 'start') { const sec = b.phase === 'qa' ? demo.qaSec : demo.pitchSec; Object.assign(demo, { phase: b.phase, endsAt: t0 + sec * 1000, left: null }); if (b.phase === 'pitch' && demo.view === 'intro') demo.view = 'slides'; }
      // what fills the LED for the current finalist: the intro card, their submitted PDF (page by page) or their live demo
      if (b.op === 'view') {
        if (['intro', 'slides', 'demo'].includes(b.view)) demo.view = b.view;
        const n = d.cfg.stagePages?.[demo.order[demo.idx]] || 50;
        if (b.page != null) demo.page = Math.max(0, Math.min(Number(b.page) || 0, n - 1));
      }
      if (b.op === 'pause' && demo.endsAt) Object.assign(demo, { left: demo.endsAt - t0, endsAt: null });
      if (b.op === 'resume' && demo.left != null) Object.assign(demo, { endsAt: t0 + demo.left, left: null });
      if (b.op === 'reset') Object.assign(demo, { phase: 'idle', endsAt: null, left: null });
      if (b.op === 'durations') Object.assign(demo, { pitchSec: b.pitchSec, qaSec: b.qaSec });
      // moving to another team closes that team's offer round
      await setLed({ demo, ...(b.op === 'go' ? { offer: null, matchReveal: false } : {}) });
      break;
    }
    case 'offerOpen': {
      const demo = led.demo || {}, order = demo.order?.length ? demo.order : d.passList;
      const teamId = b.teamId || order[demo.idx || 0];
      if (!d.passList.includes(teamId)) return bad(res, 'unknown team');
      await s.del('hk:matches');
      await setLed({ offer: { teamId, open: true, shown: false, at: now() }, matchReveal: false, demo: { ...demo, view: 'intro' } });
      break;
    }
    case 'offerReveal': {
      if (!led.offer?.teamId) return bad(res, '열린 제안이 없어요.');
      // a double click on '제안 받기 시작' lands on '마감' (same spot): ignore a close within 4s of opening
      if (led.offer.open && now() - (led.offer.at || 0) < 4000) return bad(res, '방금 제안을 열었어요. VC 응답을 기다린 뒤 마감해 주세요.');
      await setLed({ offer: { ...led.offer, open: false, shown: true }, matchReveal: true });
      break;
    }
    case 'matchReset': {
      await s.del('hk:matches');
      await setLed({ offer: null, teamMatch: {}, matchPairs: {}, matchReveal: false, matchLocked: false, matchShown: 0, matchFinal: false, matchRound: 1 });
      break;
    }
    // evening matching in rounds: confirm the VC a team chose, then reopen picks for the VCs still unmatched
    case 'matchConfirm': {
      if (!d.passList.includes(b.teamId) || !VCS.some(v => v.key === b.vc)) return bad(res, 'unknown team or VC');
      await setLed({ teamMatch: { ...(led.teamMatch || {}), [b.teamId]: b.vc } });
      await pushEvent(s, { type: 'matchPair', text: `매칭 확정: ${team(b.teamId)?.name || b.teamId} × ${b.vc}` });
      break;
    }
    case 'matchUnpair': {
      const tm = { ...(led.teamMatch || {}) }; delete tm[b.teamId];
      await setLed({ teamMatch: tm });
      break;
    }
    case 'matchNextRound': {
      await s.del('hk:matches');
      await setLed({ matchRound: (led.matchRound || 1) + 1, matchLocked: false, matchReveal: false, matchShown: 0, matchFinal: false });
      break;
    }
    case 'setCommits': {
      // commit stats written by hand: demo data (scripts/seed-demo.mjs), or a stand-in while GitHub can't be reached.
      // {perTeam: {teamId: {count, lastAt, firstAt, firstAdditions}}, feed: [{teamId, sha, msg, at}]}; /api/commits keeps them for repos it can't read
      const feed = (Array.isArray(b.feed) ? b.feed : []).map(f => ({ ...f, team: raw.teams[f.teamId]?.name || f.team || f.teamId })).sort((a, c) => c.at - a.at).slice(0, 60);
      await s.set('hk:commits', S({ at: now(), perTeam: b.perTeam || {}, feed }));
      break;
    }
    case 'resetAll': {
      if (b.confirm !== 'RESET') return bad(res, 'confirm RESET');
      const keep = b.keepTeams ? [] : ['hk:teams'];
      await s.del('hk:topics', 'hk:subs', 'hk:votes', 'hk:dec', 'hk:matches', 'hk:subseq', 'hk:events', 'hk:led', 'hk:commits', 'hk:first', ...keep);
      break;
    }
    case 'discordTest': {
      const a = await discord('submit', '[테스트] 제출 알림 웹훅 연결 확인');
      const c = await discord('result', '[테스트] 결과 발표 웹훅 연결 확인');
      return send(res, 200, { ok: true, submit: a, result: c });
    }
    default: return bad(res, 'unknown action');
  }
  await bump(s);
  return send(res, 200, { ok: true });
}
