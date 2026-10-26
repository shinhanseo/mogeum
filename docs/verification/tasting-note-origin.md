# 저장한 노트의 직접 수정 여부 복원 · #132

record_notes 조회에 포함된 edited_by_user를 복원에서 무시하고 true로 고정해 자동 정리 노트도 직접 수정 문구로 표시했습니다. 이제 서버의 실제 boolean을 composition.edited로 복원합니다. 이미 작성 중인 로컬 초안은 서버 flag로 덮지 않습니다.

iOS 26.5 실제 development build와 로컬 합성 계정에서 다음을 확인했습니다.

1. 다른 경험의 와인 향에서 사과·배만 선택, 나머지 4문항 건너뛰기 → 한 문장 자동 정리 → 실제 저장. DB edited_by_user=false.
2. 저장으로 초안 정리 후 같은 노트 재진입 → 5단계 미리보기: 사과·배 문장만 유지되고 `선택한 답변만 문장으로 정리했어요` 표시.
3. 직접 수정에서 QA 문구 추가·적용·실제 저장: DB edited_by_user=true와 수정 문장 일치.
4. 다시 진입하여 미리보기: 수정한 원문과 `내 말로 다듬은 노트예요` 표시 유지. 새 경험은 만들지 않았습니다.

합성 계정 외 실제 사용자 계정/기록은 수정하지 않았습니다. 증거: 무시된 로컬 artifacts/qa/tasting-done/ios-auto-note-origin-restored.png 및 ios-manual-note-origin-restored.png. 전체 check 376개 중 368 통과, 환경 의존 8 skip, 실패 0. Android·관리형 서버 전체 UI는 미검증입니다.
