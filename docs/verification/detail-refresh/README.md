# 기록 상세의 앱 복귀·사진 재발급

상세 화면의 record/history/private photo를 한 결과로 취급한다. focus 및 앱 active 복귀 때 다시 읽고 조회 중에는 기존 loading 상태로 전환한다. 이전 조회·다른 대상·백그라운드에서 늦게 끝난 응답은 결과를 되살리지 않는다. 실패 시 과거 상세 대신 기존 오류·재시도 UI를 사용한다.

표시 중인 사진 URI가 실패하면 현재 기록 전체를 다시 확인하고 서명 URL을 갱신한다. 다른 URI의 늦은 오류는 무시하며 같은 record/revision/photo 경로의 자동 갱신은 한 번만 허용한다. 새 focus/명시적 재시도/앱 복귀 조회는 재발급 기회를 새로 연다. 원본 Figma 레이아웃·문구·사진 3:4 비율·공통 버튼 수치는 변경하지 않았다.

## 실행 증거

- `npm run check`: 277개 중 271 통과, 로컬 HTTP/독립 DB 환경 의존 6개 skip.
- 순수 회귀 4개: 갱신 시작 시 과거 상세 제거와 실패 처리, 취소·겹친 조회의 늦은 결과 차단, 현재 사진만 1회 재발급, 재발급 도중 background/기록 삭제 차단.
- iOS 26.5 / iPhone 17 Pro 실제 dev build + 로컬 Supabase Auth/Data API: 고유 합성 계정으로 상세를 열었다. Device Hub Home으로 앱을 내리고 독립 인증 세션에서 `edit_tasting_record`로 이름을 수정했다. 홈의 앱 아이콘으로 복귀했을 때 같은 상세가 수정된 이름을 표시했다. 같은 방식으로 기록을 삭제한 뒤 복귀하면 과거 상세를 숨기고 오류·재시도 화면을 표시했다. 응답 mock/DB 관리자 직접 수정으로 사용자 RPC를 대체하지 않았다.
- [변경 전](ios-before.png), [복귀 후 수정 반영](ios-updated.png), [삭제 후 복귀](ios-deleted.png), [생성](ios-created.json), [수정](ios-updated.json), [삭제](ios-deleted.json), [최종 DB 상태](ios-final-state.json).
- 최종 records=0, visible cellar entries=0, raw cellar entries=1, saved wishlist=0을 확인했다. 스키마의 cellar_overview는 마지막 기록이 없는 항목을 숨기지만 raw 항목은 보존한다. 기존 verifier의 `raw entries <= records` 가정이 삭제 후에는 성립하지 않아 raw/visible 수를 모두 기록하고 실제 화면의 view에 대해 개수 검증하도록 수정했다. 빈 항목을 임의로 지워 검증을 통과시키지 않았다.
- 합성 계정은 앱에서 로그아웃한 뒤 private manifest의 run metadata/email을 확인하는 기존 도구로 해당 1개 계정만 정리했다. 정상 managed Metro를 복원했다. 식별자·세션·private manifest는 public 산출물에 포함하지 않았다.

Android에서 이번 상세 복귀 시나리오는 새로 실행하지 않았다. 실제 사진 URL의 300초 만료를 기다린 native E2E, 사진 오류 뒤 재발급의 기기 네트워크 검증, 운영/관리형 계정 검증은 남아 있다. signed URL 자체의 유효기간을 취소하는 기능은 아니다.
