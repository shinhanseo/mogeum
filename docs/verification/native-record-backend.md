# 실제 네이티브 사진·서버 저장 통합 검증

2026-10-23 iPhone 17 Pro/iOS26.5 Simulator와 Pixel 7/Android17(API37) AVD의 Development Build에서 실행했다. Web mock 대신 실제 React Native FileSystem/AsyncStorage/fetch와 로컬 Supabase Auth·Storage·PostgreSQL RPC를 사용했다. 운영 프로젝트/실제 사용자 계정/개인 사진/Gemini는 사용하지 않았다. UI 터치·권한 모달·관리형 소셜 로그인 전체 E2E를 완료한 것은 아니다.

각 플랫폼의 6단계가 통과했다: [iOS 최초 결과](native-record-probe/ios-local-v1.json), [Android 최초 결과](native-record-probe/android-local-v1.json). 중복 실행 방지 추가 후 [iOS 재검증](native-record-probe/ios-local-v2.json), [Android 재검증](native-record-probe/android-local-v2.json)도 6단계 통과했다. 양 플랫폼에서 같은 실행을 다시 연 뒤 공개 보고서와 private manifest의 SHA-256이 모두 동일해 덮어쓰지 않았음을 확인했다.

1. 로컬 Auth에서 서로 다른 합성 계정 두 개를 생성하고 별도 SDK 세션을 유지한다.
2. 합성 PNG를 실제 native 사진 준비 경로로 JPEG/1600px 이하로 준비하고 비공개 Storage 업로드→기록 RPC를 실행한다. 서버 저장 직후 응답 유실을 주입한다. native AsyncStorage에서 원래 요청을 읽어 같은 operation으로 재시도하고 replayed 결과를 확인한다. 업로드 409 재시도도 포함한다.
3. 실제 batch signed URL로 사진 바이너리를 읽는다. 다른 JWT는 기록 조회가 빈 결과이고 사진 발급/다운로드가 차단된다.
4. 사진만 있는 기록은 감각 취향 근거를 만들지 않는다.
5. 완료 정리 때 잘못된 caller URI를 주입해도 저장된 현재 작업 파일만 삭제한다. 다른 guard 파일과 원본 PNG는 살아 있고 pending metadata는 제거된다.
6. 실제 기록을 삭제하고 사진 삭제 작업을 처리해 authenticated binary 읽기가 실패함을 확인한다.

별도로 로컬 HTTP suite의 메뉴·Storage·테스트 계정 정리 3개가 skip 없이 통과했다. `npm run check`는 207개 중 203 통과·실제 서버 환경 필요 4개 skip이다. 실제 서버 검증을 이 skip 결과로 대체하지 않았다.

## 재현

`supabase start`는 이 레포의 project_id=mogeum에 로컬 마이그레이션 8개를 적용한다. 기존 데이터에 db reset을 실행하지 않는다. `supabase functions serve --no-verify-jwt`는 각 handler의 getUser 검증을 유지하며 CI와 같은 로컬 함수 검증에만 사용한다. 자격 증명이 출력되는 CLI status/start 원본은 공개 로그에 붙이지 않는다.

- `python3 -m http.server 8765 --bind 127.0.0.1 --directory assets/fixtures/ocr-benchmark`
- `python3 scripts/serve-native-probe.py`: 로컬 API URL과 public anon key만 loopback 8766/config로 제공한다. service key를 제공하거나 파일 서버로 노출하지 않는다. API URL이 정확히 http://127.0.0.1:54321이 아니면 시작하지 않는다.
- Android는 adb reverse로 54321/8765/8766과 Metro를 연결한다.
- 개발 앱에서 `mogeum-dev://dev/native-record-probe?run=1&runId=ios-native-local-v1` 또는 Android용 새 runId를 연다. 매번 새 runId를 사용한다. 기존 보고서/정리 manifest가 있으면 새 계정을 만들거나 덮어쓰지 않는다. runId를 생략하면 기기별 무작위 기본 ID를 사용한다. Android shell에서는 전체 am start 명령을 단일 인자로 감싸 URL의 &를 원격 shell에 노출하지 않는다. __DEV__가 아니거나 Web이면 홈으로 이동하며 요청하지 않는다.

공개 보고서는 앱 documentDirectory의 native-record-probe-<runId>.json이다. 완료/실패 단계와 성공한 테스트 이름만 포함한다. native-record-probe-private-<runId>.json은 테스트 사용자 ID를 담는 로컬 정리용 파일이며 공개 레포/보고서에 복사하지 않는다. JWT/비밀번호는 어느 보고서에도 저장하지 않는다. 글로벌 앱 Auth와 .env의 관리형 프로젝트 설정은 변경하지 않는다.

## 테스트 데이터 정리

host에서 private manifest를 비공개 임시 위치로 읽은 뒤 `npx tsx scripts/cleanup-native-probe.ts /private/path/manifest.json`을 실행한다. 이 도구는 CLI의 로컬 API URL과 두 개 이하의 지정 ID만 사용하고, **모든 계정의 run marker와 합성 email을 먼저 확인한 뒤** 해당 사용자 데이터/사진/계정을 정리한다. 사용자 전체를 조회하거나 운영 프로젝트 URL을 입력받지 않는다. 이번 iOS·Android 두 차례 합성 계정 총 8개는 정리 완료했다. 이미 삭제된 계정의 manifest를 재실행해도 다른 계정을 고르지 않고 0개 정리로 종료한다.

HTTP 회귀는 다른 run 계정이 manifest에 섞여 있으면 앞의 정상 계정도 삭제되지 않는지, 올바른 run만 지우고 다른 run은 남는지 확인한다. 실패한 probe도 private manifest로 지정한 합성 계정만 정리해야 하며 개인/관리형 데이터에 이 도구를 사용하지 않는다. 로컬 probe는 상품 계정 삭제 기능을 구현한 것이 아니다.
