# 모금 0.1.0 · 베타 준비

목표는 Expo/Metro를 켜지 않고 설치해 실제 로그인·기록·요약·메뉴판 추천을 확인하는 내부 QA 빌드다. **기술 빌드가 가능하다는 것과 외부 테스터 모집 승인은 다르다.** 현재는 개발 Supabase 프로젝트를 사용한다.

## 빌드 경로

| 프로필 | 산출물 | 용도 | 직접 인증 필요 |
|---|---|---|---|
| development | Dev Client | 개발/기존 로컬 식별자 유지 | 기존 설정 |
| preview | Android APK / iOS Ad Hoc | 서버 없이 독립 실행하는 내부 QA | Android는 EAS 서명, iOS는 Apple 서명/기기 등록 |
| preview-simulator | iOS Simulator 앱 | Mac의 시뮬레이터용 Release QA | Apple 배포 서명 불필요 |
| beta-store | Android AAB / iOS IPA | Play 내부 테스트/TestFlight 업로드 준비 | 스토어 계정·서명·제출 동의 |

스토어 제출은 자동으로 실행하지 않는다. preview-simulator 앱은 실제 iPhone에 설치할 수 없다. 빌드별 다운로드 주소/서명 정보는 공개 저장소에 넣지 않고 소유자에게 별도 전달한다.

## 연결

- EAS: @shinhanseo/mogeum. 앱 설정에 프로젝트 UUID를 연결했다.
- 베타 식별자: iOS/Android `com.hanseo.mogeum`. 개발용 com.example 식별자는 유지한다.
- 베타 로그인: `mogeum-beta://auth/callback`. 기존 개발 앱의 `mogeum-dev`와 분리하고 Supabase에 정확한 주소 하나만 추가했다. 와일드카드를 넓히지 않았다.
- preview 환경에는 Supabase URL과 publishable key만 등록한다. 서버/AI 키는 앱/EAS 클라이언트 변수에 넣지 않는다.
- 베타 앱에는 기존 모구 벡터를 재사용한 아이콘/스플래시를 넣는다. 새 캐릭터 디자인이 아니다.

## 실행

```sh
npm run beta:check        # 식별자·프로젝트·공개 변수·실제 OAuth 설정 읽기 검사
npm run beta:ready        # 위 검사 + 문서 URL/소유자 검토 확인. 아직 통과하지 않는 것이 정상
npm run beta:scan -- /path/to/app.apk
npx eas-cli build -p android --profile preview
npx eas-cli build -p ios --profile preview-simulator
```

`beta:check`는 실제 사용자 로그인/저장 검증이 아니다. `beta:scan`은 APK의 내장 JS/Hermes 번들에서 알려진 서버 키/개발 probe 패턴을 검사한다. 탐지된 값 자체는 출력하지 않는다. 모든 비밀 유출을 증명하는 도구는 아니며 `.easignore`·환경 변수 분리와 함께 사용한다.

## 외부 모집 전에 소유자가 마칠 일

1. [실제 데이터 처리 내역](data-inventory.md)을 검토하고 책임자/문의처·보관 정책·위탁/국외 처리 고지를 확정한다. 이를 실제 개인정보 문서와 이용약관으로 게시한다.
2. `EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_TERMS_URL`에 게시한 HTTPS 주소를 설정하고 앱 내 연결을 확인한다. 로그인의 기존 약관·개인정보 문구에서 각 문서를 열도록 연결했다. URL이 없거나 잘못되면 준비 안내를 표시한다. 게시 주소가 없으므로 실제 문서 열기 검증은 아직 미완료다.
3. 문서/범위를 직접 검토한 후에만 `MOGEUM_BETA_OWNER_REVIEWED=1`로 외부 배포 검사를 실행한다. 이 값은 법률 검토나 스토어 승인 대신이 아니다.
4. 실제 iPhone/TestFlight에는 Apple 계정 인증·서명·필요한 동의가 남는다. 결제·약관 동의는 자동으로 하지 않는다.
5. 실제 Apple/Kakao 연결 해제는 삭제 가능한 별도 계정으로 확인한다. 정상 계정을 시험 삼아 삭제하지 않는다.

내부 QA에서도 자신의 실제 기록 대신 지워도 되는 테스트 기록을 권장한다. 알려진 미검증 범위는 [테스터 안내](tester-guide.md)를 참고한다.

Android 직접 확인은 [실기기 수동 QA 체크리스트](android-manual-qa.md)를 사용한다. 갤럭시 설치·실행과 핵심 기능 전체 QA를 구분하며, 삼성 키보드/시스템 Back/권한/실사 OCR 등의 미검증 항목을 따로 남긴다.

보안 점검: [Expo CLI upstream 권고와 runtime 포함 범위](../verification/dependency-audit/README.md). 빌드 도구 의존성 권고는 #112에서 미해결로 추적하며 임의 major override/downgrade는 적용하지 않는다.

스토어 등록 문안은 [한국어 초안](../store/metadata-ko.md)에 정리했다. 아직 스토어에 게시하지 않았다.

2026-10-26 관리형 synthetic 계정 회귀: 실제 Auth·사진 binary·기록 생성/삭제, 타인 보존, 삭제 세션 응답 재확인 등 7항목 통과·fixture 정리 완료. [결과](../verification/provider-deletion/beta-regression-20261026.json). 실제 Apple/Kakao grant 해제와는 별도다.

기존 DB에서 기록 사용자·현재 확정 노트를 집계하는 [읽기 전용 코호트 도구](metrics.md)를 추가했습니다. 설치/재방문·추천 실행 이벤트와 구분하며 관측 전체 완료로 처리하지 않습니다.
