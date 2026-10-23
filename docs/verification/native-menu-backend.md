# 네이티브 OCR → 실제 로컬 서버 추천 검증

개발 전용 `native-record-probe`에 `menu=1`을 추가하면 기존 사진 저장 검증 후 두 장의 합성 메뉴를 실제 기기 OCR로 읽고 로컬 서버에 전달한다. 글로벌 앱 인증 세션이나 .env의 관리형 프로젝트는 바꾸지 않는다. loopback config 검사 이후 생성된 합성 SDK 계정만 사용한다.

## 검증 범위

- 합성 light/two-columns PNG → native 사진 준비 → Vision/ML Kit → 좌표 계약.
- 두 사진의 실제 OCR을 Edge parse로 보내 geometry-v2와 양쪽 출처 포함 확인.
- 명시적인 사용자 수정/제품 확인을 모사해 글렌피딕 12년 한 항목을 확정. OCR 원문 불변 및 AsyncStorage draft 복구 확인.
- 실제 menu session RPC를 두 번 호출해 같은 revision으로 재시도되고 다른 계정의 조회/덮어쓰기가 차단되는지 확인.
- 같은 계정의 사진 기록에 과일 향 노트를 실제 저장한 뒤 확정한 메뉴만 추천 요청. 추천의 근거 ID가 그 기록을 가리키며 다른 계정에는 근거가 없는지 확인.
- 기존 기록/사진 삭제 검증까지 완료. 임시 메뉴 사진·draft는 finally에서 정리하며 합성 계정과 서버 세션은 private manifest 기반 정리 도구로 제거한다.

이 검증은 __DEV__ native 경로다. 로컬 SDK의 실제 fetch/invoke/RPC를 쓰지만 관리형 설정을 사용하는 production menuClient와 화면 터치 전체 E2E를 대체하지 않는다. 제품 선택은 테스트에서 명시적으로 모사하며 OCR 정확도가 완전함을 뜻하지 않는다. 실제 모델은 호출하지 않고 evidence-rules-v1 추천을 검증한다.

## 실행

[네이티브 기록 검증](native-record-backend.md)의 로컬 서비스를 실행하고 새로운 runId로 `mogeum-dev://dev/native-record-probe?run=1&menu=1&runId=ios-menu-local-new`를 연다. Android shell에서는 URL 전체를 인용한다. 실제 결과는 아래 플랫폼별 보고서에 기록한다.

## 결과

- iOS 26.5/iPhone 17 Pro Simulator: [11단계 통과](native-menu-probe/ios-local-v1.json). 사진별 Vision v2 13줄씩, 서버 메뉴 12항목.
- Android 17/API37 Pixel 7 AVD: [11단계 통과](native-menu-probe/android-local-v1.json). 사진별 ML Kit 13줄씩, 서버 메뉴 7항목. iOS 12항목과 차이가 있으며 정확도 동등이나 누락 없음으로 해석하지 않는다.

두 플랫폼 모두 각 사진의 출처가 실제 서버 결과에 포함되고, 명시적으로 확정한 한 제품의 추천 근거가 저장한 노트에 연결됨을 확인했다. 전체 합성 메뉴 정답 12항목을 모두 인식했다는 검증은 아니다. 기존 별도 실행 AVD는 종료 상태를 보존하고 Studio 안의 Pixel 7 AVD에 동일 개발 APK를 설치했다. 앱 시작 시 개발 클라이언트가 요청한 불필요한 주변 기기 권한은 거부한 상태로 검증했다.

Android의 즉시 재실행 한 건은 메뉴 검증 진입 전 canonical_photo_cleanup에서 실패했다. [실패 보고서](native-menu-probe/android-retry-failed.json)를 보존하고 해당 단계 진단을 세분화했다. 이 실패를 통과한 것으로 계산하지 않으며 이후 세부 단계 진단을 넣은 [재실행 1](native-menu-probe/android-local-v2.json)과 [재실행 2](native-menu-probe/android-local-v3.json)는 모두 11단계 통과했다. 최초 간헐 실패의 원인은 확정되지 않았으며 해결됐다고 주장하지 않는다.

초기 iOS 실행에서는 probe가 미확정 항목까지 추천 요청해 서버가 올바르게 거절했다. 실제 앱과 같이 확정 항목만 전달하도록 검증 코드를 고친 뒤 새 runId로 재실행했다. 이 과정에서 제품 경로의 검증을 약화하지 않았다.

검증 계정은 private manifest로 지목한 iOS 6개·Android 8개를 정리했다. 공개 보고서에는 사용자 ID·JWT·비밀번호가 없다.
