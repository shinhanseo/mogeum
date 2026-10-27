# 술장 피사체 배경 분리 · 초기 검증

관련 #96, #7, #21. 사진 상세 → ‘술장에 배경 없이 놓기’ → 원본/누끼 미리보기 → 이 기기의 술장에 표시. 원본 사진/감각/추천 근거는 변경하지 않는다. `@rbayuokt/expo-background-removal@0.1.0`의 일반 물체 분리(Apple Vision iOS17+, Android ML Kit Subject Segmentation)를 사용한다. MIT 패키지이며 별도 생성형 이미지 API를 호출하지 않는다.

## 실제 확인한 결과

- Expo58/RN0.88 Android arm64 debug native build 통과. Expo dev launcher의 barcode 모델 manifest와 충돌하던 항목은 config plugin으로 `barcode_ui,subject_segment`를 합쳐 해결했다.
- Android emulator-5556 / API37 / Google Play 서비스에서 앱에 있던 `assets/fixtures/figma-whisky.jpg`(384×512) 1장을 실제 ML Kit로 처리했다. 사용자의 개인 사진이나 실물 촬영 품질 평가를 뜻하지 않는다.
- 첫 호출은 optional model 다운로드 대기 오류. 다운로드 후 재실행은 1,119ms, 201×447 RGBA PNG, alpha range 0–255. 결과 `android-cutout.png`, 측정 `android-report.json`.
- CUA에서 편집 화면의 ‘배경 없이’를 눌러 원본→분리 결과를 실제로 확인했고, ‘원본 사진’으로 복귀도 확인했다. `android-editor.png`는 실제 UI.
- 병과 겹친 앞 잔이 함께 남았다. 투명한 유리 안의 원래 배경색까지 복원하지는 못한다. 생성형 모델의 재구성이나 수작업 경계 보정은 하지 않았다.

## 저장과 경계

현재 선택은 서버 원본의 storage path+SHA256에 연결한 **기기 로컬 표시 캐시**다. 서버 저장·다른 기기 동기화는 포함하지 않는다. 캐시 유실 시 원본으로 표시한다. 이름만 같은 다른 술에 재사용하지 않으며 사진 교체 시 원본 path가 달라져 이전 누끼는 적용하지 않는다.

표시 캐시는 계정별로 분리하고 삭제 동결 대상에 포함한다. 적용 전·복사 후 현재 계정을 재확인하고, 탈퇴 시 해당 계정의 표시 캐시만 정리한다. 파일명과 소유자·원본 경로를 검증하고 네이티브 출력만 복사한다. 네이티브 호출은 직렬화하고 긴 변을1600px로 제한한다. 편집 화면을 닫으면 생성 중의 늦은 결과와 완료한 임시 누끼를 정리한다.

## 남은 검증

- 인증된 임시 계정의 실제 상세→적용→술장 재진입 전체 흐름, 탈퇴·동시 계정 변경·사진 교체의 기기 통합 검증은 아직 미완료. 관련 계약의 단위 회귀만 통과했다.
- 현재 Galaxy는 연결 해제 상태여서 해당 실기기 실행은 하지 않았다. 사용자 실제 세션/기록을 바꾸지 않았다.
- iOS pod 통합 성공. iPhone 실기기 배경 분리 검증은 미완료이며 simulator로 대체하지 않는다.
- 단일 예시 결과를 전 주종·어두운 사진·여러 병·투명 유리의 정확도나 처리 시간 보장으로 쓰지 않는다. 제품 자동 기본 적용 전에 추가 평가가 필요하다.
- 원본 Figma에 없는 누끼 편집 상태는 기존 cream/burgundy 토큰·Button·ChoiceChip·Header를 재사용한 확장 UI다. 픽셀 일치 검증은 주장하지 않는다.

최종 로컬 검사: 개발 작업 트리 `npm run check` 331개 중324개 통과/7개 환경 의존 skip. 인증 WIP와 이전 질문 수정에서 분리한 main 기반 리뷰 브랜치는 typecheck·lint·질문 계약 검사 및320개 중313개 통과/7개 skip. 테스트 개수 차이는 미병합 인증/질문 회귀를 리뷰 브랜치에 포함하지 않았기 때문이다.

### iOS 빌드 호환성 추가 확인

실제 simulator 양 아키텍처 빌드에서 패키지의 `BackgroundRemovalException.private message`가 Expo58 `Exception.message`와 충돌해 컴파일 실패했다. `detailMessage`로만 이름을 바꾸는 최소 patch-package 패치를 커밋하고 postinstall에서 재적용한다. 패치 후 Xcode `generic/platform=iOS Simulator` Debug 빌드가 **BUILD SUCCEEDED**로 끝났다. 실제 iPhone에서 Vision을 실행한 결과는 여전히 미검증이다. 패치 파일에는 빌드 산출물을 포함하지 않는다.

### 로컬 실제 Auth/Storage/DB 연결 검증 추가

`/dev/cutout-storage-probe?runId=...`를 별도 로컬 Metro8082에서 실행했다. 이 진단은 dev + 정확한 loopback API URL만 허용하고 기존 세션이 있으면 덮어쓰지 않고 중단한다. 명시적으로 생성한 임시 계정 2개만 사용한다. 결과 `android-storage-report.json`의9단계 모두 통과:

