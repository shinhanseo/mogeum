# 입력창·저장 대기 수정 베타 산출물 검증

2026-10-26. 내부 draft release용이며 공개 배포/스토어 제출을 하지 않았습니다. 소스 **49b9d5b**. 이후 main의 작성 단계 복원(#131)과 자동 노트 출처 수정(#133)은 이 산출물에 포함되지 않습니다.

| 항목 | Android | iOS Simulator |
|---|---|---|
| 앱 버전 | 0.1.0 / native code 6 | 0.1.0 / native CFBundleVersion 1 |
| EAS 표기 순번 | 6 | 4 |
| 식별자 | com.hanseo.mogeum | com.hanseo.mogeum |
| 내장 Hermes safety scan | 통과, issues 없음 | 통과, issues 없음 |
| 실행 | API37 전용 에뮬레이터 설치·로그인 화면 | iOS26.5 설치·기존 술장 로드 |

Android APK의 non-debuggable과 마이크/overlay 권한 제외를 apkanalyzer로 확인했습니다. 사용자 Galaxy는 사용하지 않았습니다. iOS의 내 취향/다음 한 잔은 사진 기록만 있을 때 감각 근거 안내를 표시하고 추천 제품을 임의 노출하지 않는 것도 확인했습니다. 실제 사용자 기록 저장/삭제·AI 새 호출은 하지 않았습니다.

최신 APK/시뮬레이터 압축 파일과 SHA256SUMS/INSTALL은 무시된 artifacts/beta 폴더에 보관합니다. 개인 설치 URL과 서명 정보는 공개 문서에 기록하지 않습니다. 로컬 PNG 증거는 artifacts/qa/tasting-done/android-code6-login.png 및 ios-beta-inputfix-no-evidence.png입니다.

미검증: Android Done·삼성 키보드·소셜 로그인 이후 전체 베타 경로, 실제 기기 OCR/누끼/권한 거부 전체, 실제 Apple/Kakao grant 해제. 이슈 #124는 Android 완료 검증이 남아 있으므로 열려 있습니다. 외부 배포 조건인 실제 개인정보/약관 문서 URL과 소유자 운영 검토도 별도입니다.
