# 반복 음용 기록 검증 · 2026-10-22

- 상세의 재음용 행동 → 기존 술장 소유권 조회 → 이름/주종만 prefill → 새 날짜/새 평가 → 기존 술장 ID로 원자 저장 → 새 record ID 상세. 기존 노트 보충과 경로를 분리했다.
- PendingRecord의 entryId도 immutable retry payload에 포함한다. 미완료 다른 작업 복구가 새 재음용 요청보다 우선한다. 오래된 entryId 없는 v1 pending은 null로 호환한다.
- 프리필 조회 실패/외부 소유 항목은 새 항목으로 조용히 대체하지 않고 차단한다. 이미 저장을 시도한 entry가 이후 삭제되면 원래 operation을 유지한 실패 상태다.
- Figma 원본 18/19 및 기록 기본 정보/평가 export를 재사용했다. 버튼/타이포/칩은 기존 공통 요소. 추가 text 행동/반복 안내는 원본에 없는 확장이다.

## 실행

`npm run check`: 타입·린트·카탈로그 검사, 53 tests / 51 pass / 2 skip (로컬 실 PostgreSQL 동시성/Storage HTTP 서비스 없음).

추가 테스트: entryId 재시도 유지/연결 변경·누락 거부/구버전 null 호환, 프리필 owner 및 필드 범위, 기존 DB 테스트에 동일 술 3개 독립 경험·빈 노트/답변·replay 유지 보강. 외부 소유 entry 연결 거부는 기존 DB 테스트로 계속 검증한다.

iPhone 17 Pro / iOS 26.5 개발 빌드의 명시적 `/dev/detail` → `/dev/repeat` fixture에서 실제 버튼 이동, 오늘 현지 날짜, 이름/주종 프리필, 사진 미복사, 다음 화면의 평가/별점 미선택을 확인했다. `ios-repeat-prefill.png`, `ios-repeat-rating.png` 보관. fixture는 서버 저장을 차단한다. 실제 사용자 Apple/Kakao 로그인 클라우드 E2E 및 Android는 아직 미검증이다.

## 남은 #9

중앙 +의 기존 술 후보 선택, 대표 사진 관리, 개별 기록 이동/수정/삭제와 집계 동기화가 남아 있다. #9를 닫지 않는다. 새 DB migration이나 cloud 데이터 변경은 없다.
