// Opening slides for the LED "slide" scene, written from assets/event.js so a new event only edits that file.
// In deck mode the header hides and each slide fills the area above the logo footer.
// One idea per slide, the title always in the same top-left slot, and a drawn pictogram carrying the message (no photos needed).
// An entry with { topics: true } reveals the mission cards one click at a time, then moves on.
import { EVENT as E, JUDGES, HOSTS, MISSIONS } from './event.js';
import { esc, hm, NAME } from './common.js';

const at = k => (E.times?.[k] ? hm(E.times[k]) : '');
const TH = E.threshold, CAP = E.capacity, PAGES = E.pitchPages, CH = E.discord?.participants;
const WILD = MISSIONS.find(m => !m.vc);

const MARK = `<div class="mark">${esc(E.name)}</div>`;
const D = (cls, inner, mark = true) => `<div class="d ${cls}">${inner}${mark ? MARK : ''}</div>`;
// fixed title slot (top-left); `right` narrows it when a visual sits on the right
const T = (h, s = '', right = '') => `<div class="t tl"${right ? ` style="right:${right}"` : ''}><div class="dh">${h}</div>${s ? `<div class="ds" style="margin-top:2.4cqh">${s}</div>` : ''}</div>`;
const rows = items => `<div class="rl">${items.map((t, i) => `<div><b>${String(i + 1).padStart(2, '0')}</b><span>${t}</span></div>`).join('')}</div>`;
const logo = (l, base) => `<img src="${l.color || l.logo}" style="height:${(base * (l.h || 1)).toFixed(2)}cqh" alt="">`;

// the day as one bar; labels alternate above and below so they never collide
const toH = s => { const [h, m] = String(s).split(':').map(Number); return h + (m || 0) / 60; };
const SCHED = (E.schedule || []).map(x => ({ ...x, a: toH(x.at), b: toH(x.end || x.at) }));
const H0 = Math.min(...SCHED.map(x => x.a)), H1 = Math.max(...SCHED.map(x => x.b)), SPAN = H1 - H0 || 1;
const SEGC = ['#8A7F75', '#D9CFC1', '#17110F', '#B5AA9E', '#A69B8F'];
const dayBar = () => { let k = 0; return `<div class="dbar">${SCHED.map((x, i) => {
  const L = (x.a - H0) / SPAN * 100, W = (x.b - x.a) / SPAN * 100;
  const pos = (i % 2 ? 'dn' : 'up') + (i && i === SCHED.length - 1 ? ' r' : '');
  const color = x.main ? '#D97757' : SEGC[k++ % SEGC.length];
  return `<div class="seg" style="left:${L}%;width:${W}%;background:${color}">${W > 40 ? `<span>${+(x.b - x.a).toFixed(1)}시간</span>` : ''}</div>
    <div class="lab ${pos}" style="${pos.includes('r') ? 'right:0' : `left:${L}%`}"><b>${esc(x.at)}</b><strong>${esc(x.title)}</strong>${x.sub ? `<span>${esc(x.sub)}</span>` : ''}</div>`;
}).join('')}</div>`; };

