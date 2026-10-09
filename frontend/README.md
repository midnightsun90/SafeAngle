# SafeAngle frontend

평가 대상자를 추가하면 첫 영상 선택 화면으로 바로 이동한다. 회사명·사업장·공정·작업명 입력 화면은 사용하지 않는다. 평가자와 대상자 이름은 Supabase에 저장하고, 영상 파일과 진행 중 입력은 현재 브라우저에서 다룬다.

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

GitHub Pages는 정적 사이트를 제공한다. 평가자·대상자 이름은 Supabase에 저장하며, 영상 파일은 현재 브라우저에서 처리한다.

이 폴더의 과거 TailAdmin 기반 코드에 대한 라이선스 기록은 `LICENSE`에 남겨 두었다.
