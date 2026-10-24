# SDK58 패치 정합화 · 2026-10-24

PR67/68의 App checks가 Expo 원격 호환 목록과의 버전 차이로 실패했다. CI 검사를 끄거나 offline으로 우회하지 않고 같은 SDK58의 권장 패치에 맞춰 package/lock을 갱신했다.

- expo58.0.17→58.0.19
- expo-dev-client58.0.14→58.0.15
- expo-file-system58.0.10→58.0.11
- expo-font58.0.9→58.0.10
- expo-router58.0.25→58.0.26
- 관련 Expo core/JSI/Metro/CLI 패치도 lockfile에 반영. React19.3.0/RN0.88.0/Node24는 유지한다.

동적 app.config.ts 때문에 설치 CLI가 자동으로 추가하지 못한 expo-font plugin을 명시했다. 기존 runtime font 로딩과 폰트 파일은 바꾸지 않았다.

## 확인 결과

- npx expo install --check: 온라인 호환 검사 통과.
- npm run check: 전체241개 중235 통과, 실제 환경 전용6 skip.
- npx expo export --platform all: iOS/Android Hermes·Web 정적 내보내기 통과.
- iOS 새 패치 재빌드 성공(0 errors, 2 warnings), 설치 후 실제 저장 UI E2E 통과.
- Android 전체 ABI assembleDebug 성공(25분52초). 기존 Pixel7 저장 공간 부족으로 설치가 실패해 기존 사용자 데이터를 삭제하지 않고 전용 AVD를 생성했다. arm64 재빌드 성공(20초)·설치·실행 후 실제 저장 UI E2E 통과.
- PR70·71 App checks / Database policies 모두 통과. 실제 UI 증거는 ../wishlist-edit/에 있다.
- iOS Simulator·Android Emulator 결과이며 실기기 검증을 대체하지 않는다.

처음 iOS pod install은 ExpoModulesWorklets/Core/FileSystem의 로컬 podspec과 Podfile.lock 충돌로 중단됐다. 기존 폴더를 지우지 않고 Expo/Core/Worklets/WorkletsAdapter/JSI/FileSystem/Font/dev-client/dev-launcher를 지정해 pod update --no-repo-update를 실행했다.

Database policies CI에 next-drinks 단일파일 검증을 추가했다. 체크 대상에 discovery 및 새 빌드 스크립트도 포함한다. 과거67의 실패는 테스트가 아닌 마지막 임시 컨테이너 종료 단계였으므로 종료가 한 번 실패할 경우 한 번 더 시도하며, 재실패도 성공으로 숨기지 않는다.
