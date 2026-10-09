# REBA 평가 연결

2026-10-09. 규칙 정본은 팀원의 [evaluation-axes.md](evaluation-axes.md)와 [확인 질문](confirmed-postures-and-reba-questions.md)이다. 이전 시제품 코드를 가져오지 않고 Codex에서 작성했다. 모델 허용 범위는 대표가 포크된 세션에서 운영진에게 확인 중이며 **MediaPipe가 대회에 허용됐다고 단정하지 않는다.**

## 목표와 변경 범위

실제 영상 → 기존 33개 관절·양쪽 측정 → 한 장면·쪽 선택 → 사람 확인 → 결정적인 REBA 점수와 근거. 팀의 회사 정보·영상 1/2/3 등록 페이지, 흰색·주황색 디자인, 정적 배포 설정을 보존하고 `/review`를 연결했다.

- `lib/reba/types.ts`, `score.ts`, `tables.ts`: 계약, 입력 검증, 계산. 프론트엔드는 이 함수를 import하며 채점식을 복제하지 않는다.
- `sceneFromAnalysis(analysis, videoId, frameIndex, side)`로 측정을 선택한다. 영상 ID·장면 인덱스·실제 시각·쪽이 같은 답변만 `scoreScene`에 넣을 수 있다.
- `frontend/src/components/EvaluationFlow.tsx`: 분석·취소·장면 선택·확인 질문·결과. 최신 `VideoFilesProvider`를 통해 업로드 화면에서 File을 전달받는다.
- 모델은 Full float16 v1, 패키지 0.10.34 그대로다. `analyzeVideo`의 선택적 `assetBasePath`는 정적 배포의 `/SafeAngle` 경로만 보완한다. 모델·각도·원본 좌표 계약을 변경하지 않는다.

## 입력 계약

`RebaAnswers = { scene: SceneKey, fields: RebaFields }`. `emptyAnswers(scene.key)`는 모든 항목을 미확인으로 만든다.

| 확인 상태 | 값 | 출처·관찰 가능 여부 |
| --- | --- | --- |
| `unknown` | null | 사람 확인 전 |
| `unavailable` | null | 사람이 확인할 수 없음 |
| `confirmed` | 실제 값, 0/false도 포함 | `source: human`, 구간 보충에는 `observable: true` 필수 |
| `not_applicable` | null | 손잡이만 허용. 잡거나 지지하는 물체가 없다고 확인한 경우 +0 |

`confirmed(value, true)`는 그 장면에서 해당 부위가 실제로 보인다고 사람이 확인했다는 뜻이다. 가려진 관절을 임의로 채울 수 없다. 엔진의 낮은 신뢰가 원본 측정을 null로 남겼지만 **사람에게는 실제 장면이 보이는 경우**에만 보충 구간을 선택한다. 보기 어려우면 확인 불가로 남긴다.

필수 입력:

- Q1: 목 기본 구간(근사·중립 보정 미완료), 몸통 중립, 목/몸통 비틀림과 옆 기울임, 다리 지지, 지지면 불안정, 팔 벌림·회전, 어깨 상승, 팔 지지, 손목 기본 구간(근사), 손목 옆 꺾임·회전.
- Q2: 실제 무게 kg 또는 힘 kgf 상당값 `loadKg`, 충격 `shock`. 카트 무게를 밀기 힘으로 대신하지 않는다.
- Q3: `good/fair/poor/unacceptable` 또는 사람이 확인한 해당 없음. 물체에 손잡이가 없는 상황은 해당 없음이 아니다.
- Q4: 같은 자세 지속 시간(분), 작은 동작의 분당 반복 수, 보행 여부, 빠르고 큰 변화. 지지면 불안정은 Q1을 재사용해 한 번만 가산한다.
- 영상 측정 실패 시: `trunkBase`, `kneeExtra`, `upperArmBase`, `lowerArmBase` 구간 보충. 앉은 자세에서는 무릎 가산과 무릎 보충을 사용하지 않는다.

직접 호출 예:

```ts
import {sceneFromAnalysis, emptyAnswers, confirmed, scoreScene} from "../lib/engine.ts";
const scene = sceneFromAnalysis(analysis, videoId, frameIndex, "left");
const answers = emptyAnswers(scene.key);
answers.fields.neckBase = confirmed(1, true); // 보이는 장면에서 실제로 확인했을 때만
const result = scoreScene(scene, answers); // 다른 필수 값은 아직 미확인, final/action = null
```

## 규칙과 앱 해석

