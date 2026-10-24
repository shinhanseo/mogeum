# 저장 목록 편집과 실제 UI 검증 준비 · 2026-10-24

이미 마신 제품은 추천 목록에서 제외되므로 추천 목록 북마크만으로는 이전 저장을 해제할 수 없었다. 저장 목록 제목 옆 편집/완료를 추가했다. 기본 마셨어요 행동은 그대로 두고 편집 상태에서 각 행의 행동을 저장 해제로 전환한다. 서버 mutation/expected revision/복구 큐를 공유하며 응답 전에 임의로 행을 지우지 않는다. 원본45에 없는 편집 상태는 공통 Button·토큰을 사용하는 확장 상태다.

## 로컬 네이티브 UI E2E 경로

`scripts/start-local-native-ui.ts`는 정확히 127.0.0.1:54321의 local CLI 상태만 허용하고 public publishable key/URL만 Metro 환경에 전달한다. 관리형 .env를 수정하지 않고 service key를 앱에 전달하지 않는다.

`mogeum-dev://dev/local-ui-session?runId=<새 실행 ID>`는 __DEV__·native·정확한 로컬URL일 때만 합성 Auth 계정을 생성한다. 기존 세션/실행 manifest는 덮지 않는다. 비밀값을 출력하지 않고 지정 합성 사용자 ID만 기기 private manifest에 보관한 뒤 실제 /discovery로 이동한다. 이 경로는 mock 추천/저장 응답을 만들지 않는다.

종료 시 같은 runId에 finish=1을 추가한다. 실제 Auth.getUser와 manifest·합성 metadata·이메일 형식이 모두 맞는 계정만 로그아웃한다. 호스트의 기존 cleanup-native-probe 스크립트로 지정 manifest의 합성 사용자를 정리한다. private manifest나 토큰을 공개 증거에 넣지 않는다.

타입·린트·질문 계약 검사와 전체241개 중235 통과/환경6skip, 실제 로컬 HTTP 5개 전부 통과를 확인했다. HTTP 검증의 한 계정은 실제 앱과 같은 publishable key로 인증한다.

로컬 실행도 CLI의 PUBLISHABLE_KEY를 사용한다. 앱의 기존 legacy JWT 키 차단을 유지하며, ANON_KEY를 넣어 configured=false가 되는 경로를 수정했다.

## 실제 네이티브 UI 결과

iOS iPhone17 Pro Simulator와 Android 전용 Mogeum_SDK58_Verify(API37, arm64)에서 새 SDK58 패치 빌드로 각각 확인했다. 실제 앱 SDK·로컬 Auth·Edge Function·DB를 사용했고 mock 응답은 사용하지 않았다.

1. 다음 한 잔에서 아드벡10년 북마크 저장 → 저장한 술1.
2. 저장 목록의 마셨어요 → 기존 기록 작성에 이름·위스키가 입력됨. 사진·별점·향 답변은 임의 입력하지 않음.
3. 또 마시고 싶어요 → 기록 저장 → 실제 상세. DB 기록1·술장 항목1·북마크 saved=true/revision1 확인.
4. 다음 한 잔 재조회에서 아드벡 제외, 저장 목록에는 유지.
5. 저장 목록 편집 → 저장 해제 → 목록0. DB 기록1·술장 항목1 유지, 북마크 saved=false/revision2 확인.

각 플랫폼의 *-recorded-saved.json / *-recorded-unsaved.json은 지정 합성 계정만 읽어 검증한 공개 가능한 보고서다. 사용자 ID·이메일·세션·키를 포함하지 않는다. ios-real-* / android-real-* PNG는 실제 UI 조작 캡처다. Android 우상단 회색 톱니는 Expo 개발 도구 오버레이로 제품 UI가 아니다.

이 결과는 로컬 인증 E2E다. Apple·카카오 provider와 관리형 프로젝트의 인증 후 E2E, 실기기 사용성, 원본44 추천 이유 화면 일치 확인은 별도로 남아 있다.

검증 종료 후 두 플랫폼 모두 finish=1 경로의 로그인 화면을 확인했고, 지정 manifest만 사용하는 cleanup으로 각 합성 계정 정리를 확인했다. 이전 iOS 정리 재실행은 삭제 대상0명으로 확인했다.
