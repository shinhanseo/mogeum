# 개발 서버 연결 · 2026-10-24

대상은 Mogeum 조직의 mogeum-dev (vsckzjfgzdpzkzuumldf)다. 기존 meomun은 변경하지 않았다. 편집기 입력을 생성 파일과 전체 일치로 확인한 뒤 대시보드에서 배포했다. 비밀 키·관리 토큰을 가져오거나 저장하지 않았으며 생성물은 저장소 밖 임시 폴더에 둔다.

## 배포 내용

- menu-recommend: geometry-v3, 32제품, 손상된 가격의 미확정 보존. build menu-cb7ea451e5d61969 / sha256 bd273ed53c6f3b5deea20b979503454ae886f7f2721c5c21576aca5ba7b21e60 / 105073 bytes.
- next-drinks: 4주종 기록 비교, 전체 이력의 음용 제품 제외, 근거/주의/미확인 특징과 owner wishlist. build next-drinks-5b23d191add97be0 / sha256 437e3d478859037c50fca5b891e7535d7f87f620455a08a0e96e24aebbf56d21 / 100508 bytes.
- 9번째 20261023040000_drink_wishlist.sql을 SQL Editor에서 begin/commit과 함께 적용했다. 사전 조회의 테이블/RPC 3개는 NULL이었으며 기존 대상을 덮지 않았다. CLI migration history를 임의로 수리하지 않았다.

## 인증·권한과 검증

next-drinks는 로컬 config와 같이 legacy-secret 전용 gateway 판정 대신 handler의 Auth.getUser(token)으로 실제 사용자 JWT를 확인한다. 두 함수 모두 익명/위조 token 요청이 빌드ID를 포함한401 UNAUTHENTICATED/no-store로 차단됐다. 관리형 인증 후 성공의 증거는 아니다. [검증 결과](managed-auth-boundary.json).

관리형 DB에서 public.drink_wishlist의 RLS=true, owner policy=1, authenticated 직접 INSERT=false, private receipt SELECT=false, anon RPC EXECUTE=false, authenticated RPC EXECUTE=true를 확인했다. private schema USAGE는 기존 구성상 true지만 receipt 직접 읽기 권한은 없다. SQL 권한 카탈로그의 확인이며 다른 사용자 실로그인 RLS E2E를 대체하지 않는다.

원본 Deno check, 전체 검사235 통과/환경6skip, 두 단일 파일의 로컬 실행 buildID와 실제HTTP5/5를 확인하고 테스트마다 원본을 복원했다. 첫 다음 한 잔 bundle 검증에서는 cleanup 테스트의 Auth 사용자 확인이 실패했고 재실행은5/5 통과했다. 처음부터 모든 실행이 통과했다고 기록하지 않는다.

Apple/Kakao provider와 Gemini 키는 미설정이다. 실제 관리형 계정의 소셜 로그인→저장→추천UI E2E는 남아 있다. 관리형에는 합성 테스트 사용자를 만들지 않았으며 모델을 호출했다고 표시하지 않는다.

## 재현

`npm run build:menu-function` / `npm run test:menu-deploy`

`npm run build:discovery-function` / `npm run test:discovery-deploy`

로컬 `functions serve --no-verify-jwt` watcher를 먼저 시작한다. 기본 실행 worker만 남아 있으면 교체한 bundle을 다시 읽지 못할 수 있다. 검증 스크립트는 finally에서 원본을 복원한다. 같은 checkout에서 여러 bundle 검증을 동시에 실행하지 않는다.
