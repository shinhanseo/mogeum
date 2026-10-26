# 백엔드 배포 · 모금

현재 실제 대상은 `mogeum-dev` 하나다. 외부 사용자용 프로젝트는 아직 등록하지 않았으며 다른 서비스의 프로젝트를 재사용하거나 중지하지 않는다. 앱 베타 빌드와 서버 배포는 별개다. 앱은 EAS, 서버는 Supabase CLI로 배포한다.

## 현재 검증과 사전 검사

```sh
npm run check
npm run backend:check -- development
```

`backend:check`는 명시된 개발 프로젝트의 5개 함수 활성 상태·gateway 설정·필수 서버 secret **이름**과 잘못된 토큰의 401 응답을 확인한다. 비밀값·원시 CLI 오류는 출력하지 않는다. 마이그레이션 파일 해시와 CLI 이력 정합성도 남긴다. 연결된 project-ref가 명시 대상과 다르면 중단한다. 실제 DB 버전 일치, 정상 로그인, AI 성공, 실제 계정 삭제 성공을 이 검사로 대체하지 않는다. CLI 인증은 `npx supabase login`을 사용하며 토큰을 채팅/공개 이슈에 보내지 않는다.

## 현재 DB 이력 경고

2026-10-26 조회에서 13개 local migration에 대응하는 remote CLI 이력이 비어 있었다. 기존 DB는 SQL Editor로 적용되어 실제 테이블/RPC가 존재한다. 이 상태에서 `db push`를 실행하지 않는다. 검사 명령은 `MIGRATION_NOT_TRACKED`로 자동 배포 불가를 표시한다. 실제 스키마·권한·함수·Storage 정책을 migration 결과와 대조한 후에만 이력 정리를 진행한다. 확인 없이 전부 applied로 표시하는 repair는 하지 않는다.

## DB 이력 정합성이 확인된 대상의 배포 순서

아래 명령은 저장소 루트에서 실행한다. 다른 프로젝트에 링크된 상태로 DB 명령을 실행하지 않는다.

```sh
npx supabase link --project-ref vsckzjfgzdpzkzuumldf
npx supabase migration list --linked
npx supabase db push --linked --dry-run
# 위 목록을 저장소와 대조하고 예상한 신규 migration만 있는지 확인한 뒤:
npx supabase db push --linked
# 사용자 JWT를 각각의 handler에서 Auth.getUser로 검증한다.
npx supabase functions deploy taste-summary menu-recommend next-drinks delete-account provider-credentials --project-ref vsckzjfgzdpzkzuumldf --use-api
npm run backend:check -- development
```

설정 파일의 각 함수 `verify_jwt=false`를 따른다. 이는 인증 생략이 아니라 publishable key를 허용하는 gateway 뒤에서 각 handler가 서명된 사용자 JWT와 소유권을 검증하는 구성이다. `--prune`, `--include-seed`, 원격 DB reset, migration repair는 일반 배포에 사용하지 않는다. 배포 시 secrets나 Auth 설정 전체를 덮어쓰지 않는다.

메뉴/다음 한 잔/삭제의 기존 단일파일 생성 스크립트는 Dashboard 수동 배포 시 대체 경로다. 일반 CLI 배포는 Git의 원본 function과 shared 모듈을 사용한다. source 배포의 build header는 `source-development`일 수 있으므로 기존 단일파일 build ID와 혼동하지 않는다.

## 외부 사용자용 프로젝트 준비

1. 비용 조건과 사용 가능 슬롯을 확인해 모금 전용 프로젝트를 준비한다. 개발 데이터와 실제 사용자 데이터를 복사하지 않는다.
2. 새 ref/URL을 환경 등록에 명시하고 앱 공개 설정도 해당 프로젝트로 분리한다. 현재 코드의 development allowlist를 운영 프로젝트로 바꾸는 것으로 대체하지 않는다.
3. 새 DB에 순서대로 migrations를 적용한다. seed는 적용하지 않는다.
4. 서버 secrets를 비공개로 설정한다. Gemini key/model, provider 암호화 키, Apple·Kakao 앱/secret 설정이 필요하다. provider 암호화 키는 기존 데이터가 있으면 무계획 교체하지 않는다.
5. 새 Supabase callback을 Apple·Kakao 콘솔에 등록하고 native callback 허용 목록을 정확히 설정한다. 기존 개발 로그인은 유지한다.
6. 별도 테스트 계정으로 로그인 → 사진/노트 저장 → 요약 → 메뉴 추천 → 삭제를 확인한다. 기존 실제 계정은 삭제 테스트에 쓰지 않는다.
7. 백업·개인정보 문서·요금/호출 제한·지원 경로를 확정한 뒤 외부 베타 앱에 연결한다.

## 복구와 운영

- 앱 문제는 이전 검사 완료 빌드로 복귀한다. EAS 앱 재배포가 DB를 자동 복구하지는 않는다.
- 함수 문제는 마지막 검사 완료 Git revision의 함수 소스를 재배포한다. DB 변경과 호환되는지 먼저 확인한다.
- 이미 적용된 migration은 삭제/수정해 되돌리지 않는다. 데이터 보존과 하위 앱 호환을 확인한 후 전진 수정 migration을 만든다. 실제 데이터 복구는 백업 정책과 별도로 검증한다.
- AI 실패는 기본 기록 저장을 막지 않으며 서버에서 입력 해시 캐시·요청 제한·timeout을 유지한다. 월 한도나 결제 설정은 소유자가 확정한다.
- 운영 로그에 사진·메모·토큰을 남기지 않는다. 호출 결과/오류 코드/작업 ID를 기준으로 확인한다.

## CI와 자동 배포 범위

PR의 App checks와 Database policies가 타입·린트·계약·생성 export 및 독립 Supabase의 DB/Auth/Storage 검증을 수행한다. 아직 운영 배포 credential을 GitHub에 복사하거나 자동 배포를 켜지 않았다. 운영 프로젝트 등록 후 환경별 제한된 secrets와 environment 검토 규칙을 먼저 구성하고, 동일 commit의 검사를 통과한 workflow에만 배포를 연결한다.

공식 근거: [함수 배포](https://supabase.com/docs/guides/functions/deploy), [마이그레이션](https://supabase.com/docs/guides/local-development/database-migrations), [dry-run과 운영 seed 주의](https://supabase.com/docs/guides/local-development/cli-workflows).

관리형 schema dump의 CLI 임시 DB 로그인은 인증 오류로 완료하지 못했다. 이력 미등록 여부와 별개로 스키마 동일성 검증 완료를 주장하지 않는다. 인증 오류를 해결하려고 DB 비밀번호를 재설정하거나 기존 연결을 끊지 않았다. CLI 이력을 읽지 못해도 배포 검사는 `MIGRATION_LEDGER_UNAVAILABLE`로 중단한다.
