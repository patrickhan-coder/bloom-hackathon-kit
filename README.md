# Bloom Hackathon Kit

**하루 만에 만들고, 그 자리에서 VC가 심사하는 해커톤**을 누구나 똑같이 열 수 있게 공개하는 운영 키트예요.

2026년 10월 24일, Bloom이 Anthropic과 함께 서울에서 연 원데이 해커톤 **Ambition for Korea**에서 실제로 쓴 코드예요. 참가자 제출, VC 실시간 심사, 현장 LED, 운영 콘솔, 샤크탱크 매칭, 디스코드 AI 운영까지 하루를 굴린 시스템을 그대로 담았어요.

![현장 LED 실시간 보드](docs/as-run/led-board.jpg)

## 그날 숫자

| 960명 신청 | 105명 · 41팀 | GitHub 커밋 2,812회 | 제출 36팀 | VC 판단 121표 | 본선 8팀 | 후속 미팅 5팀 |
|---|---|---|---|---|---|---|

운영 쪽 숫자도 있어요.
- 판정 28건은 모두 투표 그대로 자동으로 나왔고, 운영진이 손으로 바꾼 건 0건이에요.
- 참가자 질문 65건에 AI가 먼저 답했고, 첫 답까지 중앙값은 31초예요.
- 5분마다 자동 백업을 271번 했어요.

## 어떤 해커톤인가

- **모두 같은 자원으로**: 참가자 한 명당 같은 크레딧, AI 기능은 한 모델로만.
- **당일 코드만**: 10시 이후 새로 만든 공개 레포에서만 개발해요. 모든 팀의 커밋이 LED에 실시간으로 올라가요. 10시 전 커밋, 한 번에 수천 줄이 들어온 첫 커밋, 과거 이력은 심사 화면에 자동으로 표시돼요.
- **VC가 낸 미션**: 심사위원 VC가 미션을 직접 내고, 당일 아침 무대에서 공개해요. 자기 아이디어로 가려면 와일드카드를 골라요.
- **제출이 곧 심사**: 팀당 한 번만 내고, 낸 순서대로 VC가 바로 심사해요. 기준은 하나예요. "이 팀과 후속 미팅을 하고 싶은가?"
- **먼저 3표**: PASS 3표가 먼저 모이면 본선, FAIL 3표가 먼저 모이면 탈락이에요. 본선 8자리가 차는 순간 문이 닫혀요.
- **샤크탱크는 다음 미팅을 잡는 자리**: 본선 팀이 발표하면 만나고 싶은 VC가 손을 들고, 여러 곳이면 팀이 고르는 방식이에요.

자세한 규칙과 당일에 바뀐 것은 [docs/rules.md](docs/rules.md)에 있어요.

## 들어 있는 것

| 화면 | 주소 | 하는 일 |
|---|---|---|
| 참가자 제출 | `/submit` | 주제(미션) 선언과 결과물 제출을 한 링크에서. 신청 이메일로 팀을 찾아요 |
| VC 심사 | `/judge?k=…` | 제출 순서대로 데모·발표자료·커밋 기록을 보고 PASS·FAIL, 한 줄 평과 메모. 샤크탱크 제안 탭 |
| 현장 LED | `/led?key=…` | 오프닝 슬라이드, 실시간 보드(제출 전·심사 중·본선·탈락), 결과 발표 연출, 샤크탱크 |
| 실시간 현황 | `/live` | 휴대폰용 공개 현황 |
| 운영 콘솔 | `/console?key=…` | LED 장면 전환, 마감 시각, 결과 발표, 대리 투표·제출, 샤크탱크 순서·타이머·매칭 |
| 무대 타이머 | `/timer` | 발표 3분, 질의응답 7분 |
| 한 줄 평 아카이브 | `/feedback` | 행사 뒤 VC 한 줄 평을 이름 없이 공개. 결과별·미션별로 보기 |

- `api/`: 서버리스 API (제출, 주제 선언, 투표, 매칭, LED 상태, 커밋 추적, 발표자료 업로드, 관리)
- `ops/`: 디스코드 운영 스크립트 (질문 감시, AI 답변 게시, 결과 자동 발표, 제출 알림, 현황 공지, 백업)
- `docs/`: [규칙](docs/rules.md), [운영 체크리스트](docs/runbook.md), [AI 운영 방식](docs/ai-ops.md), 실제 행사 화면

## 빠르게 띄워 보기

Redis 없이 내 컴퓨터에서 바로 돌아가요. 데이터는 `.data/` 폴더의 파일에 저장돼요.

```bash
npm install
npm run dev
```

다른 터미널에서 데모 데이터를 넣어요. 가짜 팀 14개가 미션을 선언하고 그중 13팀이 제출해요. VC 여섯 곳의 심사와 샤크탱크 매칭까지 들어가요. `--live`를 붙이면 심사가 한창인 오후 상태로 넣어요.

```bash
npm run seed:demo
```

| 화면 | 주소 |
|---|---|
| 현장 LED | http://localhost:4400/led?key=dev-admin |
| 운영 콘솔 | http://localhost:4400/console?key=dev-admin |
| VC 심사 | http://localhost:4400/judge?k=dev-vc1 (`dev-vc1` ~ `dev-vc6`) |
| 참가자 제출 | http://localhost:4400/submit (`dotori@example.com`으로 팀 찾기) |
| 실시간 현황 · 아카이브 · 타이머 | `/live` · `/feedback` · `/timer` |

