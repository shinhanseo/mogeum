# 입력 완료·사진 캐시 수정 베타 QA

2026-10-26, source e337126(PR143/main39234e0와 코드 동일), 내부 draft release입니다. PR140 기본 기록·수정의 Done과 PR143 생성 사진 임시 파일 정리를 포함합니다. PR145 저장 오류 자동 스크롤은 이 빌드 이후 변경입니다.

| 항목 | Android | iOS Simulator |
| --- | --- | --- |
| 앱/네이티브 버전 | 0.1.0 / code8 | 0.1.0 / CFBundleVersion1 |
| EAS 순번 | 8 | 6 |
| 식별자 | com.hanseo.mogeum | com.hanseo.mogeum |
| 내장 번들 알려진 키/probe 검사 | 통과 | 통과 |
| 실제 설치·실행 | API37 전용 Emulator, 로그인 화면 | iOS26.5 iPhone17Pro 기존 술장 읽기 및 SE3 신규 설치 |

Android는 non-debuggable, RECORD_AUDIO/SYSTEM_ALERT_WINDOW 제외를 확인했습니다. 설치 파일125594404 bytes, SHA256 `ddaf6a87a62d7715b701a1554a33ce214ef95cbfc12683912fcba792371386f8`입니다. CUA에서 로그인 화면을 확인했습니다. 터치 전달 도구 제약이 있어 로그인 후 전체 경로·Done·삼성 키보드는 이번 Release에서 검증하지 않았습니다.

iOS는 공식 EAS CLI 다운로드 앱을 app.app 루트로 재압축했습니다(49494557 bytes, SHA256 `42fe0717586bc2e0715701df85bba5534f01934b6570122cd4f52038f8f5c7da`). 실제 CFBundleVersion은1이며 EAS 순번6을 native6으로 표기하지 않습니다(#146). iPhone17Pro에서 기존 술장 읽기, SE3 신규 설치에서 로그인→둘러보기→빈 술장 표시를 확인했습니다. SE3에서도 주종5개 필터가 한 줄에 보이고 하단 +/하트가 가려지지 않았습니다. 기존 사용자 기록 쓰기·삭제나 새 AI 생성 요청은 하지 않았습니다.

## 별도 개발 빌드 QA

iPhone SE3(iOS26.5, 375×667pt)의 로컬 개발 미리보기에서 위스키 심화 첫 질문에 긴 한글 두 줄을 입력했습니다. 글자 위아래/마지막 줄 잘림이 없고 Done 접근성 키(한국어 완료)를 눌렀을 때 키보드가 닫히며 전체 입력이 유지됨을 실제 UI로 확인했습니다. 이는 고정 미리보기이며 서버 저장 검증과 구분합니다. 원래 iPhone17Pro의 계정/기록은 유지했습니다.

SE3 개발 앱 최초 Metro 로드 중 React Scheduler EXC_BAD_ACCESS 1회를 관측했습니다. 재실행 후 로그인·테이스팅 미리보기, Release6의 로그인·빈 술장에서는 재현되지 않았습니다. 개발/배포 앱 전체 충돌 해소로 간주하지 않으며 원인은 아직 미확정입니다. 원본 진단 로그는 개인 로컬에만 보관합니다.

증거는 ignored `artifacts/qa/beta-batch/android-code8-login.png`, `ios-build6-se-cellar.png`, `artifacts/qa/tasting-done/ios-se-multiline-done.png`입니다. 사용자 데이터 가능성이 있는 스크린샷은 공개 저장소에 올리지 않습니다. APK/시뮬레이터 archive·INSTALL·SHA256SUMS는 ignored artifacts/beta와 기존 비공개 draft release에 보관합니다.

코드 검증: check394/386pass/8환경skip/0fail(PR143·145). [사진 캐시 실제 네이티브 확인](../record-image-cache/README.md), [기본 기록 Done/초안 복구](../record-input-done/README.md), [저장 오류 노출](../record-error-visible/README.md)를 구분해서 참고하세요. 실제 iPhone/TestFlight 서명·권한/실사 OCR/누끼·실제 OAuth grant 해제·외부 법적/운영 문서 검토는 남습니다.
