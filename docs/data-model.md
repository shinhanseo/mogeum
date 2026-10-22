# 데이터 모델

기록 저장 기반은 `supabase/migrations/20261021090000_record_foundation.sql`과 `20261021091000_record_transactions.sql`로 구현했다. 메뉴·추천·AI 근거 테이블은 아래 설계 계약이며 아직 마이그레이션이 없다. 기본 시간은 timestamptz, ID는 UUID다. 사용자 입력을 공통 제품의 검증된 정보로 자동 승격하지 않는다.

## 핵심 테이블

| 테이블 | 주요 필드·규칙 |
|---|---|
| profiles | user_id=auth user, display_name, created_at. 필요한 정보만 보관 |
| user_settings | user_id, last_note_mode. 기존 개별 노트 모드와 독립 |
| cellar_entries | 사용자 술장 항목. drink_id nullable, display_name/category, 대표 사진. 이름 unique/자동 병합 없음 |
| drinks | canonical_name, category, producer, aliases, verified identity. 공통 제품 단위 |
| drink_profiles | drink_id, version, structured descriptors, source_url, source_kind, fetched_at, verification_status. 원문과 정규화 특징 구분 |
| tasting_records | user_id + cellar_entry_id 복합 FK, entered_name/category/revisit/rating nullable, consumed_at, vintage_status/year, revision, operation_id unique per user. 공통 drink_id는 술장 항목을 통해 연결 |
| record_notes | record_id별 현재 mode/catalog_version, input_revision, 생성 초안·생성 입력 revision, 확정 노트·직접 편집 여부. 생성 필드는 클라이언트 쓰기 금지 |
| record_answers | record_id/mode/catalog_version/question_id, unanswered/skipped/unknown/none/answered, descriptor_codes, intensity, free_text. 모드별 원본 답변 보존 |
| record_drafts | user_id, record_id nullable, mode/schema_version, JSON payload. 앱의 로컬 draft 복구는 별도 미구현 |
| photo_deletion_jobs | DB 사진 메타데이터 삭제 시 서버용 삭제 작업 보관. 실제 Storage 삭제 worker는 후속 작업 |
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

## 구현한 불변 조건

- 저장된 경험은 반드시 소유한 술장 항목에 속한다. `cellar_entries → tasting_records → record_photos/record_notes/record_answers/record_drafts`는 user_id를 포함한 복합 FK로 연결한다.
- 대표 사진은 같은 사용자의 같은 술장 항목에 속한 사진이어야 한다. 기록/사진 이동 및 삭제 시 이전 대표 참조를 정리한다. `cellar_overview`는 security-invoker view이며 기록이 없는 항목은 숨긴다.
- 새 기록은 create RPC에서 사진 또는 이름이 있어야 한다. 평가 nullable은 과거/사진만 기록의 호환 계약이다. 정상 앱 기본 평가 필수와 별점 선택 규칙은 앱 연결 단계에서 추가 검증한다.
- 빈티지는 wine에만 가능하다. year는 실제 4자리 입력을 앱에서 받으며 DB 범위는 1–9999, NV/모름에는 연도를 넣지 않는다. DB 허용 범위와 앱 입력 UI를 혼동하지 않는다.
- 노트 모드의 단일 원본은 record_notes.mode다. 기본 기록에 중복 mode 필드를 두지 않는다. 질문 catalog별 세부 값 검증·모드 전환 로직·AI 생성 결과의 CAS 적용은 #6/#27 후속 구현이다.
- 기록과 노트/답변/사진의 변경은 기록 revision을 증가시킨다. 기본 수정/이동 RPC는 expected revision이 맞을 때만 반영한다.
- 이미지 업로드와 DB 저장은 하나의 트랜잭션이 아니다. 업로드 후 메타데이터 확인, DB 실패 시 파일 보상 삭제, 삭제 작업 재시도, 주기적 고아 파일 점검이 필요하다. 현재 DB 삭제 작업 생성까지만 구현했고 실제 worker/API 검증은 남아 있다.

## 노트 v2 확정 상태 · 2026-10-22

record_notes의 last_operation_id/last_save_payload는 응답 유실 재시도 식별자다. confirmed_input_revision은 확정 문장에 대응하는 답변 revision이다. generated_draft는 서버 AI 출력 전용으로 유지하고, 현재 결정적 템플릿은 사용자가 확인한 confirmed_note에 저장한다. record_answers/record_notes의 일반 클라이언트 직접 쓰기는 철회하고 save_tasting_note RPC로 원자 확정한다. 기존 답변을 앱으로 읽을 때 question ID/모드/카탈로그 버전을 사용한다.

### 반복 경험 연결 구현

개인 cellar_entries의 소유권 조회 후 새 operation ID/새 tasting_records ID를 생성하면서 기존 cellar_entry_id를 전달한다. 이름 일치 자동 병합이나 공통 drinks 등록은 필요 없다. 과거 record_photos/record_notes/record_answers를 새 record ID로 복제하지 않는다. DB 변경 없이 기존 소유권 검사·복합 FK·operation payload 비교를 사용한다.