1. 실제 로컬 인증
2. Android native ML Kit 처리
3. 실제 원본 업로드·기록 RPC·상세 조회
4. 로컬 누끼 적용 후 DB 술장 재조회에서 cutout URI/파일 확인
5. 새 저장 읽기에서 표시 캐시 복원
6. 원본 복귀 후 누끼 없음·원본 사진 유지
7. 실제 사진 교체 RPC 후 이전 누끼 재사용 안 함
8. 다른 임시 계정으로 전환 후 이전 계정 누끼 적용 차단·이전 술장 안 보임
9. 해당 계정의 표시 캐시 정리

검증 후 명시된 private manifest에 있는 임시 계정/기록/원본 파일만 cleanup 스크립트로 정리했다. 버튼을 누른 전체 인증 UI E2E나 프로세스 재시작 캐시 복원은 이 probe가 검증하지 않는다. 일반 사용자 데이터·운영 서버는 사용하지 않았다. 위 ‘남은 검증’의 저장/사진 교체/계정 전환 경계는 이 추가 검증으로 확인했으며 Galaxy·iPhone 실기기와 전체 UI 검증은 남아 있다.

### CI runtime 재시작 경계

CI의 계정 삭제 API 검사가2회 `502 !== 401`로 실패했고, 같은 번들/검사는 로컬에서 통과했다. 새 번들을 한 번 확인한 직후 파일 감시 재시작이 이어지는 경계가 의심돼, 인증 없는 읽기성 probe에서 동일 build ID의401 응답이2초간 안정적으로 이어진 뒤 테스트를 시작하도록 보강했다. 실패/이전 빌드 응답은 안정 구간을 초기화한다. 실제 삭제/수정 요청을 재시도해서 실패를 숨기지 않는다. readiness 회귀와 로컬 실제 Auth/Storage 삭제 검사는 통과했으며 CI 재실행 결과는 별도로 확인한다.

### 사진 교체·삭제 후 표시 캐시 정리

후속 로컬 네이티브 검증 `android-storage-cleanup-report.json`의12단계가 모두 통과했다. 기존9단계에 사진 삭제 작업이 원본을 지우기 전에 로컬 누끼를 정리하는지, 삭제된 사진에는 늦게 도착한 누끼가 적용되지 않는지, 기록 삭제 시 누끼도 제거되는지를 추가했다. 정리 실패는 durable 삭제 작업을 완료 처리하지 않아 다음 실행에서 재시도한다. 적용 직전에도 서버의 소유자·ready 원본 존재를 다시 확인한다. 테스트에서 만든 임시 계정2개와 원본은 명시적 manifest로 정리했다. 운영 계정에는 삭제 요청을 보내지 않았다.

이 변경의 `npm run check`:325개 중318개 통과,7개 환경 의존 skip. Android emulator에서 실제 ML Kit와 로컬 Auth/Storage/DB를 연결했다. iPhone·Galaxy 실기기 품질 검증과 서버 누끼 동기화는 남아 있다.

CI HTTP harness는 Node 환경이라 Expo native filesystem을 로드할 수 없다. 해당 harness에 명시적인 derivative adapter를 주입해 소유자/경로 경계와 실제 서버 원본 삭제를 검사한다. native 파일 삭제 자체는 위 Android12단계 probe에서 별도로 확인했다. 정리 실패를 무시하고 원본을 지우도록 앱 코드를 완화하지 않는다.

### iOS Simulator 실제 실행 제약 (2026-10-26)

iPhone17 Pro/iOS26.5 Simulator에 배경 분리 모듈이 포함된 기존 성공 빌드를 덮어 설치하고, 계정·서버 쓰기가 없는 bundled sample probe를 실행했다. Apple Vision은 `Could not create inference context` 및 CPU fallback이 없어 Simulator에서 foreground segmentation을 실행할 수 없다는 오류를 반환했다. 컴파일 성공과 실제 Vision 실행 성공은 다르다. iPhone 물리 기기 검증은 여전히 남아 있다. 로그인·기록·서버 삭제 검증 전체가 물리 기기를 요구하는 것은 아니다.

누끼 오류 안내는 플랫폼별로 구분한다. Simulator에는 실제 iPhone/원본 사용 안내, 일반 iOS 실패에는 사진 재시도/원본 안내를 표시한다. Android 첫 모델 다운로드 안내는 Android에만 유지한다. 기존 토큰·레이아웃·공통 컴포넌트는 변경하지 않았다. 사용자 계정 삭제·로그아웃·실제 사진 처리는 하지 않았다.


### Galaxy Release 최적화 보완 · 2026-10-27

[Galaxy QA](../galaxy-taste-cutout/README.md)에서 Debug 실제 처리(756ms, 201×447 PNG)와 minified Release 내부 provider null 오류를 구분해 재현했다. subject와 ML Kit common 패키지 보존 후 같은 기기의 Release 처리 완료를 확인했다. config plugin이 Expo prebuild 때 별도 proguard 파일을 연결한다. iPhone 물리 기기 검증과 다양한 실제 사진의 품질 검증은 계속 남아 있다.
