# 원문 대조·관리자 조사 배포 · #171

관리자 전용 product-research 함수로 호출 예약→검색→특징 추출→제조사 원문 대조를 연결했다. 일반 앱 사용자·공개 키는 접근할 수 없다. 관리형 환경에서는 별도 MOGEUM_RESEARCH_ADMIN_SECRET을 서버 secret으로 등록하며 앱·공개 저장소에 넣지 않는다. 로컬 시험은 기존 service-role secret fallback을 사용한다. 서버 DB SDK는 서버 내 service role만 사용한다.

원문 조회 허용 목록은 기존 검토된 seed 제품의 제조사 origin을 코드에서 도출한다. 모델이 origin을 추가하지 못한다. HTTPS 공개 URL·정확한 origin을 확인하고 최대2회 redirect에도 매번 재검사한다. 8초·512KB·HTML/일반 텍스트만 읽는다. 스크립트/스타일/주석은 제외한다. 외부 요청에는 인증·쿠키를 보내지 않는다. 모델이 붙인 인용의 실제 원문 포함 여부를 identity/특징별로 기록한다. quote-matched도 **reviewRequired=true / verified=false**이며 자동 카탈로그 승격은 없다.

## 실제 개발 호출 · 2026-10-28

mogeum-dev에 호출 예산 migration과 관리자 함수를 배포했다. 실제 공개 제품명4종 요청은 실패했다. 별도의 글렌피딕12 요청에서 Google provider의 HTTP429를 확인했다. Google Search 성공·출처 정확도·비용을 검증했다고 주장하지 않는다. 할당량 항목/과금 설정은 아직 확인하지 않았으며 결제·요금제를 변경하지 않았다. 최초401은 관리형 service-role 환경값과 운영 호출 키가 달라 발생했고 전용 운영 키를 서버에 분리해 해결했다. 실제 사용자 기록은 모델에 보내지 않았다.

이후 provider429에서 예약을 실패 처리하고 전체 조사에15분 backoff를 적용한다. 캐시는 계속 읽고 신규 제품명으로 우회해도 모델을 호출하지 않는다. 서비스 전용 pause RPC는60~3600초만 허용하고 일반 클라이언트는 실행하지 못한다. 공급자 backoff는 앱 요약의 하루5회 제한과 별개다.

검증: 타입·린트·단위427통과/환경13제외, 실제SDK fake429의1회 요청·lease 정리·공유 pause1/1통과, 실제 로컬 Auth/DB/Storage HTTP9/9통과. 사용자 토큰/공개 키/누락 키 거부와 관리자 잘못된 입력의 모델 호출 전 거부 포함. 실제 네이티브 추천 UI·성공한 미등록4주종 Gemini E2E·검토 승격은 남아 있다.

AI Studio에서 Mogeum Dev 무료 등급을 확인했고, [공식 요금표](https://ai.google.dev/gemini-api/docs/pricing)상3.5 Flash-Lite 검색은 무료 등급 미제공임을 확인했다. 일반 요약 GEMINI_MODEL과 검색 전용 MOGEUM_RESEARCH_MODEL을 분리하고 검색 기본값을2.5 Flash-Lite로 설정했다. 후자는 공식 표상 무료 검색 지원 모델이며 실제 성공 여부는 backoff 종료 후 별도 검증한다. 유료 전환/결제 설정은 변경하지 않았다.

## 2026-10-28 실제 재검증

검색 모델2.5 Flash-Lite는 관리형 API에서404를 반환했다. 무료 검색 지원 표만으로 해당 프로젝트의 모델 사용 가능 여부를 보장할 수 없었다. 검색 모델 기본값을 제거하고 MOGEUM_RESEARCH_MODEL을 명시적으로 설정해야 호출하도록 변경한다. 모델 미설정은503 AI_NOT_CONFIGURED이며 예산 예약/모델 호출 전에 종료한다. 공급자404는 RESEARCH_MODEL_UNAVAILABLE로 구분하고 실패 lease를 정리하며 자동 모델 전환/재시도는 하지 않는다. 실제 검색 성공으로 처리하거나 후보를 verified로 승격하지 않았다. 결제 설정은 변경하지 않았다.

Deno SDK transport 테스트:429 공유 대기와404 단일 호출/lease 정리2/2통과. iOS26.5 시뮬레이터에서 공통 삭제 확인창 표시와 취소 복귀를 확인했다. 실제 삭제는 실행하지 않았다. 키보드 테스트는 입력 전달까지 추가 확인이 필요하다.
