# 생성 메뉴판 사진: 네이티브 OCR와 용량 분리 · #169

사용자 테스트용으로 내장 image_gen을 사용해 생성한 가상 메뉴 사진이다. 전체 8항목, 한영 혼합, 같은 와인 2024의 Glass 150ml/18,000원과 Bottle 750ml/90,000원을 구분한다. 실제 판매 가격이 아니다. 생성 원본/수동으로 확인한 기대값/프롬프트는 `assets/fixtures/ocr-benchmark/generated-bar.*`에 있다. 기존 결정론적 14개 manifest는 유지하며 `fixture=generated-bar`일 때만 별도 입력을 실행한다. fixture 이미지는 EAS 배포에서 제외된다.

## 실제 관측

iPhone Simulator/iOS26.5의 Apple Vision v2와 실제 앱의 사진 준비 파이프라인을 실행했다. 사용자 기록·서버 세션을 읽거나 변경하지 않는 개발용 benchmark다.

- 수정 전: OCR 이름 관측 8/8, 메뉴 후보 8개, 정확한 이름/가격/용량 연결은 3/8. `Glass`/`Bottle`만 용량으로 떼어내고 `150ml` 등이 이름에 남으며, `Pint`는 이름에 남는 문제.
- 수정 후 네이티브 재실행: 이름/가격/용량 연결 모두 8/8, 추가 잘못된 후보 0개. 와인 잔과 병은 다른 항목으로 유지한다.
- OCR 실행 시간은 각각 984ms/776ms다. 각 1회 측정이며 캐시·기기 상태가 달라 성능 개선으로 해석하지 않는다.
- raw OCR/좌표/원본 사진을 수정하지 않고 메뉴 해석만 변경했다. 이름에 포함된 `Bottled in Bond`가 용량으로 잘려 나가지 않는 회귀도 추가했다.
- 기존 39개 pinned native 결과, 기울어진 원본 세 종류와 기존 parser/benchmark 대상 검사 33개 통과. 새 captured-native 회귀를 추가했다.

이 이미지 한 장의 결과는 실사 술집/Android 정확도, 모든 주종/레이아웃 정확도를 뜻하지 않는다. 등록된 제품 위주의 메뉴이므로 미등록 술의 검색 능력·추천 적중률도 평가하지 않는다.

## 서버 반영

해석 버전을 geometry-v5로 올렸다. generated artifact의 실제 로컬 Auth/REST 메뉴 회귀를 통과한 뒤 기존 개발 프로젝트의 menu-recommend에 배포했다. `menu-e2f693a0ffc8af20` build 헤더와 잘못된 토큰의 401 응답을 확인했다. 사용자 실제 기록/사진은 변경하지 않았다. 새 메뉴판 분석 요청부터 적용된다.

추천은 여전히 출처 있는 제한된 카탈로그와 사용자 감각 기록 비교다. Gemini 실시간 제품 검색을 구현한 것으로 표시하지 않는다.

[테스트 PNG](../../../assets/fixtures/ocr-benchmark/generated-bar.png) · [기대 항목](../../../assets/fixtures/ocr-benchmark/generated-bar.json) · [생성 지시](../../../assets/fixtures/ocr-benchmark/generated-bar.prompt.txt)

전체 검사 410개 중 400개 통과, 환경 의존 10개 건너뜀, 실패 0. captured native 결과를 재생해 같은 원문/좌표에서 8개 이름·가격·용량과 미확정 상태가 보존되는 회귀를 추가했다.
