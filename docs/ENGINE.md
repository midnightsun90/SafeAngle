# 관절 추적·자세 측정 엔진

제품 프론트엔드와 REBA 연결은 [REBA.md](REBA.md), 정적 웹 실제 실행 증거는 [REBA_VERIFICATION.md](REBA_VERIFICATION.md)를 확인한다. 아래의 엔진 단독 실행 기록과 계약은 보존한다. 자산 준비는 현재 root와 `frontend/public` 모두에 수행하고, 정적 배포에서는 `analyzeVideo(file, {assetBasePath: "/SafeAngle"})`로 서비스 경로를 전달한다.

2026-10-09: MediaPipe Pose Landmarker **Full v1**, `@mediapipe/tasks-vision` **0.10.34**로 영상 분석부터 양쪽 부위 측정·오버레이까지 구현했다. Chrome에서 실제 모델 실행과 실패·취소·복구를 확인했다. **사람이 독립적으로 표시한 기준 좌표가 없어 정확도는 미검증**이다. 실행 증거와 실패 사례는 [ENGINE_VERIFICATION.md](ENGINE_VERIFICATION.md)에 있다.

이 세션은 자세 측정을 맡는다. REBA 채점·법령 기준표·제품 프론트엔드는 임서현·한다현 담당이다. 엔진은 점수나 법적 해당 여부를 계산하지 않는다. 기존 Codex MVP를 확장했고 다른 도구의 이전 시제품 코드는 가져오지 않았다.

## 1. 준비와 확인 화면

Node.js 24 이상, 모델 다운로드에 네트워크가 필요하다.

```sh
npm ci
npm run prepare:pose
npm run typecheck
npm test
npm run engine:dev
```

`http://127.0.0.1:4173/`에서 파일 선택 → 분석 → 장면 선택 → 뼈대·양쪽 각도·관절 상세를 확인한다. 취소·재분석과 방향 변경 후 재측정도 가능하다. **제품 전체 UI가 아닌 팀 연결용 확인 화면**이다.

`prepare:pose`는 패키지 WASM을 `public/wasm`에 복사하고 Full float16 v1 모델을 `public/models`에 준비한다. 다운로드와 캐시 모두 다음 SHA256으로 검사한다.

```text
5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1
```

모델·WASM과 사용자 영상은 Git에 넣지 않는다. **배포 빌드 전에** 자산을 준비한다. Next.js를 붙이면 `npm run prepare:pose && next build`로 설정하고 배포 URL의 `/wasm/*`, `/models/pose_landmarker_full.task` 접근을 확인한다. 제품 프레임워크와 서비스 배포는 이 변경에 포함하지 않는다.

## 2. 호출 계약

`analyzeVideo`는 브라우저 전용이다. SSR 실행이나 모듈 최상위에서 호출하지 않는다.

```ts
import { analyzeVideo } from "../lib/pose/video.ts";

const abort = new AbortController();
try {
  const result = await analyzeVideo(file, {
    signal: abort.signal,
    onState: state => setPhase(state),
    onProgress: (processed, total) => setProgress(processed / total),
    // facing: 1, // 자동 방향이 틀리거나 안 잡히면 화면 오른쪽=1, 왼쪽=-1
    // side: "left", // 기존 단일 angles 계약에서 사용할 사람 기준 쪽
  });
  setResult(result);
} catch (error) {
  setMessage(error instanceof Error ? error.message : String(error));
}
// 취소 또는 컴포넌트 해제: abort.abort()
```

`setPhase`, `setProgress`, `setResult`, `setMessage`는 화면 담당자의 상태 함수다. 중복 분석과 분석 중 파일 변경을 막고 새 결과를 적용하기 전에 해당 작업이 취소되지 않았는지 확인한다. 연결 예시는 `dev/engine.ts`에 있다.

상태 콜백은 `decoding`(영상 읽기), `loading-model`(SDK·WASM·모델 준비), `analyzing`(시간순 관절 추론), `measuring`(부위별 측정·연속성 검사)다. 모델 준비는 프레임 진행률과 별개로 표시한다.

### 영상 결과

| 필드 | 의미 |
| --- | --- |
| `size`, `durationSec`, `sampleIntervalSec` | 디코딩한 표시 크기, 길이(초), 기본 0.1초 분석 간격 |
| `side` | 기존 `angles`에서 사용할 사람 기준 왼쪽/오른쪽. 양쪽 상세 측정은 항상 보존 |
| `facing` | 영상 전체의 화면상 방향, 오른쪽=1·왼쪽=-1·판단 불가=null |
| `status` | `ready` / `partial` / `retake`, 아래 정의 참조 |
| `usableRatio` | 기존 단일 `angles` 필수 부위를 모두 측정한 장면 수 / 전체 분석 장면 수 |
| `measuredFrameRatio` | 최소 한 부위를 측정한 장면 수 / 전체 분석 장면 수 |
| `measurementCoverage.left/right` | 부위별 측정 장면 수 / **실패를 포함한 전체 분석 장면 수** |
| `reasonCounts` | 이유별 장면 수. 한 장면에 여러 이유가 있을 수 있음 |
| `frames` | 아래 장면 계약 |
| `policy` | 실제 사용한 품질·추적 설정 |
| `runtime` | 모델 경로·버전·패키지 버전·처리 시작 시각·GPU/CPU·처리 시간 |

