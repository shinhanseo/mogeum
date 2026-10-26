# 입력·오류 안내·이동 검색 수정 베타 QA

2026-10-26, source999fe1bf7814348ab2d40145e8514866ee0717b4, 내부 draft release입니다. PR140 기본 기록·수정 Done, PR143 사진 중간 캐시 정리, PR145 저장 오류 자동 스크롤, PR149 남은6입력 Done, PR151 이동 검색 세대별 응답 격리를 포함합니다. 이후 main의 인계 문서 수정은 실행 코드 변경이 아닙니다.

| 항목 | Android | iOS Simulator |
| --- | --- | --- |
| 앱/네이티브 버전 | 0.1.0 / code9 | 0.1.0 / CFBundleVersion1 |
| EAS 순번 | 9 | 7 |
| 식별자 | com.hanseo.mogeum | com.hanseo.mogeum |
| 알려진 서버 키/개발 probe 내장 번들 검사 | 통과 | 통과 |
| 실제 설치·실행 | API37 전용 Emulator 로그인 화면 | iOS26.5 iPhone17Pro 기존 술장·검색 |

Android는 non-debuggable, RECORD_AUDIO/SYSTEM_ALERT_WINDOW 제외를 manifest XML에서 확인했습니다. APK125595924 bytes, SHA256 `cc3bd3397ca640ef95226f82bd33727f9a7c8d9b135214f33c0f7cd554c4d5f8`. CUA에서 로그인 화면을 확인했습니다. 재부팅 후에도 앱 터치와 Android Studio 시스템 Home 입력이 반응하지 않아 이번 Release의 로그인 후 경로·Done·삼성 키보드는 미검증입니다. 앱 결함이나 도구 문제 중 하나로 원인을 확정하지 않습니다. AVD 데이터는 초기화하지 않았습니다.

iOS는 공식 EAS CLI 다운로드 앱을 app.app 루트로 재압축했습니다(49495366 bytes, SHA256 `540c0b5abab53c809815adaa2588a6f94c0ff5ab427dabc8e6b6c7dd26828104`). EAS 순번7과 실제 CFBundleVersion1은 다릅니다(#146). 설치 후 기존 세션/술장 읽기, 주종5개 칩 한 줄/하단 +·하트 확인. 실제 Release 검색어 입력→완료→키보드 닫힘/검색 결과 유지도 확인했습니다. 검증 후 검색어를 지우고 기본 술장으로 돌아왔으며 기존 사용자 기록은 변경/삭제하지 않았습니다.

## 개발 빌드 QA와 구분

iPhoneSE3(375×667pt) 긴 한글2줄/테이스팅 Done, 6개 추가 입력의 실제 완료 동작은 각각 [입력창](../tasting-input-keyboard.md), [추가 Done](../remaining-input-done.md)에 있습니다. iOS 이동 검색의 글렌→맥주→글렌 결과 표시도 개발 fixture에서 확인했습니다. 지연 페이지 ABA/이전 오류/취소/중복 더보기5회귀는 비동기 도메인 테스트이며 네이티브 원격 지연 응답 재현으로 주장하지 않습니다. [검색 순서](../move-target-search.md).

SE3 개발 최초 Metro 로드 중 Scheduler EXC_BAD_ACCESS1회는 원인 미확정입니다. 재실행과 과거 Release6 SE3 빈 술장, 이번 Release7 iPhone17Pro 시작·검색에서는 재현되지 않았으며 전체 충돌 해소로 간주하지 않습니다.

증거는 ignored `artifacts/qa/beta-batch/android-code9-login.png`, `ios-build7-search-done.png`입니다. 실제 사용자 사진 가능성이 있어 공개 저장소에는 올리지 않습니다. 설치 파일/INSTALL/SHA256SUMS는 ignored artifacts/beta와 기존 비공개 draft release에 보관합니다. 실제 iPhone/TestFlight·실사 촬영/OCR/누끼·소셜 grant 해제·외부 법적/운영 문서 검토는 남습니다.

코드 검증은 check399/391pass/8환경skip/0fail 및 PR151 앱·DB CI 통과입니다. 빌드 파일 검사와 모든 기기의 전체 QA 완료는 구분합니다.
