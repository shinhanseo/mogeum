# 다음 한 잔 · 앱 복귀 시 최신화

다음 한 잔의 포커스가 유지된 채 앱만 백그라운드로 갔다 오면 기존 추천·저장 상태를 계속 보여주던 경로를 보완했다. AppState가 active로 돌아올 때 실제 로컬 서버를 재조회한다. 포커스가 없거나 백그라운드에서는 조회와 새 저장 행동을 시작하지 않는다. 비활성 전환은 진행 중 응답의 generation을 무효화하며, 저장 중 복귀는 해당 작업 종료 후 최신 상태를 다시 조회한다. 갱신 실패 때는 이전 추천과 개인 근거를 지우고 기존 오류/재시도를 사용한다.

Figma 04 기반 목록·상세·토큰·컴포넌트의 모양은 변경하지 않았다.

## 네이티브 검증 · 2026-10-24

- iOS Simulator / Android Emulator의 실제 앱과 로컬 Supabase Auth·Edge·DB를 사용했다. mock 응답이 아니다.
- 플랫폼별 새 합성 계정으로 저장 0개를 확인하고 홈 화면으로 전환했다.
- `scripts/set-local-ui-wishlist.ts`로 해당 합성 사용자만 검증한 뒤 별도 세션을 발급하고 authenticated `set_drink_wishlist` RPC로 아드벡10년을 저장했다. 서버의 소유권·revision 경로를 그대로 사용하며 service role로 북마크 테이블을 직접 수정하지 않는다. 보조 세션은 local scope로 로그아웃하므로 native 세션을 취소하지 않는다.
- 앱 프로세스를 종료하거나 추천 route로 다시 이동하지 않고 복귀했을 때 양쪽 모두 저장한 술 1개·아드벡 선택 상태가 자동 반영됐다. `*-resumed.png`, `*-second-session.json` 참고.
- `*-state.json`은 기록0·술장 항목0·저장1/revision1을 확인한 읽기 전용 보고서다. 북마크가 음용 기록이나 취향 근거를 생성하지 않았다.
- `npm run check`: 전체246개 중240 통과·환경6 skip, 타입·린트·질문 계약 통과.

개인 식별자·인증 토큰은 공개 보고서에 넣지 않는다. 검증용 계정은 지정 manifest 기준으로 로그아웃·정리한다. 실행 전 `scripts/start-local-native-ui.ts`로 정확한 로컬 URL을 사용하고 `mogeum-dev://dev/local-ui-session?runId=<새 ID>`로 시작한다. Android adb로 여러 query parameter를 전달할 때 URL 전체를 기기 shell 안에서도 따옴표로 감싸야 한다.

## 남은 검증

오프라인 복귀·복귀 직전 저장 응답 유실·백그라운드에서 늦게 도착하는 응답의 네이티브 fault injection은 이번 UI 검증에 포함하지 않았다. 이 경로의 가드는 구현했지만 실제 통과로 주장하지 않는다. Android Studio 시스템 Back/Home 도구 버튼은 상세에서 반복 조작 시 일관된 화면 전환이 관찰되지 않았다. 화면 내 뒤로 가기와 별도로 실제 시스템 제스처/실기기 검증이 남는다. 관리형 소셜 로그인 경로도 별도다.
