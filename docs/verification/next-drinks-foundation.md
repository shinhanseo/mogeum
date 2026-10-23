# 다음 한 잔 · 추천/저장 서버 기반

04의 42–46 기능을 연결하기 위한 선행 서버/DB를 구현했다. 앱의 기존 다음 한 잔 CTA는 아직 비활성 상태이며 새 API/북마크를 실제 화면에 연결한 완료 상태가 아니다.

## 추천

`next-drinks`는 POST의 검증된 Auth JWT에서 owner를 얻고 body는 선택 category만 받는다. client userId/근거/기록을 받지 않는다. 2KB 본문 한도와 전체 데이터 fetch 25초 제한, no-store 응답을 사용한다. taste_summary_context의 최근 200개 확정 감각 근거와, owner 전체 기록의 제품 정체성을 구분한다. 이전 200개 밖의 이미 마신 제품도 제외한다. 전체 이력을 cursor로 읽되 인식한 32제품의 대표 정체성만 메모리에 보관한다.

제품은 출처 카탈로그 32개로 한정한다. 향은 다른 주종과 연결할 수 있으나 맛/질감/탄산/여운 선호는 같은 주종 근거만 사용한다. 상반된/부정 기록은 cautions에 남고 score가 0 이하면 가까운 취향으로 단정하지 않는다. 다른 제품 특징은 unconfirmedFeatures로 두며 취향이 반대라고 추론하지 않는다. 사진만 있거나 기록이 없으면 explore 상태로 제품 정보만 보여준다. 정확한 이름·주종·와인 빈티지 일치만 이미 마신 제품으로 분류하며 모름을 NV로 바꾸지 않는다.

결과 method=evidence-rules-v1, modelUsed=false다. 실제 Gemini 호출로 표기하지 않는다. AI 취향 요약 provider 설정과 독립적이다. product/source와 claim의 실제 record ID를 함께 반환한다. 전체 필터는 네 주종을 하나씩 먼저 배치해 새 주종도 둘러볼 수 있게 한다.

## 북마크

9번째 마이그레이션 drink_wishlist와 private.wishlist_operations를 추가했다. 별도 saved/revision 상태이며 테이스팅 기록/느낌 집계에 넣지 않는다. 사용자 직접 DML을 허용하지 않고 set_drink_wishlist RPC가 auth/active user/32제품 whitelist/operation ID/expected revision을 검증한다. 소유자만 상태를 읽고 다른 계정과 같은 product ID를 독립 저장한다.

같은 operation의 정확한 재시도는 원래 receipt를 반환하고 payload 변경은 거절한다. 저장 해제 후에도 revision tombstone을 남겨 오래된 작업이 재적용되지 않게 한다. receipt는 과거 작업의 결과이므로 후속 상태 변경 뒤 옛 receipt를 재조회해도 현재 상태를 덮어쓰지 않는다. 클라이언트는 receipt 확인 뒤 최신 wishlist를 다시 읽어야 한다. UI 연결과 로컬 pending mutation 복구는 후속 작업이다.

## 검증

- 전체 검사 229개 중 223 통과/실제 환경 전용 6 skip. PGlite DB invariant에 저장/해제·immutable receipt·stale revision·타인/직접 DML 차단·unknown 제품 거절을 추가했다.
- 실제 HTTP 5/5 통과: 초기 탐색, forged owner/잘못된 주종/과대 본문 거절, 동시 저장 한 번 반영, 북마크 후 기록 수 0 유지, 과거 제품+최근 200개 등 총 201기록 이력과 감각 추천, 다른 계정 정보 차단.
- iOS·Android native에서 Auth→실제 새 endpoint→근거→북마크/재시도/타인 차단과 기존 기록/메뉴 경로까지 각 16단계 통과: [iOS](next-drinks/ios-native.json), [Android](next-drinks/android-native.json). 지정 합성 계정 4개 정리.
- 원본 Deno check 통과. 로컬에는 9번째 migration을 `migration up --local`로 적용했으며 기존 DB reset은 하지 않았다.

## 디자인과 남은 작업

[Figma 원본/에셋](figma-reference/next-drinks/README.md)에 42/43/45/46 고해상도 코드·렌더와 원본 SVG 26개를 저장했다. 44 이유 화면은 Figma Starter MCP 호출 한도로 상세 원본/렌더를 확보하지 못했다. 파일 04 자체는 확인했으며 이전 보관 페이지를 가져오지 않았다.

UI 42–46·bookmark pending queue·기록 작성 prefill·이유 화면·앱 응답 검증을 연결해야 한다. 관리형 DB migration/새 function 배포는 아직 수행하지 않았다. 로컬 native API 확인은 관리형 로그인 UI E2E를 대신하지 않는다. 기존 클라이언트의 비활성 CTA를 완료된 기능으로 보고하지 않는다.

## 앱 응답 계약 후속

`src/features/discovery/contract.ts`는 catalog version/method/모델 미사용 여부와 실제 제품 전체 속성을 대조한다. 반환된 URL을 그대로 UI에 넘기지 않고 검증 후 로컬 카탈로그를 복제한다. 제품·북마크·근거의 중복, 누락된 근거 ID, 다른 주종의 비향 감각 연결, 반대 평가 연결, 상충/미확인 특징 및 score 불일치를 거절한다. JSON 객체의 키 순서 변화는 허용한다. 감각 답변 자체의 진위는 인증된 서버 분석 책임이며, 클라이언트가 소유권이나 원 답변을 재검증했다고 주장하지 않는다.

`loadDiscovery`는 기존 owner 고정 JWT client와 30초 요청 제한을 사용하며 응답 검증을 통과한 결과만 반환한다. 실제 HTTP 테스트가 빈 탐색 및 201개 기록의 실제 endpoint 응답을 이 계약에 통과시킨다. DB의 consumed_at은 날짜 전용 문자열이 아닌 timezone 포함 timestamp로 올 수 있어 둘 다 수용한다. 화면 및 durable bookmark 연결은 아직 미완료다.
