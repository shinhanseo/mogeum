# 서버 API와 OCR 계약 v0

구현 전 제안 계약이다. 부트스트랩 이후 src/contracts와 서버에서 런타임 schema를 공유 또는 동기화한다. 일반 기록 CRUD는 Supabase SDK/RPC를 쓰며 아래는 논리적인 Edge Function 작업 이름이다. 실제 URL은 `/functions/v1/<function-name>` 패턴으로 구현 시 확정한다.

## 공통

Authorization Bearer JWT 검증 필수. 클라이언트가 body의 userId로 타인 데이터를 요청할 수 없다. 요청은 schemaVersion과 operationId/idempotencyKey를 가진다. 오류는 code, 사용자 메시지, retryable, 관련 photoId를 포함한다. 내부 키·stack trace는 응답하지 않는다. 재시도는 같은 입력 버전에서 중복 결과를 만들지 않는다.

| 작업 | 입력 | 출력 |
|---|---|---|
| taste-summary | inputRevision | status, summaryId/jobId, claims와 evidence recordIds |
| menu-parse | sessionId, sessionRevision, photoId, imageRevision, OCR document | job/result, 구조화 메뉴, missingFields, original sources |
| confirm-menu | sessionId, expectedRevision, 수정 menuItems | 최신 revision, 확정 메뉴. 가격/용량 검증 |
| recommend-menu | sessionId, expectedMenuRevision, tasteRevision | result/jobId, item별 identity, similar/different, evidence, source references |
| analysis-status | jobId | owner-scoped 상태·부분 결과·retryable error |

추천 endpoint는 현재 세션의 실제 menu_item ID만 반환할 수 있다. 처리 중 입력이 바뀌면 오래된 결과를 stale로 반환하고 최신 입력을 덮어쓰지 않는다. 초기 응답이 길어지면 202 + jobId로 돌려주고 앱은 서버 상태를 조회한다. HTTP 응답과 실제 작업 완료를 구분한다.

## OCR 문서

```json
{
  "schemaVersion": "ocr.v1",
  "sessionId": "uuid",
  "photoId": "uuid",
  "imageRevision": 1,
  "engine": {"name": "candidate-engine", "modelVersion": "to-be-selected"},
  "image": {"width": 1200, "height": 1800, "orientation": "upright"},
  "lines": [
    {"id": "l1", "text": "Glenlivet 12", "polygon": [[0.1,0.2],[0.5,0.2],[0.5,0.23],[0.1,0.23]], "confidence": null},
    {"id": "l2", "text": "15,000", "polygon": [[0.7,0.2],[0.9,0.2],[0.9,0.23],[0.7,0.23]], "confidence": null}
  ]
}
```

좌표는 **저장된 upright 원본 이미지** 기준 0–1 정규화다. OCR 입력 resize/crop/rotate 좌표는 이 기준으로 되돌린다. 이미지 크기·버전·line ID는 필수다. 신뢰도를 제공하지 않는 엔진에는 null을 쓰며 임의의 숫자를 만들지 않는다. block/word 단위 정보는 선택 확장 가능. 한 줄 전체 텍스트만 보내 레이아웃을 잃지 않는다.

## 메뉴 항목

```json
{
  "id": "uuid",
  "name": "글렌리벳 12년",
  "serving": {"value": 30, "unit": "ml"},
  "price": {"value": 15000, "currency": "KRW"},
  "identityStatus": "verified",
  "drinkId": "uuid",
  "sources": [{"photoId": "uuid", "imageRevision": 1, "lineIds": ["l1", "l2"], "polygon": [[0.1,0.2],[0.9,0.2],[0.9,0.23],[0.1,0.23]]}]
}
```

이 값은 예시다. 가격이나 용량이 읽히지 않으면 null+missingFields로 남긴다. 사용자 수정은 별도 revision과 provenance=user_correction을 남긴다. source polygon이 없으면 원본 사진만 열고 위치를 지어내지 않는다.

## 추천 응답 원칙

kind=new/previously_liked/needs_confirmation, menuItemId, drinkProfileVersion, evidence recordIds+revision, similarFeatures, differentFeatures, unresolvedFields, explanation을 구분한다. unknown과 disliked는 다르다. 제품 특징의 출처와 사용자 근거는 각각 제공한다. 부정확한 적합도 백분율은 UI에 만들지 않는다. provider raw 응답은 이 계약을 통과해야 저장·표시한다.

