# 데이터 모델

이 문서는 설계 계약이며 실행 가능한 마이그레이션이 아니다. 구현 시 enum·제약·인덱스·RLS와 실제 migration을 함께 확정한다. 기본 시간은 timestamptz, ID는 UUID다. 사용자 입력을 공통 제품의 검증된 정보로 자동 승격하지 않는다.

## 핵심 테이블

| 테이블 | 주요 필드·규칙 |
|---|---|
| profiles | id=auth user, display_name, created_at. 필요한 정보만 보관 |
| drinks | canonical_name, category, producer, aliases, verified identity. 공통 제품 단위 |
| drink_profiles | drink_id, version, structured descriptors, source_url, source_kind, fetched_at, verification_status. 원문과 정규화 특징 구분 |
| tasting_records | user_id, drink_id nullable, entered_name nullable, category nullable, consumed_at, revisit nullable, note nullable, revision, operation_id unique per user |
| record_photos | user_id, record_id, storage_path, width, height, sort_order, upload_status |
| record_sensations | record_id, dimension, descriptor_code, perceived=true, sentiment=liked/disliked/neutral/unknown. 단순 지각과 선호 분리 |
| taste_summaries | user_id, input_revision, schema_version, summary_json, model metadata, created_at, status |
| taste_summary_evidence | summary_id, claim_id, record_id, record_revision, descriptor reference. 주장별 근거 |
| menu_sessions | user_id, revision, status, created_at, expires_at/retention policy later. 한 번의 여러 장 추천 |
| menu_photos | session_id, user_id, order, storage_path, canonical width/height, image_revision, upload/ocr/parse status, error_code |
| ocr_runs | photo_id, image_revision, engine/model/version, schema_version, raw blocks/lines/polygons, created_at. 재시도 이력 |
| menu_items | session_id, raw_name, normalized_name, category nullable, amount_value/unit nullable, price_value/currency nullable, drink_id nullable, identity_status, correction_revision, user_confirmed_at |
| menu_item_sources | menu_item_id, photo_id, image_revision, line_ids, polygon. 중복 메뉴도 여러 사진의 출처 유지 |
| menu_recommendations | session_id, input_revision, taste_revision, status, result_json, model/prompt/schema metadata, created_at |
| recommendation_evidence | recommendation_id, item_id, record_id or drink_profile_id, claim_id, relation=similar/different/uncertain |
| analysis_jobs | user_id, session/photo/ref, operation, input_revision, idempotency_key, status, attempts, error_code, lease/updated_at |

## 반드시 유지할 관계

사진만으로 저장할 때 drinks 연결, 이름, 질문 답변, revisit는 필수가 아니다. 반복해서 마시면 동일 drink_id에 tasting_records를 추가하고 기존 느낌을 덮어쓰지 않는다. 술장 제품별 그룹과 경험별 이력을 별도 조회할 수 있어야 한다. 이름 미확정 기록끼리는 단순 문자열 일치로 무조건 합치지 않는다.

메뉴는 **공통 제품 drinks**, **판매 항목 menu_items**, **원본 위치 menu_item_sources**를 구분한다. 같은 제품이라도 30ml/보틀은 별도 판매 항목이다. 용량 미상, 가격 불일치, edition 불명은 자동 중복 처리하지 않는다. 이름만 같은 보통명사 메뉴는 identity_status=needs_confirmation이다.

메뉴판 사진을 재촬영하면 image_revision이 바뀐다. 이전 OCR 좌표를 새 사진에 적용하지 않는다. 메뉴 수정·사진 추가/삭제 시 session.revision을 증가시키고 이전 추천을 stale로 표시한다. 기록 수정·삭제는 사용자 취향 input_revision에 반영한다. 실행 중 오래된 작업이 끝나도 최신 결과를 덮어쓰지 못하게 조건부 갱신한다.

## 권한

사용자별 테이블과 파일은 user_id=auth.uid() 기준 읽기·쓰기. 자식 FK가 다른 사용자 데이터에 연결되지 않게 FK 관계와 정책을 함께 검증한다. 공통 drinks/profiles는 읽기 범위와 서버 쓰기 권한을 분리한다. menus와 AI 결과는 기본 비공개이며 공개 피드는 만들지 않는다. 계정 삭제 시 DB·Storage·분석 작업·서드파티 보관 대상의 처리 정책을 정하고 검증한다.

## 인덱스와 상태

술장 user_id+consumed_at, drink_id별 이력, session_id별 메뉴/사진, status+updated_at별 작업을 우선 고려한다. JSON에 모든 관계를 숨기지 않고 근거·출처를 FK로 추적한다. job 상태는 queued/running/succeeded/failed/cancelled, 추천은 stale을 추가한다. 삭제·취소된 사진이 전체 메뉴 재집계에서 빠지는 것을 확인한다.
