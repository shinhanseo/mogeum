# 사진 접근 안내

촬영/앨범 버튼 → 앱 안내 시트 → 실제 시스템 권한/사진 picker → 선택된 사진만 기존 기록 폼으로 전달한다. 카메라 이미 허용이면 안내를 반복하지 않는다. 재요청 불가 거부이면 설정 열기를 제공하고, 설정에서 돌아온 뒤 다시 촬영을 누르면 현재 권한을 재조회한다. 나중에/배경/Android back은 그대로 입력을 보존한다. iOS에서는 앱 Modal onDismiss 이후 시스템 picker를 열어 겹침을 피한다. pickerLock으로 중복 요청을 차단한다.

이미지만 고르는 현재 시스템 앨범 picker에는 전체 사진 권한이 필요하지 않아 광범위한 권한을 추가 요청하지 않는다. 앨범 시트는 사진 선택 안내이며 허용한 것처럼 표현하지 않는다. [Expo 공식 근거](https://docs.expo.dev/versions/latest/sdk/imagepicker/). 카메라/앨범 한글 usage description과 microphonePermission:false는 기존 app.config.ts를 유지한다.

iOS 26.5 native fixture에서 camera 안내/나중에 닫기/거부 상태 UI를 확인하고 screenshot을 보관했다. 실제 촬영은 시뮬레이터 카메라가 없으므로 실기기 확인이 필요하다. 실제 OS 권한 거부/설정 복귀와 Android 검증은 남아 있다. `/dev/photo-access`는 실제 권한 요청 없이 시안만 보여준다.

기록 본 흐름에 연결했고 타입/린트/기존 59개 테스트(57 pass,2 local services skip)를 통과했다. 사용자가 허용하기 전 카메라 요청이나 사진 선택을 시작하지 않는다. React 점검으로 Modal 전환 ref 소거·중복 동작 lock·취소 보존·외부 API 실패 안내와 접근성 버튼 라벨을 확인했다.
