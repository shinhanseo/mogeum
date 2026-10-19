# 환경 설정과 운영

현재 문서/에셋만 초기화된 레포다. 개발 이슈에서 실제 환경을 만든 뒤 명령을 추가한다. 사용자가 이미 Apple Developer에 가입했다고 했으나 계정 접근, 서명, 실제 Supabase/EAS 프로젝트 연결은 아직 완료되지 않았다.

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
