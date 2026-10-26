# 베타 준비 검증 · 2026-10-26

- `npm run check`: 352개 중 344 통과, 8개 환경 의존 skip, 실패 0.
- `npm run beta:check`: 고정 EAS 프로젝트/식별자/공개 변수 및 실제 Apple·Kakao 활성 설정 확인. 실제 사용자 로그인 E2E와는 구분한다.
- Supabase 설정 diff의 유일한 변경은 `auth.additional_redirect_urls`에 베타 callback 추가. push 후 변경 0, 비밀키 전송 없음. 기존 provider 설정 유지.
- EAS archive에서 개발 probe 화면, `.env`, 네이티브 생성 폴더를 제외. 빌드는 preview 공개 환경 변수만 사용한다.
- `npm run beta:ready`는 문서 URL 2개와 소유자 검토가 없어 실패하는 상태가 정상이다. 기술 준비를 외부 배포 승인으로 표시하지 않는다.

iOS Simulator Release 산출물을 다운로드해 내장 Hermes 번들을 검사했고 알려진 서버 키/개발 probe 패턴은 발견되지 않았다. 번들의 실제 식별자 `com.hanseo.mogeum`과 `mogeum-beta` scheme을 확인했고, 부팅된 iPhone 17 Pro 시뮬레이터에 설치 후 프로세스 실행 성공을 확인했다. 화면·실제 사용자 로그인 성공을 이 검사로 대체하지 않는다. Android APK는 클라우드 빌드 중이며 아직 설치·실행 성공으로 처리하지 않는다. 실제 iPhone/TestFlight 서명과 실제 Apple/Kakao grant 해제 테스트는 포함하지 않는다. 개인 설치 주소나 서명 정보는 이 공개 문서에 기록하지 않는다.

Hermes 원시 문자열 테이블에서 SDK prefix와 인접 문자열이 합쳐지는 오탐을 발견해 disassembly 후 검사하도록 수정했다. 실제 Hermes 안전/위험 fixture 두 개를 컴파일하는 회귀 테스트를 포함한다.
