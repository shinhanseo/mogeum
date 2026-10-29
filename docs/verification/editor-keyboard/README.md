# 최종 노트 편집 키보드 점프 수정

최종 문장 편집기가 부모 ScrollView 안에서 전체 높이로 측정되며 selection/content-size/keyboard-frame/layout 이벤트마다 revealInput을 호출했다. 긴 편집 영역 전체를 가시 영역 위로 올리려는 보정은 native caret 스크롤과 중첩되고 반복될 수 있었다.

`TastingNoteEditor`를 외부 ScrollView에서 분리했다. 부모 KeyboardAvoidingView가 사용 가능한 높이를 변경하고, flex 입력창은 native 내부 스크롤로 커서를 표시한다. 앱이 문자 입력/선택마다 외부 scrollTo를 호출하지 않는다. 단계 전환 시 이전 focus/origin을 지우고, 문장 편집의 적용/취소는 한 줄로 배치해 작은 화면 공간을 확보했다. composition editBuffer/persistence 계약은 변경하지 않았다.

## 검증
- 전체 check: 444 pass / 14 환경 skip / 0 fail.
- iOS26.5 작은 iPhone SE 시뮬레이터, 합성 24줄 노트로 최종 편집 복원.
- 한국어 소프트웨어 키보드 ㄱ/ㅏ/공백/ㄴ/ㅏ 등을 직접 눌러 첫 문장 중간에 `가 나 가 가` 입력. 헤더·입력창 상단·적용/취소 위치 유지, 입력 내용 변경 확인.
- 키보드 완료 키로 닫은 뒤 편집창 높이 확대 및 내용 유지 확인.
- 문장 적용 후 미리보기에서 추가한 내용과 직접 수정 상태 확인.
- 서버 저장 호출 없는 fixture다. DB 저장/실기기 키보드/Android 체감 및 다른 키보드 전체 검증을 완료한 것으로 보지 않는다.
- `ios-long-edit-keyboard.png`는 합성 기록 입력 후 화면. 테스트 종료 후 Device Hub Capture Keyboard off 복원.
