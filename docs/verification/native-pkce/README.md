# 네이티브 PKCE S256 · 2026-10-24

iOS/Android 실제 로컬 UI 검증에서 Supabase Auth SDK가 WebCrypto 미지원으로 PKCE challenge를 plain으로 낮추는 경고가 확인됐다. 사용 중인 @supabase/auth-js의 generatePKCEChallenge는 crypto.subtle와 TextEncoder가 없으면 verifier 자체를 challenge로 반환한다.

## 변경

기존 expo-crypto를 사용해 getSupabase의 native client 생성 전에 필요한 최소 암호화 기능을 연결한다. 없는 getRandomValues는 네이티브 난수로, 없는 subtle.digest는 네이티브 SHA-256으로 연결한다. 기존 정상 구현은 덮지 않고 web은 그대로 사용한다. SHA-256 외 알고리즘은 지원한다고 가장하지 않고 거부한다. native digest 실패·인코더 부재는 plain으로 재시도하지 않는다. 별도 패키지·키·provider·서버 권한 변경이 없다.

이 브리지는 Supabase PKCE 경로를 위한 최소 구현이며 완전한 WebCrypto API가 아니다. 다른 암호화 기능이 필요해지면 별도로 지원 여부를 확인해야 한다.

## 검증

- RFC7636 공개 표준 verifier/challenge 벡터 일치, 기존 구현 보존, 지원하지 않는 알고리즘 거부, 네이티브 실패 전파 단위 테스트.
- 실제 Expo Development Build iOS Simulator·Android Emulator에서 네이티브 SHA-256 벡터 일치 확인. 실제 SDK signInWithOAuth(skipBrowserRedirect)의 요청을 생성해 code_challenge_method=s256, 43자 challenge가 저장 verifier의 SHA-256/base64url과 일치하며 verifier 자체와 다름을 확인했다.
- app/dev/auth-crypto는 __DEV__·native·정확한 로컬 URL에서만 실행한다. SDK 저장소는 별도 메모리 Map이고 종료 시 비운다. 계정 생성·provider 인증·브라우저 열기를 하지 않는다. 출력 JSON은 성공 여부·알고리즘·길이만 담으며 생성 URL/verifier/세션/키를 담지 않는다.
- 초기에 검증용 SDK를 persistSession=false로 만들어 SDK 내부 메모리로 저장되어 제공 Map에서 verifier를 읽지 못했다. 테스트를 별도 메모리 storage+persistSession=true로 수정한 최종 v3 결과를 보관했다. 앱의 기존 실제 세션 저장 정책은 변경하지 않았다.

현재 npm run check는 전체246개 중240 통과·환경6skip이다. 이 결과는 요청 생성과 native 암호화 검증이다. Apple/카카오 provider 미설정으로 실제 소셜 인증 및 callback 교환 성공을 검증했다고 주장하지 않는다.