`ready`는 선택한 쪽의 몸통·목·위팔·팔꿈치·무릎을 모두 측정한 장면이 60% 이상이라는 뜻이다. **손목 정확도, 반대쪽의 완전한 측정, 법정 기준 충족을 뜻하지 않는다.** 위 조건은 부족해도 최소 한 측정이 있으면 `partial`, 모든 부위가 측정 불가면 `retake`다. `ready`에서도 각 장면과 부위의 null·경고를 확인해야 한다.

### 장면·관절·측정 결과

| 필드 | 의미 |
| --- | --- |
| `timeSec` | seek 후 `video.currentTime`의 초 단위 값. 요청 시각을 그대로 복사하지 않음 |
| `personCount` | 모델이 검출한 인물 수(최대 2). 모든 실제 인물을 검출했다는 보장은 없음 |
| `landmarks` | 한 사람 검출 시 모델 원본 33개 좌표. 사람 없음·다중 인물이면 빈 배열 |
| `joints[0..32]` | 공식 인덱스, 영어·한글 이름, 사람 기준 좌우, 원본 point 또는 null, 상태·이유·추적 경고 |
| `jointStatus` | 이전 호출부를 위한 33개 상태 배열 |
| `measurements.left/right` | 각 부위의 독립적인 상세 측정 |
| `status` | 양쪽 12개 값이 모두 있으면 `complete`, 일부만 있으면 `partial`, 하나도 없으면 `unusable` |
| `angles` | 이전 단일 계약. 선택한 쪽 필수 5개 부위가 모두 있어야 반환. 손목은 별도 null 가능 |
| `usable`, `wristReliable` | 이전 단일 계약의 필수 부위 완료 여부, 손목 근사값 생성 여부 |
| `trackSegment`, `trackingWarnings`, `requiresReview` | 추적 끊김·좌표 도약·대상 교체 의심과 재확인 여부 |

관절 `point`는 x/y/z/visibility 원본을 보존한다. x/y는 영상 정규화 좌표다. **z는 보정된 실제 거리나 길이가 아니다.** `visibility`는 실제 위치 정확도나 오차 백분율이 아니다. `reliable`도 앱 임계값을 통과한 추정 좌표라는 뜻이다.

관절 상태: `reliable`, `occluded`(낮은 visibility), `out_of_frame`(경계 여유 포함), `invalid`(비정상 좌표·confidence), `missing`. 사람 없는 장면에도 33개 이름·인덱스와 null point를 반환한다. 이전 장면으로 빈 좌표를 채우지 않는다.

```ts
const knee = result.frames[index].measurements.right.knee;
// { value: number | null, status: "measured" | "unavailable",
//   reasons: QualityReason[], joints: number[],
//   minVisibility: number | null, approximate: boolean }
```

null을 0도로 바꾸지 않는다. 귀가 가려지면 그쪽 목만, 손목이 가려지면 그쪽 팔꿈치·손목만 비우고 독립적인 부위는 유지한다. 사람 없음·다중 인물·너무 먼 영상·측면 아님·대상 교체 의심은 전체 실패 조건이다. 자동 방향이 불명확하면 부호가 필요한 값만 비우고 관찰 가능한 팔꿈치·무릎·손목 내각은 유지한다.

## 3. 각도 정의

항상 정규화 좌표에 실제 영상 가로·세로를 곱한 **영상 평면상의 픽셀 좌표**로 계산한다. 화면 오른쪽·아래쪽을 x/y의 양 방향으로 두고 `f`는 `facing`이다. `θ = atan2(f·(어깨.x−골반.x), −(어깨.y−골반.y))`가 몸통 기울기다. 결과의 단위는 도다.

