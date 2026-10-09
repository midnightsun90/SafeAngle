# SafeAngle frontend

팀의 design/design.md에 맞춘 흰색·주황색 입력 화면이다. 회사·작업 정보와 영상 1/2/3 등록을 보존하고 /review에서 실제 관절 추적, 장면·쪽 선택, 확인 질문, 결정적인 REBA와 근거를 연결했다. /results의 요약과 /report의 상세 평가서는 같은 실제 결과를 사용하며 표 A/B/C도 공통 모듈에서 가져온다.

실제 업무에 없는 촬영 유형은 건너뛸 수 있으며 영상 한 편부터 평가한다. 영상·좌표·답변은 브라우저 메모리에서만 처리한다. 새로고침하거나 등록 화면으로 돌아가면 현재 분석과 답변이 초기화된다.

결과·평가서로 이동하면 평가 스냅샷은 유지한다. /review로 돌아가 재평가하면 이전 스냅샷을 지운다. 팀의 예시 사진·질문·진행률은 demoMode에서 보존하며 실제 모델 분석·확정 점수와 구별한다.

## 실행

Node.js 24 이상. **저장소 루트부터** 설치한다.

```powershell
npm ci
npm --prefix frontend ci
npm --prefix frontend run dev
```

`http://localhost:3000`. predev/prebuild가 공통 엔진의 의존성과 공식 Full 모델을 사용해 frontend/public/models와 frontend/public/wasm을 준비한다. lib를 복사하지 않는다. 상세 계약·확인 질문·검증은 [REBA.md](../docs/REBA.md)와 [REBA_VERIFICATION.md](../docs/REBA_VERIFICATION.md)에 있다.

## 정적 빌드

```powershell
$env:GITHUB_PAGES='true'
npm --prefix frontend run build
$env:BASE_PATH='/SafeAngle'
npm --prefix frontend start
```

`http://127.0.0.1:3000/SafeAngle/`. 정적 산출물 out을 로컬에서 서비스한다. 루트 경로가 필요하면 두 환경변수를 제거하고 다시 빌드한다.

팀이 추가한 .github/workflows/deploy-frontend.yml을 보존했다. 공통 엔진 의존성 설치·Node 24·lib 변경 감지를 보완했으며, main 변경 시 정적 사이트를 배포하는 기존 흐름이다. **새 PR 병합·배포는 이 작업에서 실행하지 않는다.** 실제 Pages 권한·서비스 URL은 미검증이다. 저장소 Settings → Pages의 Source는 GitHub Actions여야 한다.

MediaPipe의 대회 허용 범위는 별도 문의 중이다. 사람 기준 관절 정확도·채점 일치율, Safari·iPhone 영상, 실제 현장 촬영은 미검증이다. 생성형 API와 조사표 전체는 이 변경에 포함되지 않는다.

과거 TailAdmin 코드의 라이선스 기록은 LICENSE에 보존한다.
