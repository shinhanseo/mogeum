# 개발 서버 배포 검사 · 2026-10-26

- 실제 5개 함수가 ACTIVE이며 handler 인증 구성과 필수 서버 secret 이름을 확인했다. 값은 기록하지 않았다.
- 실제 관리형 endpoint에 고정된 잘못된 토큰을 보냈고 모두 401을 반환했다. 삭제 endpoint는 확인 요청 형식을 맞춘 뒤 검사했다. 실제 계정 토큰이나 삭제 성공 테스트가 아니다.
- CLI migration list에서 local 13개, remote 이력 없음. 기존 SQL Editor 적용 문서와 일치한다. 실제 SQL 재적용/repair는 하지 않았다.
- 관리형 public schema dump는 CLI 임시 DB 인증 실패로 미완료. 로컬 schema만 읽었으며 둘의 동일성을 주장하지 않는다.
- 읽기 전용 검사에 등록되지 않은 환경·함수 누락·서버 설정 누락·미등록 migration·알 수 없는 remote migration 차단을 추가했다.
- 타입·린트·계약 검사, 테스트 355개 중 347 통과·8 환경 의존 skip.
- Android 최종 Release APK는 전용 에뮬레이터에 설치, cold start 2.84초, 프로세스 유지와 최근 crash buffer에 해당 앱 없음 확인. UI 시각 검사 및 실제 로그인은 별도다.

현재 자동 운영 배포 준비 완료가 아니다. DB 이력/스키마 정합성 및 운영 전용 프로젝트가 필요하다. [실행 절차](../../deployment/README.md)를 따른다.
