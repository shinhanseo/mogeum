# 기존 술 후보 연결

이름 2자 이상 입력 후 300ms debounce로 현재 사용자의 cellar_overview를 검색한다. 최근 날짜/id 순 최대 5개이며 %, _, 역슬래시는 패턴 리터럴로 escape한다. 후보 응답은 사용자/검색어별로 묶고 이전 effect 응답은 무시한다. 이름 문자열로 자동 병합하지 않는다.

선택 시 entryId와 이름/주종만 적용한다. 사진/현재 평가/날짜는 그대로다. 다른 술 선택 또는 이름/주종 변경은 연결을 해제하며, 저장 이후 기존 PendingRecord의 entryId 불변 규칙을 따른다. 검색 실패해도 새 기록은 작성 가능하다.

검증: npm run check (59 tests /57 pass/2 local service skip). 검색 범위/limit/패턴 escape 및 기존 DB 소유권/독립 경험/재시도 검증. CI 실 Auth/Storage에는 후보 검색→선택한 entryId로 추가→기존 노트 미복사→횟수2→개별 삭제 경로를 추가했다. iOS 26.5 fixture에서 이름 입력→후보 선택→주종 채움/연결 상태→다른 술 해제를 확인했다. 실제 사용자 로그인 E2E/Android는 미검증이다.

React 점검: debounce effect 정리/늦은 응답 무시, 사용자별 결과 범위, 명시적 버튼 label, 안정 key, 기존 입력값 미복사 확인. 원본 Figma 정보 폼을 재사용한 확장 상태이며 새 후보 영역의 픽셀 일치를 주장하지 않는다.
