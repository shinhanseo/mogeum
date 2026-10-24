# 다음 한 잔 앱 연결 · 2026-10-24

내 취향의 비활성 CTA를 /discovery에 연결했다. owner 고정 실제 endpoint 결과를 검증한 뒤 네 주종을 필터하고 북마크를 저장/해제한다. 시작/재진입/재시도에는 보관한 북마크 작업부터 완료한다. 저장 목록의 마셨어요는 /record?productId=...로 기존 composer에 연결하며 이름·주종·명시된 와인 빈티지만 채운다. 기존 미완료 기록이 있으면 새 prefill로 덮지 않고 기존 요청을 먼저 복구한다. 저장 목록 진입만으로 실제 음용이나 감각 근거가 증가하지 않는다.

## 원본과 확장

확보된 고해상도 context/screenshot 43(19:784),45(19:972), 공통 토큰·Button·ChoiceChip·BottomTabBar를 적용했다. ChoiceChip의 outlined 변형을 추가해 기존 술장 compact 모양은 유지했다. 원본 88px SVG 4개와 bookmark 20px의 동일 바이트 복사본을 사용한다. 저장 행에는 wrapper scale로 64px를 만들고 root를 바꾸지 않는다. 동적 제품 이름·판본은 실제 출처 카탈로그이므로 원본 예시 이름과 다를 수 있다. 좁은 화면은 flex, 필터는 한 줄 가로 스크롤, 긴 제품명은 줄바꿈한다.

bookmark 선택 rose 배경, 오류/재시도/빈 상태, 목록 내 근거 펼침은 원본 외 확장 상태다. 펼침은 근거의 긍정·부정을 구분하고 각 3개 기록을 바로 열며 미확인 특징/제조사 출처를 제공한다. 독립적인 Figma 44번 상세와 일치한다고 주장하지 않는다. 42/46 진입 요약 자체의 새로운 원본 적용도 별도다.

## 검증

- 전체 검사 241개 중 235 통과, 실제 환경 전용 6 skip. prefill이 감각/사진/평가를 복사하지 않고 wine year/NV만 구분하는 회귀 추가.
- iOS 26.5 iPhone17Pro와 Android API37 Pixel7에서 __DEV__ native 전용 /dev/discovery로 UI를 확인했다. 시안에는 서버 저장 없음이 표시된다. iOS 와인 필터·긴 제품명·저장 목록·제품 정보 펼침, Android 북마크 선택 및 저장 개수 3→4·저장 목록 전환을 확인했다. 원본과 동일 viewport의 pixel diff 및 확대 글자/키보드 전체 검증은 아직 수행하지 않았다.
- 양 플랫폼 실제 Auth/Storage/OCR/Edge/DB 연속 검증 각각 17단계 통과. 신규 단계는 실제 AsyncStorage에 요청 저장→server commit 후 응답 유실→새 queue에서 replay→receipt 저장 후 조회 실패→서버에서 저장 해제 revision2→새 queue에서 최신 false 복원이다. [iOS](ios-native.json), [Android](android-native.json). 지정 합성 계정 총4개 정리 완료.
- 네이티브 서버 probe와 UI 시안 확인은 관리형 소셜 로그인 후 앱 UI 전체 E2E를 대체하지 않는다. 관리형 9번째 migration과 next-drinks function 배포, Apple/Kakao provider/Gemini 키 설정은 남아 있다.

## 캡처

- ios-saved.png: 64px 일러스트·저장 목록·마셨어요
- ios-wine-filter.png: 와인 선택·긴 제품명
- ios-inline-product-info.png: 기록 없는 상태의 제품 정보/미확인 특징
- android-list-saved-state.png: 원본88px 일러스트·rose bookmark 선택·저장4
- android-saved.png: 저장4·긴 와인명·공통 바텀탭

개발 런처 gear/시안 안내는 테스트 오버레이이며 제품 UI가 아니다. 캡처는 CUA 원본 창 이미지다.
