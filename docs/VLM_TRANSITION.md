# GPT 대표 장면 분석과 REBA 연결

## 목표와 완료 기준

2026-10-09 팀장이 전달한 포크 검증 보고서의 확정 방향을 구현했다. 원본 영상은 팀이 구현한 비공개 Supabase 저장소에 보관하며(최대 50MB), OpenAI에는 대표 장면만 보낸다. 사람이 대표 장면·사람 기준 왼쪽/오른쪽·화면의 몸 방향을 고르고 전송에 동의하면 **OpenAI API만** 관절 좌표를 제안한다. 사람이 원본 위의 좌표를 확인·수정한 뒤 코드로 2차원 각도와 REBA를 계산한다.

완료 기준은 실제 API → 좌표 검토 → Q1~Q4 → 결과 요약·평가서의 연결이다. 공개 URL의 API 배포와 독립 정답 대비 정확도는 별도 검증이다. 실행 증거는 [검증 기록](VLM_VERIFICATION.md)에 남긴다.

## 데이터와 계산

`lib/vlm/contract.ts`의 `safeangle-joints-v1`을 사용한다.

- 장면: `videoId`, 실제 `timeSec`, 사람 기준 `side`, `revision`, 실제 JPEG 폭·높이, 몸 방향 `facing`. `frameIndex`는 연속 추론 프레임이 아닌 대표 장면 캡처 revision이다.
- 브라우저가 비율을 보존한 JPEG 한 장을 추출한다. 긴 변 최대 1000px, 명시적 전송 동의가 필요하다.
- 선택한 쪽의 `ear`, `shoulder`, `elbow`, `wrist`, `index_mcp`, `hip`, `knee`, `ankle`만 요청한다. 왼쪽 위 (0,0)부터 오른쪽 아래 (1,1)까지의 비율 좌표이며 관측 불가는 `null`이다.
- GPT는 각도·점수·무게·시간·visibility를 출력하지 않는다. MediaPipe의 33개 landmarks를 만들지 않는다.
- `VlmProposal`은 미확인 제안이다. `VlmEvidence`는 원 제안과 사람 수정, 실제 모델·프롬프트 버전·응답 ID·대표 장면을 보존한다.

`sceneFromVlm(evidence)` → `PostureScene` → `emptyAnswers(scene.key)` → 사람 Q1~Q4 확인 → `scorePostureScene(scene, answers)`.

`lib/angles/geometry.ts`에서 기존 포즈 엔진과 같은 픽셀 기하 계산을 공유한다. 필요한 관절 누락·가장자리·퇴화된 기하는 해당 각도를 `null`로 남긴다. 관절이 전부 없거나 몸통 길이가 영상 긴 변의 7% 미만이면 장면을 거부한다. 7%는 앱 정책이며 법정 기준이 아니다. 일부 누락은 기존 사람 보충 구간으로 확인하며, 확인 불가인 필수 항목에는 확정 점수가 없다.

목·손목은 2차원 근사값이므로 사람의 구간 확인을 유지한다. 검지 MCP는 MediaPipe 검지 landmark와 다른 점이다. 손가락 전체 추적을 뜻하지 않는다. 같은 장면·쪽의 각도, 사람 가감·하중·손잡이·활동만 계산한다.

선택한 쪽만 요청하는 `safeangle-selected-joints-1` 프롬프트는 포크의 양쪽 16좌표 프롬프트와 다르며 반복 실험도 새로 진행했다. 쪽을 고정해 요청해도 해부학적 좌우가 항상 정확하다고 보장하지 않는다.

## 변경 위치와 유지할 것

