# 관리형 DB와 CLI 이력 정리 · 2026-10-26

SQL Editor로 적용했던 13개 migration의 CLI 이력이 비어 있어 `db push` 재실행 위험이 있었다. 먼저 코드/로컬 DB와 관리형 개발 DB의 application schema를 읽기 전용으로 비교했다. 사용자 기록/사진/토큰을 조회하지 않았다.

## 비교

- public/private 함수·컬럼·제약·인덱스·정책·RLS·뷰·enum·trigger·테이블/함수/schema ACL·비공개 bucket 설정 420항목 중 419항목 지문 일치.
- 유일한 차이는 `begin_account_deletion` 내부 주석. 로컬 정의의 주석 한 줄만 서버 문구로 바꾼 후 MD5가 실제 서버 지문과 일치함을 확인했다. 실행 SQL 차이는 없다.
- relation owner/options(뷰 security_invoker 포함)·함수 owner·Storage 업로드 guard trigger 추가 59항목 모두 일치.
- 전체 Supabase 플랫폼 schema나 사용자 데이터의 동일성을 주장하지 않는다. inventory 쿼리는 `scripts/backend-schema-inventory.sql`에 재현 가능하게 보관한다.

## 적용

위 비교 후 공식 CLI `migration repair --project-ref ... --status applied`로 **13개 버전의 적용 이력만 등록**했다. migration SQL 재실행·데이터 이동·RLS 변경·비밀번호 변경은 하지 않았다. 기존 DB 버전 이름에 대응하는 migration 파일은 수정하지 않았다. 일상 배포에서 repair를 반복하는 절차는 아니다.

이전 schema dump는 CLI 임시 DB 로그인 실패로 미완료였고, Dashboard의 읽기 전용 조회/CSV export로 비교를 완료했다. 최초 배포 검사 결과는 해당 시점의 이력 불일치를 설명하는 기록이며 최신 상태는 이 문서를 따른다.

후속 CLI migration list에서 local/remote 13개가 모두 일치했고, `db push --dry-run`은 upToDate=true·migrations/seeds/roles 빈 배열이었다. 관리형 DB를 다시 적용하지 않았다. CLI의 migration 출력은 `--output-format json`을 사용해야 구조화되므로 검사 명령도 맞췄다.
