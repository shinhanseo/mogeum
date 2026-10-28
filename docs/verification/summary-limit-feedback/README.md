# 취향 요약 한도 안내 구분 · 2026-10-28

기존 서버는 하루5회 시도와20초 간격을 모두 limited로 반환해 실제 횟수가 남아 있어도 ‘오늘 요약 횟수를 모두 썼을 수도’ 문구가 나왔다. begin_taste_summary의 조회/캐시/진행 lease/일일5회 시도 예산을 유지하면서 daily-limit와cooldown을 구분한다. 날짜는 서버 로컬 설정에 의존하지 않고 UTC 일자를 명시한다. 한국 시간 오전9시에 새 UTC 날짜가 시작한다. 실패 시도도 예산에 포함하는 기존 정책은 유지한다.

새 handler는 SUMMARY_DAILY_LIMIT/다음UTC자정까지 retryAfterSeconds, SUMMARY_COOLDOWN/20초, 실제 provider429의 AI_PROVIDER_LIMITED/60초를 구분한다. 공급자 오류 원문은 반환하지 않는다. 구버전 migration의 limited도 RATE_LIMITED로 계속 지원하며 새 앱은 이 경우 하루 한도를 추측하지 않는 일반 대기 문구를 사용한다. 기존 저장 기록/요약/캐시를 지우지 않는다.

단위429통과/환경13제외. PGlite 실제 전체 migration에서 cooldown·daily-limit·UTC 다음 날짜의daily_calls1 초기화·사용자 RPC 차단 검증,30통과/동시성2제외. 별도로 만든 임시 PostgreSQL DB에서도 전체 migration replay 후32/32통과했고 해당 임시 DB를 정리했다. 관리형 mogeum-dev에 새 handler 배포 후 20261028020000 migration 적용을 완료했다. 기존 기록/요약은 변경하지 않았다. 실제 네이티브 오류 상태 캡처는 아직 남아 있다. 배포 중 기존 limited도 호환 처리한다.
