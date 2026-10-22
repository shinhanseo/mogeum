# 기록 사진 교체·다른 술로 옮기기

## 연결
수정 화면 → 사진 변경 → 현재/새 사진 3:4 비교 → 저장 → 실제 업로드/RPC → 상세 재조회. 사진 없는 기록에 추가도 가능하다. 기존 사진 binary는 정상 교체 이후 정리한다.

수정 화면 → 다른 술로 옮기기 → 내 술장 검색/페이지 추가 또는 새 술로 분리 → 확인 → RPC → 상세 재조회. 이 날짜의 경험 한 건만 옮기며 사진·날짜·평가·빈티지·노트와 답변을 유지한다. 기존 술장이 비면 overview에서 숨기고 대상 기록 수를 다시 계산한다. 기본 정보 수정 중 이동하면 취소 여부를 먼저 묻는다.

## 디자인 근거와 범위
`04 · 화면 정리본` 원본 22 수정 화면과 공통 Button/ChoiceChip/ScreenHeader, tokens.ts를 기준으로 확장했다. Chrome에서 원본 확인(파일 T99YyZulPfJaSkW7tq4xcn, node 4:4343). 원본 수정 카드의 84×112 사진을 유지한다. 새 교체/이동 화면은 원본에 없는 확장 상태로 원본과 픽셀 일치라고 주장하지 않는다. 크림/버건디, Noto Sans KR, 동일 하단 52 버튼을 사용한다. 두 화면은 작업 화면이므로 바텀탭을 추가하지 않는다.

## 검증
- npm run check: 타입·린트·노트 계약·63 tests, 61 pass, 2 skip(실제 PostgreSQL 동시성/HTTP 스택은 CI).
- PGlite 정책 테스트: 사진 교체 rollback, 대표 사진/삭제 job, 응답 유실 replay, stale revision, 외부 계정/대상 차단, 이동/분리 수와 원래 기본 정보 보존.
- HTTP CI 테스트 추가: 실제 JWT/Storage 업로드 → 교체 → 이전 binary 정리 → 이동 → 확정 노트 유지 → 분리/replay → 최종 binary 삭제.
- iPhone17Pro iOS26.5 native: 수정 진입, 교체 비교·저장 callback, 이동 선택·확인, 새 술 이름 입력·키보드 위 버튼·취소 후 입력 보존. 개발 fixture이며 서버 저장 없음 배너를 표시한다.
- UI screenshots: ios-record-photo-replacement.png, ios-record-move.png, ios-record-split.png. 사진 비교 예시는 같은 허가된 Figma fixture를 사용하며 실제 서로 다른 사용자 사진 교체 증거가 아니다.

## 남은 범위
Apple/카카오 provider 미설정으로 사용자 실제 계정의 iOS 저장 E2E는 미검증. Android/실기기 촬영 및 접근성 글자 확대도 남아 있다. abandoned 업로드의 서버 정리 worker, AI 요약 stale 처리 UI는 후속. 이슈 전체 완료로 닫지 않는다.
