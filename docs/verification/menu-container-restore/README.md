# iOS 컨테이너 변경 뒤 메뉴판 초안 복구

실제 보존된 iOS `menu-ocr-fixture`의 저장 URI는 이전 컨테이너 UUID를 가리켰고 JPEG는 현재 Documents 안의 동일 계정/세션/사진 ID/판본 경로에 존재했다. 기존 exact absolute URI 검사 때문에 파일 존재 확인 전에 복구가 실패했다.

`currentDocumentUri`는 현재 URI를 우선 허용한다. 현재 Documents가 알려진 iOS device/simulator 형태이면 **같은 device root의 앱 컨테이너 UUID만 다른** 이전 URI를 해당 파일의 현재 canonical 경로로 해석한다. 계정·세션·사진 ID·revision suffix가 하나라도 다르면 거부한다. 이전 컨테이너를 읽거나 복사하지 않고 현재 앱 Documents만 읽는다. arbitrary root, 다른 simulator device, cache, 외부URL, traversal·encoded path·query/fragment는 허용하지 않는다. 다른 플랫폼의 기존 exact 경로 검사는 유지한다.

이 로직은 JSON 파싱 결과의 로컬 URI만 정규화하며 저장된 원문을 읽기 중 덮어쓰거나 삭제하지 않는다. OCR·사용자 수정·pendingSave 요청/판본은 유지한다. 현재 canonical 위치에 실제 파일이 없으면 기존 missing-photo 상태를 유지하며 사진이나 OCR을 생성하지 않는다.

## 검증 · 2026-10-24

- npm run check: 타입·린트·질문 계약, 전체261개 중255 pass·환경6 skip.
- physical iOS/simulator 형태의 컨테이너 변경·동일 경로, 다른 계정/판본/device/root·traversal/URL 차단 회귀. 메뉴 통합 파싱에서 수정 이름·가격·pending 요청·판본 보존 확인.
- 실제 보존된 iOS 합성 fixture: 원문을 초기화하지 않고 이전 컨테이너 URI와 현재 파일 존재를 확인한 뒤 앱에서 사진1장·OCR4줄 복구를 확인했다. `ios-restored.png` 참고. `ios-fixture-report.json`은 원문 bytes 불변·이전/현재 컨테이너 차이·현재 파일 존재를 확인한 보고서이며 UUID나 개인 계정 정보를 포함하지 않는다.
- Android의 이동 경로를 새로 허용하지 않았다. Android 경로는 existing exact 규칙이며 native 컨테이너 이동 검증은 iOS 범위다.

앱 재설치로 파일 자체가 삭제된 경우를 복원하는 기능이 아니다. 기록 저장/사진 교체의 다른 local draft는 이번 메뉴판 수정과 별도이며 같은 문제 여부를 후속 확인한다. 사용자 실제 사진이나 관리형 서버 데이터는 변경하지 않았다.
