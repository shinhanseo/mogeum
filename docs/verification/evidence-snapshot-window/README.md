# 취향 근거의 사진 준비 중 기록 변경과 앱 복귀

메뉴판 추천 근거와 내 취향 loader는 context → 사진 조회·서명 → context 재확인 순서로 읽는다. 시작과 마지막 hash가 같을 때만 결과를 표시한다. 사진만 실패하면 사진 없는 기존 표시를 유지하지만 마지막 기록 확인 실패·기록 변경은 이전 요약/추천을 유효한 결과로 표시하지 않는다. 무한 자동 재시도 대신 기존 재시도/메뉴 확인 경로를 사용한다.

취향 근거 route도 같은 loader를 사용한다. focus·앱 active 복귀 때 재조회하고 blur·background 때 늦은 결과를 취소한다. 읽기 시작 시 이전 화면 데이터를 숨긴다. 버튼·폰트·레이아웃 수치는 바꾸지 않았다.

## 검증

- 수정 전 신규 회귀 테스트에서 사진 서명 중 변경된 기록의 이전 결과가 fresh/ready로 표시되는 실패를 재현했다.
- 회귀 5개: 메뉴 사진 준비 중 hash 변경, 마지막 hash 조회 실패, 취향 사진 준비 중 hash 변경, 마지막 context 실패, 마지막 검증 중 취소.
- `npm run check`: 타입·린트·테이스팅 계약 통과, 290개 중 284 pass / 별도 HTTP·동시 DB 환경 의존 6 skip.
- iOS 26.5 / iPhone 17 Pro dev build + 실제 로컬 Supabase Auth/Data API. 고유 합성 계정과 과일 향 노트를 생성하고 취향 근거 route에 표시했다. Device Hub Home으로 background 전환 후 독립 인증 세션의 `edit_tasting_record`로 이름을 변경했다. 홈 아이콘으로 복귀한 같은 근거 화면에서 수정된 이름을 확인했다. 다시 background에서 해당 기록을 삭제하고 복귀하니 과거 카드·향 근거가 사라지고 기존 빈 안내를 표시했다.
- [변경 전](ios-before.png), [수정 후 복귀](ios-updated.png), [삭제 후 복귀](ios-deleted.png), [생성 확인](ios-created.json), [수정 확인](ios-updated.json), [삭제 확인](ios-deleted.json), [최종 DB 상태](ios-final-state.json).
- 마지막 records=0 / visible entries=0 / raw empty entries=1 / wishlist=0 확인. 앱에서 로그아웃한 뒤 run metadata/email을 검증하는 기존 도구로 이번 합성 계정 1개만 정리하고 원래 managed Metro를 복원했다. 개인 정보·인증 토큰·private manifest는 첨부하지 않았다.

위 native 검증에는 실제 사진 서명 지연을 강제로 끼워 넣지 않았다. 그 경합은 지연 Promise 회귀 테스트로 검증했다. Android의 이번 복귀 시나리오, 실제 관리형 계정·Gemini, 실시간 구독은 검증/구현 범위가 아니다. 최종 확인 이후에 생기는 변경까지 원자적으로 막는 실시간 잠금이라고 주장하지 않는다.
