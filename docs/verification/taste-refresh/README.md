# 내 취향 · 최신 기록 복구

내 취향 화면을 다시 열 때 이전 context/사진을 지우고 기록과 사진 map을 함께 게시한다. context 확인 실패는 이전 요약을 유지하지 않고 기존 오류/재시도 상태로 전환한다. 사진 서명만 실패한 경우에는 현재 기록과 기존 placeholder를 사용한다.

포커스 해제·앱 비활성·unmount는 이전 조회를 무효화한다. 앱 복귀 시 다시 읽고, 요약 생성 요청의 늦은 성공/실패도 포커스 epoch가 달라지면 게시하지 않는다. 화면별 owner key는 유지한다. 실패 상태의 spinner는 중단한다. 기존 Figma 기반 배치·공통 버튼·색상은 변경하지 않는다.

## 검증 · 2026-10-24

- `npm run check`: 타입·린트·질문 계약 통과. 전체253개 중247 pass·환경6 skip.
- 새 loader 테스트: 정상 기록/사진 실패 분리, context 실패 후 이전 개인 근거 폐기, 겹친 응답 순서 역전, 취소 후 늦은 사진/실패 응답 무시.
- iOS Simulator 실제 로컬 합성 계정으로 내 취향 빈 상태 확인: `ios-empty.png`.
- Android Emulator 실제 로컬 합성 계정에서 정상 조회 → 해당 emulator의 로컬API54321 reverse만 해제 → 내 취향 재진입 실패/재시도 버튼 확인(`android-offline.png`) → reverse 복원 → 기록 다시 불러오기로 오류가 사라지고 정상 빈 상태 복구(`android-recovered.png`). Metro8081·호스트 네트워크·관리형 DB는 변경하지 않았다. mock 오류를 사용하지 않았다.
- 지정 합성 계정만 로그아웃·정리한다. 캡처는 개인 기록이 없는 계정이며 JWT/이메일/사용자 ID를 공개하지 않는다.

요약이 있는 실제 계정의 오프라인 전환, iOS 오프라인 복구, 생성 중 시스템 백그라운드 경합의 native fault injection은 남아 있다. 경합 차단은 도메인 테스트 범위이며 Gemini 키 미설정으로 실제 모델 생성 성공을 주장하지 않는다. React 코드 검토 스킬의 hooks/async cleanup 점검을 적용했으며 React Native 앱에 웹 UI 라이브러리를 도입하지 않았다.