## 기록 저장 RPC v1 (구현·앱 연결됨, 실제 소셜 로그인 검증 전)

모두 authenticated JWT/RLS 범위에서 실행하는 SECURITY INVOKER 함수다. userId 인자를 받지 않으며 `auth.uid()`를 사용한다.

- `create_tasting_record(p_operation_id uuid, p_record jsonb, p_entry_id uuid|null)` → `{recordId, cellarEntryId, revision, replayed}`. entryId가 없으면 별도 항목을 만들고, 있으면 소유한 기존 항목에 경험을 추가한다. 같은 operation ID/같은 입력 재시도는 같은 기록을 반환한다. 다른 입력에 같은 ID를 재사용하면 23505. 동시 호출은 사용자+operation 단위 transaction advisory lock으로 직렬화한다.
- p_record: enteredName/category/consumedAt/revisit/rating/vintageStatus/vintageYear/photo만 허용. category=`whisky|wine|beer|traditional|other`, revisit=`again|okay|not_for_me`, vintageStatus=`year|nv|unknown`. nullable 평가/주종/빈티지와 생략된 값을 구분한다.
- photo=`{storagePath,width,height}`. Storage API로 먼저 비공개 record-photos에 올린 뒤 존재하는 자기 경로를 연결한다. `userId/records/operationId/photoId.ext` 경로를 사용하고 재시도 시 기존 파일을 덮어쓰지 않는다.
- `update_tasting_record(p_record_id,p_expected_revision,p_patch)` → 최신 record row. enteredName/category/consumedAt/revisit/rating/vintageStatus/vintageYear만 수정한다. 소유자·operation ID·생성 payload는 바꾸지 못한다.
- `move_tasting_record(p_record_id,p_entry_id,p_expected_revision)` → 최신 record row. 소유한 대상 항목으로 원자 이동하고 대표 사진 참조를 정리한다.
- 잘못된 입력 22023, 권한/없는 소유 기록 42501, FK 23503, 무결성 23514, 오래된 revision 40001. 앱은 40001을 무조건 재저장하지 않고 새 기록을 불러온 뒤 사용자 수정과 비교해야 한다. SQLSTATE/HTTP 상태는 동일한 개념이 아니다.
- `cellar_overview` → id/user_id/drink_id/display_name/category/record_count/last_consumed_at/revisit/photo_path. 정렬·페이지 조회를 앱에서 지정하고 photo_path는 필요할 때만 짧은 signed URL로 바꾼다.

operation ID와 최초 입력은 응답 유실 시에도 바꾸지 않는다. 기록을 삭제한 뒤 도착하는 오래된 생성 요청을 막는 삭제 tombstone/operation 보존 정책은 후속 보강 대상이다. 이 단계는 실제 로그인/사진 API 업로드/앱 저장 완료를 뜻하지 않는다.

## 질문형 노트 저장 RPC v2 · 구현됨

`save_tasting_note(p_record_id uuid,p_operation_id uuid,p_expected_revision integer,p_mode note_mode,p_catalog_version integer,p_answers jsonb,p_note text,p_edited boolean)` → `{recordId,revision,replayed}`.

- catalogVersion은 2. 질문 ID/descriptor code/최대 선택 수/강도를 `private.tasting_catalog_v2()`의 동결한 카탈로그로 검사한다. 아로마 세부 향에는 해당 계열이 함께 활성화되어 있어야 한다. 와인 종류별 색과 관찰하지 않은 향 변화의 비활성 답변은 거부한다.
- p_answers 항목은 `{questionId,status,descriptorCodes,intensity,freeText}`. 생략/건너뜀/모름/없음/실제 강도 0은 별개다. 복합 질문의 각 감각은 `palate.sweet`, `palate.acid`처럼 개별 답변이다. 같은 질문 ID 중복을 거부한다.
- SECURITY DEFINER 함수는 `auth.uid()`와 활성 사용자·기록 소유권을 직접 확인하고 해당 기록을 FOR UPDATE로 잠근다. JWT 사용자 외의 userId를 받지 않는다. authenticated의 record_answers 직접 쓰기와 record_notes 직접 확정을 철회했다. RLS 읽기와 소유 기록 삭제 시 cascade는 유지한다.
- 같은 operation ID/동일 payload 재시도는 기존 결과, 같은 ID/변경 payload는 23505. 최신 revision과 다른 새 요청은 40001. 기존 마신 기록만 수정하므로 술장 항목/마신 횟수를 늘리지 않는다.
- 답변·확정 문장·직접 편집 여부·confirmed_input_revision·마지막 사용 모드를 한 트랜잭션에 보관한다. 비활성 모드의 기존 답변은 삭제하지 않는다. 빈 확정 문장은 저장하지 않는다.
- 앱은 기기에 저장 시도 ID와 원래 revision을 먼저 보관하고 응답이 불확실한 상태에서 다른 내용으로 덮어쓰지 않는다. 권한/충돌/연결 오류를 모두 성공처럼 처리하지 않는다. 충돌 후 최신 내용과 비교하는 UI는 후속이다.