| 항목 | 적용 |
| --- | --- |
| 표 | A: 몸통 행, 목·다리 열. B: 위팔 행, 아래팔·손목 열. C: A 행, B 열. 팀 문서의 240칸 전부 테스트에서 문서 원본 행과 대조 |
| 겹치는 경계 | **앱 정책**: 몸통 20° → 기본 2, 위팔 20° → 기본 1, 45° → 기본 2, 90° → 기본 3. 문서에 겹쳐 적힌 구간을 낮은 점수 쪽으로 해석 |
| 몸통 중립 | 사람이 중립 여부 확인. ±5° 등의 임의 허용치를 사용하지 않음. 측정 불가 시 보충 구간과 중립 확인이 모순되면 오류 |
| 목 | 중립 오프셋 기본 0은 보정 완료를 뜻하지 않음. 원본 근사 각도를 보존하고 기본 구간을 항상 사람 확인. 뒤젖힘 기본 2 |
| 위팔 지지 | −1 가감은 보존. 기본+가감이 0이면 **앱 정책으로 부위 점수 1 유지**, 일반 입력 clamp 없음. 저자 원문의 중력 도움 −1과 표 B의 1~6 입력 범위를 확인했으나 명시적인 최소 1점 문장을 확인한 것은 아님 |
| 다리 | 앉음/양발/보행 기본 1, 한쪽/불안정 기본 2. 무릎 30° 포함 +1, 60° 초과 +2. 앉음은 무릎 가산 0 |
| 중복 | 목·몸통의 비틀림 OR 옆 기울임, 손목의 옆 꺾임 OR 회전 각각 +1 한 번. 팔 벌림·회전과 어깨 상승은 각각 +1 |
| 하중 | <5kg +0, 5~10kg +1, >10kg +2, 충격 +1 |
| 활동 | >1분 정지 +1, >4회/분 작은 반복(보행 제외) +1, 빠른 변화 OR 불안정 지지 +1. 최대 3 |

중력 도움 −1의 원문 근거는 [Hignett·McAtamney 저자 업로드 논문](https://www.researchgate.net/publication/12603778_Rapid_entire_body_assessment_REBA) Discussion에 있다. 최소점수와 겹치는 각도 경계는 원문에 명시된 사실로 주장하지 않는 앱 해석이다. 사람이 이를 검토할 수 있도록 근거와 테스트를 함께 남겼다.

## 출력과 상태 갱신

- `parts`: 원본 측정(값/null/이유/근사 표시), 기본점수 출처, 기본·가감·부위점수, R ID와 설명.
- `inputs`: 사람 확인값·상태·출처·관찰 가능 여부의 복사본. 원본 입력을 변경하지 않는다.
- `tableA/load/scoreA`, `tableB/coupling/scoreB`, `tableC/activity/activityBreakdown`을 분리한다.
- 필수 입력 미확인이면 `pending`, 확인 불가면 `unavailable`. 둘 다 `final`과 `action`은 null. 계산 가능한 부위별 근거는 남는다.
- `requiresReview`, 다중 인물, 측면 실패, 너무 먼 영상, 방향 불명 등 전역 품질 문제는 사람 답으로 정상화하지 않는다.
- 장면·쪽·방향 변경 시 현재 답변과 확정 결과를 제거한다. 같은 답변으로 다른 시각을 자동 채점하지 않는다. 영상 탭별 분석·답변은 별도 상태이며 다른 영상의 목·팔·다리를 섞지 않는다.
- 새 파일 선택은 현재 분석·답변을 초기화한다. `/upload`로 돌아가거나 새로고침하면 분석·답변은 사라진다. 파일/좌표/결과는 서버·DB로 보내지 않는다.
- 현재 결과는 **선택한 장면의 점수**다. 미확인 장면의 최고점이나 전체 영상 위험을 확정하지 않는다.
- 법적 부담작업 해당 여부는 `unknown`, 조사표 완료는 false다. B/S/V 축을 REBA에 더하지 않으며 건강·개인 이력을 영상으로 추정하지 않는다.

## 실행과 모델 자산

Node.js 24 이상. 저장소 루트에서 먼저 엔진 의존성을 설치한다.

```powershell
npm ci
npm --prefix frontend ci
npm --prefix frontend run dev
```

`predev/prebuild`가 공식 Full 모델의 SHA256을 확인한 뒤 root `public`과 실제 **`frontend/public`**에 모델·WASM을 준비한다. 사용자 영상과 모델 바이너리는 Git에 넣지 않는다. 공통 lib는 복사 없이 import하고, TS의 `.ts` 확장자 허용과 Turbopack root를 저장소 루트로 설정한다.

정적 GitHub Pages와 같은 경로로 빌드·미리보기:

```powershell
$env:GITHUB_PAGES='true'
npm --prefix frontend run build
$env:BASE_PATH='/SafeAngle'
npm --prefix frontend start
```

`http://127.0.0.1:3000/SafeAngle/`. `out`만 서비스한다. 개발/루트 경로로 실행하려면 GITHUB_PAGES와 BASE_PATH를 제거하고 다시 빌드한다. 외부에 사이트를 배포한 검증과는 구별한다.

## 검증

```powershell
npm test
npm run typecheck
npm --prefix frontend run typecheck
$env:GITHUB_PAGES='true'
npm --prefix frontend run build
$env:VERIFY_BASE_PATH='/SafeAngle'
npm run reba:verify
```

브라우저 스크립트는 Chrome과 **실제 모델**, 정적 산출물을 사용하며 4180번 미리보기 서버를 생성·종료한다. SDK와 측정값을 모킹하지 않는다. 영상은 기존 `npm run prepare:fixtures`로 준비한다(FFmpeg 필요, [원본·파생 영상 출처](ENGINE_VERIFICATION.md)). 결과·스크린샷은 `.local/reba-verification/`이며 Git에 포함하지 않는다.

최종 실행 결과는 [REBA_VERIFICATION.md](REBA_VERIFICATION.md)에 기록한다. 질문의 테스트 입력은 연결 검증용 시나리오이며 독립적인 사람 기준 라벨이 아니다. **실제 작업 영상의 관절·각도 정확도와 사람 채점 일치율은 미검증**이다. Safari/iPhone 코덱과 실제 배포·현장 촬영도 미검증이다.
