# Background / Problem 근거

확인일: 2026-10-09(KST).

## 사진에서 확인한 조항

`assets/hackathon-photos/KakaoTalk_Photo_2026-10-09-10-36-42 001.jpeg`의 책 698–699쪽은 부록 1 「산업안전보건 기준에 관한 규칙」이다. 제657조의 3년 주기, 신설 사업장 최초 조사, 근로자 참여와 제658조의 조사 방법을 확인했다. 주변 전사본의 조사 주기·도구·방법 관련 해설도 확인했다.

사진은 과거 조문을 담고 있다. 특히 제657조 제2항의 ‘지체 없이’ 문구는 현행 조문의 ‘1개월 이내에 조사대상 및 조사방법 등을 검토하여’와 다르므로 현재 의무 설명에는 아래 공식 원문을 사용한다.

## 제657조 제1항 — 현행 원문

> 사업주는 근로자가 근골격계부담작업을 하는 경우에 3년마다 다음 각 호의 사항에 대한 유해요인조사를 하여야 한다. 다만, 신설되는 사업장의 경우에는 신설일부터 1년 이내에 최초의 유해요인 조사를 하여야 한다.
>
> 1. 설비ㆍ작업공정ㆍ작업량ㆍ작업속도 등 작업장 상황
> 2. 작업시간ㆍ작업자세ㆍ작업방법 등 작업조건
> 3. 작업과 관련된 근골격계질환 징후와 증상 유무 등

[국가법령정보센터 제657조](https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1028543325). 시행 2026-03-02, 고용노동부령 제450호(2025-09-01 일부개정).

같은 조 제2항은 질환 발생·인정, 새로운 부담작업·설비 도입, 업무량·공정 등 작업환경 변경 시 수시 조사 조건을 규정한다. 제3항은 근로자 대표 또는 해당 작업 근로자의 참여를 요구한다. 3년 주기를 ‘모든 직원의 REBA를 3년마다 실시해야 한다’로 표현하지 않는다.

## 제658조 — 조사 방법

> 사업주는 유해요인 조사를 하는 경우에 근로자와의 면담, 증상 설문조사, 인간공학적 측면을 고려한 조사 등 적절한 방법으로 하여야 한다. 이 경우 제657조제2항제1호에 해당하는 경우에는 고용노동부장관이 정하여 고시하는 방법에 따라야 한다.

[국가법령정보센터 제658조](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1020911757). 시행 2026-03-02. 영상 기반 자세 평가는 조사 과정의 일부를 지원하며 면담과 증상 조사 전체를 대체한다고 주장하지 않는다.

## 해외 평가 시간 사례

