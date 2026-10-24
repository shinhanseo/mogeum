# 기록 저장 기반 · 2026-10-21

## 현재 범위

#3의 첫 단계이며 #29 UI 위에 쌓은 변경입니다. 사용자 계정·술장 항목·음용 기록·사진 메타데이터·노트/답변/draft·삭제 작업, RLS, 비공개 bucket과 기록 RPC를 구현했습니다. 메뉴·AI 근거 테이블, 실제 로그인·앱 저장 연결은 포함하지 않습니다. 화면은 변경하지 않았습니다.

## 로컬 검증

`npm run check`와 `npm run test:db`로 빈 PostgreSQL 엔진에 migration을 적용합니다. 로컬 Docker daemon이 실행되어 있지 않아 PGlite를 사용합니다. 이는 실제 PostgreSQL RLS/제약/트리거 검증이며, auth.uid와 Storage 메타데이터 테이블은 명시적인 테스트 fixture입니다. Supabase Auth/Storage HTTP API를 구현하거나 모의 성공으로 대체하지 않습니다.

- 두 사용자/비로그인 select/insert/update/delete와 FK/대표 사진 소유권 차단.
- 사진만 기록, 동일 입력 재시도, 다른 입력의 operation 충돌, 동일 이름 분리, 동일 항목 3회 경험.
- 대표 사진 이동/삭제와 빈 그룹 제외, 삭제 작업 생성.
- 수정 revision 충돌, 잘못된 별점·빈티지·없는 업로드 시 전체 트랜잭션 rollback.
- light/deep 원본 답변 및 미응답/모름/건너뜀/없음/0 구분, owner draft와 설정 격리, AI 생성 필드 직접 쓰기 차단.

PGlite는 단일 세션이라 독립 세션의 동시 요청은 로컬 테스트에서 명시적으로 skip합니다. `.github/workflows/database.yml`은 실제 Supabase의 auth/storage 스키마에서 동일 테스트와 독립 PostgreSQL 세션 2개의 동시 저장을 수행하도록 구성했습니다. 첫 실제 CI에서 테스트 드라이버가 JSON을 문자열로 이중 인코딩하는 차이를 발견해, native adapter는 sql.json으로 구조화된 값을 전달하도록 수정했습니다. 관리형 Storage는 SQL DELETE 자체를 차단하므로 실제 파일 삭제 검증은 HTTP 통합 테스트로 분리했습니다. [실제 Supabase CI](https://github.com/shinhanseo/mogeum/actions/runs/39592097941)가 통과했습니다. 관리 스키마 기반 SQL 테스트 18개(독립 세션 동시 저장 포함)와 실제 Auth/Storage/Data API 통합 테스트 1개를 실행했습니다. [앱 검사 CI](https://github.com/shinhanseo/mogeum/actions/runs/39592097834)도 타입·린트·테스트·Expo 호환성 및 export를 통과했습니다. 로컬 기본 검사에서는 24개 중 22개 통과, 실제 서버가 필요한 두 개만 명시적으로 skip합니다.

`npm run test:storage`는 CLI의 일회성 로컬 환경에서 합성 계정 두 개를 가입시키고 실제 JWT로 사진 binary 업로드, 기록 RPC/재시도, 술장 조회, 사용자 간 접근 차단, signed URL, 참조 중 파일 삭제 차단 및 기록 삭제 후 binary 삭제를 확인합니다. 로컬 기본 검사에서는 명시적으로 skip하며 CI에서 실행합니다. 비밀번호·토큰·signed URL은 로그에 출력하지 않습니다.

## 재현

```sh
npm ci
npm run check
# Docker가 있는 환경에서만, 이 프로젝트의 disposable 로컬 DB에 실행
npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,realtime,mailpit
npx supabase db reset --local
MOGEUM_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db
MOGEUM_TEST_SUPABASE_HTTP=1 npm run test:storage
npx supabase stop --no-backup
```

DB 테스트는 loopback URL만 허용합니다. 위 password는 Supabase CLI의 일회성 로컬 기본값이며 실제 계정/클라우드 키가 아닙니다. 실제 클라우드 DB에 테스트를 실행하지 않습니다. 반복 실행 전 테스트 전용 DB를 reset해야 합니다. seed는 비어 있고 합성 사용자/Storage 메타데이터는 테스트 코드에서만 생성합니다.

## 남은 검증/구현

- 실제 사용자 소유 Supabase 개발 프로젝트 생성/연결 및 OAuth (#4).
- 앱에서 Storage API 연결, 삭제 worker와 고아 파일 보상 처리. Storage 관리 테이블은 앱 SQL로 직접 삭제하지 않습니다.
- 기록 저장 앱 연결과 재실행 조회 (#5/#7), 모든 주종 질문 값의 runtime catalog 검증 (#6).
- 계정 삭제 시 DB 행 → Storage 파일 → Auth 사용자 삭제의 서버 orchestration, 비활성 토큰/사진 접근 검증.
- 삭제된 기록의 operation tombstone, AI 생성 결과 revision 조건부 적용, 메뉴/AI 근거 테이블.

DB 메타데이터와 Storage binary는 분산되어 있으므로 정책만으로 두 시스템의 원자적 삭제를 보장한다고 주장하지 않습니다. 업로드 완료/DB 저장 사이와 삭제 사이의 경합·실패는 실제 API 통합 단계에서 추가로 검증합니다.

## 공식 근거

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Storage 권한 정책](https://supabase.com/docs/guides/storage/security/access-control)
- [Storage 관리 스키마는 읽기 전용으로 취급](https://supabase.com/docs/guides/storage/schema/design)
- [Supabase 테스트](https://supabase.com/docs/guides/local-development/testing/overview)
- [PGlite PostgreSQL 실행 API](https://pglite.dev/docs/api)
