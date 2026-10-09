# GPT 대표 장면 검증, 2026-10-09

## 검증 범위

공개 영상 **1편의 2.00초 장면**, 480×640 JPEG를 같은 사람 기준 왼쪽·화면 왼쪽 방향으로 3회 분석했다. `gpt-6.1-sol`, reasoning high, image original, 프롬프트 `safeangle-selected-joints-1`을 사용했다. OpenAI 실제 호출이며 독립 정답 좌표는 없다.

공개 출처: RickyBennison, [Basic single leg squat](https://commons.wikimedia.org/wiki/File:Basic_single_leg_squat.webm), 2022-08-04, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). 운동 영상이므로 산업 작업의 대표 표본은 아니다. 원본 SHA-256: `ab4602823ad00de3409eb50d2c65c6b1ce5566c5dca6753555ff2b19107db88e`. 파생 영상과 이미지도 CC BY-SA 4.0이다. 재현용 파일은 Git에서 제외한 `.local/fixtures`, `.local/vlm-verification`에 있다.

초기 방향 선택이 반대인 시나리오에도 3회 호출했다(36.196·29.381·44.364초). 원본을 직접 보고 방향을 수정했으며 아래 각도 표에는 초기 시나리오를 포함하지 않았다. 이번 작업의 총 실제 호출은 6회다. 초기 시나리오 3번째에는 고관절·무릎·발목이 null이었다. 정확도 성적으로 취급하지 않는다.

## 실제 반복 결과

시간: **24.012 / 24.773 / 25.667초**, 평균 **24.817초**. 8관절 중 7관절은 세 번 모두 좌표가 나왔고 검지 MCP는 세 번 모두 null이었다.

| 관절 | 좌표 응답 횟수 / 3 | 최대 두 응답 간 픽셀 거리 |
| --- | --- | --- |
| 귀 | 3 | 3.62 |
| 어깨 | 3 | 2.83 |
| 팔꿈치 | 3 | 3.02 |
| 손목 | 3 | 1.98 |
| 검지 MCP | 0 | 비교 불가 |
| 고관절 | 3 | 9.03 |
| 무릎 | 3 | 4.96 |
| 발목 | 3 | 2.23 |

고관절은 다른 관절보다 반복 변동이 컸다. 쪽을 고정한 요청은 보냈지만 영상에 정답 쪽 라벨이 없어 **좌우 정확도가 개선됐다고 확정할 수 없다**. 같은 사람의 같은 부위를 가리켰는지는 원본 위에서 확인해야 한다.

아래 각도는 응답 좌표를 코드로 계산한 값이며 수기 정답이 아니다. 최종 채점 전에 사람이 확인해야 한다.

| 부위 | 실행 1 | 실행 2 | 실행 3 |
| --- | --- | --- | --- |
| 몸통 | 49.15° | 52.72° | 45.78° |
| 목 근사 | -27.34° | -24.89° | -21.53° |
| 위팔 | 78.24° | 77.61° | 73.18° |
| 아래팔 | 4.00° | 13.43° | 4.04° |
| 무릎 | 76.38° | 69.39° | 67.40° |
| 손목 | null | null | null |

## 연결과 실패 처리

70개 엔진 테스트와 최신 팀의 프론트 상태 13개 테스트 통과. REBA 표 240칸·논문 예제·경계값·누락 처리 회귀와 공개 API 인증을 포함한다. 루트·프론트 타입 검사와 최신 팀 통합 후 정적 24페이지 빌드를 통과했다. 새 장면 캡처에는 seek 완료 대기를 추가했다.

실제 응답으로 좌표 확인과 Q1~Q4 이후 REBA를 계산했다. 테스트 시나리오의 목·손목 구간·하중·활동 입력은 연결 검증용이며 독립 수기 채점이 아니다. 화면 검증에서는 5점 → 활동 입력 변경 6점을 확인했다. 좌표 수정은 이전 답변과 점수를 제거했고, 평가서에 원본 이미지·실제 모델·원 좌표·수정 좌표·A/B/C 강조가 표시됐다.

이후 UI 회귀는 같은 실제 API 응답 3개를 재사용해 추가 과금 없이 수행했다. all-null·503·취소는 **통제한 응답**으로 검증했고 실제 OpenAI가 그런 오류를 냈다는 뜻은 아니다. 최신 main의 대상자·업로드·하지 않는 작업 생략·Q2~Q4에서 GPT 엔진까지 연결을 확인한다. 기존 Supabase는 통제한 응답으로 격리하고 실제 DB에 쓰지 않는다. 이 검증을 실제 Auth·DB 배포 검증으로 취급하지 않는다.

최신 팀 통합 후 브라우저 검증 10항목 통과. 390px에서 가로 넘침 없음, 브라우저 예외 0개, MediaPipe·WASM 요청 없음. 웹 외부 요청은 GPT 로컬 API와 가로챈 기존 Supabase뿐이다. 요청 도중 다른 대상자로 바꾸면 이전 좌표·점수가 반영되지 않으며 영상 등록 링크도 다시 사용할 수 있다. 좌표 표의 스크롤은 표 안에 제한했다. 최신 main 40671a8의 비공개 업로드·입력 동기화를 유지했고, 새로고침 후 서명 URL 영상 → 캔버스 JPEG → 새 좌표 확인 → REBA 연결도 검증했다. 업로드·Auth·DB·서명 URL 요청은 모두 가로챈 응답이며 실제 데이터 쓰기나 데이터베이스 마이그레이션을 실행하지 않았다.

## 공개 배포와 실제 저장 흐름 검증

2026-10-09 PR #27을 merge commit `8f61b60348bd4623b88a3e3aec8054097b47b7d0`으로 병합했다. [Pages 배포 실행 37896802618](https://github.com/midnightsun90/SafeAngle/actions/runs/37896802618)은 빌드와 게시가 모두 성공했다. 공개 웹은 [SafeAngle](https://midnightsun90.github.io/SafeAngle/), API는 `https://safeangle-api.vercel.app/api/vision`이다.

세 단계로 구분해 확인했다.

1. 배포 API 직접 확인: health 200, 로그인 없는 분석 401, 실제 익명 Supabase 세션의 인증된 분석 200. OpenAI 실제 호출 1회, 32.550초, 7관절 좌표와 검지 MCP null을 반환했다.
2. 공개 웹의 실패·회귀 검사 10항목: 실제 Auth와 실제 배포 API·OpenAI 호출 1회(31.055초)를 사용했다. DB·저장소는 통제한 응답이며 추가 분석 2개는 이전 실제 응답 재사용이다. 좌표 수정, 쪽 변경, all-null, 서버 오류, 취소, 대상자 변경, 390px 화면, 평가서 연결을 확인했다. 브라우저 예외 0개, MediaPipe·WASM 요청 0개다. 이 단계의 세 응답을 공개 API 3회 반복 실험으로 해석하지 않는다.
3. 실제 저장 흐름: 별도 테스트 브라우저에서 요청을 가로채지 않고 실제 익명 Auth, 평가자 프로필, 대상자·평가 DB 행, 비공개 TUS 영상 업로드를 진행했다. Q2~Q4 이후 새로고침해 실제 서명 URL 영상과 저장된 입력을 복원했다. 해당 영상의 2.00초 장면을 캔버스로 추출해 배포 API와 OpenAI에 실제 요청했다(26.447초). 사람이 관절과 작업 조건을 확인한 뒤 REBA 5점, 결과 요약, 원본 장면·좌표·A/B/C가 있는 상세 평가서까지 확인했다. 브라우저 예외와 HTTP 오류는 0개다. 5점은 연결 검증 시나리오의 결과이며 독립 수기 정답과의 일치 결과가 아니다.

테스트가 만든 영상 객체와 해당 테스트 평가자의 DB 행만 삭제했다. 세 검증 단계가 생성한 익명 Auth 사용자는 남아 있다. 실제 사용자 데이터와 DB 스키마를 변경하지 않았다. 토큰·키는 검증 결과나 Git에 저장하지 않았다. 결과와 화면은 Git에서 제외한 `.local/hosted-api-verification.json`, `.local/public-verification`, `.local/live-flow`에 있다.

서버의 `OPENAI_API_KEY`는 Vercel Production Secret이다. Node 24 기본 TypeScript 제거 기능으로 API에 필요한 7개 파일만 JavaScript로 빌드하며, 생성된 공유 처리기의 export를 assert로 확인한다. 인증은 Supabase `/auth/v1/user`에서 확인하며 CORS만으로 인증을 대신하지 않는다. 단일 인스턴스 제한은 프로젝트 전체 지출 상한이 아니다.

## 재현

```powershell
npm ci
npm --prefix frontend ci
npm run prepare:fixtures
npm --prefix frontend run build
# 서버 .env.local에 키와 ALLOWED_ORIGIN=http://127.0.0.1:4180 설정
npm run vision:dev
# 다른 터미널
npm run vision:verify
```

`vision:verify`는 실제 API 3회와 통제한 UI 시나리오를 실행한다. 이미 받은 `.local/vlm-verification/api-results.json`으로 UI만 재확인하려면 `$env:VERIFY_USE_CAPTURE='1'`을 설정한다. 출력의 actualCalls와 reusedRealCalls를 구별한다. 요청·이미지·키는 커밋하지 않는다.

공개 화면과 배포 API의 회귀 검사는 다음과 같이 실행한다. 실제 익명 Auth와 OpenAI 호출 1회가 발생하며 DB·저장소는 통제한 응답이다. 실제 저장 흐름 검증과 구분한다.

```powershell
$env:VERIFY_WEB_URL='https://midnightsun90.github.io/SafeAngle'
$env:VERIFY_API_URL='https://safeangle-api.vercel.app/api/vision'
npm run vision:verify
```

## 아직 확인하지 않은 것

독립 정답 대비 관절·REBA 정확도, 실제 산업 작업 영상, iPhone·Safari, 법정 조사표 전체, 여러 사용자 동시 부하는 확인하지 않았다. 관측한 대표 장면의 공개 API 응답은 약 26~33초였으며 연속 추적이나 자동 최악 자세 탐색으로 표현하지 않는다. 좌표 수정과 사람 확인이 MVP의 필수 단계다. 이미지·좌표와 산출 점수는 탭 메모리에 있으므로 새로고침하면 다시 분석해야 한다. 영상과 입력 복원 검증은 분석 결과 영구 저장을 뜻하지 않는다.