| 위치 | 책임 |
| --- | --- |
| `lib/vlm/contract.ts`, `schema.ts`, `prompt.ts` | 좌표·근거 계약, strict 출력, 선택한 쪽 요청 |
| `lib/vlm/validation.ts`, `openai.ts` | 정확한 키·범위·동의·장면 검증과 서버 전용 Responses 호출 |
| `lib/vlm/measure.ts`, `lib/angles/geometry.ts` | 사람 확인 후 좌표에서 각도 계산 |
| `lib/reba/types.ts`, `score.ts`, `lib/engine.ts` | 모델과 독립적인 채점, 기존 `scoreScene` 호출 호환 |
| `server/vision.ts`, `start.ts` | HTTP API, 키·Origin·크기·요청 제한 |
| `frontend/src/lib/captureFrame.ts`, `visionClient.ts` | 실제 장면 추출·전송, 다른 장면의 응답 거부 |
| `frontend/src/components/EvaluationFlow.tsx` | 장면·동의·좌표 수정·사람 확인·채점 |
| `frontend/src/app/report/page.tsx` | 장면·모델·원 좌표·수정 좌표와 채점 근거 |
| `tests/vlm.test.ts`, `scripts/verify-vlm-browser.cjs` | 입력·계산·실패와 실제 공개 영상 검증 |

팀 R01~R27와 표 A/B/C, 앉음·팔 지지·활동 중복·필수 누락 규칙을 유지했다. 최신 main의 대시보드·대상자·최대 3영상·작업 질문·예시 시안도 유지한다. 기존 MediaPipe 코드와 회귀 테스트는 이력에 남지만 제품 `EvaluationFlow`는 호출하지 않는다. 제품 정적 빌드에 모델·WASM을 준비하는 hook을 제거했다. 사전 설계 출처와 Git 이력은 바꾸지 않는다.

## API 경계

검증 보고서를 따라 `gpt-6.1-sol`, Responses API, reasoning `high`, image detail `original`, `store:false`, strict JSON schema를 사용한다. 실제 응답 모델 ID를 기록하고 다른 제공자로 대체하지 않는다.

- body 최대 2 MiB, 디코딩 JPEG 최대 1 MiB, 선언한 크기와 실제 JPEG 헤더 대조. 전체 JPEG 디코더를 추가하지 않았다.
- 정확한 허용 Origin, JSON, 동의, 좌표·쪽·방향·revision 검증. 외부 이미지 URL은 받지 않는다.
- 대기 최대 120초, 자동 재시도 없음. 취소 시 upstream도 중단한다. 단일 프로세스에서 동시 2회·분당 6회 제한이다.
- `completed`가 아니거나 refusal·잘못된 JSON·범위 초과이면 제안을 채택하지 않는다.
- 키·사진·본문·OpenAI 원문 오류를 로그에 출력하지 않는다. `store:false`가 OpenAI의 모든 데이터 처리를 없애지는 않는다.
- **CORS는 인증이 아니다.** 공개 서버 배포 전에 프로젝트 지출 제한과 접근 대상을 결정한다. 다중 인스턴스라면 공유 limiter가 필요하다.

HTTP: 입력 400, 동의 403, 크기 413, 빈도 429, 미설정 503, 시간 초과 504, API 실패·refusal·불완전·출력 오류 502.

## 실행과 배포

루트와 `frontend`에서 각각 `npm ci`. 루트 `.env.example`을 `.env.local`로 복사하고 **서버에만** `OPENAI_API_KEY`를 설정한다.

```powershell
# 터미널 1, 저장소 루트
npm run vision:dev
# 터미널 2, 저장소 루트
npm --prefix frontend run dev
```

웹 `http://localhost:3000`, API `http://127.0.0.1:3212/api/vision`. localhost 웹은 API 주소를 자동 사용한다. 원격 웹은 `NEXT_PUBLIC_VISION_API_URL`에 HTTPS 주소를 설정한 뒤 다시 빌드한다.

공개 웹은 `https://midnightsun90.github.io/SafeAngle/`, API는 `https://safeangle-api.vercel.app/api/vision`이다. GitHub Pages를 GitHub Actions 방식으로 활성화하고 Vercel의 `safeangle-api` 프로젝트에 API를 배포했다. 실제 공개 웹 호출 검증 상태는 [검증 기록](VLM_VERIFICATION.md)에 남긴다.

