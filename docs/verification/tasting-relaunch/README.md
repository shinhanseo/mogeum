# 노트 작성 중 앱 종료·재실행 QA · #161

## iOS 실제 화면 흐름

iPhone 17 Pro / iOS 26.5 development build, 로컬 Supabase의 기존 이름 붙인 합성 계정만 사용했다. 실제 운영 계정과 기록은 변경하지 않았다.

1. 기존 합성 위스키 기록에서 심화 노트 시작 → 스트레이트와 한글 메모 입력 → Done → 다음 질문에서 호박색 선택.
2. `simctl terminate` / `launch` 후 같은 기록의 노트 추가를 열었다. **심화 2/9와 호박색 선택**이 복구됐다. 이전 질문으로 돌아가 **스트레이트와 한글 메모 전체**가 유지됨을 확인했다.
3. 가볍게 모드로 전환해 과일 향만 선택하고 나머지 질문을 건너뛰었다. 미리보기는 `과일 향이 떠올랐어요.`만 포함했다.
4. 문장 직접 수정에서 전체 내용을 빈 문자열로 바꾸고 다시 terminate/launch했다. 동일 기록 재진입 시 **빈 입력과 편집 화면**으로 복구됐다.
5. 취소를 누르자 원래 문장 미리보기로 돌아왔다. 서버 노트 저장 버튼은 누르지 않았다. 합성 계정의 서버 기록 2개/노트 0개 상태와 별도로 로컬 초안만 작성한 시험이다.

재실행 도중 로컬 Metro의 IPv6-only 바인딩과 공개 설정 변수 누락을 발견해 로컬 QA 서버 설정을 바로잡았다. 새 프로세스에서 IPv4 localhost의 최신 코드를 다시 연결한 뒤 위 복구를 확인했다. 인증 정보·초안 파일을 호스트에서 바꿔 복구를 흉내 내지 않았다.

로컬 CUA 증거는 ignored `artifacts/qa/tasting-relaunch/ios-question-restored.png`, `ios-answer-restored.png`, `ios-empty-edit-restored.png`에 있다. 이 검증은 계정 전환 전체 UI/모든 주종/실기기 종료 상황을 모두 확인한 것은 아니다.

## Android 실제 native 저장소 + 프로세스 종료

전용 `Mogeum_SDK58_Verify` / API 37 development build. Android Studio의 CUA 터치/툴바 Home 입력이 앱에 전달되지 않아 **터치 UI 검증은 통과로 계산하지 않는다.**

`app/dev/tasting-relaunch-probe.tsx`의 명시적 진단 경로로 production과 같은 `createTastingDraftStorage` + 실제 native AsyncStorage를 사용했다. 새 무작위 합성 owner/record 키만 만들고 기존 키가 존재하면 덮지 않는다. Auth client·서버 호출·사용자 키 스캔 없이 실행하며 기존 사용자 세션은 그대로 둔다. 각 초안에는 두 모드의 선택형/한글 답변과 현재 질문을 독립적으로 채운다.

- 4주종 × 2모드 × 질문/미리보기/편집 = **24개 초안**을 저장하고 완료 보고서를 먼저 확인했다.
- 실제 Android 앱 PID 3813에서 `am force-stop` 후 프로세스가 없는 것을 확인했다. 개발 client를 재연결한 새 PID 3962에서 별도 `verify` 단계를 실행했다.
- 24개 전체의 복구 JSON이 원본과 정확히 같았고, 화면 단계·빈 편집 버퍼도 유지됐다. 다른 owner의 읽기는 초안을 반환하지 않았다.
- 이는 서버 RLS 또는 실제 사용자의 모드 전환/키보드/시스템 Back UI 검증이 아니다. 보고서에도 `uiInteractionVerified=false`, `serverWritePerformed=false`를 명시했다.

비식별 합성 [native 결과](android-native.json). CUA 화면 증거는 ignored `artifacts/qa/tasting-relaunch/android-native-restore-passed.png`다. 개인 owner/record ID가 담긴 원본 manifest는 기기 내부에만 보관한다. 진단 경로는 `__DEV__` 전용이고 `.easignore`의 `app/dev/` 제외 대상이다. 기존 배포 APK에 새 진단 경로가 들어갔다고 주장하지 않는다.

재실행 방법은 개발 client를 로컬 Metro에 연결한 후 `mogeum-dev://dev/tasting-relaunch-probe?runId=<새 실행명>&phase=seed`를 열어 `ready_for_process_restart`를 확인하고 앱 프로세스를 종료한다. 새 프로세스에서 동일 실행명과 `phase=verify`를 열어 `passed`를 확인한다. seed는 기존 실행명을 덮지 않는다. 손상된 초안이나 실패 원문을 임의로 삭제하지 않는다.

검증: `npm run check` **403개 중 395 통과, 환경 의존 8 skip, 실패 0**, `git diff --check` 통과. 이번 변경은 개발용 진단/검증 자료만 추가한다.

남은 범위: Android 터치·Done·시스템 Back·권한/설정 복귀, 실기기 앱 종료·OS 메모리 회수·reinstall, 실제 계정 전환 전체 화면, 의도적으로 지연된 native 쓰기 중 강제 종료, 접근성 글자 확대.
