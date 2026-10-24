# 기록 저장 복구와 사진 경로 검사

기록 저장/사진 교체의 native 준비 사진은 정확히 현재 documentDirectory/record-drafts/<operation UUID>.jpg만 허용한다. 폴더 접두사만 같은 다른 operation·부모 경로·percent-encoded 경로·외부 파일·원격 URL은 복구/업로드에서 거절한다. Web은 크기가 제한된 JPEG data URI만 허용한다. 완료 정리는 호출자가 넘긴 URI 대신 현재 저장된 요청에서 검증된 URI를 사용한다.

기본 기록 pending 복구에는 operation/owner/연결 ID, 사진의 owner+operation storagePath와 크기, 저장 receipt의 ID/revision 형식 검사를 추가했다. null storage만 빈 상태이며 빈 문자열/손상된 JSON은 실패다. 손상된 요청은 저장소에서 지우거나 새 요청으로 덮어쓰지 않는다. 이미 저장된 receipt가 있다면 로컬 사진 포인터가 없어도 기존 저장 결과를 복원할 수 있다. 사진 교체 pending도 현재 sandbox/operation 경로를 확인하고 빈 문자열을 정상 빈 상태로 취급하지 않는다.

npm 도메인 검증에 정상 draft/receipt/이름만 기록, 다른 파일/경로 탈출/다른 sandbox, 소유자·storagePath·크기·ID·손상 JSON, Web URI 제한 회귀 4개를 추가했다. 기존 응답 유실·재시도·사진 교체·소유자 전환 테스트와 함께 실행한다. 이것은 실기기 파일 강제 손상·재설치 후 sandbox 경로 이동·실제 계정 사진 저장 E2E를 완료한 것은 아니다. DB RLS/저장 RPC 권한 규칙은 변경하지 않았다. 기존 UI·디자인 변경 없음.

## iOS 앱 컨테이너 변경 후 복구

기록 저장 대기 및 사진 교체 요청은 알려진 iOS Documents 경로에서 컨테이너 UUID만 바뀐 경우, 동일 operation 파일을 현재 Documents 경로로 정규화한다. 다른 기기/시뮬레이터 루트, 다른 operation, 임의 폴더, query/encoded 경로는 계속 거절한다. 이전 컨테이너를 읽거나 파일을 복사하지 않는다. 현재 파일이 실제로 없으면 기존 파일 읽기 오류로 남으며 새 사진으로 위장하지 않는다.

읽기만으로 원본 JSON을 다시 저장하지 않는다. 저장 직전에도 정규화된 반환값을 사용하므로 업로드와 재시도 identity 비교에 이전 경로가 남지 않는다. operation ID, owner, remote storagePath, 서버 요청 내용, expectedRevision 및 저장 receipt는 변경하지 않는다. 완료 정리는 현재 저장 요청의 검증된 현재 경로만 사용한다.

`tests/record-container-restore.test.ts`의 3개 회귀는 원본/receipt 보존, 경로·소유자 격리, 사진 교체 재시도의 단일 업로드·단일 mutation을 검증한다. `npm run check`: 264개 중 258 통과, 환경 의존 6개 skip. iOS·Android 네이티브에서 합성 사진의 preparePhoto → AsyncStorage 보관 → 기록/교체 decoder → 현재 파일 읽기와 원본 JSON 보존을 추가 확인했다. iOS의 이전 컨테이너 URI는 합성한 값이며 실제 재설치 시험은 아니다. 인증 후 서버 저장 E2E는 이번에 새로 실행하지 않았다. [네이티브 결과](record-container-restore/README.md). 메뉴판의 실제 보존된 iOS 초안 복구는 [별도 검증](menu-container-restore/README.md)에 있다.

## 완료 receipt가 있는 이전 화면의 재시도

`submitPending`은 같은 owner/operation/entry/input인지 검사한 뒤, 저장소에 이미 존재하는 완료 receipt를 먼저 사용한다. 화면에 남은 이전 pending 객체로 완료 receipt를 덮어쓰거나 사진 업로드/RPC를 반복하지 않는다. 조회 중 계정이 바뀌면 완료 결과도 반환하지 않는다. 변경된 payload는 완료 receipt가 있더라도 거절한다.

`tests/pending.test.ts`의 2개 회귀로 오래된 화면 상태의 재시도, 원본 receipt 보존, 업로드/RPC/쓰기 0회, 계정 변경 차단을 확인했다. `npm run check`: 266개 중 260 통과, 환경 의존 6개 skip. 이 추가 변경은 UI·DB 스키마 변경이 없으며 네이티브에서 응답 유실 상황을 새로 강제한 시험은 아니다.