- `dev-admin`, `dev-vc1` 같은 개발용 키는 내 컴퓨터에서만 통해요. Vercel에 올리면 환경 변수로 넣은 키만 받아요.
- 아카이브 데이터는 `node scripts/build-feedback.mjs`로 다시 만들어요.
- `npm run e2e`는 제출부터 심사까지 한 바퀴 도는 점검이에요.
- 데모 시드는 전체 데이터를 지우고 새로 넣어요. 그래서 내 컴퓨터의 파일 저장소에서만 돌아가요.

![데모 LED 심사 화면](docs/screenshots/demo-led-judging.png)

다른 화면은 [docs/screenshots](docs/screenshots)에 있어요.

## 우리 행사로 바꾸기

`public/assets/event.js` 한 파일만 고치면 돼요. 화면과 서버(`api/_lib.js`)가 같은 파일을 읽어요.

- `EVENT`: 행사 이름, 날짜, 장소, 시각(대기·미션 공개·개발 시작·주제 선언 마감·제출 마감·샤크탱크), 본선 자리 수(`capacity`), 결정 표 수(`threshold`), 대량 커밋 기준, 샤크탱크 발표·질의응답 시간, 규칙 문구, 디스코드 링크, 포스터·영상·QR 이미지(없으면 제목 카드로 대신해요)
- `JUDGES`: 심사위원(VC). 키, 이름, 담당자, 직함, 로고
- `MISSIONS`: VC가 낸 미션과 와일드카드. 데모에는 Ambition for Korea의 실제 미션 문구를 그대로 넣어 뒀어요
- `HOSTS`: 주최·파트너 로고

로고는 `public/assets/logos/`에 넣고 경로만 바꾸면 돼요. 마감 시각, 본선 자리, 미션은 당일 운영 콘솔에서도 바꿀 수 있어요. 파일은 시작값이에요.

참가 팀은 신청 시트(팀명·이름·이메일·승인 여부)를 CSV로 받아 `scripts/build-seed.py`로 만들고, `scripts/seed.mjs`로 넣어요. 이메일은 해시로만 저장돼요.

## 배포

- Vercel에 이 폴더를 그대로 올리면 돼요. `api/`는 서버리스 함수로, `public/`은 정적 파일로 나가요.
- 저장소는 Upstash Redis예요. Vercel의 Upstash 연동을 켜면 `KV_REST_API_URL`, `KV_REST_API_TOKEN`이 자동으로 들어와요. 이 값이 없으면 메모리 저장소로 돌아가니 운영에는 꼭 Redis를 붙여요.
- 발표자료 PDF 업로드는 Vercel Blob을 써요 (`BLOB_READ_WRITE_TOKEN`).
- 관리자 키(`ADMIN_KEY`)와 VC별 심사 키(`VC_KEYS`), 디스코드 웹훅은 환경 변수로 넣어요. 전체 목록은 [.env.example](.env.example)에 있어요.
- 화면들이 몇 초마다 상태를 읽어서 행사 당일 Redis 사용량이 크게 늘어요. 그날 하루 만에 무료 플랜의 월 대역폭 한도를 넘겨, 행사가 끝난 밤 데이터베이스가 정지됐어요. 유료 플랜이나 넉넉한 한도로 준비하세요.

## 디스코드 AI 운영

행사 날 운영자 노트북의 Claude Code 세션이 디스코드를 지켰어요. 질문이 올라오면 AI가 먼저 답하고, 운영진은 같은 대화를 보다가 판단이 필요한 것만 넘겨받았어요. 제출 알림, 결과 발표, 현황 공지, 백업은 스크립트가 자동으로 했어요. 방법과 응대 기준은 [docs/ai-ops.md](docs/ai-ops.md)에 있어요.

## 실제 행사 화면

참가자와 팀원 이름은 가렸어요.

| | |
|---|---|
| ![VC 심사 화면](docs/as-run/judge.jpg) | ![참가자 제출 화면](docs/as-run/submit-form.jpg) |
| VC 심사 화면 | 참가자 제출 화면 |
| ![샤크탱크 LED](docs/as-run/led-offer.jpg) | ![디스코드 운영방](docs/as-run/discord-ops.jpg) |
| 샤크탱크 LED | 디스코드 운영방 자동 공지 |

## 라이선스

[MIT](LICENSE). 폰트(Pretendard, Anton, Black Han Sans)는 각 폰트의 SIL Open Font License를 따라요.

만든 곳: [Bloom](https://blog.bloomworld.ai/). 이 키트로 해커톤을 열었다면 알려 주세요.

---

## English summary

Bloom Hackathon Kit is the system that ran **Ambition for Korea** (Bloom × Anthropic, Seoul, 24 Oct 2026), a one-day hackathon with live VC judging. 105 builders in 41 teams pushed 2,812 commits, 36 teams submitted, six VCs cast 121 votes, 8 teams reached the shark tank and 5 left with follow-up VC meetings.

How it works: everyone builds from a fresh public repo after 10:00 with the same credits; VCs set the missions; each team submits once; VCs judge in submission order, and the first side to reach 3 votes (PASS or FAIL) decides; the round closes when 8 finalist seats fill; in the shark tank, VCs raise hands and the team picks one.

The kit has the participant submit page, the VC judging page, the LED board, a public live page, the operator console, a stage timer, an anonymous feedback archive, the serverless API (Vercel + Upstash Redis, or a local file store) and the Discord scripts used to run Q&A with Claude Code. See `docs/` for the rules as run, the runbook and the AI ops setup (Korean).
