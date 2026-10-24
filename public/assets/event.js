// The one file an organizer edits: the event, its schedule, the judges (VCs), their missions and the partners.
// The pages read it through assets/common.js and the API through api/_lib.js, so a change here shows up everywhere.
// Times are ISO strings with the venue's UTC offset. Deadlines, capacity and missions can still be changed from the
// console on the day; this file is the starting point. Everything below is demo data: replace it with your own.
// The pages pick up edits on reload; restart `npm run dev` too, since the API loads this file once.

export const EVENT = {
  name: 'Bloom Hackathon',
  nameLines: ['Bloom', 'Hackathon'], // how the name breaks on the LED and slides; the second line is the accent
  short: 'Bloom', // tab titles and tight spots
  tagline: '하루 만에 만들고, 그날 VC에게 심사받는 해커톤',
  dateLabel: '2026.12.05',
  venue: '데모 빌딩 메인홀',
  timezone: 'Asia/Seoul',
  organizer: 'Bloom',
  siteUrl: 'https://your-hackathon.vercel.app', // shown on the slides as the submit address (no trailing slash)
  mark: '/assets/logos/mark.svg', // small mascot / brand mark (LED header, submit page, cover slide)

  times: {
    standby: '2026-12-05T09:00:00+09:00', // LED standby countdown ("시작까지", shown on the day itself)
    reveal: '2026-12-05T09:40:00+09:00', // missions go up on stage; the submit page says so until then
    buildStart: '2026-12-05T10:00:00+09:00', // commits before this are flagged on the judge page
    submitOpenAt: '2026-12-05T10:00:00+09:00',
    topicDeadline: '2026-12-05T10:30:00+09:00',
    submitDeadline: '2026-12-05T17:00:00+09:00',
    sharkTank: '2026-12-05T19:00:00+09:00', // shown on the board and slides; the LED break countdown counts to it
    matching: '2026-12-05T20:30:00+09:00',
  },
  // the day as one bar on the schedule slide (local times)
  schedule: [
    { at: '09:00', end: '10:00', title: '오프닝', sub: '규칙 안내 · 미션 공개' },
    { at: '10:00', end: '17:00', title: '개발', sub: 'VC 심사는 제출 순서대로', main: true },
    { at: '17:00', end: '19:00', title: '제출 마감', sub: '샤크탱크 준비' },
    { at: '19:00', end: '20:30', title: '샤크탱크', sub: '본선 팀 발표' },
    { at: '20:30', end: '21:00', title: '매칭 · 결과', sub: '21:00 마무리' },
  ],

  capacity: 8, // finalist seats; the round closes when they fill
  threshold: 3, // first side (PASS or FAIL) to reach this many votes decides
  bulkLines: 3000, // a first commit with this many added lines gets flagged
  pitchPages: 2, // page limit for the submitted pitch PDF
  sharkTank: { pitchSec: 180, qaSec: 420, format: '팀당 발표 3분, 질의응답 7분' },
  finalistNotice: '본선 팀은 팀원 모두 18:45까지 메인홀로 모여 주세요.', // added to the PASS result post
  prize: { amount: '$5,000', label: '팀당 AI 크레딧' }, // null hides it everywhere
  wifi: 'Wi-Fi 이름 · 비밀번호', // LED standby default; the console can change it on the day

  rules: [
    '기획과 개발은 오늘 이 현장에서 시작해요',
    '코드는 개발 시작 이후 새 공개 레포에서만 쓰고, main 브랜치에 push해요',
    '기존 코드는 쓰지 않아요. 레포와 커밋 기록을 보고 판단해요',
    'API 키는 절대 커밋하지 않아요 (.env와 .gitignore)',
    'VC가 데모 링크를 직접 써 봐요. 앱은 행사가 끝날 때까지 켜 두세요',
  ],

  discord: {
    invite: 'https://discord.gg/your-invite', // '' hides the invite link on the judge page
    channelUrl: '', // direct link to the participant channel (falls back to the invite)
    participants: '#hackathon', // participant Q&A and result posts
    ops: '#hackathon-운영', // VCs and staff only
  },

  // optional media; null (or an empty list) hides it and the screens fall back to a title card
  media: {
    poster: null, // standby and cover image, e.g. '/assets/poster.jpg'
    trailer: null, // standby video, e.g. '/assets/trailer.mp4'
    archiveHero: null, // top photo on /feedback
    archivePhotos: [], // gallery on /feedback
  },
  qr: {
    submit: null, // QR image that opens /submit, shown on the submit slide
    community: null, // { img, text } on the closing scene, e.g. a community invite
    break: null, // { img, text } on the break scene
  },
};

