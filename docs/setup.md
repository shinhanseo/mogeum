# 환경 설정과 운영

사진 기록·Apple/Kakao 인증·Supabase 서버 연결을 구현했다. 최신 베타 빌드 준비와 미검증 범위는 [베타 안내](beta/README.md)를 기준으로 확인한다.

## 준비 순서

1. 부트스트랩에서 사용할 Node LTS·패키지 매니저·Expo/RN 호환 버전을 선택하고 lockfile과 실행 스크립트를 커밋한다.
2. 사용자가 소유한 Supabase 개발 프로젝트를 연결한다. 결제나 새 유료 요금제를 임의로 시작하지 않는다.
3. migration·RLS·private bucket 정책을 코드로 관리하고 로컬/개발 환경에 적용한다.
4. OAuth provider 설정·딥링크·번들 식별자를 두 플랫폼에서 검증한다. bundle ID는 소유자 확인 후 고정한다.
5. AI 모델 API는 서버 secret으로 설정한다. provider/model 선택 전 실제 메뉴판과 요약 평가를 진행한다.
6. Development Build를 두 플랫폼에 설치하고 OCR 네이티브 모듈을 검증한다.

## 환경 변수

.env.example에는 자리표시자만 있다. EXPO_PUBLIC_ 값은 앱 번들에 노출된다. Supabase URL과 publishable key를 넣을 수 있으나 service role·provider secret은 절대 넣지 않는다. Supabase 권한은 publishable key를 숨기는 방식이 아니라 JWT/RLS로 통제한다. 로컬 .env와 서버 secret 저장소에 실제 값을 넣고 로그·PR·이슈에 붙이지 않는다.

## 사진

기록과 메뉴판을 비공개 bucket 또는 명확한 prefix로 나눈다. 사용자별 Storage 정책과 signed URL 만료를 설정한다. DB에는 만료되는 URL 대신 안정적인 storage path를 저장한다. orphan 정리와 삭제 실패 재시도를 준비한다. 이미지 최대 크기·확장자·압축·동시 업로드 수는 실기기 측정으로 확정한다. 앱에서 회전 정리한 canonical 이미지와 OCR 좌표 기준을 일치시킨다.

## 배포·관측

테스터용 개발/프리뷰와 운영 환경을 구분한다. iOS/Android 빌드, 서명, 권한 문구, OAuth redirect, 앱 아이콘·스플래시, 개인정보 처리 고지·계정 삭제 흐름을 배포 이슈에서 점검한다. 로그는 correlation/job ID 위주로 하고 사용자 사진·메모·토큰을 수집하지 않는다. AI 호출 횟수·지연·실패·재시도·캐시 사용을 관찰하고 한도를 둔다.

서버 function을 수정하면 해당 기능의 migration/API/schema 버전을 함께 검토한다. production destructive migration이나 실제 사용자 데이터 purge는 별도 배포 절차에서 다룬다. seed는 합성 데이터만 사용하고 demo account와 실제 사용자를 혼동하지 않는다.

## 로컬 실행 (초기 설정)

Node 24.22.0 / npm 11.12.1. `nvm use && npm ci` 후 `npm run check`로 타입 검사·린트·환경 설정 테스트를 실행한다. `npm run web`은 브라우저 확인용이다. `npx expo export --platform all`은 iOS/Android/Web 번들을 생성한다.

실제 설정은 `.env.example`을 `.env`로 복사한 뒤 입력한다. `.env` 변경 후 Metro를 재시작하고 앱을 새로고침한다. 화면의 재확인 버튼은 현재 번들에 주입된 설정을 다시 읽는 동작이다. 누락/자리표시자/잘못된 URL은 앱에서 설정 안내를 표시한다. 새 `sb_publishable_` 키를 사용한다. AI provider/service role 키를 앱에 넣지 않는다. 서버 SDK와 OAuth 연결 코드가 있으며 provider 등록 전에는 로그인할 수 없다. 현재 적용 상태와 수동 migration history 주의사항은 docs/verification/live-records.md를 참고한다.

```sh
# 아래 com.example 값은 로컬 검증용이며 스토어 식별자가 아니다.
MOGEUM_IOS_BUNDLE_ID=com.example.mogeum.dev npm run ios
MOGEUM_ANDROID_PACKAGE=com.example.mogeum.dev npm run android
npm start
```

식별자를 바꿀 때는 두 값을 모두 설정하고 `npx expo prebuild --clean`으로 재생성한다. ios/android는 생성 출력이므로 Git에서 제외한다. 실제 출시용 bundle ID와 서명은 소유자 확인 후 설정한다. Apple Developer 로그인이나 클라우드 프로젝트 생성은 이 초기화에 포함하지 않는다.

EAS 프로젝트를 연결했고 development/preview/preview-simulator/beta-store 프로필을 구성했다. preview 환경은 개발 Supabase에 연결한다. 빌드 산출물 검증과 외부 배포 조건은 [베타 안내](beta/README.md)에 구분한다. SDK 58 선택 근거: [공식 생성 가이드](https://docs.expo.dev/get-started/create-a-project/), [Development Build 가이드](https://docs.expo.dev/develop/development-builds/introduction/).

2026-10-23 기준 기본 수정·사진 완료 확인(20261022160000) 및 삭제 영수증(20261022161000)까지 mogeum-dev에 수동 적용했다. 기존 3개와 합쳐 총 5개 migration의 CLI history 정합성 복구가 필요하다. 이전 SQL을 db push로 중복 실행하지 않는다. [적용 증거와 검증](verification/record-edit.md)을 참고한다.
