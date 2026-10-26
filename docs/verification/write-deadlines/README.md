# 기록 전송 대기 제한 (#119)

기본 기록과 사진 교체의 계정 고정 SDK 전송에 20초 fetch deadline을 적용한다. 기존 호출자 AbortSignal도 합쳐 전달한다. 응답 헤더만 도착하고 본문이 멈춘 경우까지 signal을 유지한다. 전송 취소를 서버 저장 실패 확정으로 해석하지 않고 기존 pending의 operation ID와 payload를 그대로 재시도한다.

## 재현과 자동 검증

- iOS 26.5 실제 development build + 격리 로컬 합성 계정에서 gateway를 55초 일시 중지했다. 변경 전 저장 busy 상태가 25초 이상 유지됐고 gateway 복구 뒤 완료됐다. 실제 서버 응답 단절이며 preview/mock UI가 아니다.
- Node의 실제 localhost HTTP 서버로 헤더 이전 무응답, 헤더 도착 후 body 무응답, caller 취소, 이미 취소된 요청의 전송 방지, 정상 POST의 method/body/header 보존을 검사했다.
- RN 0.88 설치 소스의 AbortSignal.timeout/any 구현을 확인했다. native에서도 실제 대기 제한과 재시도 검증이 필요하다.

## iOS native 결과

최신 JS bundle이 로드된 것을 Metro에서 확인한 뒤, 같은 로컬 합성 계정으로 재음용을 작성했다. gateway를 45초 중지한 동안 20초 deadline 이후 busy가 해제되고 기존 평가/보관 요청과 오류 안내가 남는 것을 AX와 캡처로 확인했다. gateway 복구 뒤 같은 버튼으로 재시도해 상세 화면으로 이동했다. 해당 합성 계정의 DB는 저장 전 3행에서 완료 후 **4행**으로 증가했고, 모두 같은 술장 항목 1개에 연결됐으며 operation ID는 4개였다. 저장 요청 하나가 한 행만 추가됐다.

`artifacts/qa/composer-draft/ios-server-deadline-error.png`는 실제 시간 초과 후 상태다. 처음 시도한 회차는 iOS가 이전 개발 서버 번들을 유지한 정황이 있어 수정 후 검증으로 계산하지 않았다(`ios-server-deadline-inconclusive-stale-bundle.png`). 서버 gateway는 자동 복구 watchdog으로 원복했고 최종 paused=false를 확인했다. 운영 서버/실제 사용자 기록은 건드리지 않았다.

`npm run check`: 371개 중 363 통과, 환경 의존 8 skip, 실패 0. 이후 Request signal에 init.signal=undefined가 전달되는 경계도 추가 검사해 원래 취소를 유지하는 것을 확인했다.

## 남은 검증

Android deadline, native 사진 교체 deadline, 다른 노트/삭제 mutation의 대기 제한은 별도로 확인해야 한다. 전체 네트워크 흐름을 이 변경만으로 완료 처리하지 않는다.