| 값 | 필요한 관절 | 중립·부호·계산 | 범위와 한계 |
| --- | --- | --- | --- |
| `trunk` | 해당 쪽 골반·어깨 | 위쪽 수직축에서 바라보는 방향으로 기울면 + | −180~180°, 실제 3D 굽힘 아님 |
| `neck` | 골반·어깨·귀 | 어깨→귀의 수직 기울기 − θ − 목 중립 보정 | (−180,180], **목 근사치**, 귀·어깨는 경추 기준점 아님 |
| `upperArm` | 골반·어깨·팔꿈치 | 몸통 아래 방향 기준, 앞으로 들면 +. `atan2(f·Δx, Δy) + θ` | (−90,270], 머리 위 들기 180° 부근 |
| `lowerArm` | 어깨·팔꿈치·손목 | 180° − 세 점의 내각. 일자로 펴면 0° | 0~180°, 영상 평면상의 팔꿈치 굽힘 |
| `knee` | 골반·무릎·발목 | 180° − 세 점의 내각. 일자로 펴면 0° | 0~180°, 좌우 최대값을 섞지 않음 |
| `wrist` | 팔꿈치·손목·검지 기준점 | 180° − 세 점의 내각. 일자로 정렬되면 0° | 0~180°, **손목 근사치**, 손가락·원근 영향, 사람 확인 필요 |

양쪽을 각각 계산하며 화면 반전은 사람 기준 좌우 이름을 바꾸지 않는다. 해부학적 회전·손목 회전·실제 하중·팔 지지·다리 지지는 자동 확정하지 않는다. `neckNeutralOffsetDeg` 기본값 0은 보정 완료를 뜻하지 않는다. 실제 중립 장면과 사람이 만든 기준값으로 보정해야 한다.

방향·선택한 쪽을 수정할 때는 모델 재실행 없이 다음으로 다시 측정한다.

```ts
import { analyzePoses } from "../lib/engine.ts";
const updated = analyzePoses(
  result.frames.map(({ timeSec, landmarks, personCount }) => ({ timeSec, landmarks, personCount })),
  result.size,
  { side: "right", facing: -1, policy: result.policy },
);
// analyzePoses의 길이는 마지막 샘플+간격 추정치다.
// 실제 durationSec와 runtime은 원래 VideoAnalysis에서 보존한다.
```

## 4. 추적과 품질 설정

원본 좌표를 보간·평활화하지 않는다. `VIDEO` 모델 내부의 추적·보정은 별개로 동작한다. 한 프레임의 좌우를 합쳐 한 궤적으로 바꾸지 않는다.

| 설정 | 기본값 | 적용 |
| --- | --- | --- |
| `minVisibility` | 0.5 | 필요한 관절의 confidence 미달 시 해당 부위 null |
| `frameMargin` | 0.02 | x/y가 영상 경계 2% 안쪽 바깥이면 화면 이탈 |
| `minTrunkToLongSideRatio` | 0.07 | 보이는 어깨·골반 길이/영상 긴 변이 7% 미만이면 제외 |
| `maxHipToTrunkRatio` | 0.35 | 양쪽 골반이 보일 때 골반 간 거리/몸통 길이로 비측면 의심 |
| `minUsableRatio` | 0.6 | 영상 `ready` 판단에만 사용 |
| `maxJointSpeedTrunksPerSec` | 8 | 이전 신뢰 가능한 몸통 길이로 정규화한 이동 속도 초과 시 `position_jump` |
| `maxSegmentLengthChangeRatio` | 0.6 | 이전 분절 길이 대비 60% 초과 변화 시 `segment_length_change` |
| `maxSubjectShiftTrunks` | 1.5 | 골반 중심이 이전 몸통 길이의 1.5배 초과 이동하면 대상 교체 의심 |
| `maxTrackingGapSec` | 0.35 | 시간 간격 초과 또는 재검출 시 새 segment와 `tracking_gap` |

수치는 **앱의 검증 전 품질 설정**이며 법정·REBA 기준이 아니다. 속도·분절 경고만으로 빠른 실제 동작을 오추정이라고 단정하거나 수치를 지우지 않는다. 다중 인물 검출 뒤 또는 대상 교체 의심 뒤에는 동일 인물을 확정할 수 없어 이후 측정을 `tracking_uncertain`으로 남긴다. 원본 좌표는 유지한다. 한 사람만 포함하는 구간으로 자르고 새로 분석해야 한다. 완전한 인물 식별 기능은 없다.

`reasons`는 양쪽 모든 부위의 합집합이다. 반대쪽 팔의 가림 때문에 `ready`에도 `occluded`가 있을 수 있다. 화면은 **선택 부위의 reasons·joints·trackingWarnings**를 읽는다. `reasonCounts` 합계를 실패 장면 수로 부르지 않는다.

## 5. 영상과 오버레이 연결

```ts
import { drawPose, videoTransform } from "../lib/pose/draw.ts";
// canvas backing 크기를 영상 표시 영역에 맞춘다. CSS 크기와 backing 크기를 구별한다.
drawPose(canvas, result.frames[index], result.size, { fit: "contain", mirrored: false });
const area = videoTransform(result.size, { width: canvas.width, height: canvas.height }, "contain");
// 표시점 x = area.offsetX + point.x * area.width
// 표시점 y = area.offsetY + point.y * area.height
```