`supabase/tasting-catalog-v2.json`과 마이그레이션 내 snapshot은 동일해야 한다. v2가 개발 DB에 적용되었으므로 기존 code의 의미를 바꾸려면 새로운 버전과 마이그레이션을 추가한다. `scripts/check-tasting-contract.ts`로 앱 정의·DB snapshot·마이그레이션의 일치를 읽기 전용으로 검증한다. 적용된 마이그레이션을 수정해 재배포하지 않는다.

### 반복 기록 클라이언트 계약

`/record?entryId=<개인 술장 UUID>`는 해당 사용자의 `cellar_entries`에서 id/display_name/category만 읽는다. 전역 drinks ID나 과거 record ID로 대체하지 않는다. 조회 실패는 작성 차단 상태이며 자동으로 새 술장 저장으로 전환하지 않는다.

기존 `create_tasting_record` RPC의 p_entry_id에 확인한 entryId를 전달한다. 로컬 PendingRecord v1에 선택적 entryId를 함께 영속화한다. 기존 v1 데이터의 entryId 미존재는 null(새 항목)로 호환한다. 같은 operation ID의 input뿐 아니라 entryId 변경/누락도 저장 재시도에서 거부한다. 이미 저장 중인 다른 작업이 있으면 그 작업의 payload와 연결을 복구한다. 노트 보충은 이 RPC가 아니라 기존 save_tasting_note 경로를 유지한다.

## 기본 정보 수정·삭제 · 2026-10-22

- `edit_tasting_record(p_record_id,p_expected_revision,p_patch)`는 기존 update RPC의 소유권/버전 검증을 재사용한다. 주종 변경은 답변 이관이 필요하므로 거부한다. 한 번만 기록한 술의 이름 변경은 술장 display_name과 원자 동기화하고, 여러 경험이 있으면 해당 경험 이름만 바꾼다.
- 앱의 이름/현지 날짜/재음용 의사/선택 별점/와인 빈티지 수정은 새 경험을 만들지 않는다. 40001은 최신 기록을 다시 확인하게 하고 자동 덮어쓰지 않는다. 네트워크 결과 미확인 상태에서는 수정/삭제의 원래 행동으로만 재시도한다.
- 개별 기록 삭제는 `tasting_records`의 JWT 소유자+id+revision 조건으로 실행한다. 0행 삭제 후 소유 기록이 여전히 있으면 충돌, 없으면 이미 삭제된 응답 유실 재시도로 처리한다. DB cascade는 해당 경험의 자식과 대표 사진 참조를 정리하고 binary 삭제 job을 남긴다.
- 앱의 사진 정리기는 로그인 사용자의 미완료 job을 최대 20개 읽고 Storage remove 후 `complete_photo_deletion(p_job_id)`를 호출한다. 이 definer 함수는 활성 사용자/작업 소유자/Storage 객체 부재를 다시 확인한 뒤에만 done 처리한다. 파일이 있으면 false, 남의 작업은 42501이다. 실패 job은 다음 술장 focus에서 재시도한다. 앱이 열리지 않거나 계정이 이미 삭제된 경우 처리하는 서버 worker는 후속이다.

삭제된 생성 요청 ID는 deleted_record_operations에 사용자별 ID·삭제 시각만 남긴다. create_tasting_record는 같은 advisory lock 아래 삭제 영수증을 검사하여 P0002를 반환하며 기록을 재생성하지 않는다. 앱은 그 오류의 기존 pending을 정리한다. 계정 제거 시 영수증도 cascade 정리한다. 이는 위 v1 설명의 tombstone 후속 항목을 구현한 것이다.