[Corporate Work Health Australia — Ergonomic Assessments for Melbourne Businesses](https://corporateworkhealth.com.au/ergonomic-assessments-for-melbourne-businesses-what-to-expect-and-how-to-prepare/), Heath Williams, 2026-06-10.

‘What Happens During the Assessment’에서 업체가 일반적인 멜버른 직장 인간공학 평가에 근로자 1명당 **20–40분**이 걸린다고 안내한다. 해당 과정은 근로자 면담, 작업 관찰, 노출 요인 확인, 작업환경 조정, 교육과 보고를 설명한다.

서비스 제공업체의 안내 수치이며 국가 평균이나 통제된 시간 측정 연구가 아니다. 국내 법정 유해요인조사 시간, REBA 단일 자세 채점 시간, SafeAngle의 절감 시간으로 환산하지 않는다. 발표에는 ‘호주 서비스 안내 사례: 20–40분/명’으로 표시한다.

## 슬라이드에 연결한 문제

정기 조사 의무가 있고, 평가에는 관찰과 조건 확인, 근거 정리가 필요하다. SafeAngle의 문제 가설은 이 중 영상의 위험 장면 탐색, 자세 기준 대조, 근거 정리를 돕는 것이다. 국내 현장 소요 시간과 제품의 실제 절감 효과는 별도 검증한다.

## 피치덱 8장 초안의 실행 화면과 검증 근거

- `real-report.png`, `real-video-score.png`: 엔진 연결 브랜치 `feat/reba-integration`, 커밋 `34603c2`, 2026-10-09 13:43 로컬 실제 실행의 스크린샷. 기존 UI와 관절 엔진, 사람 확인 입력, 결정적 REBA 계산을 연결한 결과다. 공개 배포 화면 또는 독립 정답 일치율을 뜻하지 않는다.
- 검증 문서: [PR #19의 REBA_VERIFICATION.md](https://github.com/midnightsun90/SafeAngle/blob/34603c2265e037e6caf840e9341407da9efce622/docs/REBA_VERIFICATION.md). 표 A 60칸 + B 36칸 + C 144칸 대조, 저자 예제 11점 재현, 실제 영상 연결 검증 기록을 확인했다. 최종 제출 버전에서 다시 대조한다.
- 화면 속 영상: [RickyBennison, Basic single leg squat](https://commons.wikimedia.org/wiki/File:Basic_single_leg_squat.webm), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). 검증 화면에 원본 영상의 선택 프레임과 관절 표시를 사용했다. 공개 영상 한 편이며 현장 표본이 아니다. 해당 영상 프레임을 포함하는 `real-video-score.png`의 재사용에도 동일 이용 조건을 적용한다.
- 기존 해외 20–40분 사례는 자료 보관용으로 남겼으나 현재 발표 슬라이드에서는 제외했다. 국내 평균 또는 제품 절감 효과와 연결하지 않는다.
- 기업의 업무 부담, 초기 구매 대상과 효용은 제품 가설이며 사용자 인터뷰나 구매 확인 결과로 제시하지 않는다.
- 2장 팀원 사진: 대표가 피치덱에 사용하도록 직접 제공한 해커톤 작업 사진(2026-10-09). `assets/team-hackathon.jpg`에 저장. 실제 질환이나 위험 등급을 판정하는 자료가 아닌 공감 장면이다.
- `assets/video-overlay.png`: 동일 PR #19 로컬 실제 실행의 관절 표시 화면. 영상은 RickyBennison, CC BY-SA 4.0이며 해당 프레임에도 동일 이용 조건을 적용한다.

- 서체: [Pretendard 공식 저장소](https://github.com/orioncactus/pretendard), npm 배포 1.3.9 Regular/Bold 고정 WOFF2 사용. PDF의 Pretendard-Regular 및 Pretendard-Bold 글꼴을 확인했다. 로컬 폰트와 SIL Open Font License 원문을 `assets/fonts/`에 포함했다.


## 12장 시각 중심 개정의 추가 근거 (10/9)

- 4장: 고용노동부 「2025년 산업재해 현황」. 신체부담작업 질병재해자 14,185명, 전체 질병재해자 33,825명 중 41.9%. 산재 승인일 기준. [공식 원문 표](https://www.korea.kr/docViewer/result/2026.03/31/198418718/198418718.files/24.html), [공식 비중](https://www.korea.kr/docViewer/result/2026.03/31/198418718/198418718.files/5.html), [승인일 기준 각주](https://www.korea.kr/docViewer/result/2026.03/31/198418718/198418718.files/29.html). 공식 HWP 텍스트와 변환 뷰어를 대조했다. 자세만의 원인, 전체 근골격계질환 수, 제품 효과로 확대하지 않는다.
- 5장: 산업안전보건연구원(2023) 「근골격계질환 유해요인조사제도 개선 방안 연구」 p.46. 기간 문항 응답 51개 사업장 평균 20.5일, 범위 1~90일, 표준편차 21.3일. 사업장 조사 전체 과정이며 노동시간이나 REBA 한 건의 시간이 아니다. 전국 대표 평균도 아니다. [1차 연구 원문](https://www.aposho.org/oshri/publication/researchReportSearch.do?articleNo=448394&attachNo=253286&mode=download). 직접 PDF 다운로드 오류로 1차 보고서 색인 본문과 표를 확인했으며 PDF 표 이미지 시각 검증은 미완료다.
- 7장 각주: 같은 연구 p.51–52, 어려움 문항 응답 사업장 89개소 중 27개소(30.3%)가 적절한 조사 방법을 모른다고 답했다. 복수응답이다. 수치를 합산하거나 모든 사업장·비전문가 비율로 바꾸지 않는다.
- 6장: 3년 정기조사 의무는 위 제657조에 따른다. 5년은 [KOSHA GUIDE E-G-1-2025 제10장](https://www.aposho.org/kosha/info/koshaGuideData.do?articleNo=453891&attachNo=261185&mode=download#page=43)의 조사 결과와 의학적 조치 기록 보존 권고다. [표지](https://www.aposho.org/kosha/info/koshaGuideData.do?articleNo=453891&attachNo=261185&mode=download#page=1)는 기술적 권고임을 명시한다. 인쇄 p.38–39, PDF43–44. 모든 문서·원본 영상의 법정 의무 또는 구현된 저장 기능으로 설명하지 않는다.

### 추가 이미지

- `assets/industrial-work.png`: 내장 OpenAI 이미지 생성 도구로 제작한 설명용 이미지. 실제 현장·재해 기록이 아니다. 프롬프트: “16:9 documentary-style warehouse illustration. One East Asian logistics worker on the right, leaning forward to handle a modest box on a low pallet. Orange safety vest and gloves, natural anatomy and neutral daylight. Muted dark-grey negative space on the left for headline. No injury, no agony, no skeleton overlay, no logos or text. Illustrative scene, not a real worker or accident.”
- `assets/assessment-reference.jpg`: 저장소의 팀 제공 사진 `assets/hackathon-photos/KakaoTalk_Photo_2026-10-09-10-37-31 001.jpeg`을 그대로 복사했다. 인간공학 평가기법 기준표와 필기 자료를 업무 복잡성의 설명 사진으로 사용한다. 현행 법령의 근거는 공식 조문을 사용한다.
- 9장 `assets/real-report.png`: 기존 PR #19의 로컬 실행 화면의 부위별 판정 요약만 보여 준다. 최종 제품 캡처 제공 시 교체한다. 전체 보고서를 모두 보여 주는 구성이나 공개 배포 증거가 아니다.

## 심사기준 대응과 GPT·Codex 활용 반영 (10/9)

- 사용자 제공 심사기준 이미지 `KakaoTalk_20261009_094625753.jpg`의 6개 기준과 Safety & Resilience 실패 대응 기준을 반영했다.
- 현재 제품 경로는 GPT 대표 장면의 8관절 좌표 제안, 사람 확인·수정, 코드 각도·REBA 계산이다. 입력: 대표 JPEG, 평가할 쪽, 몸 방향. 출력: 좌표 또는 null. 모델이 각도·점수·하중·시간을 직접 생성하지 않는다. 소스: 엔진 `lib/vlm/prompt.ts`, `lib/vlm/validation.ts`, `docs/VLM_TRANSITION.md`.
- GPT 연결 변경: 로컬 엔진 커밋 `8c61b15` (30파일, +819/-117). 검증은 현재 작업 중인 엔진의 `docs/VLM_VERIFICATION.md`, `.local/vlm-verification/results.json`을 읽어 반영했다. 현재 팀 병합이 진행 중이며 최종 제출 버전은 재대조해야 한다. 테스트를 이번 덱 작업에서 다시 실행하지 않았다.
- 실제 공개 영상 1편의 2초 장면, 480×640 JPEG, 같은 요청 3회에서 검지 MCP 0/3, 고관절 최대 두 응답 차이 9.03px. 시간 평균 24.817초. 정답 대비 정확도 표본이 아니며 산업 현장 대표 표본도 아니다. 잘못된 초기 방향 시나리오 3회는 별도로 기록됐다.
- 문서 기록: 엔진 69개·프론트 상태 8개 테스트 통과, REBA 240칸 및 기준 예제 11점, 타입 검사·24페이지 정적 빌드 통과. 실제 응답의 수정·채점 연결과 통제한 all-null·503·취소 시나리오를 구별한다. 수정하면 이전 답변·점수 제거, 실패 또는 필수 미확인에는 확정 점수 없음.
- `assets/gpt-overlay.png`, `assets/gpt-report.png`는 엔진 `.local/vlm-verification`에서 그대로 복사했다. 공개 영상 출처와 CC BY-SA 4.0은 앞의 RickyBennison 출처와 동일하다. GPT 보고서에서 원 제안·사람 수정·모델·대표 장면·계산 근거를 보존한다. 현재 로컬 화면이며 공개 API 배포·현장 정확도를 입증하지 않는다.
- Codex 슬라이드는 개발 도구와 제품 GPT를 구분하고 구현→검토·수정→통합 과정의 작업 범위를 설명한다. 사전 설계를 소급해 당일 Codex 작업이라 주장하거나 과거 이력을 지우지 않는다. 최종 제출 작업 로그·SHA와 일치시킨다.

## 실무자 부담 요약 장 추가

현재 7장은 방법 판단(27/89개소, 30.3%, 복수응답), 사업장 조사 전체 기간(응답 51개소 평균 20.5일), 비용(응답 44개소 평균 304.8만원)을 각각 표시한다. 비용은 표준편차 539.5만원, 범위 0–2,000만원, 0원 응답 17개소이며 높은 편차를 각주에 표시한다. 전국 대표 평균, 한 자세·한 영상의 평가 가격, 제품 절감 효과로 환산하지 않는다. 출처는 위 2023년 연구 p.46–47·51–52다. PDF 표 이미지의 시각 대조는 아직 미완료다. 이전 출처 기록의 장 번호는 당시 버전이며 현재 번호는 README를 따른다.


## 법령 학습 사진

- `assets/safety-book-cover.jpg`,`assets/safety-rules-spread.jpg`: 대표 제공 자료 사진. 책 표지와 법령 학습 부분을 보여 주며 현행 법령의 공식 출처를 대체하지 않는다.

## 현재 11–13장 배포 캡처

실제 공개 웹앱 https://midnightsun90.github.io/SafeAngle/ 의 실행 캡처. 엔진 `.local/live-flow/results.json` (2026-10-09T07:24:08.321Z), `overlay.png`, `report.png`를 대조했다. 실제 인증·DB·영상 업로드·GPT 요청·사람 확인·REBA 5점·보고서 저장 및 재접속 복원 기록이며 `noRequestMocks: true`, 오류·실패 배열은 비어 있다. 모델 gpt-6.1-sol, 해당 호출 33.479초. 독립 정답 검증은 하지 않았으며 산업 현장 정확도나 시간 절감의 증거는 아니다. 위의 과거 로컬 캡처 설명보다 이 현재 기록이 우선한다. 공개 영상 CC BY-SA 4.0 출처는 동일하다.

## PDF 이미지 반영

12장은 실제 저장한 상세평가서 PDF 2페이지의 항목별 판정 요약이다. 15장은 PDF 1페이지의 관절 확인 기록을 확대해 index_mcp의 관측 불가와 사람 확인 기록을 보여 준다. 출처: 엔진 `.local/pdf-verification/report.pdf`, `print-1.png`, `print-2.png`. 누락은 기록하고 사람의 확인을 요구하며, 확인 후 점수가 생성되는 흐름이다. 관측 불가가 한 개라도 있으면 영구적으로 채점을 거부한다고 설명하지 않는다.
