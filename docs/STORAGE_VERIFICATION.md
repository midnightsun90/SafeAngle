# Supabase 연결과 Pretendard 확인

확인일: 2026-10-09. 작업 브랜치: `feat/supabase-video-persistence`.

## 최신 DB 변경과 현재 검증 범위

2026-10-09 재확인에서 `assessments`의 현재 열은 `id`, `manager_id`, `person_id`, `schema_version`, `created_at`, `updated_at`이었다. 이전 `result`, `measurements`, `reba_score`, `status`, `answers` 열은 더 이상 없다. 삭제한 열을 복구하지 않고 결과만 `assessment_analysis_results`로 분리했다. 신규 SQL은 `supabase/migrations/20261009064000_assessment_analysis_results.sql`이며 아직 원격 적용하지 않았다.

최신 검증에서는 영상·질문·인증·접근 제한은 실제 Supabase를 사용했다. 신규 결과 테이블 요청만 가로챘으며, GPT는 공개 영상의 기존 응답을 재생했다. 사람 좌표 확인 → REBA 계산 → 자동 저장 요청 → 요약 화면 → 새로고침 후 점수 복원을 확인했다. 신규 테이블의 실제 저장과 RLS는 SQL 적용 후 재검증해야 한다. 아래 결과 저장 항목은 이전 열이 있던 시점의 원격 확인과 최신 가로채기 검증을 구분해야 한다.

## 실제 원격 확인

별도 Chrome 브라우저의 임시 익명 관리자 계정으로 공개 영상의 짧은 구간을 업로드했다. 개인 영상과 기존 사용자의 기록은 사용하지 않았다.

| 항목 | 결과 |
| --- | --- |
| 비공개 영상 업로드와 DB 경로 | 저장 성공, 서로 일치 |
| 인증된 다운로드 | 원본 파일과 바이트 전체 일치 |
| 새로고침 | 영상 재생, 질문 답변, 확인 불가 값, 건너뛰기 복원 |
| 선택 장면 시각 | 2초 DB 저장·조회 |
| 결과 저장 계약 | 확인용 pending/null 및 complete/1 결과 저장·복원 |
| 입력 변경 | 이전 결과와 점수가 null로 무효화 |
| 동일 입력 재저장 | JSONB 키 순서가 달라도 기존 점수 보존 |
| 불일치 장면·미확정 0점 | 저장 거부 |
| 0바이트·50 MiB 초과 파일 | 업로드 전 거부 |
| 다른 익명 관리자 | 영상 다운로드 거부, 평가 조회 결과 빈 배열 |
| 공개 Storage URL | 접근 실패 |
| Pretendard | 실제 웹폰트 로드, 본문·입력 서체 일치 |
| 390px 화면 | 가로 스크롤 없음(390/390), 화면 캡처 확인 |
| 페이지 예외 | 0건 |

결과 저장 확인에 사용한 점수는 저장 계약용 데이터다. 실제 GPT 호출·관절 정확도·수기 REBA 일치율을 의미하지 않는다. 공개 VLM 브랜치와 저장 콜백을 별도 작업 폴더에서 통합했다. 프레임 JPEG는 결과 DB에서 제외하고 좌표·사람 확인·채점 입력 근거를 보존한다.

확인에 만든 영상 객체와 관리자·대상자·평가·입력·영상 기록은 삭제했다. Supabase Auth의 임시 익명 사용자 자체는 관리자 권한 없이 삭제할 수 없어 남아 있다. 관리자 키는 사용하지 않았다.

## 재현

Supabase 익명 로그인과 기존 비공개 버킷/RLS가 설정된 확인용 프로젝트에서 실행한다. 이 스크립트는 새 익명 계정과 확인용 DB 기록을 만들고 자신이 만든 영상·기록만 정리한다.

```powershell
npm --prefix frontend ci
npm --prefix frontend run build
# 별도 터미널에서 frontend/out을 127.0.0.1:3198로 정적 제공한다.
node --experimental-strip-types scripts/verify-storage.cjs
# 신규 결과 SQL 적용 전에는 결과 테이블만 가로채 확인 가능:
$env:VERIFY_ANALYSIS_MOCK='1'
node --experimental-strip-types scripts/verify-storage.cjs
```

스크립트는 기존 `SafeAngle-engine` 작업 폴더의 Playwright 설치와 공개 테스트 영상 `short.webm`을 재사용한다. 다른 환경에서는 해당 설치·파일 경로를 맞춰야 한다. `VERIFY_STORAGE_URL`로 정적 서버 URL을 바꿀 수 있다.

로컬 증거: `.local/storage-verification/results.json`, `mobile.png`. 키·토큰·사용자 식별자는 증거에 출력하지 않는다.

영상 출처: [Basic single leg squat](https://commons.wikimedia.org/wiki/File:Basic_single_leg_squat.webm), Ricky Bennison, CC BY-SA 4.0. 원본에서 추출한 짧은 구간이며 관절 정답 라벨은 없다.

폰트 출처: [Pretendard v1.3.9](https://github.com/orioncactus/pretendard/tree/v1.3.9), SIL Open Font License. 웹에 직접 포함하며 라이선스는 `frontend/src/app/fonts/OFL.txt`에 있다.

## 남은 범위

신규 결과 테이블 SQL 적용과 실제 원격 결과 저장 재검증이 필요하다. Safari/iPhone, 네트워크 단절 중 파일 교체, 장기 보관·미참조 객체 정리, 서로 다른 기기에서의 계정 복구는 미검증 또는 미구현이다. 이 브랜치는 병합·서비스 배포를 수행하지 않았다.

## 팀원 변경과의 통합

main에 병합된 PR #25의 입력 저장과 PR #26의 비공개 TUS 영상 업로드·서명 URL 재생을 그대로 사용한다. 이전 중복 `assessmentStorage.ts`는 제거했다. 결과 저장만 `analysisStorage.ts`로 추가하고 기존 입력 저장 큐에서 실행한다. 입력이 변경되면 결과와 점수를 무효화하며, 대기 중인 오래된 입력은 최신 입력을 덮어쓰지 않는다.

제품 엔진이 결과를 발행하면 입력·영상 경로가 동기화된 뒤 `persistResult(videoNumber, rebaResult)`를 자동 호출한다. 실패는 기존 연결 오류 표시로 전달한다. 저장된 결과는 확인 좌표와 입력으로 REBA를 재계산해 상태·최종 점수를 검증한 뒤 요약·평가서에 복원한다. 결과는 현재 DB 영상 경로, 선택 시각, 평가 쪽, 사람의 좌표 확인 기록과 맞아야 한다. 미확정 결과에는 최종 점수를 저장하지 않는다. 영상 파일 식별자 `fileKeys`는 Storage 경로가 아니므로 저장 경로는 `storedVideos`에서 읽는다.
