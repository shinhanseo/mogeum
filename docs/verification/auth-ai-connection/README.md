# Apple·카카오·Gemini 개발 프로젝트 연결 · 2026-10-25

사용자가 직접 Apple 로그인·갱신 계약 동의를 완료했고, 모금 전용 앱/키 생성과 Supabase 개발 프로젝트 등록을 명시적으로 승인했다. 기존 앱·키와 결제 설정은 변경하지 않았다. Google은 앱 로그인 공급자가 아니라 Gemini API용이다.

## 등록 상태

- 대상: `mogeum-dev` / `vsckzjfgzdpzkzuumldf`.
- Apple App ID `com.hanseo.mogeum`, Services ID `com.hanseo.mogeum.auth`, `Sign In with Apple` 활성화. Services ID의 primary app도 모금으로 한정했다. 도메인과 return URL은 위 프로젝트의 HTTPS `/auth/v1/callback`이다.
- 모금 전용 Apple 로그인 서명 키 발급·보관, Services ID client secret을 Supabase Apple provider에 저장. **client secret은 2027-04-23 전에 갱신해야 한다.** provider Client IDs는 Services ID 우선, App ID 다음이다. 다운로드한 `.p8`와 client secret은 저장소 밖의 소유자 전용 디렉터리에 보관하며 공개 파일에 넣지 않는다.
- Kakao 앱 `모금`(개발자 표시명 모금, 앱 ID 1621286, 식음료). 로그인·OpenID Connect ON, REST API 키의 로그인 콜백과 client secret을 Supabase Kakao provider에 등록했다. 이메일 미제공 사용자를 허용한다.
- Gemini: 새 `Mogeum Dev` 프로젝트와 `mogeum-dev-server` 키. Supabase Edge Function secret `GOOGLE_GENERATIVE_AI_API_KEY` 등록을 성공 toast/목록으로 확인했다. 결제 연결·요금제 변경 없음.
- 기존 앱 callback allow list의 `mogeum-dev://auth/callback`과 개발용 localhost callback들은 유지했다.

## 카카오 요청 범위

관리형 Auth의 실제 기본 요청은 `account_email profile_image profile_nickname`을 강제로 붙인다. `options.scopes='openid'`를 추가하는 것만으로는 이 기본값이 제거되지 않음을 실제 302 응답으로 확인했다. 모금은 기본 이메일/프로필 수집이 필요하지 않아 `queryParams: { scope: 'openid' }`로 provider 요청을 명시한다. PKCE·state·Supabase code exchange는 기존 SDK 경로 그대로 유지한다. 실제 관리형 302 요청이 정확히 `openid`만 포함하는지 검증한다. 공식 문서의 이메일 미제공 허용 안내만으로 요청 scope까지 제거된다고 가정하지 않는다.

- [공식 Supabase Kakao 안내](https://supabase.com/docs/guides/auth/social-sign-in/auth-kakao)
- [Supabase provider 기본 scope 문제](https://github.com/supabase/auth/issues/2574)

## 검증과 남은 범위

- `scripts/verify-managed-auth.ts`: 지정된 개발 프로젝트에만 읽기 요청. 실제 SDK의 PKCE authorize URL → Apple/Kakao 302 이동·client/callback/scope 확인. 사용자 로그인·인증 코드 교환은 하지 않는다. [실행 결과](managed-auth.json).
- 기존 production provider 함수 `selectHighlights`를 Deno에서 실제 호출. 합성 위스키 기록 3개와 과일 향만 사용했고 `gemini-3.8-flash`의 구조화 응답을 `validateSelection`으로 검사했다. [실행 결과](gemini-provider.json). 개인 기록/사진은 전송하지 않았다. 서비스 모델 목록에서도 해당 모델의 generateContent 지원을 확인했다.
- SDK 회귀 테스트는 Apple/Kakao 모두 exact native callback·PKCE challenge를 유지하고 Kakao만 최소 scope를 덮어쓰는지 확인한다.
- 실제 사용자 계정의 최종 로그인·앱 복귀·세션 재실행 복원, 로그인 후 실제 기록 저장, 관리형 taste-summary endpoint의 인증·DB·AI 전체 흐름, Android의 실제 OAuth는 아직 완료로 주장하지 않는다. iOS 앱은 managed 설정과 최신 요청 코드로 새로고침해 사용자 인증·동의를 기다린다.
- 로그아웃/계정 삭제 기능 개발은 별도 후속 작업이며 이번 설정으로 완료되지 않는다. 10번째 술장 migration과 최신 next-drinks 번들의 관리형 배포도 이 작업에서 자동으로 완료하지 않았다.

`npm run check`: 타입·린트·테이스팅 계약 통과. 총 292개 중 286 pass / 별도 환경 의존 6 skip. 신규 SDK 회귀 2개는 네트워크/로그인 모의 성공을 실제 사용자 로그인이라고 처리하지 않는다.
