# 기록 저장 복구와 사진 경로 검사

기록 저장/사진 교체의 native 준비 사진은 정확히 현재 documentDirectory/record-drafts/<operation UUID>.jpg만 허용한다. 폴더 접두사만 같은 다른 operation·부모 경로·percent-encoded 경로·외부 파일·원격 URL은 복구/업로드에서 거절한다. Web은 크기가 제한된 JPEG data URI만 허용한다. 완료 정리는 호출자가 넘긴 URI 대신 현재 저장된 요청에서 검증된 URI를 사용한다.

기본 기록 pending 복구에는 operation/owner/연결 ID, 사진의 owner+operation storagePath와 크기, 저장 receipt의 ID/revision 형식 검사를 추가했다. null storage만 빈 상태이며 빈 문자열/손상된 JSON은 실패다. 손상된 요청은 저장소에서 지우거나 새 요청으로 덮어쓰지 않는다. 이미 저장된 receipt가 있다면 로컬 사진 포인터가 없어도 기존 저장 결과를 복원할 수 있다. 사진 교체 pending도 현재 sandbox/operation 경로를 확인하고 빈 문자열을 정상 빈 상태로 취급하지 않는다.

npm 도메인 검증에 정상 draft/receipt/이름만 기록, 다른 파일/경로 탈출/다른 sandbox, 소유자·storagePath·크기·ID·손상 JSON, Web URI 제한 회귀 4개를 추가했다. 기존 응답 유실·재시도·사진 교체·소유자 전환 테스트와 함께 실행한다. 이것은 실기기 파일 강제 손상·재설치 후 sandbox 경로 이동·실제 계정 사진 저장 E2E를 완료한 것은 아니다. DB RLS/저장 RPC 권한 규칙은 변경하지 않았다. 기존 UI·디자인 변경 없음.
