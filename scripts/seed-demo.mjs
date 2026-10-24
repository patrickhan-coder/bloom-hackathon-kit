// Demo data for a local dev server: 14 made-up teams declare missions, 13 submit, the six demo VCs vote through the real
// endpoints, 8 teams take the finalist seats (the rest fail or close with the round) and three shark-tank matches are made.
// After it runs, /led, /live, /judge?k=dev-vc1, /console?key=dev-admin and /submit all have something to show,
// and `node scripts/build-feedback.mjs` turns the result into the /feedback archive.
// usage: node scripts/seed-demo.mjs [baseUrl] [--live]
//   baseUrl  default http://localhost:4400. It starts with a full reset, so it only runs against a local server on the file store.
//   --live   stop in the middle of judging instead: a running countdown, teams under review, one result waiting to go out.
// Everyone here is fictional: folk-tale characters, example.com emails and links, github.com/example repos.
// It also writes a two-page pitch PDF per team to public/assets/demo/ so the judge page and the stage have slides to show.
import fs from 'node:fs';
import path from 'node:path';
import { EVENT, MISSIONS } from '../public/assets/event.js';
import { ROOT, ADMIN_KEY, VC_KEYS, baseFrom } from './_env.mjs';

const args = process.argv.slice(2);
const B = baseFrom(args), LIVE = args.includes('--live');
if (!/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(B)) { console.error(`seed-demo resets all data, so it only runs against a local dev server (got ${B})`); process.exit(1); }

