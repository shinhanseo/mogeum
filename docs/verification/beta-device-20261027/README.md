# 최신 베타 빌드와 갤럭시 설치 · #163

검증 완료 PR162를 병합한 소스 `e30a5cb27a57eead0338a4d581659102d3efcd51`에서 빌드했다. PR160의 긴 노트 저장 오류 안내 스크롤을 포함한다. 이후 이 QA 문서 브랜치는 앱 실행 코드를 변경하지 않는다. 외부 공개가 아닌 기존 draft/prerelease의 내부 QA 산출물이다.

| 항목 | Android | iOS Simulator |
| --- | --- | --- |
| 버전 | 0.1.0 / code10 | 0.1.0 / 실제 CFBundleVersion1 |
| EAS 순번 | 10 | 9 |
| 식별자 | com.hanseo.mogeum | com.hanseo.mogeum |
| 빌드 | FINISHED | FINISHED |
| 알려진 서버 키/개발 probe 내장 번들 검사 | 통과 | 통과 |
| 새 설치·시작 | 갤럭시 S24 / Android16, OS foreground 확인 | iPhone17Pro / iOS26.5, 술장 CUA 확인 |

Android APK **125596244 bytes**, SHA256 `b988fe89b305b5b7a51094aafc92e44f9c195673d1aac127e75db3fb87a4c3ff`. APK 서명 검사 통과, manifest의 non-debuggable과 RECORD_AUDIO/SYSTEM_ALERT_WINDOW 제외를 확인했다. USB 연결된 SM-S921N에 `adb install -r`가 Success를 반환했고, 실제 설치 package의 versionCode10, MainActivity COLD 시작 성공, 실행 프로세스와 OS의 topResumedActivity/현재 포커스를 대조했다. 기존 개발 앱을 삭제·초기화하지 않았다.

이는 실제 기기 **설치·실행 확인**이다. 휴대폰 화면의 로그인 이후 흐름을 CUA로 직접 조작한 것은 아니므로 전체 Android 기능 통과라고 주장하지 않는다. 사용자가 직접 확인할 [Android 미검증 항목/수동 QA](../../beta/android-manual-qa.md)에 삼성 키보드·재실행·Back·권한·오프라인·실사 OCR·계정 경계 등을 정리했다. 설치 후 사용자의 휴대폰 QA를 방해하는 강제 종료나 계정 변경은 하지 않았다.

iOS 공식 EAS CLI 다운로드 앱을 `app.app` 루트로 압축했다. archive **49495434 bytes**, SHA256 `220baca0d17969b7ab47f49b139be6498e7dfb1e09251dd9079601ffed24bd4c`. 설치 후 기존 세션의 술장을 CUA로 읽고 다섯 필터와 중앙 +/하트가 보이는 시작 화면을 확인했다. 실제 기록 쓰기·삭제는 하지 않았다. screenshot은 사용자 사진이 포함돼 ignored `artifacts/qa/beta-device-20261027/ios-build9-cellar.png`에만 보관한다.

iOS 첫 업로드는 두 CLI 프로세스의 로컬 Git 설정 충돌로 실패했고, 업로드 완료된 Android 요청을 다시 만들지 않고 iOS만 순차 재요청했다. iOS EAS 순번8은 업로드 실패 때 소비돼 최종 순번이9다. 실제 CFBundleVersion1과 혼동하지 않으며 실제 서명 IPA 확인은 #146에 남아 있다. 이 파일은 실제 iPhone/TestFlight용이 아니다.

기존 로컬 versioned 산출물은 유지하고 `artifacts/beta/`의 latest 별칭·INSTALL.md·SHA256SUMS.txt를 갱신했다. 새 개발 전용 진단 경로는 `.easignore`의 `app/dev/` 제외 대상이며, 실제 배포 번들의 probe 검사도 통과했다.

관련 코드 검증은 PR160/162 CI 통과 및 `npm run check` 403개 중395 통과·환경 의존8 skip·실패0이다. 이번 문서 변경은 `git diff --check`로 확인한다. Android 실제 터치/키보드 QA, 실기기 사진/누끼/OCR 정확도, 실제 OAuth grant 해제, 외부 개인정보/약관/문의처 검토와 iPhone 서명 배포는 여전히 별도다.
