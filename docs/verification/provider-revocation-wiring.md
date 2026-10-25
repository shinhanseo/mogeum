# 외부 로그인 연결 해제 · 앱/서버 연결과 복구

관련 #4, #21. 실제 사용자 계정을 삭제하거나 Apple·카카오 연결을 해제하는 테스트는 하지 않는다.

## 변경

- OAuth code 교환 직후의 세션에서 provider refresh token을 확보해 기기 SecureStore에 계정/프로젝트/제공자별로 보관한다. Keychain 접근 정책은 이름 있는 `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` 상수를 사용한다. 앱 복귀 시 같은 계정의 보관 요청만 재전송한다. 서버는 JWT의 사용자를 직접 검증한다.
- 제공자 토큰을 고정된 Apple/Kakao endpoint로 검증하고 subject·앱을 대조한 뒤 AES-GCM으로 암호화해 service-only DB에 보관한다. 원문/서버 키를 앱·DB 일반 사용자·로그에 노출하지 않는다.
- capture receipt는 원래 토큰의 단방향 SHA256과 owner/provider/subject에 묶인다. 저장 응답 유실 후 같은 입력을 다시 보내도, 이미 회전된 토큰을 외부에서 재갱신하지 않고 기존 receipt로 확인한다. migration/receipt 조회가 없으면 외부 토큰 갱신 전에 중단한다.
- 계정 삭제는 외부 연결 해제와 generation별 receipt 기록을 먼저 마친 뒤 사진/DB/Auth 정리로 진행한다. 미완료 제공자는 재시도하고 완료된 제공자는 반복하지 않는다. provider 실패 시 사진/기록은 지우지 않는다.
- Kakao access token 만료 시 검증된 refresh로 갱신하고 새 토큰을 DB에 먼저 보관한 뒤 unlink한다. invalid_grant와 일시적인503/429·client 설정 오류를 구분한다. 불명확한 unlink 응답을 성공으로 가정하지 않는다.
- 누락/만료 토큰에는 해당 제공자만 재로그인을 안내한다. 삭제 작업이 idle 상태일 때 자격 증명 교체를 허용하되 진행 중/완료 상태는 차단한다. rotate/mark RPC는 유효한60초 lease 행을 잠그고 generation을 검사해 만료된 worker를 거절한다.

## 검증

- typecheck/lint/질문 계약·전체 테스트333개 중325개 통과/외부 환경 의존8개 skip.
- PGlite 전체 migration/DB 검사28개 중27개 통과/다중 세션1개 skip.
- **실제 로컬 PostgreSQL의 새 임시 owner**로 capture receipt, 타인/일반 사용자의 RPC 차단, active lease 중 변경 차단, idle 재인증 갱신, 만료 lease 거부, revoke 후 receipt 무효화를 통과했다. 새 fixture만 정리했다.
- 암호화 주체 묶음·응답 유실/회전 후 capture 재시도·외부 장애·재로그인 필요·연결 해제 실패 시 기록 보존의 회귀를 추가했다. 실제 provider HTTP 호출은 mock이며 사용자 grant를 해제하지 않는다.
- Deno의 provider-credentials/delete-account 원본 typecheck 및 delete-account 배포 번들 생성 통과.

## 배포/실기기 상태

13번째 migration은 로컬 DB에 적용했고 개발 중 보완한 store 함수 정의도 로컬에 동기화했다. **관리형 Supabase에는12/13 migration, provider-credentials 새 함수/신규 revoke 연결, provider 복호화 키를 아직 등록·배포하지 않았다.** 현재 관리형 delete-account 동작과 이 branch의 revoke 연결은 구분한다.

SecureStore가 들어간 Android/iOS native 재빌드는 누끼 작업 중 컴파일 성공했지만, 이 branch의 Apple/Kakao 실제 로그인→서버 capture·unlink 전체 흐름은 별도로 검증해야 한다. 정상 사용자 grant를 테스트 목적으로 해제하지 않는다. 해당 검증 전 #4/#21을 닫지 않는다.
