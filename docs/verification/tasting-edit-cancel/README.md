# 문장 편집 취소와 Back 일관성

기존 TastingComposer는 취소 버튼에서 편집 버퍼를 지웠지만 상단/Android Back 경로에서는 view만 preview로 바꿨다. 그 상태로 초안을 다시 열면 남은 editBuffer로 인해 취소한 편집 화면이 복원될 수 있었다.

취소와 Back을 같은 cancelEdit 함수로 연결한다. 적용하지 않은 prose buffer만 제거하고 기존 preview 문장·edited 상태·source revision·감각 답변을 보존한다. 키보드/입력 포커스도 기존 dismissInput 경로로 정리한다. 기존 레이아웃·문구·토큰 수치 변경은 없다.

회귀 검증은 실제 draft storage serialize/parse/restore를 사용해 편집 중 버퍼 복원 → 취소 → 재복원 시 원래 적용 문장 보존 및 버퍼 제거를 확인한다. 원본 draft는 변경하지 않는다. 전체 타입·린트·계약 및 테스트 359개 중 351 통과·8 환경 의존 skip.

이 변경의 네이티브 Back 동작과 실제 앱 재실행 검증은 아직 포함하지 않는다. 해당 시나리오는 #21의 후속 native QA에서 확인한다. 도메인 검증을 네이티브 Back 성공으로 표시하지 않는다.
