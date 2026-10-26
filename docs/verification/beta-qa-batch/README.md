# 작성 복원·로그아웃·기울임 수정 베타 QA

2026-10-26, source25c37e4(PR138/main06a14f5의 코드), 내부 draft release입니다. PR131 작성 단계 복원, PR133 자동/수동 노트 출처, PR136 로그아웃 대기 제한, PR138 geometry-v4를 앞선 입력창/Done/저장 대기 수정과 함께 포함합니다. 이후 PR140 기본 기록·수정 Done은 포함되지 않습니다.

| 항목 | Android | iOS Simulator |
| --- | --- | --- |
| 앱/네이티브 버전 | 0.1.0 / code7 | 0.1.0 / CFBundleVersion1 |
| EAS 순번 | 7 | 5 |
| 식별자 | com.hanseo.mogeum | com.hanseo.mogeum |
| 내장 번들 알려진 키/probe 검사 | 통과 | 통과 |
| 실제 설치·실행 | API37 전용 Emulator, 로그인 화면 | iOS26.5, 기존 술장 로드 |

Android는 non-debuggable, RECORD_AUDIO/SYSTEM_ALERT_WINDOW 제외를 확인했습니다. 설치 파일125590384 bytes, SHA256 `90dd9b513f1defca55f6ef1e959228065554fd8a5f7da2e599520bd79c2a793b`입니다. 로그인 후 전체 경로·Done·삼성 키보드는 이번 Release 실행에서 확인하지 않았습니다.

iOS는 공식 EAS CLI 다운로드 앱을 app.app 루트로 재압축했습니다(49492668 bytes, SHA256 `82ad423bf6ca5e48671926ed7d2a5f858b3bedd15906f99f23000761bd81cbb2`). 실제 CFBundleVersion은1이며 EAS 순번5를 native5로 표기하지 않습니다. 설치 후 기존 술장·필터 한 줄·가려지지 않은 탭 표시와 사진 기록만 있는 계정의 내 취향/다음 한 잔 근거 부족 안내를 확인했습니다. 기존 사용자 기록 쓰기·삭제나 새 AI 생성 요청은 하지 않았습니다.

증거는 ignored `artifacts/qa/beta-batch/android-code7-login.png`, `ios-build5-cellar.png`, `ios-build5-no-evidence.png`입니다. 실제 사용자 사진이 포함될 수 있어 공개 저장소에 올리지 않습니다. APK/시뮬레이터 archive·INSTALL·SHA256SUMS는 ignored artifacts/beta와 기존 비공개 draft release에 보관합니다. 실제 iPhone/TestFlight 서명·권한/실사 OCR/누끼·실제 OAuth grant 해제·외부 법적/운영 문서 검토가 남습니다.

코드 및 서버 검증: check390/382pass/8환경skip/0fail, 로컬 번들 HTTP6개 통과, 관리형 합성 계정 전체 smoke와 정리 확인. [OCR 배포 범위](../menu-skew/README.md), [기본 기록 Done/초안 복구](../record-input-done/README.md)를 구분해서 참고하세요.
