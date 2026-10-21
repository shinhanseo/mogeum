# 앱 인증·기록 SDK 연결 준비 · 2026-10-21

## 범위

#4의 클라이언트 기반과 #5/#7에서 사용할 기록 repository를 구현했다. #30 위에 쌓인 PR이며 로그인 UI/OAuth provider/계정 삭제/앱 저장 버튼 연결은 완료하지 않았다. 화면 수치·디자인은 변경하지 않았다.

- 환경 설정이 없으면 클라이언트를 생성하지 않는다. 공개 키만 사용하는 기존 env 검증을 유지한다.
- Supabase 클라이언트 하나, PKCE, URL 세션 자동 감지 비활성화, processLock을 사용한다.
- 네이티브 세션은 공식 React Native 가이드의 AsyncStorage adapter에 보관한다. 암호화 저장소라고 주장하지 않는다. 웹은 SDK 기본 저장소를 사용한다. 토큰은 로그에 출력하지 않는다.
- 앱 foreground에서 갱신을 시작하고 background/Root cleanup에서 중지한다. 렌더링·Fast Refresh마다 리스너가 누적되지 않는다.
- 세션 관찰은 먼저 auth 이벤트를 구독하고 복원을 수행한다. 복원 도중 로그아웃/계정 변경이 오면 이전 복원 결과를 폐기하며 unmount 후에도 결과를 발행하지 않는다.
- 기록 repository는 private 사진 ArrayBuffer 업로드(upsert false), 기존 생성 RPC, 안정적 정렬/페이지 조회, 5분 signed URL을 제공한다. userId를 body로 받지 않는다. 호출자는 동일 operation ID와 입력을 보존해서 불확실한 저장 결과를 재시도해야 한다.
- HTTP 통합 테스트에서 실제 SDK repository로 저장·술장 조회·signed URL 조회 후 동일 요청을 HTTP로 재시도한다. fixture 성공으로 대체하지 않는다.

## 확인

타입 검사·린트 및 로컬 27개 중 25개 테스트가 통과했다(실제 서버 필요 2개 skip). [앱 CI](https://github.com/shinhanseo/mogeum/actions/runs/39606054163)는 Expo 호환성·전체 export까지 통과했고, [실제 Supabase CI](https://github.com/shinhanseo/mogeum/actions/runs/39606054172)는 SQL 회귀 및 SDK 저장·술장 조회·signed URL을 포함한 HTTP 통합 검사를 통과했다. 로컬 Docker daemon이 없어 실제 서버 통합은 GitHub의 일회성 서버에서 실행한다. 네이티브 AsyncStorage 세션 재실행, provider redirect/취소, iOS·Android 실기기는 아직 검증하지 않았다.

## 다음 연결

1. 최신 Figma 로그인 프레임과 provider 확인 후 UI 연결.
2. 사용자 소유 Supabase 프로젝트와 provider/redirect 설정. 비밀 키는 앱에 넣지 않는다.
3. 계정 전환 시 서버 캐시·작성 draft 정리, 로그인 유도와 둘러보기 분리.
4. 사진을 안정적인 draft 경로에 보관하고 operation ID/입력 영속화 후 실제 저장 버튼 및 술장 연결.
5. 업로드 성공 후 저장 실패 보상, 계정 삭제/Storage worker 구현.

공식 근거: [Supabase React Native Auth](https://supabase.com/docs/guides/auth/quickstarts/react-native), [foreground 자동 갱신](https://supabase.com/docs/reference/javascript/auth-startautorefresh).
