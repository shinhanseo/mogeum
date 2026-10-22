# 디자인 기준과 화면 지도

[Figma 원본](https://www.figma.com/design/T99YyZulPfJaSkW7tq4xcn/모금). `01 · 디자인 시스템`, `02 · 컴포넌트`, **`04 · 화면 정리본`**을 사용한다. `99 · 보관 — 이전 화면`은 구현 기준이 아니다. 파일 접근 권한은 별도이며 이 링크가 공개 권한을 부여하지 않는다.

## 톤과 공통 요소

| 토큰 역할 | 값 |
|---|---|
| background/default | #FAF7F2 |
| surface/card | #FFFDFA |
| action/primary | #783F4B |
| rose surface | #F2E5E8 |
| text/primary | #332D2B |
| text/secondary | #776B65 |
| border/default | #E6DDD4 |

Noto Sans KR를 사용한다. Figma의 Display 40, Heading1 28, Heading2 24, Heading3 20, Body 16, BodySmall 14, Label 14, Caption 12와 Button 15, Chip 13 스타일을 먼저 대조해 앱 토큰으로 옮긴다. 기본 간격은 4/8/12/16/24/32/48, 라운드 12/16/24/full. 숫자는 dp 기준의 출발점이며 safe area와 화면 너비에 맞춘다.

공통 버튼: Primary/Secondary/Text × Default/Pressed/Disabled, 주요 행동 높이 52. 선택 칩: Selected/Disabled. 중앙 정렬은 텍스트 길이·폰트·아이콘 포함 상태에서 확인한다. 바텀탭: 나의 술장 / 중앙 56px + / 내 취향. 가운데 +는 기록 시작 행동이며 선택 상태가 없다. 하트 상단 clipping을 재발시키지 않는다. 일반 술장에서는 중복 기록 CTA를 두지 않고 빈 술장에서만 첫 사진 안내를 둔다.

## 화면 지도

| 번호 | 화면/기준 |
|---|---|
| 01–03 | 온보딩 3단계 |
| 04 | 로그인·둘러보기 |
| 05–07, 27 | 빈 술장·선반 술장·스크롤·전체 술장 |
| 08 | 이름·주종·취향 검색 |
| 09 | 이전 취향 요약안. 28·29로 대체 |
| 10–17 | 기록 시작·사진 확인·주종·질문·노트 미리보기·완료 |
| 18–19 | 사진만 있는 상세 / 노트가 있는 상세 |
| 20–21 | 다른 사람의 느낌 예시. 공개 커뮤니티는 기본 출시 범위에서 제외 |
| 22–26 | 기본 정보·느낌 수정과 노트 확인 |
| 28–29 | 초기 2개 기록 / 축적 8개 기록 AI 취향 요약 |
| 30–31 | 축적 / 초기 취향 근거 기록 |
| 32 | 메뉴판 업로드 시작. 최대 5장 안내로 수정됨 |
| 33 | **여러 사진의 통합 메뉴 확인**. 사진 3장·중복 3개·고유 메뉴 8개 예시 |
| 34 | 이전 메뉴 추천안. 37로 대체 |
| 35–36 | 마셔본 술 추천 이유 / 동일 이름 제품 확인 후보 |
| 37 | **최신 추천**. 새로운 술 우선·익숙한 술·원본 위치·사진 추가 |
| 38–39 | 새로운 술의 닮은 점·다른 점 / 비교에 쓰인 내 기록 |
| 40 | 사진 여러 장 관리·사진별 삭제·재촬영·읽기 상태 |
| 41 | 원본 메뉴판 1/3장과 추천 메뉴 위치 표시 |

번호 순서가 이동 순서는 아니다. 최신 메뉴 흐름은 32 → 40 → 33 → 37 → 38 → 39, 원본 위치는 37 → 41이다. 같은 ID의 33·37은 최신 내용으로 수정된 상태다.

## 직접 열기

- [술장 06](https://www.figma.com/design/T99YyZulPfJaSkW7tq4xcn/모금?node-id=4-3139)
- [취향 초기 28](https://www.figma.com/design/T99YyZulPfJaSkW7tq4xcn/모금?node-id=9-7442) / [축적 29](https://www.figma.com/design/T99YyZulPfJaSkW7tq4xcn/모금?node-id=9-7517)
- [메뉴판 시작 32](https://www.figma.com/design/T99YyZulPfJaSkW7tq4xcn/모금?node-id=9-7760)
- [사진 관리 40](https://www.figma.com/design/T99YyZulPfJaSkW7tq4xcn/모금?node-id=9-8329) / [통합 확인 33](https://www.figma.com/design/T99YyZulPfJaSkW7tq4xcn/모금?node-id=9-7820)
- [추천 37](https://www.figma.com/design/T99YyZulPfJaSkW7tq4xcn/모금?node-id=9-8109) / [비교 38](https://www.figma.com/design/T99YyZulPfJaSkW7tq4xcn/모금?node-id=9-8163) / [근거 39](https://www.figma.com/design/T99YyZulPfJaSkW7tq4xcn/모금?node-id=9-8214)
- [원본 위치 41](https://www.figma.com/design/T99YyZulPfJaSkW7tq4xcn/모금?node-id=9-8522)

## 에셋과 구현

모구는 물방울 몸·사진 주머니가 있는 버건디 앞치마 캐릭터. 사용 가능한 Figma 벡터 원본을 추출해 사용하고 임의의 새 캐릭터로 바꾸지 않는다. 현재 저장소에는 주종 일러스트 4종만 있다. 모구·제품 사진은 아직 앱용으로 반출하지 않았으며 별도 이슈에서 원본과 사용 범위를 확인한다.

사진 없는 술은 assets/illustrations의 고정 SVG를 사용한다. 실제 병이나 라벨처럼 생성해 오인시키지 않는다. 사용자 사진은 원본 비율에 맞게 crop하고 사진만 저장한 상세와 노트 상세를 구분한다. 첫 기록 진입, 질문 skip, 뒤로 가기, 완료, 수정 취소, 키보드, 로딩, 빈 상태, 오류 상태를 포함한다. 프레임 설명은 개발 문서이며 제품 화면에 그대로 붙이지 않는다.

## 반복 음용 구현 · 2026-10-22

04의 19(4:4227) 재음용 행동과 기존 11/평가 화면을 재사용한다. 이름·주종만 미리 채운 기존 정보 폼에서 시작하며 사진이 없으면 `사진 추가`로 표시한다. 18 사진 기록의 기본 CTA는 노트 추가, 19 노트 기록의 기본 CTA는 한 번 더 기록하기로 유지하고, 다른 행동은 공통 text 버튼으로 분리했다. 두 번째 text 행동과 반복 기록 안내 문구는 구현 확장 상태이며 원본 픽셀 일치로 주장하지 않는다. 술장 다회 기록은 기존 카드 분류 아래와 같은 타이포로 `기록 N회`를 표시한다. 근거 원본 측정은 docs/verification/figma-reference/detail.json, record-info.svg, record-rating.svg.
