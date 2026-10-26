# 작성 화면 시스템 Back 연결

기록 작성과 주종별 노트 작성에 focus 범위의 Android BackHandler를 연결했다. 상단 뒤로 버튼과 같은 동작을 공유하며, 화면이 focus를 잃으면 구독을 제거한다. 최신 화면 상태는 layout effect의 ref로 사용한다.

- 기록: 평가 → 기본 정보 → 기록 시작 순서. 저장 중에는 busyRef로 막는다. 보관된 불확실 저장 요청이 있으면 기존 안내를 유지하고 단계를 되돌리지 않는다.
- 노트: 직접 수정 → 미리보기 → 질문 → 이전 질문. 저장 중에는 busy ref로 막고 기존 보관 요청 상태에서는 기존 닫기 동작을 따른다.
- 기존 Figma 레이아웃·문구·컴포넌트 수치 변경 없음. iOS 스와이프/stack 이탈 방지 및 메뉴·사진 변경 화면은 이 수정에 포함하지 않는다.

`npm run check`: 266개 중 260 통과, 환경 의존 6개 skip.

Android API 37의 실제 dev build에서 `/dev/repeat` 기본 정보 → 평가로 이동한 화면을 확인했다. Android Studio embedded emulator의 toolbar Back, Escape 및 edge drag는 화면 전환을 확인할 수 없었다. 입력이 기기 시스템 Back으로 전달됐는지 현재 도구로 구분하지 못했으므로 **시스템 Back 네이티브 검증은 미통과/미완료**다. 이 항목을 #21에서 닫지 않는다. 저장 중 강제 이탈·질문/편집 단계의 시스템 Back도 추가 네이티브 검증이 필요하다. 단위 테스트나 상단 뒤로 버튼 검증으로 이를 대체하지 않는다.

## 2026-10-26 실제 기록 경로 재검증

Android API37/SDK58의 격리 로컬 합성 계정으로 실제 상세 → 한 번 더 기록하기 → 평가에 진입했다. 툴바 Back 클릭에서는 여전히 변화가 없었으나 기기 화면 왼쪽 가장자리에서 안쪽으로 드래그하는 시스템 제스처로 **평가 → 기본 정보 → 기록 시작** 전환을 각각 확인했다. 상단 뒤로 버튼을 누른 결과가 아니다. android-system-back-rating-to-info.png, android-system-back-info-to-start.png를 로컬 artifacts/qa/composer-draft에 보관한다. 저장 중/불확실 요청/질문·직접 수정의 Back 검증은 이 결과에 포함하지 않는다.

추가로 실제 노트의 질문2→질문1 시스템 Back에서 선택한 과일 향 유지, 직접 수정에서 문장을 비운 뒤 IME 닫기→수정 취소→원래 미리보기 복귀와 재편집 시 원문 유지를 확인했다. android-tasting-back-keeps-answer.png 및 tasting-edit-cancel/README.md에 증거 범위를 남긴다. 저장 중 이탈·불확실 pending·다른 주종 전체를 이번 표본으로 통과 처리하지 않는다.
