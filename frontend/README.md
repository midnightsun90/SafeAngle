# SafeAngle frontend

평가 대상자를 추가하면 첫 영상 선택 화면으로 바로 이동한다. 회사명·사업장·공정·작업명 입력 화면은 사용하지 않는다. 평가자와 대상자 이름은 Supabase에 저장하고, 원본 영상은 비공개 Supabase 저장소에 업로드하고 작업 조건과 진행 입력도 DB에 동기화한다.

## 로컬 미리보기

```bash
cd frontend
npm ci
npm run dev
```

http://localhost:3000

실제 분석은 루트 `.env.local`에 서버 API 키를 설정한 뒤 별도 터미널에서 `npm run vision:dev`를 실행한다. 제품 `/analysis`는 대표 장면을 GPT로 보내 관절을 제안받고 사람이 좌표를 확인한 뒤 공유 엔진으로 각도·REBA를 계산한다. 자세한 계약·오류·배포 환경은 [GPT 연결 안내](../docs/VLM_TRANSITION.md)에 있다. 원본 영상은 비공개 저장소에 보관하고 OpenAI에는 동의한 대표 장면 한 장만 보낸다. 좌표·대표 이미지·새 REBA 결과는 탭 메모리에만 두며 기존 DB에 넣지 않는다.

## 평가서 PDF 저장

상세 평가서의 **인쇄 / PDF 저장** 버튼을 누르고 브라우저 인쇄 창에서 대상을 **PDF로 저장**으로 선택한다. A4 평가서에 최신 화면의 측정값·측정 상태·작업 조건·분석 기록을 담으며, 선택 장면도 정지 이미지로 캡처한다. 추가 모델 호출은 하지 않는다. 측정 불가·예시 결과 표시는 그대로 유지한다.

## GitHub Pages 배포

`main`의 `frontend/` 또는 배포 워크플로가 변경되면 `.github/workflows/deploy-frontend.yml`에서 정적 사이트를 빌드해 배포한다. GitHub 저장소의 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 설정해야 한다.

공개 주소: https://midnightsun90.github.io/SafeAngle/ (GitHub Actions 방식 활성화)

GitHub Pages는 정적 사이트를 제공한다. 평가자·대상자 이름은 Supabase에 저장하며, 원본 영상은 비공개 Supabase에 저장하고, 장면 추출·좌표 검토·각도와 REBA 계산은 브라우저에서 처리한다.

GPT API는 `https://safeangle-api.vercel.app/api/vision`이다. repository variable `VISION_API_URL`을 이 주소로 설정하고 웹을 빌드한다. 기존 Supabase 로그인 세션을 전달하며, 공개 API는 로그인 없이 분석하지 않는다. 브라우저 번들이나 `NEXT_PUBLIC_` 환경변수에 OpenAI 키를 넣지 않는다.

이 폴더의 과거 TailAdmin 기반 코드에 대한 라이선스 기록은 `LICENSE`에 남겨 두었다.
