# SafeAngle frontend

`design/screen-01-company-work/screen-01-concept.png`을 바탕으로 만든 첫 화면이다. 회사명, 사업장·작업 위치, 공정·작업명을 입력하고 브라우저에 저장한다. 영상 업로드 화면은 아직 구현되지 않았다.

## 로컬 미리보기

```bash
cd frontend
npm ci
npm run dev
```

http://localhost:3000

## GitHub Pages

`main`의 `frontend/` 또는 배포 워크플로가 변경되면 `.github/workflows/deploy-frontend.yml`에서 정적 사이트를 빌드해 배포한다. GitHub 저장소의 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 설정해야 한다.

예상 주소: https://midnightsun90.github.io/SafeAngle/

GitHub Pages는 정적 사이트만 제공한다. 입력값은 방문자 자신의 브라우저에 저장되며 서버로 전송되지 않는다.

이 폴더의 과거 TailAdmin 기반 코드에 대한 라이선스 기록은 `LICENSE`에 남겨 두었다.
