# 임팩트 수정 전 버전

2026-10-09 16:17 저장. 14·15장을 압축한 직후의 16장 덱이다. HTML, 발표 노트, README, 출처, PDF, 미리보기, 이미지와 폰트를 모두 보존했다. manifest.json은 저장 당시 파일의 SHA-256이다.

## 복원

SafeAngle-pitch 저장소에서 아래 PowerShell 명령을 실행하면 현재 피치덱 파일을 이 버전으로 덮어쓴다. 먼저 현재 버전이 필요하면 별도로 보관한다. Git 기록은 변경하지 않는다.

```powershell
$deckBackup = 'pitching\versions\pre-impact-20261009-161700'
Copy-Item -LiteralPath "$deckBackup\deck.html","$deckBackup\speaker-notes.md","$deckBackup\README.md","$deckBackup\sources.md" -Destination 'pitching' -Force
Copy-Item -Path "$deckBackup\assets\*" -Destination 'pitching\assets' -Recurse -Force
Copy-Item -Path "$deckBackup\exports\*" -Destination 'pitching\exports' -Recurse -Force
```