## 사진 교체·기록 이동 · 2026-10-23

- `change_record_attachment(p_record_id,p_operation_id,p_expected_revision,p_change)` → `{recordId,cellarEntryId,revision,replayed}`. 활성 JWT 소유자만 호출. private receipt로 동일 요청 재실행을 반환하며 operation 재사용/다른 payload는 23505, 최신 revision 충돌은 40001, 삭제는 P0002.
- photo: `{kind:'photo',storagePath,width,height}`. 먼저 소유자/records/operationId/photo.jpg에 새 파일을 업로드한다. 트랜잭션에서 첫 사진 metadata만 교체하고 대표 사진을 갱신한다. 기존 사진은 deletion job으로 정리하며 다른 첨부는 보존한다. 파일/입력 오류면 원래 사진을 포함해 rollback.
- move: `{kind:'move',entryId}`. 소유한 다른 술장으로 경험 한 건만 이동. split: `{kind:'split',name:null|string}`. 새 술장을 만들어 분리. 날짜/사진 경로/주종/평가/빈티지/확정 노트/답변은 변경하지 않는다. 다른 주종의 술장 선택 시 경고하고 원래 주종을 보존한다.
- 앱은 계정+기록별 immutable pending을 저장한다. 응답 유실 시 같은 업로드 경로/operation/expectedRevision으로 복구한다. 계정 변경 시 중단. 충돌이면 최신 내용 재조회 후 새로운 요청으로 진행한다. 정상 완료 뒤 상세를 재조회한다.
- record revision은 변경된다. AI 요약 증거 무효화 UI/서버는 AI 기능 구현 단계이며 이 RPC만으로 완료되었다고 보지 않는다.

## 내 기록 기반 취향 요약 v1 · 2026-10-23

- `taste_summary_context()`는 활성 JWT 소유자의 `{snapshot:{hash,records,totalRecords,omittedCount},cached,stale,running}`를 반환한다. hash는 모든 경험 ID/revision + taste-v1이며 상세 분석 입력은 최근 200개로 제한한다. 클라이언트는 사용자 ID/근거/완성 주장을 입력하지 않는다.
- `POST /functions/v1/taste-summary` body `{}`. 서명된 사용자 JWT를 `Auth.getUser(token)`로 검증한 뒤 자신의 context만 읽는다. 새 asymmetric JWT를 위해 legacy-secret gateway 검사를 사용하지 않으며 handler 인증은 필수다.
- 200 ready/insufficient, 202 running, 401 UNAUTHENTICATED, 409 STALE_INPUT, 429 RATE_LIMITED, 503 AI_NOT_CONFIGURED, 502 ANALYSIS_FAILED. 실패 응답에 provider 상세/메모/키를 포함하지 않는다.
- service_role만 `begin_taste_summary(owner,hash,lease)`/`finish_taste_summary(owner,hash,lease,result)` 호출 가능. 사용자는 private jobs/결과에 직접 쓰지 못한다. 서버 검증된 owner만 전달한다. 90초 lease, 20초 간격, 사용자별 하루 5회 획득 한도. 모델 자동 재시도 0, 호출 25초 timeout, 최대 출력 512 tokens.
- 같은 hash 캐시는 재사용한다. 현재 hash와 다른 결과는 반환하지 않고 이전 요약을 숨긴다. 생성 중 수정/삭제/이동되면 완료 결과를 거절한다. 소유자의 계정 삭제 시 cache도 cascade.
- AI는 코드 집계에서 검증된 feature ID 1–3개를 선정한다. 임의 문장/새 맛/타 기록 ID를 받지 않는다. 앱은 승인된 표현과 근거 기록으로 화면을 구성한다. 모델에 사진·이름·날짜·자유 메모·확정 원문·사용자 ID를 보내지 않고 고정 특징 ID/계열/횟수/다양성만 보낸다.

## 현재 연결된 메뉴 MVP API (evidence-rules-v1)