Pages workflow는 repository variable `VISION_API_URL`을 빌드 시 읽는다. 값은 위 HTTPS API 주소다. API는 루트 `vercel.json`과 `api/vision.mjs`로 별도 배포하며 Next.js나 영상·모델 자산을 업로드하지 않는다. `OPENAI_API_KEY`는 Vercel Production의 Secret이고 브라우저나 Git에 넣지 않는다. `NODEJS_HELPERS=0`으로 원본 HTTP 요청을 공유 처리기에 넘긴다. GPT 대기 120초를 위해 함수 최대 실행 시간을 180초로 설정했다.

공개 API의 기본 허용 Origin은 `https://midnightsun90.github.io`다. 웹은 현재 Supabase 세션의 Bearer 토큰을 전달하고, API가 같은 Supabase의 `/auth/v1/user`에서 검증한다. 없는 토큰·만료된 세션은 401이며 OpenAI를 호출하지 않는다. 기존 익명 로그인과 RLS는 유지한다. 다른 배포를 연결할 때 `ALLOWED_ORIGIN`과 필요 시 `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`를 설정한다. 이 publishable key는 서버 비밀 키가 아니다.

API 빌드는 Node 24에서 `node scripts/build-api.mjs`로 진행한다. 기본 `stripTypeScriptTypes`로 필요한 서버·VLM 7개 파일을 `.api-build`의 JavaScript로 변환하고 상대 import 확장자를 바꾼다. `api/vision.mjs`가 생성된 처리기를 불러온다. 처리기 export는 빌드 중 assert로 확인하며 생성 파일은 Git에 넣지 않는다. 공개 웹의 실제 DB·저장소 → 재불러오기 → GPT → REBA → 상세 평가서까지 검증했으며, 분모와 미확인 항목은 [검증 기록](VLM_VERIFICATION.md)에 있다.

로컬 서버 환경은 `OPENAI_API_KEY`, `OPENAI_VISION_MODEL`, `ALLOWED_ORIGIN`, `PORT`, `HOST`다. 단일 프로세스 동시·분당 제한은 배포 인스턴스마다 적용되므로 전체 프로젝트 지출 상한을 대신하지 않는다.

## 상태와 검증

동의 전 전송 없음, 좌표 확인 전 점수 없음. 영상·시각·쪽·방향·재요청은 제안·답변·결과를 제거한다. 좌표를 수정하면 좌표 확인과 질문을 다시 받는다. requestId·scene·revision·imageSize가 다른 응답은 버리고 화면 이탈은 요청을 취소한다. 최대 3영상의 상태는 독립적이다.

최신 팀 화면은 대상자 → 영상 등록·하지 않는 작업 생략 → 영상 확인 → 작업 질문 → `/analysis`다. 실제 GPT 엔진은 `/analysis`에 연결했고 예시 추천·확인 경로는 유지했다. 앞에서 받은 작업 조건은 보존하되 범위 답변을 실제 kg·분·횟수로 임의 변환하지 않는다. REBA 질문에서 실제 조건을 확인한다. 새 REBA 결과·대표 이미지·좌표는 대상자별 메모리에만 남고 Supabase나 localStorage에 저장하지 않는다. 평가자·대상자 이름, 작업 조건·진행 입력의 DB 동기화, 원본 영상의 비공개 업로드와 서명 URL 재생은 최신 main 40671a8의 팀 구현 그대로다. 저장 영상을 다시 열면 새 좌표 확인과 채점이 필요하다.

기존 REBA 240칸·논문 예제·기하 회귀, VLM 입력·동의·누락·오류, 공개 영상 실제 API, 수정·재채점·평가서·모바일을 검증한다. [실제 결과와 분모](VLM_VERIFICATION.md)를 확인한다. 정답 없는 영상의 반복 안정성을 관절 정확도나 REBA 정확도로 발표하지 않는다.

제외한 범위: 연속 VLM 추적, 최악 장면 자동 탐색, 33개 전신·손가락 전체 추적, 3D, 추가 모델, 개선안·법정 조사표 전체 신규 구현. REBA를 법적 조사 완료로 표시하지 않는다.

공식 참고: [이미지 입력의 제한](https://developers.openai.com/api/docs/guides/images-vision), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs). 스키마 일치는 관절 정확도를 보장하지 않는다.
