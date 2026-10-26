# 사진 접근 안내

촬영/앨범 버튼 → 앱 안내 시트 → 실제 시스템 권한/사진 picker → 선택된 사진만 기존 기록 폼으로 전달한다. 카메라 이미 허용이면 안내를 반복하지 않는다. 재요청 불가 거부이면 설정 열기를 제공하고, 설정에서 돌아온 뒤 다시 촬영을 누르면 현재 권한을 재조회한다. 나중에/배경/Android back은 그대로 입력을 보존한다. iOS에서는 앱 Modal onDismiss 이후 시스템 picker를 열어 겹침을 피한다. pickerLock으로 중복 요청을 차단한다.

이미지만 고르는 현재 시스템 앨범 picker에는 전체 사진 권한이 필요하지 않아 광범위한 권한을 추가 요청하지 않는다. 앨범 시트는 사진 선택 안내이며 허용한 것처럼 표현하지 않는다. [Expo 공식 근거](https://docs.expo.dev/versions/latest/sdk/imagepicker/). 카메라/앨범 한글 usage description과 microphonePermission:false는 기존 app.config.ts를 유지한다.

iOS 26.5 native fixture에서 camera 안내/나중에 닫기/거부 상태 UI를 확인하고 screenshot을 보관했다. 실제 촬영은 시뮬레이터 카메라가 없으므로 실기기 확인이 필요하다. 실제 OS 권한 거부/설정 복귀와 Android 검증은 남아 있다. `/dev/photo-access`는 실제 권한 요청 없이 시안만 보여준다.

기록 본 흐름에 연결했고 타입/린트/기존 59개 테스트(57 pass,2 local services skip)를 통과했다. 사용자가 허용하기 전 카메라 요청이나 사진 선택을 시작하지 않는다. React 점검으로 Modal 전환 ref 소거·중복 동작 lock·취소 보존·외부 API 실패 안내와 접근성 버튼 라벨을 확인했다.

iOS 실제 실행 추가 확인: `/dev/existing`의 RecordComposer에서 사진 추가 → 앱 앨범 안내 → 계속 → 시스템 PHPicker까지 전환되는 것을 확인했다. OS 화면에 앱이 선택 항목만 접근한다는 안내가 표시됐다. 사용자 사진을 고르거나 저장하지 않고 취소했다. 카메라 촬영·Android는 미검증이다.


## 추가 실제 iOS 권한 거부·설정·앨범 취소 · 2026-10-26

별도 `Mogeum Small Screen QA` iPhoneSE3/iOS26.5의 개발 앱과 `/dev/attachment?kind=photo&selected=1` fixture에서 확인했습니다. 기존 사용자 기기의 TCC/세션·사진은 변경하지 않았고 이 화면의 저장 버튼은 누르지 않았습니다.

1. 카메라 사전 안내 → 나중에 할게요 → 선택된 병 사진과 저장 버튼 유지.
2. 다시 촬영 → 사전 안내에서 카메라 사용하기 → 실제 iOS 카메라 접근 요청. 한글 usage 문구를 확인하고 **허용 안 함** 선택.
3. 설정에서 허용하라는 브랜드 안내 확인. 앱 재실행 후 이미 거부된 카메라로 다시 진입해 **설정 열기 → 실제 iOS 설정 앱 도착 → 앱 복귀**를 확인. 이 시뮬레이터에서는 설정 최상위 화면으로 열렸으며 모금 전용 권한 페이지 도착/토글 허용/허용 후 촬영은 확인하지 않았습니다.
4. 재진입 안내의 나중에 할게요로 닫아도 선택 사진 유지.
5. 카메라 거부 상태에서도 앨범 안내 → 실제 PHPicker 진입. ‘앱은 선택한 항목에만 접근’ 시스템 안내를 확인했고 전체 사진 권한 요청은 나타나지 않았습니다. 사진을 고르지 않고X로 취소 → 선택돼 있던 fixture 사진·저장 버튼 유지.

375×667pt 화면에서 안내·설명·두 버튼이 보였으며 앱/DB 기록을 저장·수정하지 않았습니다. 로컬 ignored 증거는 `artifacts/qa/photo-permission-native/ios-camera-denied.png`, `ios-library-after-camera-denial.png`, `ios-picker-cancel-keeps-photo.png`입니다.

반복 Modal 전환 중 CUA 접근성 목록에서 시트가 누락되거나 최초 설정 전환 결과가 불확실한 구간이 있었습니다. 재실행 후 설정 앱 이동·복귀와 좌표 기반 취소는 확인했으나 도구/시뮬레이터/앱 중 원인을 확정하지 않습니다. 실제 VoiceOver와 iPhone의 반복 권한 거부·설정 허용 후 복귀는 계속 미검증입니다. 코드를 추정으로 변경하거나 권한 전체를 통과한 것으로 표시하지 않습니다. 실제 촬영·Android 전체 권한 흐름도 남습니다.
