# 상세 조회 대기 제한과 사진 실패 구분

기록 상세의 DB 조회와 사진 발급이 기본 SDK 대기 시간에 의존하고 있었다. 기록+이력 조회는 하나의 20초 AbortSignal을 공유하며, 첫 조회 이후 두 번째 조회에서 대기 시간이 다시 초기화되지 않는다. 사진 발급은 기존 signPhotoBatch 경로의 10초 UI 대기 제한과 300초 비공개 링크를 사용한다. SDK가 실제 파일 전송을 취소하지 못하는 사진 서명 요청의 늦은 결과는 기존 Promise.race/상세 generation 규칙으로 무시한다.

기록 또는 이력 조회가 실패/중단되면 부분 상세를 반환하지 않고 기존 오류·재시도 화면을 사용한다. 사진 발급만 실패하면 확인된 기록과 이력은 유지하고 photoUri=null을 반환한다. 현재 owner/records/ 경로 밖의 사진은 서명 요청에 넣지 않는다.

사진 없는 기록과 사진을 못 불러온 기록의 기존 placeholder를 구분했다. 사진 metadata가 있으면 ‘사진을 불러오지 못했어요’, 사진이 없으면 기존 ‘사진 없이 남긴 한 잔’을 표시한다. 같은 caption/style/레이아웃/3:4 영역을 사용한다. 실패 안내는 Figma 원본 18·19에 정의되지 않은 보충 상태이며 새 디자인 일치 검증으로 주장하지 않는다.

## 검증

- npm run check: 281개 중 275 통과, HTTP/독립 DB 환경 의존 6개 skip.
- 실제 Supabase JS SDK와 제어된 fetch transport로 첫 기록/두 번째 이력 요청을 각각 멈추고 취소해 signal이 전달되고 부분 데이터가 반환되지 않는 것을 확인했다. SDK fetch를 제어하는 transport 회귀이며 실제 서버에 연결한 네이티브 네트워크 시험과는 구분한다.
- batch 서명 요청의 정확한 owner 경로/300초 body, 서명 503 실패에도 기록/이력 유지, foreign 경로 미전송을 확인했다. 기존 record/history owner 필터·사진 sort·노트 relation 회귀도 유지한다.
- iOS 26.5 dev build의 명시적 /dev/detail?photo=unavailable&note=1 및 photo=none&note=1 fixture로 두 안내와 노트 보존을 CUA로 확인했다. [사진 발급 실패 시안](ios-photo-unavailable.png), [사진 없는 기록 시안](ios-no-photo.png). 개발 시안·서버 저장 없음 표기를 유지한다.
- iOS/Android 실제 네트워크를 20초 이상 지연시킨 timeout E2E 및 Android의 두 caption 시안은 이번에 새로 실행하지 않았다. 운영/관리형 계정 연결 검증과 구분한다. 사진 복구 자동 재시도 횟수는 기존 상세 loader의 한 번 제한을 유지한다.
