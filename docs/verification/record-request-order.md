# 저장 대기 요청과 정리의 동시 실행

기존 submit 로직은 저장소에 다른 operation이 있으면 거절하지만 read→write가 분리돼 있었다. 두 화면이 동시에 빈 저장소를 읽으면 다른 요청을 덮어쓸 수 있었고, 완료 정리의 read→remove 사이에도 새 요청이 들어올 수 있었다.

native 기록 저장은 owner별, 사진 교체/이동은 owner+record별로 read/submit/finish를 같은 프로세스 큐에서 직렬화한다. submit 내부 저장소 조회는 큐에 다시 들어가지 않도록 내부 read를 사용한다. 대기 후에도 원래 계정과 세션을 확인하고 기존 payload/operation/receipt 검사를 유지한다. 다른 owner/record의 요청은 서로 막지 않는다. 큐 오류는 이후 같은 작업의 재시도를 영구 차단하지 않는다.

프로세스 큐는 DB 트랜잭션이나 앱 강제 종료 복구를 대체하지 않는다. 재시작 시 기존 AsyncStorage pending과 서버 idempotency 계약으로 복구한다. 이미지 준비 작업 자체, 다른 앱 프로세스, 원격 세션 간의 동시 편집은 이 큐의 범위가 아니다. UI/DB 변경 없음.

`npm run check`: 273개 중 267 통과, 환경 의존 6개 skip. `record-request-order.test.ts`는 지연된 저장·업로드와 실제 submitPending/submitAttachment를 조합해 서로 다른 동시 요청 차단, 같은 교체 요청의 단일 업로드·mutation, 완료 정리 뒤 새 요청 유지, 실패 후 복구와 다른 계정 독립 실행을 확인한다. 여러 네이티브 작성 화면을 실제로 동시에 열어 시험한 결과는 아니다.
