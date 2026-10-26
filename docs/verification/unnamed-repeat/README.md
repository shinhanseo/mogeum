# 이름 없는 술의 반복 기록 (#118)

사진만 저장한 술은 이름이 nullable이다. 상세의 `한 번 더 기록하기`에서 기존 술장 항목을 명시했는데도 앱과 RPC가 새 이름/사진을 요구해 저장을 막았다.

앱은 기존 항목을 읽은 경우에만 이 입력 검사를 생략하고, RPC는 명시적인 entry ID가 있을 때 소유권을 확인한 뒤 새 경험을 만든다. 새 항목의 이름/사진 요구, 인증·계정 활성 상태, 행 잠금, operation ID 재시도와 삭제 tombstone 처리는 유지한다. 사진·별점·느낌·답변·노트는 이전 기록에서 복사하지 않는다.

## 검증

- Android SDK58 development build, 전용 에뮬레이터와 로컬 Supabase 합성 계정: 사진만 있는 위스키의 반복 기록에서 새 사진/이름 없이 `괜찮아요`를 골라 저장했다. 상세로 이동했고 실제 DB는 경험 1→2, 술장 항목 1개, operation ID 2개였다.
- 새 경험의 entered_name/rating은 null, revisit는 okay, 사진/답변/노트는 각각 0행이었다. 원래 경험의 사진 1행과 평가(again/5점)는 유지됐다.
- 술장으로 돌아가 사진 카드 1개와 `기록 2회` 표시를 확인했다. 캡처는 로컬 `artifacts/qa/composer-draft/android-unnamed-repeat-saved.png`, `android-unnamed-repeat-cellar.png`에 보관한다. 실제 사용자 데이터가 아니다.
- DB 회귀 테스트: 같은 operation의 재시도는 같은 경험, 빈 신규 항목은 22023, 존재하지 않거나 타인 소유 항목 및 비로그인은 42501을 확인한다.
- `npm run check`: 총 368개, 360 통과, 환경 의존 8 skip, 실패 0. PostgreSQL 다중 세션 동시성은 CI의 격리 Supabase에서도 확인한다.

## 서버와 디자인 범위

2026-10-26 `mogeum-dev`에 `20261026030000_repeat_without_new_identity.sql`만 dry-run으로 확인한 뒤 적용했다. 기존 데이터 재작성이나 DB reset은 하지 않았다. 원래 함수에서 신규 이름/사진 검사의 조건만 바꾼 CREATE OR REPLACE이며 security invoker와 ACL을 유지한다.

04 화면의 기존 재음용 경로(19: 4:4227)와 저장 화면을 재사용하며 컴포넌트·레이아웃·토큰을 변경하지 않았다. 이 PR은 새로운 Figma 픽셀 일치 검증이 아니다. iOS의 이 조건 및 관리형 서버를 통한 native 반복 저장은 이번 회차에 따로 검증하지 않았다.
