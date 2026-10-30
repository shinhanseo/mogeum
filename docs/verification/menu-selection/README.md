# 메뉴판 Gemini 선택 · #174

## 연결 범위

shared-catalog-v1 요청에 recommendationVersion=menu-selection-v1을 명시한 경우, 확정 메뉴를 현재 기록과 먼저 비교한다. 제품 판본이 확인되고 양의 근거 점수가 있는 similar/known 메뉴 최대80개에서 Gemini가 최대10개 ID의 순서를 고른다. 선택하지 않은 메뉴도 기존 순서로 뒤에 보존한다. 제품 특징·가격·용량·원본 좌표·개인 근거는 규칙 비교에서 검증된 값을 유지하며 모델이 작성하지 않는다.

모델 입력은 메뉴 ID·점수·특징별 긍정/부정 건수뿐이다. 개인 기록 ID·노트·사진·메뉴 원문을 보내지 않는다. 미확인 술을 검색하거나 검증 카탈로그로 승격하는 기능과 구분한다. 후보가 없으면 모델/예약 호출 없이 insufficient다.

## 호출과 실패

private.menu_selection_jobs에 계정별 lease/입력 hash/모델 버전/선택 ID를 보관한다. 같은 입력은24시간 캐시를 사용한다. 기록 hash·제품 문서·메뉴/가격·근거가 바뀌면 입력 hash도 바뀐다. 실행 중 요청은 같은 작업에 합류하고90초가 지나면 다른 lease로 인계할 수 있다. 늦은 완료는 거절한다. 실패 후30초 backoff와 UTC 하루10회 시도 상한을 적용한다. 실패도 시도로 세며 cache/running/backoff는 새 시도가 아니다. Auth 삭제 시 FK cascade로 정리된다. anon/authenticated는 테이블·예약/완료 RPC를 사용할 수 없다.

실패·한도·키 누락에는 기존 근거 비교 결과를 유지하되 method=evidence-rules-v1/modelUsed=false와 상태를 표시한다. 실제 생성/캐시만 gemini-menu-selection-v1/modelUsed=true다. 앱은 이 조합과 모든 제품/기록 근거를 다시 검증한다. 모델 처리 후 taste snapshot을 재조회해 기록 변경 시409로 결과를 숨긴다. 주간 추천 갱신 제한과 별도다.

## 검증

- npm check451통과/환경14제외(타입·린트·도메인·DB/PGlite 포함).
- 실제 SDK + 가짜 transport2통과: 집계만 전달, 임의 메뉴 ID 차단. 실제 Gemini 호출 검증과 다르다.
- DB: lease 소유권, 캐시/멱등 완료, 실패 backoff, UTC 일일 상한/초기화,90초 늦은 완료 거절, 사용자 권한 차단, Auth 삭제 cascade.
- 관리형 서버 배포·실제 Gemini·양 플랫폼 UI 검증은 후속 단계. 앱의 gemini 옵션은 배포 검증 뒤 활성화한다.
