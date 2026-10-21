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

## 기록 저장 RPC v1 (구현됨, 앱 연결 전)

모두 authenticated JWT/RLS 범위에서 실행하는 SECURITY INVOKER 함수다. userId 인자를 받지 않으며 `auth.uid()`를 사용한다.

- `create_tasting_record(p_operation_id uuid, p_record jsonb, p_entry_id uuid|null)` → `{recordId, cellarEntryId, revision, replayed}`. entryId가 없으면 별도 항목을 만들고, 있으면 소유한 기존 항목에 경험을 추가한다. 같은 operation ID/같은 입력 재시도는 같은 기록을 반환한다. 다른 입력에 같은 ID를 재사용하면 23505. 동시 호출은 사용자+operation 단위 transaction advisory lock으로 직렬화한다.
- p_record: enteredName/category/consumedAt/revisit/rating/vintageStatus/vintageYear/photo만 허용. category=`whisky|wine|beer|traditional|other`, revisit=`again|okay|not_for_me`, vintageStatus=`year|nv|unknown`. nullable 평가/주종/빈티지와 생략된 값을 구분한다.
- photo=`{storagePath,width,height}`. Storage API로 먼저 비공개 record-photos에 올린 뒤 존재하는 자기 경로를 연결한다. `userId/records/operationId/photoId.ext` 경로를 사용하고 재시도 시 기존 파일을 덮어쓰지 않는다.
- `update_tasting_record(p_record_id,p_expected_revision,p_patch)` → 최신 record row. enteredName/category/consumedAt/revisit/rating/vintageStatus/vintageYear만 수정한다. 소유자·operation ID·생성 payload는 바꾸지 못한다.
- `move_tasting_record(p_record_id,p_entry_id,p_expected_revision)` → 최신 record row. 소유한 대상 항목으로 원자 이동하고 대표 사진 참조를 정리한다.
- 잘못된 입력 22023, 권한/없는 소유 기록 42501, FK 23503, 무결성 23514, 오래된 revision 40001. 앱은 40001을 무조건 재저장하지 않고 새 기록을 불러온 뒤 사용자 수정과 비교해야 한다. SQLSTATE/HTTP 상태는 동일한 개념이 아니다.
- `cellar_overview` → id/user_id/drink_id/display_name/category/record_count/last_consumed_at/revisit/photo_path. 정렬·페이지 조회를 앱에서 지정하고 photo_path는 필요할 때만 짧은 signed URL로 바꾼다.

operation ID와 최초 입력은 응답 유실 시에도 바꾸지 않는다. 기록을 삭제한 뒤 도착하는 오래된 생성 요청을 막는 삭제 tombstone/operation 보존 정책은 후속 보강 대상이다. 이 단계는 실제 로그인/사진 API 업로드/앱 저장 완료를 뜻하지 않는다.
