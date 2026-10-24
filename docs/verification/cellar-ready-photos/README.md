# 술장 대표 사진 가용성

`cellar_overview`가 `missing` 상태인 지정 대표 사진을 그대로 반환하는 실패를 신규 회귀 테스트로 재현한 뒤 수정했다. 지정 대표와 대체 사진 모두 같은 사용자·술장에 연결된 `ready` 사진이어야 한다. 지정 대표의 선택 자체는 보존한다.

검증한 경우: 정상 지정 대표 우선, 지정 대표 missing 시 정상 사진 대체, 모든 사진 missing 시 null과 기록 2회 유지, 지정 대표 ready 복구, 대표 미지정·최근 사진 missing 시 과거 ready 선택, 타 사용자 조회 차단.

- `npm run check`: 282 tests / 276 pass / 6 환경 의존 skip; 타입·린트·테이스팅 계약 통과.
- PGlite DB: 26 tests / 25 pass / 동시 세션 1 skip.
- 실제 로컬 PostgreSQL: 26/26 pass (동시 요청 포함).
- `supabase migration up --local`: 10번째 migration만 추가 적용. 데이터 초기화 없음.
- 화면 구조·사진 비율·디자인 변경 없음. 새 네이티브 시각 검증이나 실제 파일의 자동 누락 탐지는 수행하지 않았다.
- 관리형 Supabase 프로젝트에는 이번 migration을 적용하지 않았다.
