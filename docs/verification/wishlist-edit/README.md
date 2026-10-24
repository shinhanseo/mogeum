# 저장 목록 편집과 실제 UI 검증 준비 · 2026-10-24

이미 마신 제품은 추천 목록에서 제외되므로 추천 목록 북마크만으로는 이전 저장을 해제할 수 없었다. 저장 목록 제목 옆 편집/완료를 추가했다. 기본 마셨어요 행동은 그대로 두고 편집 상태에서 각 행의 행동을 저장 해제로 전환한다. 서버 mutation/expected revision/복구 큐를 공유하며 응답 전에 임의로 행을 지우지 않는다. 원본45에 없는 편집 상태는 공통 Button·토큰을 사용하는 확장 상태다.

## 로컬 네이티브 UI E2E 경로

`scripts/start-local-native-ui.ts`는 정확히 127.0.0.1:54321의 local CLI 상태만 허용하고 public anon key/URL만 Metro 환경에 전달한다. 관리형 .env를 수정하지 않고 service key를 앱에 전달하지 않는다.

`mogeum-dev://dev/local-ui-session?runId=<새 실행 ID>`는 __DEV__·native·정확한 로컬URL일 때만 합성 Auth 계정을 생성한다. 기존 세션/실행 manifest는 덮지 않는다. 비밀값을 출력하지 않고 지정 합성 사용자 ID만 기기 private manifest에 보관한 뒤 실제 /discovery로 이동한다. 이 경로는 mock 추천/저장 응답을 만들지 않는다.

종료 시 같은 runId에 finish=1을 추가한다. 실제 Auth.getUser와 manifest·합성 metadata·이메일 형식이 모두 맞는 계정만 로그아웃한다. 호스트의 기존 cleanup-native-probe 스크립트로 지정 manifest의 합성 사용자를 정리한다. private manifest나 토큰을 공개 증거에 넣지 않는다.

현재 타입 검사와 전체241개 중235 통과/환경6skip을 확인했다. 새 패치 native 재빌드와 이 helper를 통한 실제 UI 조작은 진행 중이며, 이전 시안 캡처를 실제 저장 UI E2E의 증거로 쓰지 않는다. 최종 결과를 아래에 추가한다.
