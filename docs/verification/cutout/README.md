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
