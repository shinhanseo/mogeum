# 기본 기록 초안 복구 · 개발 중 (#115)

현재 브랜치는 저장 계층과 native 사진 보관 기반을 준비한 상태다. **RecordComposer UI 연결과 실제 앱 재실행 검증은 아직 미완료**이며, 베타 APK에 이 기능이 적용됐다고 주장하지 않는다.

완료한 기반:

- 계정 UUID + 새 기록/재음용 항목/추천 prefill context별 draft key.
- 불완전 빈티지 입력을 허용하는 버전/소유권/입력 검증, revision 경합·다른 form 덮어쓰기 방지.
- 완료한 초안의 늦은 쓰기와 오래된 cleanup이 새 초안을 지우는 것 방지.
- photo URI 대신 photo ID/크기를 저장하고 새 앱 컨테이너의 owner 전용 경로로 복원.
- 이미지 준비 queue freeze/drain과 계정 삭제의 owner 폴더 정리 연결.
- 계정 storage freeze와 cleanup key 판별에 새 namespace 포함.

현재 검사: 타입·린트·계약 및 363개 중 355 통과·8 환경 의존 skip. 메타데이터 복원·경합·소유권·freeze를 검증했다. native 이미지 준비/삭제의 실기기 동작은 아직 실행하지 않았다.

다음 연결 순서:

1. `app/record.tsx`의 기존 pending 복구를 가장 우선한다. pending이 없을 때만 해당 context 초안을 복원하고 이전 이름/주종/날짜/평가/빈티지/사진을 적용한다.
2. 기본 작성 상태 변경을 저장하고 사진 선택 시 owner 전용 경로로 준비한다. 기존 usePhotoPicker/PhotoAccessSheet와 Figma 수치를 유지한다.
3. 서버 전송 전에 최신 snapshot을 flush한다. 가능하면 composer draft ID를 operation ID로 사용해 완료 후 초안 정리 실패에서도 중복 기록을 방지한다.
4. PendingRecord에 복구할 composer snapshot/식별자를 검증된 선택 필드로 연결한다. 다른 진입 경로에서 pending을 복구해도 원래 초안을 정리해야 한다.
5. 서버 receipt 확인 → 해당 composer snapshot 조건부 정리 → 기존 pending 정리 순서로 완료한다. cleanup 실패는 서버 재전송 대신 receipt로 재시도한다.
6. 원본 사진을 다시 압축하지 않고 `composerPhotoForPending`으로 기존 pending photo 경로에 복사한다. 사진 교체 시 새 snapshot 보관이 성공한 뒤 기존 owner 사진만 정리한다.
7. iOS/Android에서 종료/복구·스토리지 실패·다른 계정·pending 우선·재음용/prefill context 분리를 실제로 검증한다. 실제 사용자 계정은 사용하지 않는다.

도구 현황: iOS UI는 macOS `Device Hub`(`com.apple.dt.Devices`)에서 CUA로 조작 가능하다. beta Release에는 app/dev가 제외돼 있으므로 로그인 없는 preview를 이용한 검증을 실제 인증 E2E로 부르지 않는다. 별도 dev native + local synthetic account 경로를 준비하고 기존 실제 세션을 덮지 않는다.
