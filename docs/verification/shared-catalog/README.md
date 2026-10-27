# 공통 카탈로그 기반 · #175

기존 32제품의 ID/판본/특징/출처를 product_catalog의 document에 보존하고 family_id로 제품군을 구분한다. 공통 drinks UUID 테이블은 기존 개인 술장 FK 때문에 유지하며, product_catalog는 추천 제품의 기존 문자열 ID와 동적 판본을 위한 저장소다. 개인 기록이나 추천 이유를 넣지 않는다.

- candidate/verified/held. 검증 완료 제품만 활성 인증 사용자 읽기 가능. 익명 읽기/클라이언트 쓰기/후보 승격 금지.
- stage_catalog_candidate는 service_role 전용이며 후보로만 제안한다. 이미 있는 ID는 자동 병합/덮어쓰기/승격하지 않는다. 제품 식별 충돌은 후속 검토 대상이다.
- 저장 목록의 고정 32개 CHECK를 제품 FK로 바꾸고 기존 ID/멱등 영수증을 유지한다. 새 저장은 verified만, held 제품의 기존 저장 해제는 허용한다. 과거 성공 영수증 재생이 최신 상태를 뒤집지 않는다.
- 새 provider/transport 입력의 이름·판본·별칭·특징·날짜·공개 HTTPS 출처 URL은 catalog-contract에서 검증한다. 형식 통과는 사실 검증이나 출처 지지를 뜻하지 않는다. URL 검사는 서버 fetch 허가가 아니며 검색 출처/리다이렉트 검증은 #171 범위다.

이번 단계는 DB 기반과 보호 규칙이다. 다음 한 잔은 후속 변경에서 [동적 추천·저장·기록 연결](../dynamic-discovery/README.md)을 추가했다. 메뉴판은 아직 정적 제품 배열을 사용한다. 120제품군 추가와 Gemini 탐색·주간 생성은 미완료다. 이슈 #175는 열어둔다.

## 검증 · 2026-10-27

PGlite 32개 중30통과·동시성2제외. 별도 생성한 임시 PostgreSQL DB에서 실제 migration replay 후32/32통과(임시 DB 정리 완료). 로컬 서비스에 새 마이그레이션을 추가 적용한 뒤 실제 Auth/Storage/메뉴/다음 한 잔/4주종 노트 저장 HTTP7/7통과. 기존 공유 로컬 DB에 고정 fixture ID가 있어 직접 DB suite가 중복키로 실패했으며, 기존 fixture를 삭제하지 않고 별도 DB로 검증했다. 관리형 개발 서버에 마이그레이션을 적용하고 합성 임시 계정으로 읽기·후보 격리·북마크 경계를 확인했다.
