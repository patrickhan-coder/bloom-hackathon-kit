// End-to-end smoke test with fake teams. Usage: node scripts/e2e.mjs [baseUrl]   (default http://localhost:4400)
// Keys come from the environment or .env.local; without them it uses the local dev keys. It adds three test teams and
// turns on test mode, so run it against a dev server (or reset afterwards from the console).
import { ADMIN_KEY as K, VC_KEYS as VC, baseFrom } from './_env.mjs';
import { JUDGES } from '../public/assets/event.js';
const B = baseFrom(process.argv.slice(2));
const [V1, , V3, , V5, V6] = JUDGES.map(v => v.key);
const call=async(p,body,key)=>{const r=await fetch(B+p,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(key?{'x-key':key}:{})},body:body?JSON.stringify(body):undefined});const j=await r.json().catch(()=>({}));return [r.status,j];};
const adm=(action,x={})=>call('/api/admin',{action,...x},K);
console.log('cfg', (await adm('setConfig',{patch:{test:true,topicsRevealed:true}}))[0]);
for (const [n,e] of [['테스트팀A','a@example.com'],['테스트팀B','b@example.com'],['테스트팀C','c@example.com']]) await adm('upsertTeam',{team:{name:n,members:[n+'1',n+'2'],emails:[e]}});
console.log('lookup bad', (await call('/api/lookup',{email:'nobody@example.com'}))[0]);
let [s,j]=await call('/api/lookup',{email:'A@example.com '}); console.log('lookup', s, j.team?.name);
[s,j]=await call('/api/topic',{email:'a@example.com',topic:'t1',idea:'테스트 아이디어',market:'미국 프리랜서',repo:'https://github.com/octocat/Hello-World'}); console.log('topic', s, j.error||'ok');
[s,j]=await call('/api/topic',{email:'b@example.com',topic:'wild',idea:'B 아이디어',market:'일본',repo:'https://github.com/octocat/Spoon-Knife'}); console.log('topicB', s, j.error||'ok');
[s,j]=await call('/api/submit',{email:'a@example.com',serviceName:'TestSvc',oneLiner:'한 줄',demoUrl:'https://example.com',pdfUrl:'https://example.com/a.pdf',builtToday:'전부',demoGuide:'첫 화면부터'}); console.log('submit', s, j.no, j.error||'');
[s,j]=await call('/api/submit',{email:'a@example.com',serviceName:'x',oneLiner:'y',demoUrl:'https://example.com',pdfUrl:'https://example.com/a.pdf',builtToday:'z',demoGuide:'z'}); console.log('dup submit', s, j.error);
[s,j]=await call('/api/submit',{email:'b@example.com',serviceName:'B서비스',oneLiner:'B 한 줄',demoUrl:'https://example.com',pdfUrl:'https://example.com/b.pdf',builtToday:'UI',demoGuide:'로그인 없이'}); console.log('submitB', s, j.no);
const tA=(await call('/api/lookup',{email:'a@example.com'}))[1].team.id, tB=(await call('/api/lookup',{email:'b@example.com'}))[1].team.id;
for (const v of [V1,V5,V6]) { [s,j]=await call('/api/vote',{k:VC[v],teamId:tA,vote:'pass',comment:v+' 좋아요'}); console.log('vote',v,s,j.error||''); }
[s,j]=await call('/api/vote',{k:VC[V3],teamId:tA,vote:'fail'}); console.log('late vote', s, j.error);
for (const v of [V1,V5,V3]) await call('/api/vote',{k:VC[v],teamId:tB,vote:'fail',comment:'아직 이르다'});
[s,j]=await call(`/api/state?scope=judge&k=${VC[V1]}`); console.log('judge view subs', JSON.stringify(j.subs.map(x=>[x.no,x.status,x.decided,x.auto?.result])));
[s,j]=await call('/api/state?scope=admin',null,K); console.log('admin auto', JSON.stringify(j.subs.map(x=>[x.no,x.auto.result,x.auto.pass,x.auto.fail])));
[s,j]=await adm('reveal',{teamId:tA}); console.log('reveal A', s, j.error||'ok');
[s,j]=await call('/api/state?scope=public'); console.log('public', JSON.stringify(j.counts), JSON.stringify(j.subs.map(x=>[x.no,x.status,x.result?.pass,x.result?.fail,x.result?.comments?.length])), 'flash', !!j.led.flash, 'memo leaked?', JSON.stringify(j).includes('memo'));
[s,j]=await call('/api/commits?force=1'); console.log('commits', s, JSON.stringify(j));
[s,j]=await call('/api/state?scope=public'); console.log('feed', j.feed.length, JSON.stringify(j.teams.filter(t=>t.commits).map(t=>[t.name,t.commits.count,t.commits.firstAt&&new Date(t.commits.firstAt).toISOString().slice(0,10),t.commits.firstAdditions])));
