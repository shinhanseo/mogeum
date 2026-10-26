# 노트 조회·저장 응답 대기 제한

관련 #127, #21, #27. 기록 문맥·기존 노트·마지막 방식·답변 조회와 save_tasting_note 요청에 각 20초의 AbortSignal을 적용했습니다. 글로벌 Auth transport나 다른 SDK 요청은 변경하지 않습니다. 각 요청별 제한이며 전체 진입 작업 합계가 20초라는 의미는 아닙니다.

시간 초과는 서버 작업의 취소/롤백 증명이 아닙니다. 저장 전 보관한 operation ID·expected revision·답변·문장을 그대로 재사용해 응답 유실을 처리합니다. 저장 실패 후에는 편집을 잠그고 동일 요청 재시도를 제공합니다. 기록 기본 저장과 이미 작성한 초안은 유지합니다.

실제 로컬 HTTP 서버가 헤더만 보내고 응답 본문을 끝내지 않는 상황에서 조회·RPC가 종료되고, 서버 복구 후 같은 RPC payload로 재시도되는 회귀를 추가했습니다. transport 회귀 서버이며 실제 DB 저장 성공 검증과 구분합니다. 전체 check: 374개 중 366 통과, 환경 의존 8 skip, 실패 0.

iOS 26.5 실제 development build + 별도 로컬 합성 계정에서 와인 5문항 작성 → 로컬 API gateway 일시 중지 → 저장 요청 → 시간 초과 안내/기존 미리보기/재시도 가능 → gateway 복구 → 동일 노트 재시도 → 상세에 확정 노트 표시를 확인했습니다. 해당 합성 술의 DB 기록 수는 4개 그대로이며 노트 수만 0→1로 바뀌었습니다. watchdog으로 gateway를 자동 복구했고 마지막 paused=false도 확인했습니다. 증거: 무시된 로컬 artifacts/qa/tasting-done/ios-note-timeout-keeps-preview.png 및 ios-note-retry-saved.png. 운영 계정/운영 서버는 사용하지 않았습니다.

Android, 실제 기기, 관리형 서버 장애 주입과 초기 조회 시간 초과 UI는 아직 확인하지 않았습니다.