// Six demo judges. key is the id used in URLs, votes and VC_KEYS; name is what screens show.
// logo is the light mark for dark screens, color the full-color mark for white bands and the ivory slides,
// h scales a logo next to the others so they look the same size.
export const JUDGES = [
  { key: 'vc1', name: 'VC A', short: 'A', person: '심사위원 A', title: 'Partner', logo: '/assets/logos/vc-a.svg', color: '/assets/logos/color/vc-a.svg', h: 1 },
  { key: 'vc2', name: 'VC B', short: 'B', person: '심사위원 B', title: 'General Partner', logo: '/assets/logos/vc-b.svg', color: '/assets/logos/color/vc-b.svg', h: 1 },
  { key: 'vc3', name: 'VC C', short: 'C', person: '심사위원 C', title: 'Investment Manager', logo: '/assets/logos/vc-c.svg', color: '/assets/logos/color/vc-c.svg', h: 1 },
  { key: 'vc4', name: 'VC D', short: 'D', person: '심사위원 D', title: 'Partner', logo: '/assets/logos/vc-d.svg', color: '/assets/logos/color/vc-d.svg', h: 1 },
  { key: 'vc5', name: 'VC E', short: 'E', person: '심사위원 E', title: 'Principal', logo: '/assets/logos/vc-e.svg', color: '/assets/logos/color/vc-e.svg', h: 1 },
  { key: 'vc6', name: 'VC F', short: 'F', person: '심사위원 F', title: 'Venture Partner', logo: '/assets/logos/vc-f.svg', color: '/assets/logos/color/vc-f.svg', h: 1 },
];

// Missions the judges set, revealed on stage one card at a time. vc is a judge key; the wildcard has vc: null.
// These are the missions of the event this kit first ran, credited to the demo judges.
export const MISSIONS = [
  { id: 't1', vc: 'vc1', title: '1년 안에 전 세계 1억 명이 쓰는 컨슈머 AI' },
  { id: 't2', vc: 'vc2', title: '한국의 엔터·게임 감각으로 미국 Personal Agent와 겨루는 서비스' },
  { id: 't3', vc: 'vc2', title: '미국 RL Eval·데이터 회사가 돈 내고 쓸 서비스' },
  { id: 't4', vc: 'vc3', title: '채팅창 다음의 인터페이스: 챗이 아닌 UI/UX, 또는 화면이 없는 제품' },
  { id: 't5', vc: 'vc3', title: 'AI로 사라질 직업 1,000만 명을 구할 제품' },
  { id: 't6', vc: 'vc4', title: '해외 투자를 받고 싶은 한국 스타트업을 위한 리서치 에이전트' },
  { id: 't7', vc: 'vc6', title: 'K-뷰티·K-의료를 찾는 전 세계 소비자를 위한 서비스' },
  { id: 't8', vc: 'vc6', title: '스테이블코인과 블록체인으로 만드는 글로벌 서비스' },
  { id: 't9', vc: 'vc5', title: '제조업처럼 독점 데이터가 있는 버티컬에서 사람이 하던 일을 대체하는 AI' },
  { id: 'wild', vc: null, title: '와일드카드: 우리 팀의 아이디어 (해외 시장 명시)', short: '우리 팀의 아이디어',
    note: '조건은 하나, 타깃 해외 시장을 국가와 고객까지 정해 주세요. VC가 낸 미션보다 불리할 수 있어요.' },
];

// Organizer and partners for the logo band, the live page and the last slide. role groups them on the slide.
export const HOSTS = [
  { key: 'bloom', name: 'Bloom', role: '주최', logo: '/assets/logos/bloom.svg', color: '/assets/logos/color/bloom.svg', h: 1 },
  { key: 'partner-a', name: 'Partner A', role: '후원', logo: '/assets/logos/partner-a.svg', color: '/assets/logos/color/partner-a.svg', h: 0.8 },
  { key: 'partner-b', name: 'Partner B', role: '장소', logo: '/assets/logos/partner-b.svg', color: '/assets/logos/color/partner-b.svg', h: 0.8 },
];
