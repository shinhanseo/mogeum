# 베타 의존성 보안 점검 · 2026-10-26

`npm audit --omit=dev`는 root 경로에서 high 5건, server functions 경로에서 0건을 보고했다. root 5건은 두 하위 패키지와 Expo 상위 의존성의 연쇄 표시다. 0건으로 숨기기 위한 의존성 이동·강제 downgrade/override는 하지 않았다.

- [node-forge 권고](https://github.com/advisories/GHSA-86w9-cpqp-85rv): <=1.4.0 영향, 확인 당시 patched version 없음. registry 최신 1.4.0.
- [Zod 권고](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5): <4.6.6 영향. SDK58의 CLI 58.1.15는 ^3.25.76을 요구한다. 서버는 이미 4.6.7 고정.
- npm fix가 제안한 Expo44는 현재 RN/SDK와 맞지 않아 적용하지 않았다. 암호 검증을 임의 수정하지 않았다.

Android production Metro export와 source map을 생성했다. 1,478개 source에서 node-forge/Zod는 0개, @expo/cli는 Metro require shim 1개였다. 이 export 범위의 앱 JS에 취약 패키지가 포함되지 않은 것과 빌드 도구의 미해결 권고는 구분한다. 실제 APK 전체·네이티브 의존성·공급망 위험 전부를 검증한 결과는 아니다.

이 항목은 [#112](https://github.com/shinhanseo/mogeum/issues/112)에서 upstream 수정을 추적한다. 외부 배포 검토에 남은 항목이며 보안 점검 전체 완료로 표시하지 않는다. 서버/클라이언트 dependency audit와 production export를 실행했고 앱/서버 코드는 바꾸지 않았다.