// pictograms: a commit grid, the single submission, the votes that decide, the finalist seats
const ghGrid = n => Array.from({ length: n }, (_, i) => `<i class="${['', 'a', 'b', 'c', 'a', '', 'b'][(i * 7 + (i >> 2)) % 7]}"></i>`).join('');
const VORDER = [0, 1, 3, 5, 2, 4];
const votePic = () => { const on = new Set(VORDER.filter(i => i < JUDGES.length).slice(0, TH)); return Array.from({ length: JUDGES.length }, (_, i) => on.has(i) ? '<i class="y">✓</i>' : '<i></i>').join(''); };
const seatPic = () => Array.from({ length: CAP }, (_, i) => `<i class="${i < Math.ceil(CAP * 0.6) ? 'y' : ''}"></i>`).join('');
// the build slide's backdrop: a contribution grid that fills up toward the right, like the day itself
const buildGrid = () => Array.from({ length: 9 * 22 }, (_, i) => { const c = i % 22, r = (i * 37 + c * 11) % 10; const lv = c / 22 + r / 25; return `<i class="${lv > 1.05 ? 'c' : lv > .8 ? 'b' : lv > .5 ? 'a' : ''}"></i>`; }).join('');
const siteHost = String(E.siteUrl || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
// the cover wordmark shrinks for long names so a word never breaks (about 0.72em per uppercase letter in the left half)
const coverSize = Math.min(13, 78 / (Math.max(...NAME.map(w => [...String(w || '')].length), 1) * 0.72)).toFixed(2);
const roles = [...new Set(HOSTS.map(h => h.role || ''))];

export const SLIDES = [
  // ---------- welcome and the day ----------
  { tag: 'WELCOME', html: D('', `
    ${E.media?.poster
      ? `<img src="${esc(E.media.poster)}" onerror="this.remove()" style="position:absolute;right:6cqw;top:50%;transform:translateY(-50%);height:72cqh;border-radius:2.4cqh;box-shadow:0 3cqh 6cqh rgba(60,30,20,.18)" alt="">`
      : `<div class="art">${E.mark ? `<img src="${esc(E.mark)}" alt="">` : ''}</div>`}
    <div class="t" style="left:5.2cqw;right:50cqw;top:50%;transform:translateY(-50%)">
      <div class="dk">${esc(E.organizer)} · One Day Hackathon</div>
      <div class="wm" style="font-size:${coverSize}cqh;margin-top:2.6cqh">${esc(NAME[0])}${NAME[1] ? `<br><em>${esc(NAME[1])}</em>` : ''}</div>
      <div class="ds" style="margin-top:3.4cqh">${esc(E.tagline || '')}</div>
      <div class="dl" style="margin-top:3.4cqh">${esc(E.dateLabel)} · ${esc(E.venue)}</div>
    </div>`, false) },

  ...(SCHED.length ? [{ tag: 'SCHEDULE', html: D('', `${T('오늘의 순서', `${esc(SCHED[0].at)}부터 ${esc(SCHED[SCHED.length - 1].end || SCHED[SCHED.length - 1].at)}까지 ${+SPAN.toFixed(1)}시간`)}
    <div class="t" style="left:5.2cqw;right:5.2cqw;top:30cqh">${dayBar()}</div>`) }] : []),

  // ---------- the game ----------
  { tag: 'HOW IT WORKS', html: D('', `${T('해커톤 진행 방식', '', '5cqw')}
    <div class="t flow" style="left:5.2cqw;right:5.2cqw;top:33cqh">
      <div class="fs"><div class="pic"><div class="gh">${ghGrid(54)}</div></div>
        <b>공개 레포로 개발</b><span>${at('buildStart')}부터 새 공개 레포, 커밋은 화면에 공개</span></div>
      <div class="ar">→</div>
      <div class="fs"><div class="pic"><div class="doc"><i></i><i></i><i style="width:80%"></i><i></i><i style="width:55%"></i><div class="one">1</div></div></div>
        <b>제출 기회는 단 1번</b><span>데모 링크와 발표자료 PDF${PAGES ? ` ${PAGES}장` : ''}, ${at('submitDeadline')}까지 선착순</span></div>
      <div class="ar">→</div>
      <div class="fs"><div class="pic"><div class="votes">${votePic()}</div></div>
        <b>VC ${TH}곳 PASS면 본선</b><span>${TH}곳이 FAIL하면 탈락, 먼저 모이는 쪽으로 결정</span></div>
      <div class="ar">→</div>
      <div class="fs"><div class="pic"><div class="seats">${seatPic()}</div></div>
        <b>본선은 오직 <em>${CAP}자리</em></b><span>다 차면 바로 마감, 결과는 이름과 함께 화면에</span></div>
    </div>`) },

  ...(E.rules?.length ? [{ tag: 'HACKATHON RULES', html: D('', `${T('해커톤 규칙')}
    <div class="t" style="left:5.2cqw;right:8cqw;top:26cqh">${rows(E.rules.map(esc))}</div>`) }] : []),

  { tag: 'MISSION', topics: true },

  ...(WILD ? [{ tag: 'WILDCARD', html: D('', `${T(`와일드카드: <em>${esc(WILD.short || '우리 팀의 아이디어')}</em>로`, esc(WILD.note || ''), '44cqw')}
    <div class="wildc"><span>WILDCARD</span><b>${esc(WILD.title.replace(/^와일드카드\s*[:·]\s*/, ''))}</b></div>`) }] : []),

  // ---------- judging and the evening ----------
  { tag: 'JUDGES', html: D('', `${T('오늘의 심사위원', `VC ${JUDGES.length}곳이 미션을 내고, 들어온 순서대로 심사해요`)}
    <div class="t" style="left:5.2cqw;right:5.2cqw;top:37cqh"><div class="judges2">${JUDGES.map(v => `<div>${logo(v, 5.8)}<b>${esc(v.person || v.name)}</b><span>${esc([v.name, v.title].filter(Boolean).join(' · '))}</span></div>`).join('')}</div></div>`) },

  { tag: 'VC REVIEW', html: D('', `${T('VC는 이렇게 심사해요', '', '48cqw')}
    <div class="t sm" style="left:5.2cqw;width:40cqw;top:23cqh">${rows([`제출 순서대로 VC ${JUDGES.length}곳의 화면에 올라가요`, `데모를 직접 써 보고, 발표자료 PDF${PAGES ? ` ${PAGES}장` : ''}을 봐요`, '기준은 하나, "이 팀과 후속 미팅을 하고 싶은가"', `VC ${TH}곳이 PASS하면 본선, ${TH}곳이 FAIL하면 탈락`, '한줄평은 VC 이름 없이 현장 화면에 공개돼요'])}</div>
    <div class="vcard"><div class="vq">“이 팀과 후속 미팅을<br>하고 싶은가”</div>
      <div class="vb"><span class="p">PASS · 미팅하고 싶다</span><span class="f">FAIL</span></div>
      <div class="vt"><i>한줄평 · 이름 없이 공개</i>타깃 고객을 정확히 짚었어요. 데모가 바로 이해돼요</div>
      <div class="vd">${Array.from({ length: JUDGES.length }, (_, i) => `<i class="${i < TH ? 'p' : ''}"></i>`).join('')}<span>${TH}표 먼저 · 본선</span></div></div>`) },

  { tag: 'SHARK TANK', html: D('', `${T(`${at('sharkTank') ? at('sharkTank') + ' ' : ''}샤크탱크`, `본선 ${CAP}팀${E.sharkTank?.format ? ` · ${esc(E.sharkTank.format)}` : ''}`, '5cqw')}
    <div class="t flow" style="left:5.2cqw;right:5.2cqw;top:36cqh">
      <div class="fs"><div class="pic"><div class="tk">${Math.round((E.sharkTank?.pitchSec || 180) / 60)}:00</div></div>
        <b>발표하고 질문받기</b><span>발표자료와 데모는 제출한 그대로 화면에 올라가요</span></div>
      <div class="ar">→</div>
      <div class="fs"><div class="pic"><div class="hands">${Array.from({ length: JUDGES.length }, (_, i) => `<i class="${i === 1 || i === 3 ? 'y' : ''}"></i>`).join('')}</div></div>
        <b>VC가 손을 들어요</b><span>후속 미팅을 하고 싶은 VC가 '만나고 싶어요'를 눌러요</span></div>
      <div class="ar">→</div>
      <div class="fs"><div class="pic"><div class="pick"><i class="y">${esc(JUDGES[1]?.name || 'VC')} ✓</i><i>${esc(JUDGES[3]?.name || 'VC')}</i></div></div>
        <b>팀이 한 곳을 골라요</b><span>여러 곳이 손을 들면 팀이 고르고, 그 자리에서 확정해요</span></div>
    </div>`) },

  // ---------- go ----------
  { tag: 'SUBMIT', html: D('', `${T(`주제 선언은 <em>${at('topicDeadline')}</em>,<br>제출은 <em>${at('submitDeadline')}</em>까지`, '', '44cqw')}
    <div class="t sm" style="left:5.2cqw;width:46cqw;top:42cqh">${rows([`<b class="k">${at('topicDeadline')}까지</b> 주제 선언 · 미션, 아이디어 한 줄, 타깃 시장, 공개 GitHub 레포`, `<b class="k">${at('submitDeadline')}까지</b> 제출, 팀당 한 번 · 서비스 이름, 한 줄 소개, 데모 링크, 데모 사용법, 발표자료 PDF${PAGES ? ` ${PAGES}장` : ''}`, '제출한 순서대로 바로 VC 심사가 시작돼요'])}</div>
    <div class="ucard">${E.qr?.submit ? `<img src="${esc(E.qr.submit)}" onerror="this.remove()" alt="">` : ''}
      <div class="dl">${esc(siteHost)}<wbr>/submit</div>
      <div class="ds">신청 이메일로 팀을 찾고, 안 되면 팀 이름과 내 이름으로 찾아요.${CH ? ` 궁금한 건 디스코드 <b>${esc(CH)}</b>에 남겨 주세요.` : ''}</div></div>`) },

  { tag: 'BUILD', html: D('dark', `<div class="ghx">${buildGrid()}</div>
    <div class="t" style="left:5.2cqw;top:50%;transform:translateY(-50%)">
      <div class="dk" style="color:#FF9A73">${at('buildStart')} · 개발 시작</div>
      <div class="wm" style="font-size:24cqh;margin-top:1.6cqh">Build</div>
      <div class="dl" style="margin-top:3.4cqh;font-size:4.6cqh">주제 선언은 <em>${at('topicDeadline')}</em>, 제출은 <em>${at('submitDeadline')}</em>까지 선착순</div>
    </div>`) },

  { tag: 'THANKS', html: D('', `${T('함께해 주셔서 고마워요')}
    <div class="t cat" style="left:5.2cqw;right:5.2cqw;top:24cqh">
      ${roles.map(r => `<div><label>${esc(r || '함께')}</label><div class="lo">${HOSTS.filter(h => (h.role || '') === r).map(h => logo(h, 6.4)).join('')}</div></div>`).join('')}
      <div><label>심사</label><div class="lo" style="gap:3.4cqw;flex-wrap:nowrap">${JUDGES.map(v => logo(v, 4.6)).join('')}</div></div>
    </div>`) },
];

// One clicker step through the opening: slides move by one; on the mission slide each step flips one card.
export function stepSlide(led, d, topicsCount) {
  const i = Math.max(0, Math.min(led.slide || 0, SLIDES.length - 1));
  const shown = led.topicsShown ?? 0;
  if (SLIDES[i]?.topics) {
    if (d > 0 && shown < topicsCount) return { scene: 'slide', slide: i, topicsShown: shown + 1 };
    if (d < 0 && shown > 0) return { scene: 'slide', slide: i, topicsShown: shown - 1 };
  }
  const j = Math.max(0, Math.min(i + d, SLIDES.length - 1));
  const patch = { scene: 'slide', slide: j };
  // entering the mission slide: forward starts with every card face down, backward shows them all
  if (SLIDES[j]?.topics && j !== i) patch.topicsShown = d > 0 ? 0 : topicsCount;
  return patch;
}
