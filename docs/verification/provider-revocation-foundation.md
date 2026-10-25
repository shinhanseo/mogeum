# 외부 로그인 연결 해제 기반 · 미배포

이 변경은 `provider-credentials` 서버 입력 경계와 암호화 저장 기반이다. 현재 로그인 흐름과 `delete-account`에는 아직 연결하지 않았으며 제공자 토큰을 실제로 취소하지 않았다. 기존 사용자 계정의 Apple·카카오 연결을 테스트로 해제하지 않는다.

## 구현

- Supabase `getUser`로 인증한 계정의 Apple/Kakao identity만 선택한다. body의 사용자 ID·subject·URL은 허용하지 않는다.
- Apple refresh token으로 고정 Apple `/auth/token`에 요청한 뒤, 반환된 ID 토큰을 Apple JWKS/RS256/issuer/Services ID audience로 검증하고 Auth identity의 sub와 일치시킨다.
- Kakao refresh token으로 access token을 받은 뒤 access-token-info의 사용자 ID와 모금 앱 ID를 모두 확인한다. 유효한 다른 사용자의 토큰도 보관할 수 없다.
- 검증된 credential을 AES-256-GCM으로 암호화한다. 추가 인증 데이터에 계정·제공자·subject를 묶고 임의 IV를 사용한다. 서버 환경의 32바이트 `MOGEUM_PROVIDER_CREDENTIAL_KEY`가 필요하며 새 키를 자동 생성·배포하지 않았다.
- `private.provider_credentials`는 authenticated/anon이 읽거나 쓸 수 없다. 서버 RPC도 service_role만 실행한다. Auth identities의 실제 provider_id와 대조하고 계정 삭제가 시작되면 새 credential 저장을 막는다.
- 삭제 작업의 lease로만 credential을 조회할 수 있다. 제공자 해제 확인 후 동일 generation의 영수증을 확정할 때 암호문에서 토큰 자료를 제거한다. Auth 계정 삭제 시 row도 cascade 제거된다.
- Apple revoke 및 Kakao unlink 고정 API adapter를 만들었다. 서버 오류·다른 사용자 ID 응답을 성공으로 처리하지 않는다. 임의 리다이렉트와 임의 외부 주소를 따르지 않는다.

## 검증

순수 테스트로 body 경계, 다른 사용자·다른 Kakao 앱 거절, Apple 서명 검증 port 및 sub 일치, 계정/제공자/subject 변경 시 복호화 실패, provider 실패/응답 ID 불일치를 검증한다. DB 테스트는 실제 PostgreSQL 문법/RLS로 서비스 전용 권한, identity mismatch, 삭제 후 새 저장 차단, 잘못된 lease/generation 거절, revoke receipt 후 암호문 제거와 Auth cascade를 확인한다. PGlite의 auth.identities는 테스트 스키마 계약이며 실제 외부 로그인 API 검증이 아니다.

로컬 Supabase에 12번째 마이그레이션만 추가 적용했고 기존 DB를 초기화하지 않았다. 관리형 DB에는 아직 이 마이그레이션을 적용하지 않았다. Deno endpoint와 앱 전체 타입/린트 검사를 수행한다.

## 다음 연결에 필요한 것

- 로그인/세션 복원 시 provider refresh token을 서버에 안전하게 전달하고, 실패한 전달을 손실 없이 재시도하는 기기 저장 경로.
- 서버 환경 APPLE_CLIENT_ID/APPLE_CLIENT_SECRET, KAKAO_CLIENT_ID/KAKAO_CLIENT_SECRET/KAKAO_APP_ID 및 암호화 키 등록. 기존 Supabase OAuth 설정만으로 함수 환경에도 있다고 가정하지 않는다.
- 삭제 worker가 연결된 모든 provider를 순서대로 해제하고 durable 단계 영수증을 기록하는 경로. Kakao unlink 성공 후 응답 유실/토큰 만료 재시도의 확인 방식도 필요하다.
- 기존 사용자에게 credential이 없을 때 재인증으로 복구하는 UI. 제공자 해제가 실패했는데 최종 탈퇴 완료로 표시하지 않아야 한다.
- 테스트 전용 외부 계정으로 실제 revoke/unlink 검증. 실제 사람 계정은 삭제 버튼을 누르지 않는다.

공식 근거:
- [Apple 계정 삭제와 토큰 해제](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple)
- [Apple revoke endpoint](https://developer.apple.com/documentation/signinwithapplerestapi/revoke-tokens)
- [Kakao Unlink·token info·refresh](https://developers.kakao.com/docs/en/kakaologin/rest-api)

따라서 이 기반 변경만으로 #4의 외부 로그인 해제를 완료로 처리하지 않는다.