`contain`/`cover`는 영상 `object-fit`과 맞추고 가운데 정렬 기준으로 쓴다. CSS와 좌표 변환에서 반전을 두 번 적용하지 않는다. 미러 영상이면 영상만 CSS로 반전하고 뼈대는 `mirrored: true`로 한 번 반전한다. 좌표 측정 입력을 바꿀 필요는 없다. 정상 추정 관절은 초록 점·실선, 낮은 신뢰도나 의심 좌표는 주황 빈 점·점선이다.

장면 선택 시 일시 정지하고 `video.currentTime = frame.timeSec`로 seek한다. `seeked` 이후 같은 장면의 뼈대·측정·관절 상세를 그린다. 재생 중에는 가장 가까운 분석 장면만 표시하고 현재 영상 시각과 분석 시각을 함께 표시한다. 중간 장면을 보간해 새 분석 결과로 만들지 않는다. `dev/engine.ts`에 전체 흐름이 있다.

### 타임스탬프·오류·자원

- `timeSec`와 모델 타임스탬프는 seek 완료 후 `video.currentTime`이다. 모델에는 증가하는 밀리초를 보낸다. `runtime.timestampSource = "seek_position"`이며 **디코더의 원본 프레임 PTS를 별도 측정한 값은 아니다**. 코덱별 장면 선택 오차는 기준 장면 비교가 필요하다.
- 최대 60초·250MiB, 기본 0.1초 간격이다. 빈 파일·길이 초과·디코딩·모델/그래픽 오류는 예외로 반환한다. 디코딩/seek 20초, SDK/WASM/모델 준비 단계별 40초 타임아웃이다.
- GPU 초기화 실패 시 CPU로 한 번 재시도한다. CPU 대체도 브라우저 그래픽/영상 환경에 영향을 받는다. 그래픽 기능이 전부 없는 환경까지 지원한다고 보장하지 않는다.
- 추론은 동기식이다. 프레임 사이에는 UI에 양보하지만 취소는 해당 추론이 끝나야 적용된다. 첫 GPU 추론에서 약 3.4초의 정지를 관측했다. 이 제한을 확인 화면에 표시했다. Worker는 추가하지 않았다.
- 성공·실패·취소 시 모델·임시 영상·리스너·Object URL을 정리한다. 취소한 초기화가 늦게 끝나면 늦게 생성된 모델도 닫는다. SDK 내부에서 이미 시작한 다운로드 자체를 중단하는 보장은 없다.
- 전체 영상과 좌표는 브라우저에서 처리한다. 서버는 모델/코드 자산만 제공한다. DB·외부 API·영상 업로드·관절 로그 저장은 없다. 확인용 상세 결과는 해당 페이지 메모리에만 둔다.

## 6. 검증과 팀 인계

```sh
npm run typecheck
npm test
# Chrome, FFmpeg 설치 필요. FFmpeg가 PATH에 없으면 FFMPEG에 실행 파일 경로 지정.
npm run prepare:fixtures
npm run engine:verify
```

브라우저 검증은 별도 4174번 서버를 띄우고 종료한다. 모델을 모킹하지 않고 실제 추론한다. GPU→CPU 경로만 GPU 초기화 예외를 주입하고 CPU 추론은 실제 실행한다. `.local/verification/results.json`, `normal.png`에 실행 기록을 남긴다. 테스트 영상·이미지·결과는 Git에 넣지 않는다.

팀은 `measurements[선택한 쪽][부위]`를 채점 입력의 제안으로 읽는다. null이나 `requiresReview`를 0점으로 바꾸지 않는다. 손목·목·회전·지지·하중·빈도와 측정 불가 값은 [팀의 확인 질문](confirmed-postures-and-reba-questions.md)과 연결한다. 영상 성공률을 손 채점 일치율로 발표하지 않는다.

실제 작업 영상, 독립 라벨, 빠른 팔 동작, Safari/iPhone, 영상 회전 메타데이터, 서비스 배포와 제품 화면 연결은 아직 미검증이다. 정확도 검증에는 라벨 작성자, 장면 시각, 사람 기준 좌우, 원본 픽셀 좌표·각도, 실패 장면을 포함한 분모가 필요하다. 수정용 장면과 확인용 장면을 분리한다.

## 외부 자산

- [MediaPipe Pose Landmarker Web](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js), 공식 API·VIDEO 실행·정규화 좌표. 패키지 0.10.34, Apache-2.0.
- [관절·모델 설명](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker), 33개 관절 인덱스.
- [Full float16 v1](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task), Apache-2.0. [공식 모델 카드](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf)의 가림·촬영 조건 한계가 있다.
- [Playwright](https://github.com/microsoft/playwright), 1.62.1, Apache-2.0. 실제 브라우저 검증에만 사용한다.
- 공개 영상의 작성자·CC BY-SA 4.0·변형 내역은 [검증 기록](ENGINE_VERIFICATION.md)에 있다.
