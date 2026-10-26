# 기본 기록 초안 복구 (#115)

사진 선택부터 전송 전까지 이름·주종·마신 날짜·호감·별점·빈티지·작성 단계를 계정과 진입 경로별로 기기에 보관한다. 새 기록, 같은 술 재음용, 추천 술에서 시작한 기록은 서로 다른 context를 사용한다. 이미 전송을 시도한 pending이 있으면 그것을 먼저 복원한다.

## 보관과 완료 처리

- 빈티지 연도를 두 자리만 입력한 상태도 보관한다. 달력을 열면 복구한 마신 날짜의 달을 보여준다.
- 사진은 최대 긴 변 1600px JPEG로 owner 전용 Documents 폴더에 둔다. 절대 URI 대신 사진 ID/크기를 저장해 현재 앱 컨테이너 기준으로 복구한다.
- 사진 변경은 새 파일과 메타데이터 보관이 성공한 뒤 기존 사진을 정리한다. 사진이 없어졌을 때는 입력을 유지하고 다시 선택하도록 안내한다.
- 전송 전에 최신 snapshot을 flush하고 pending에 원본 snapshot을 넣는다. pending operation ID는 별도 UUID이며 기존 서버 중복 방지 계약을 유지한다.
- 서버 receipt 확인 → 정확히 해당 snapshot의 사진/초안 정리 → pending 정리 순서다. 초안 정리 실패 시 receipt를 남겨 같은 요청으로 재시도한다. 더 새 초안은 오래된 cleanup으로 지우지 않는다.
- revision/직렬 queue가 오래된 쓰기와 다른 form 덮어쓰기를 막는다. 완료된 draft ID의 늦은 쓰기도 막는다.
- 계정 삭제 시 storage freeze와 이미지 queue drain 후 해당 owner의 폴더만 정리한다.

## 실행한 검증 · 2026-10-26

`npm run check`: **365개 중 357 통과, 8개 환경 의존 skip**, 실패 0. 메타데이터 파싱/소유권/context 분리, 저장 경합, 다른 form 충돌, 삭제 freeze, cleanup 실패 후 재시도, pending snapshot 불변성을 검사했다.

iOS 26.5 iPhone 17 Pro 시뮬레이터의 실제 development build + 격리된 로컬 Supabase 합성 계정으로 다음을 실행했다. preview나 운영 계정 검증이 아니다.

1. 사진 없는 기록에서 이름·와인·부분 빈티지 `20` 입력 → 앱 terminate/relaunch → 동일 입력 복구. 이때 서버 기록은 0개였다.
2. 빈티지 입력 키보드가 필드/적용 버튼을 가리는 문제를 발견해 modal에 KeyboardAvoidingView를 적용했다. 입력/적용 버튼이 키보드 위에 표시됨을 확인했다.
3. 빈티지 2020과 저장소 fixture 사진 선택 → 호감/별점 4 선택 → terminate/relaunch → 사진·평가 단계·모든 값 복구.
4. 실제 저장 후 SQL의 합성 계정 범위에서 기록 **정확히 1개**, 이름/별점/호감 일치 확인. 상세에 사진과 빈티지 표시 확인.
5. 완료 후 composer/pending 사진 파일 0개, 새 기록이 빈 시작 화면으로 열리는 것 확인.

CUA 캡처는 로컬 `artifacts/qa/composer-draft/`에 보관했다: `ios-vintage-keyboard.png`, `ios-vintage-restored.png`, `ios-photo-rating-restored.png`, `ios-saved-detail.png`. 사진은 저장소 fixture이며 사용자 사진/운영 세션을 사용하지 않았다. 이 캡처를 Figma 전체 시각 일치 검증으로 부르지 않는다.


Android API 37 전용 에뮬레이터에서도 실제 SDK 58 development build와 별도 로컬 합성 계정으로 확인했다.

- 시스템 사진 선택기에서 저장소 fixture 선택 → 위스키 적용 → force-stop/relaunch → 동일 사진·주종·날짜·기본 정보 단계 복구. 저장 전 해당 합성 계정의 서버 기록은 0개였다.
- 호감과 별점 4를 고른 후 실제 저장해 서버 기록 정확히 1개를 확인했다. composer/pending 사진 파일은 모두 정리됐다.
- `android-photo-restored.png`를 로컬 artifacts 폴더에 보관했다. 키보드 입력 전달 제약 때문에 Android의 이름/부분 빈티지는 이 회차에서 확인하지 않았다.
- 로컬 API reverse 포트를 제거하는 장애 주입은 기존 HTTP 연결을 끊지 못해 저장은 성공하고 상세 사진 로드만 실패했다. **저장 실패/재시도 통과로 계산하지 않는다.** 포트는 복구했다.

반복 QA를 위해 기존 로컬 합성 계정 경로를 Expo development 메뉴의 명시적 버튼으로 연결했다. `__DEV__` + native + 정확한 로컬 API URL 조건을 모두 만족해야 등록되며, 기존 세션을 덮지 않는 route 검증과 private manifest 확인을 유지한다. 로그아웃 역시 현재 합성 계정과 manifest를 확인한다. 일반 사용자 로그인이나 관리형 서버용 우회가 아니다.

배포 제외 조건(`.easignore`의 `app/dev/` 제외)을 적용한 별도 소스 복사본에서 Android release Hermes export와 `beta:scan`을 실행해 key/probe 검사 통과를 확인했다. 로컬 QA 메뉴 문자열도 release에서 제거됐다. 일반 working tree를 그대로 export하면 dev route 마커 때문에 스캔이 거부되는 것도 확인했다. 실제 APK 재빌드를 대체하지 않는다.

## 남은 검증

실제 기기, Android 이름/빈티지 입력과 평가 단계 재실행, 네트워크 실패 후 UI 재시도, native 파일 삭제 실패 주입, 여러 계정 전환과 재음용/prefill context의 화면 E2E는 추가 검증이 필요하다. 순수 계약 테스트 통과로 대체하지 않는다. 공개 베타 산출물은 이 변경 이전 빌드이므로 새 빌드 검증 전 최신 기능이 포함됐다고 표시하지 않는다.