POST `/functions/v1/menu-recommend`, 검증된 사용자 Bearer JWT 필수. `{action:"parse", photos}`는 원본 OCR의 안정적인 photoId/imageRevision/lineId/정규화 polygon과 실제 confidence를 받아 확인 전 MenuItem을 반환한다. `{action:"recommend",photos,items}`는 확인 완료 메뉴만 받으며 현재 사용자 taste context로 비교한다. 응답은 recommendations, evidenceRecords(id/name/date/revision/category/revisit/noteText), tasteHash, recordCount, method, limitedCatalog다. 이 구현은 위의 전체 목표 계약 중 초기 연결이며 자동 병합/전체 카탈로그/LLM 설명 생성 완료가 아니다.

앱 입력과 서버 재검증 타입은 `supabase/functions/_shared/menu-domain.ts`가 기준이다. 사진 자체는 기기에 남고 원문 OCR과 수정 값은 별도 배열로 유지한다. 메뉴 저장 RPC `save_menu_session(p_id,p_revision,p_photos,p_items)`는 owner JWT, 5장/100항목 제한, optimistic revision, 동일 요청 재시도를 적용한다. 사진/메뉴 수정 후 결과를 버리고 재추천한다. 원본은 이 기기에서만 확인 가능하다.

### 메뉴 카탈로그 응답 호환성

`menu-recommend`의 parse와 recommend 응답에는 `catalogVersion`을 포함한다. recommend는 `catalogSize`도 포함한다. 앱의 PRODUCT_CATALOG_VERSION과 다르거나 필드가 없는 예전 서버이면 MENU_CATALOG_MISMATCH로 결과 노출을 중단한다. 기존 사진/수정 입력을 보관한다. 추천은 메뉴 집합·제품 후보·출처 특징·근거 ID·상태·점수의 교차 참조를 검사하고 잘못된 응답은 INVALID_MENU_RESULT로 거부한다. 소유권 판단은 계속 서버의 verified JWT/RLS에서 수행한다.

### 메뉴 로컬 복구와 저장 재전송

로컬 restore는 empty/ready/failed로 구분하며 failed를 새 세션으로 저장하지 않는다. 현재 메뉴의 낡은 제품 확인은 해제하되 pendingSave는 정확한 내용과 revision을 보존한다. save_menu_session transport의 productId는 bounded opaque ID이며 제품 확인 권한이 아니다. 추천 Edge는 현재 카탈로그/메뉴 이름 후보와 일치하지 않는 ID를 계속 거부한다. [복구 검증과 한계](verification/menu-recovery.md)를 참조한다.

메뉴 parse는 세션 전체에서 100개를 넘는 판매 항목이 나오면 HTTP 400 / MENU_ITEM_LIMIT를 반환한다. 일부 항목만 조용히 잘라 반환하지 않는다. 앱은 사진/OCR/이전 수정 입력을 유지하고 사진을 나눠 처리하도록 안내한다. 정확히 100개는 허용한다.

현재 OCR 엔진 허용 값은 `apple-vision-v1`, `apple-vision-v2`, `mlkit-korean-16.0.1`, `manual`이다. v2는 Vision 좌표를 adapter에서 이미지 경계로 clip하며 서버는 여전히 유한한 [0,1] 사각형 꼭짓점만 받는다. 관리형 함수에 허용 목록 변경을 배포하기 전에는 v2 입력 연결을 완료로 보지 않는다.

메뉴 Edge 요청 본문은 600,000 UTF-16 코드 유닛을 유지하며 stream 수신 중 검사한다. 바이트 상한은 선행 BOM을 포함해 1,800,003이다. 실제 body 한도 초과는 TOO_LARGE/413이고 기존 사진/메뉴 validation 코드는 유지한다. [검증](verification/menu-request-body.md).

## 메뉴 해석 geometry-v3

parse 응답의 parser는 geometry-v3다. 가격이 손상된 독립 OCR 셀은 금액으로 확정하지 않고 이름·lineIds·photoId·imageRevision을 보존한 `price: null`, `confirmed: false`, `productId: null` 후보로 반환한다. 금액 없는 카탈로그 이름 후보도 같은 상태로 남긴다. 제목/설명 등 모든 무가격 줄을 술로 확정하지 않으며 원문은 photos.lines에 유지한다. 클라이언트 수정은 원문을 덮어쓰지 않고, recommend는 사용자가 확정한 항목만 받는다. 버전별 실제 배포 상태는 docs/verification/menu-price-review.md를 따른다.
