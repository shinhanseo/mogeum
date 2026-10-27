# Gemini 제품 조사 공유 캐시·호출 예약 · #171/#176

내부 budgetedProductResearch는 서버의 제품명·주종·판본만 받는다. 검증된 입력과 모델/계약 버전의 SHA-256을 공유 키로 만들어 DB 예약 후에만 Google Search provider를 호출한다. 제품 조사 결과는 grounded candidate로 검증해 보관하고, 캐시를 읽을 때도 동일 제품/출처/지원 구간을 재검사한다. 개인 노트·사용자 ID·취향은 입력/공유 캐시에 넣지 않는다.

- 공유 캐시7일. 성공 결과도 **candidate**이며 제품 카탈로그 verified로 자동 승격하지 않는다.
- 전역 동시2건·UTC 하루20회·UTC 월200회 **시도 예약**. 실패/취소/만료도 소비한 시도로 기록한다. 캐시/대기/차단은 provider를 호출하지 않는다. 이는 검색 질의 수나 금액의 정확한 상한이 아니다. 한 provider 호출 내부 검색 수는 다를 수 있다.
- 동일 제품 진행 중60초 lease. 실패/만료 후5분 backoff. 이전 lease의 늦은 완료는 새 결과를 덮지 못한다. 하나의 전역 advisory lock으로 캐시 획득과 전체 예산 예약을 직렬화한다.
- begin/finish RPC는 service_role 전용이다. private 테이블은 RLS 및 클라이언트 접근 차단. 전체 예산을 사용자별로 나누거나 body의 한도로 우회할 수 없다.
- 공개 Edge endpoint/앱 요청은 아직 없다. 실제 제품·판본/주장 검증·정규화·승격·주간 개인 추천은 후속이다. 현재 앱이 Gemini로 미등록 술을 추천한다고 주장하지 않는다.

검증: PGlite에서 실제 신규 migration을 실행해 RPC 권한·후보 캐시·동시 슬롯·실패 backoff·이전 lease 거부·일/월 시도 제한을 확인했다. orchestration은 차단/캐시에서 provider 미호출·실패 정리·개인 context 거부를 검증했다. 전체421통과/환경12제외. Deno service/provider 타입 검사 통과. 실제 SDK fake transport3/3은 기존 검증이며 실제 Gemini 검색/가격/정확도·실제 PostgreSQL 동시성·관리형 적용은 아직 미수행이다.