const call = async (p, body, key) => {
  const r = await fetch(B + p, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(key ? { 'x-key': key } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) throw new Error(`${p} → ${r.status} ${j.error || ''}`);
  return j;
};
const admin = (action, x = {}) => call('/api/admin', { action, ...x }, ADMIN_KEY);
const vote = (teamId, vc, v, comment, memo = '') => call('/api/vote', { k: VC_KEYS[vc], teamId, vote: v, comment, memo });
const sleep = ms => new Promise(r => setTimeout(r, ms));

// votes: [VC key, vote, comment, memo?] in the order they come in; each list stops at the vote that decides (3 of one side)
const TEAMS = [
  { id: 'dotori', name: '도토리랩', members: ['홍길동', '전우치'], topic: 't1', svc: 'Dotori', en: 'Replies in your own voice, right from the keyboard',
    one: '하루 3분, 내 말투로 답장을 대신 써 주는 메신저 키보드', market: '미국·동남아 Z세대 메신저 사용자',
    built: '키보드 확장 프로토타입과 말투 학습 파이프라인 전부', guide: "1. 데모 페이지에서 '샘플 대화 불러오기'를 눌러 보세요\n2. 추천 답장 3개 중 하나를 고르면 말투가 바뀌어요\n3. 테스트 계정 demo@example.com / demo1234",
    votes: [['vc1', 'pass', '매일 쓰는 키보드에 붙인 게 영리해요. 리텐션 숫자가 궁금해요.', '후속 미팅 때 D7 리텐션 물어보기'], ['vc4', 'fail', '기능은 좋은데 기존 키보드 앱이 금방 따라 할 수 있어 보여요.'],
      ['vc3', 'pass', '말투 학습이 꽤 자연스러워요. 개인정보 동의 흐름은 꼭 다듬어야 해요.'], ['vc6', 'pass', '1억 명이라는 미션에 가장 가까운 형태. 배포 채널 전략을 더 듣고 싶음.']] },
  { id: 'saebyeok', name: '새벽세시', members: ['심청', '심학규'], topic: 't5', svc: 'Night Shift', en: 'Reskilling call-center agents into AI QA leads',
    one: '야간 콜센터 상담원을 AI 상담 품질 관리자로 키우는 재교육 코치', market: '필리핀·인도 BPO 상담원',
    built: '상담 녹취 평가 화면과 코칭 시나리오 생성', guide: "1. '샘플 상담 불러오기'를 누르세요\n2. 오른쪽 코칭 카드에서 '다음 연습'을 눌러 보세요",
    votes: [['vc2', 'fail', '문제 정의는 좋은데 데모에서 코칭이 실제로 어떻게 달라지는지 안 보였어요.'], ['vc5', 'pass', '현장 상담원 인터뷰를 했다는 점이 좋았어요.'],
      ['vc1', 'fail', 'BPO 업계에서 돈을 낼 사람이 누구인지가 불분명함.'], ['vc3', 'fail', '재교육 시장은 크지만 오늘 만든 범위가 좁아요.']] },
  { id: 'bandit', name: '반딧불', members: ['견우', '직녀'], topic: 't4', svc: 'Glow', en: 'A screenless desk lamp you control with gestures',
    one: '말 대신 손짓과 표정으로 조작하는 화면 없는 AI 스탠드', market: '북미 재택근무자',
    built: '웹캠 제스처 인식과 조명 제어 시뮬레이터', guide: "1. 카메라 권한을 허용해 주세요\n2. 손바닥을 펴면 켜지고, 주먹을 쥐면 꺼져요\n3. 고개를 기울이면 밝기가 바뀌어요",
    votes: [['vc3', 'pass', '채팅창이 아닌 인터페이스라는 미션을 정면으로 풀었어요.'], ['vc2', 'pass', '하드웨어 없이 웹캠만으로 이 정도 반응 속도면 인상적임.'],
      ['vc6', 'pass', '데모 흐름이 짧고 분명해서 바로 이해됐어요.']] },
  { id: 'paper-plane', name: '종이비행기', members: ['콩쥐', '팥쥐'], topic: 't6', svc: 'Paperplane', en: 'Turns Korean IR decks into what US seed VCs read',
    one: '한국 스타트업 IR 자료를 미국 시드 VC가 읽는 형식으로 바꿔 주는 리서치 에이전트', market: '미국 시드 투자를 찾는 한국 창업자',
    built: 'IR PDF 분석과 투자 메모 생성', guide: "1. 샘플 IR을 고르세요\n2. '메모 만들기'를 누르면 1분 안에 영문 메모가 나와요",
    existing: '예전에 만든 IR 요약 프롬프트 일부',
    votes: [['vc4', 'fail', '결과물이 일반적인 요약 수준이라 차별점이 약해요.'], ['vc1', 'fail', '투자자 매칭 데이터가 없으면 리서치만으로는 부족해 보임.'],
      ['vc5', 'fail', '타깃 VC 리스트를 직접 만들어 보면 훨씬 설득력 있을 것 같아요.']] },
  { id: 'orange-cat', name: '주황고양이', members: ['흥부', '놀부'], topic: 't7', svc: 'SkinRoute', en: 'Compare Korean skin clinics and prices from one photo',
    one: '피부 사진 한 장으로 한국 피부과 시술과 가격을 영어로 비교해 주는 앱', market: '일본·미국 의료관광객',
    built: '사진 분석, 시술 추천, 병원 비교 화면', guide: "1. 샘플 사진 중 하나를 고르세요\n2. 추천 시술을 누르면 병원별 가격이 나와요\n3. '예약 문의'는 데모라 실제로 보내지지 않아요",
    votes: [['vc6', 'pass', '의료관광 동선을 잘 이해하고 있어요. 병원 쪽 파트너십이 관건이에요.'], ['vc2', 'fail', '가격 비교는 규제 이슈가 있을 수 있어요.'],
      ['vc4', 'fail', '진단처럼 보이는 표현은 조심해야 함.'], ['vc1', 'pass', '데모 완성도가 높고 바로 써 보고 싶어요.'], ['vc5', 'pass', '외국인 리뷰 데이터를 어디서 가져올지 궁금하지만 방향은 좋아요.']] },
  { id: 'cloud-bridge', name: '구름다리', members: ['장화', '홍련'], topic: 't2', svc: 'Mate', en: 'A to-do agent that talks like your game party',
    one: '게임 속 동료처럼 말을 거는 일정 관리 에이전트', market: '미국 대학생 게이머',
    built: '캐릭터 대화 엔진과 일정 연동', guide: "1. 캐릭터를 하나 고르세요\n2. '오늘 할 일'을 말하면 퀘스트로 바꿔 줘요",
    votes: [['vc2', 'pass', '캐릭터 대사가 재밌어서 계속 쓰고 싶어져요.'], ['vc3', 'pass', '게임 감각을 생산성 도구에 붙인 시도가 신선함.'],
      ['vc5', 'fail', '리텐션 장치가 캐릭터에만 기대는 건 아닌지 걱정돼요.'], ['vc4', 'pass', '미국 대학생이 타깃이면 디스코드 연동부터 하면 좋겠어요.']] },
  { id: 'shooting-star', name: '별똥별', members: ['이몽룡', '성춘향', '방자'], topic: 't8', svc: 'Remit Star', en: 'Stablecoin remittance inside your messenger',
    one: '메신저에서 바로 스테이블코인으로 고향에 송금하는 지갑', market: '한국에서 일하는 베트남 근로자',
    built: '지갑 생성, 송금 흐름, 수수료 비교', guide: "1. 데모 지갑이 미리 만들어져 있어요\n2. '송금'에서 금액을 넣으면 수수료 비교가 나와요",
    votes: [['vc6', 'pass', '송금 수수료 비교가 명확해요.'], ['vc1', 'fail', '규제와 환전 경로 설명이 부족해요.'], ['vc3', 'fail', '지갑 UX는 깔끔하지만 기존 송금 앱과 차이가 작아 보임.'],
      ['vc2', 'pass', '타깃 고객을 정확히 정한 점은 좋았어요.'], ['vc5', 'fail', '현지 파트너 없이는 출금이 어려울 것 같아요.']] },
  { id: 'hourglass', name: '모래시계', members: ['우렁각시', '나무꾼'], topic: 't3', svc: 'Hourglass', en: 'Generates and grades Korean eval tasks for AI agents',
    one: 'AI 에이전트 평가용 한국어 과제를 만들고 채점하는 플랫폼', market: '미국 AI 평가·데이터 회사',
    built: '과제 생성기, 채점 기준 편집기, 검수 대시보드', guide: "1. '과제 세트 만들기'를 누르세요\n2. 샘플 에이전트 답변을 채점하고 검수 화면을 열어 보세요",
    votes: [['vc2', 'pass', '바로 고객이 떠오르는 제품이에요. 가격 모델만 정하면 될 것 같아요.'], ['vc5', 'pass', '채점 기준을 사람이 검수하는 흐름이 잘 잡혀 있어요.', '데이터 라이선스 확인'],
      ['vc4', 'pass', '데이터 품질 지표를 데모에서 보여준 게 좋았음.']] },
  { id: 'pinecone', name: '솔방울', members: ['바리', '선녀'], topic: 't9', svc: 'Pinecone QA', en: 'Reads inspection logs and points to the root cause first',
    one: '공장 검사 기록을 읽고 불량 원인부터 짚어 주는 품질 관리 에이전트', market: '베트남·멕시코 전자부품 공장',
    built: '검사 로그 분석과 원인 리포트', guide: "1. 샘플 검사 로그를 올려 보세요\n2. 리포트의 '원인 후보'를 누르면 근거 데이터가 나와요",
    votes: [['vc5', 'pass', '독점 데이터가 있는 버티컬을 정확히 골랐어요.'], ['vc6', 'fail', '실제 공장 데이터 없이 만든 한계가 보여요.'],
      ['vc1', 'pass', '도입을 결정하는 사람이 누구인지 다음엔 꼭 확인해 보세요.'], ['vc3', 'pass', '품질 관리자 입장에서 바로 쓸 만한 화면이에요.']] },
  { id: 'green-light', name: '초록신호', members: ['해님', '달님'], topic: 'wild', svc: 'Greenlight', en: 'Voice guidance for crosswalk signals',
    one: '횡단보도 신호를 음성으로 알려 주는 시각장애인 길 안내', market: '영국 시각장애인 보행자',
    built: '신호 데이터 연동과 음성 안내 앱', guide: "1. '런던 샘플 경로'를 고르세요\n2. 재생을 누르면 신호가 바뀔 때마다 음성으로 알려 줘요",
    votes: [['vc1', 'pass', '와일드카드인데 타깃 시장이 분명해서 좋았어요.'], ['vc4', 'fail', '공공 데이터 의존도가 높아 국가별 확장이 어려울 수 있어요.'],
      ['vc6', 'pass', '오늘 하루에 만든 결과물로는 완성도가 높아요.'], ['vc2', 'fail', '수익 모델이 아직 안 보여요.'], ['vc3', 'pass', '당사자 인터뷰가 있으면 훨씬 강해질 것 같아요.']] },
  { id: 'snail', name: '달팽이레이싱', members: ['토끼', '자라'], topic: 't1', svc: 'Snail Mail', en: "Newsletters you don't read, as a 3-minute commute audio",
    one: '읽기 싫은 뉴스레터를 출근길 3분 오디오로 바꿔 주는 앱', market: '미국 직장인 팟캐스트 청취자',
    built: '메일 연동, 요약, 음성 합성', guide: "1. 샘플 받은편지함을 연결하세요\n2. '오늘의 3분'을 누르면 바로 재생돼요",
    votes: [['vc3', 'pass', '매일 쓰는 습관을 만들 수 있는 제품이에요.'], ['vc6', 'pass', '오디오 품질이 생각보다 좋아요.'], ['vc4', 'pass', '경쟁 서비스가 많아서 배포 전략이 핵심일 것 같아요.']] },
  { id: 'slow-turtle', name: '느린거북', members: ['옹고집', '배비장'], topic: 't5', svc: 'Second Act', en: "Retired craftsmen's know-how, kept as an AI tutor",
    one: '은퇴한 숙련 기술자의 노하우를 AI 튜터로 남기는 서비스', market: '독일 제조업 은퇴자',
    built: '인터뷰 녹음 정리와 튜터 대화', guide: "1. 샘플 인터뷰를 고르세요\n2. 튜터에게 '용접 각도'를 물어보세요",
    votes: [['vc1', 'pass', '숙련 기술을 남긴다는 문제 의식이 좋아요.'], ['vc5', 'fail', '튜터 품질을 어떻게 검증할지 더 보고 싶어요.']] },
  { id: 'glass-shoe', name: '유리구두', members: ['허생', '김선달'], topic: 't4', svc: 'Beam', en: 'Slides that advance themselves while you talk',
    one: '말하는 동안 AI가 알아서 슬라이드를 넘겨 주는 발표 도우미', market: '미국 B2B 영업 담당자',
    built: '음성 인식과 슬라이드 넘김 연동', guide: "1. 샘플 발표를 여세요\n2. 마이크를 켜고 대본을 읽으면 슬라이드가 넘어가요",
    votes: [['vc2', 'pass', '화면이 없는 제품이라는 미션에 잘 맞는 아이디어예요.']] },
  { id: 'blue-umbrella', name: '파란우산', members: ['연오랑', '세오녀'], topic: 't7', submit: false,
    one: '여행 중 피부 고민을 현지 약국 제품으로 연결해 주는 가이드', market: '대만 여행객' },
];
// in --live mode: the first 11 submit, the first 8 get all their votes, and only the first 7 results go out
const SUBMIT_N = LIVE ? 11 : 13, VOTED_N = LIVE ? 8 : 13, REVEAL_N = LIVE ? 7 : 13;
const PARTIAL = LIVE ? { 'pinecone': 2, 'green-light': 1, 'snail': 0 } : {};

// ---------- a tiny two-page PDF per team (ASCII text, built-in fonts, no dependencies) ----------
const rgb = hex => [1, 3, 5].map(i => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(3)).join(' ');
const pstr = s => `(${String(s).replace(/[^\x20-\x7e]/g, '').replace(/[\\()]/g, m => '\\' + m)})`;
const text = (x, y, size, font, color, s) => `BT /${font} ${size} Tf ${rgb(color)} rg ${x} ${y} Td ${pstr(s)} Tj ET`;
const rect = (x, y, w, h, color) => `${rgb(color)} rg ${x} ${y} ${w} ${h} re f`;
function pitchPdf(t, no) {
  const p1 = [rect(0, 0, 960, 540, '#0A0706'), rect(60, 300, 90, 8, '#FF7A4D'),
    text(60, 440, 16, 'F1', '#FF7A4D', `TEAM ${String(no).padStart(2, '0')}  |  DEMO PITCH`), text(60, 340, 76, 'F1', '#F6E6DA', t.svc),
    text(60, 250, 26, 'F2', '#C9BFB2', t.en), text(60, 56, 13, 'F2', '#857B72', 'Fictional demo data - bloom-hackathon-kit')].join('\n');
  const p2 = [rect(0, 0, 960, 540, '#F7F3EB'), text(60, 448, 40, 'F1', '#17110F', 'What we built today'),
    ...['Problem worth solving, in one sentence', 'A live demo built from an empty repo today', 'Next: the first 100 users in the target market']
      .flatMap((s, i) => [rect(60, 352 - i * 70, 34, 34, '#D97757'), text(70, 362 - i * 70, 18, 'F1', '#FFFFFF', String(i + 1)), text(112, 361 - i * 70, 24, 'F2', '#17110F', s)]),
    text(60, 56, 13, 'F2', '#857B72', `${t.svc}  |  page 2 / 2`)].join('\n');
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [5 0 R 7 0 R] /Count 2 >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];
  for (const c of [p1, p2]) {
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 960 540] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${objs.length + 2} 0 R >>`);
    objs.push(`<< /Length ${Buffer.byteLength(c)} >>\nstream\n${c}\nendstream`);
  }
  let out = '%PDF-1.4\n';
  const offs = objs.map((o, i) => { const at = Buffer.byteLength(out); out += `${i + 1} 0 obj\n${o}\nendobj\n`; return at; });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

// ---------- commit stats (written through the admin API, since github.com/example repos have no history) ----------
const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const MSGS = ['feat: 첫 화면과 온보딩', 'feat: 데모 계정 로그인', 'fix: 모바일 레이아웃 깨짐', 'chore: .env.example 추가', 'feat: 음성 입력 연결', 'refactor: 프롬프트 정리',
  'feat: 발표용 샘플 데이터', 'docs: README에 데모 사용법', 'feat: 대시보드 차트', 'fix: API 타임아웃 늘림', 'feat: 영어 번역', 'test: 채점 기준 샘플', 'feat: 공유 링크',
  'style: 버튼 색 정리', 'fix: 이미지 업로드 크기 제한', 'feat: 결과 리포트 PDF 내보내기', 'fix: 빈 응답 처리', 'feat: 결제 링크 연결'];
function commits(t0, buildStart) {
  const MIN = 60000, perTeam = {}, feed = [];
  TEAMS.forEach(t => {
    const h = hash(t.id), count = 12 + (h % 70), firstAt = buildStart + (6 + (h >>> 8) % 30) * MIN, lastAt = t0 - ((h >>> 4) % 6 === 0 ? 3 : 4 + (h >>> 12) % 80) * MIN;
    // two teams carry the flags the judge page explains: a commit before the start, and a huge first commit
    perTeam[t.id] = { count, lastAt, firstAt: t.id === 'paper-plane' ? buildStart - 52 * MIN : firstAt, firstAdditions: t.id === 'shooting-star' ? 4210 : 120 + (h % 900) };
    for (let k = 0; k < 2 + (h % 3); k++) feed.push({ teamId: t.id, sha: hash(t.id + k).toString(16).padStart(7, '0').slice(0, 7), msg: MSGS[(h + k * 7) % MSGS.length], at: lastAt - k * (9 + (h % 17)) * MIN });
  });
  return { perTeam, feed };
}

// times around now, written with the event's UTC offset so the console shows local times
const off = (EVENT.times.buildStart.match(/([+-])(\d\d):?(\d\d)$/) || ['', '+', '00', '00']);
const offMin = (off[1] === '-' ? -1 : 1) * (Number(off[2]) * 60 + Number(off[3]));
const iso = ms => new Date(ms + offMin * 60000).toISOString().slice(0, 19) + `${off[1]}${off[2]}:${off[3]}`;

// ---------- run ----------
const st0 = await call('/api/state?scope=admin', null, ADMIN_KEY).catch(e => { console.error(`can't reach ${B} as admin: ${e.message}\nstart it with: npm run dev`); process.exit(1); });
if (st0.storage !== 'memory' && !args.includes('--force')) { console.error(`this server stores data in ${st0.storage || 'a database'}; the demo seed only resets the local file store (pass --force to override)`); process.exit(1); }

const t0 = Date.now(), H = 3600000, MIN = 60000, buildStart = t0 - 6 * H;
await admin('resetAll', { confirm: 'RESET', keepTeams: false });
await admin('setConfig', { patch: { topicsRevealed: true, test: false, submitPaused: false, discordMuted: true, grace: {}, rotate: null,
  capacity: EVENT.capacity, threshold: EVENT.threshold, topics: MISSIONS,
  buildStart: iso(buildStart), submitOpenAt: iso(buildStart), topicDeadline: iso(buildStart + 30 * MIN), submitDeadline: iso(t0 + (LIVE ? 80 : 60) * MIN) } });

for (const t of TEAMS) await admin('upsertTeam', { team: { id: t.id, name: t.name, members: t.members, emails: [`${t.id}@example.com`, `${t.id}.team@example.com`] } });
const title = id => MISSIONS.find(m => m.id === id)?.title || '';
for (const t of TEAMS) await admin('setTopic', { teamId: t.id, topic: { topic: t.topic, topicTitle: title(t.topic), idea: t.one, market: t.market, repo: `https://github.com/example/${t.id}` } });

const demoDir = path.join(ROOT, 'public', 'assets', 'demo');
fs.mkdirSync(demoDir, { recursive: true });
const subs = TEAMS.filter(t => t.submit !== false).slice(0, SUBMIT_N);
for (const [i, t] of subs.entries()) {
  fs.writeFileSync(path.join(demoDir, `${t.id}.pdf`), pitchPdf(t, i + 1));
  await call('/api/submit', { email: `${t.id}@example.com`, serviceName: t.svc, oneLiner: t.one, market: t.market, demoUrl: `https://example.com/${t.id}`,
    pdfUrl: `${B}/assets/demo/${t.id}.pdf`, builtToday: t.built, demoGuide: t.guide, usedExisting: !!t.existing, existingNote: t.existing || '' });
}
await admin('setCommits', commits(t0, buildStart));

for (const [i, t] of subs.entries()) {
  if (i >= VOTED_N && !(t.id in PARTIAL)) continue;
  const list = t.id in PARTIAL ? t.votes.slice(0, PARTIAL[t.id]) : t.votes;
  for (const [vc, v, comment, memo] of list) await vote(t.id, vc, v, comment, memo);
}
// results go out in submission order, as the auto-reveal script does on the day; the 8th PASS closes the round
for (const t of subs.slice(0, REVEAL_N)) {
  const st = await call('/api/state?scope=admin', null, ADMIN_KEY);
  const x = st.subs.find(y => y.teamId === t.id);
  if (x?.auto?.result && !x.dec && x.status !== 'closed') await admin('reveal', { teamId: t.id });
}
await admin('clearFlash');

if (!LIVE) {
  // shark tank: two offer rounds the way the console runs them, plus one match recorded afterwards
  const { passList } = await call('/api/state?scope=admin', null, ADMIN_KEY);
  await admin('demo', { op: 'order', order: passList });
  const round = async (idx, yes, pick) => {
    await admin('demo', { op: 'go', idx });
    await admin('offerOpen', { teamId: passList[idx] });
    for (const vc of Object.keys(VC_KEYS)) await call('/api/match', { k: VC_KEYS[vc], teamIds: yes.includes(vc) ? [passList[idx]] : [] });
    await sleep(4300); // the console ignores a close within 4s of opening
    await admin('offerReveal');
    await admin('matchConfirm', { teamId: passList[idx], vc: pick });
  };
  await round(0, ['vc1', 'vc3'], 'vc3');
  await round(1, ['vc2'], 'vc2');
  await admin('matchConfirm', { teamId: passList[4], vc: 'vc5' });
  await admin('demo', { op: 'go', idx: 2 });
}
await admin('setLed', { patch: { scene: 'board', flash: null, standbyTarget: iso(t0 + 25 * MIN) } });

const st = await call('/api/state?scope=admin', null, ADMIN_KEY);
// only the public dev keys are printed; a real key from .env.local stays out of the terminal
const shown = k => (String(k).startsWith('dev-') ? k : '<your key>');
const judgeKey = VC_KEYS.vc1 || Object.values(VC_KEYS)[0];
console.log(`seeded ${LIVE ? 'mid-judging' : 'end of judging'}: ${JSON.stringify(st.counts)}${LIVE ? '' : ` · matches ${Object.keys(st.led.teamMatch || {}).length}`}`);
console.log(`  LED      ${B}/led            (operator: ${B}/led?key=${shown(ADMIN_KEY)})`);
console.log(`  console  ${B}/console?key=${shown(ADMIN_KEY)}`);
console.log(`  judge    ${B}/judge?k=${shown(judgeKey)}`);
console.log(`  live     ${B}/live    · submit ${B}/submit (try dotori@example.com)`);
if (!LIVE) console.log(`  archive  node scripts/build-feedback.mjs ${B}  →  ${B}/feedback`);
