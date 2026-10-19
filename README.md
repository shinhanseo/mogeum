# 모금 · Mogeum

사진으로 가볍게 남기는 술 기록과 내 취향 기반 메뉴판 추천 앱.

위스키·와인·맥주·전통주를 가리지 않고 즐기지만 긴 테이스팅 노트는 부담스러운 사람을 위한 iOS·Android 앱입니다. 사진만 저장해도 기록이 되고, 느낌이 쌓이면 좋아했던 술을 다시 찾거나 처음 보는 술을 고를 때 활용합니다.

## 현재 상태

**개발 준비 단계입니다. 실행 가능한 앱이나 배포된 백엔드는 아직 없습니다.** 이 저장소에는 제품·디자인·기술 기준, 작업 이슈와 주종별 SVG 에셋이 있습니다. 개발 시작점은 [개발 로드맵](docs/milestones.md)과 [이슈 지도](docs/issue-map.md)입니다. 예시 화면의 메뉴·가격·사용자 기록은 실제 운영 데이터가 아닙니다.

## 출시 범위

- 사진만으로 기록 → 질문형 테이스팅 노트 → 술장·검색·상세·수정·삭제·재음용 기록
- 기록이 적을 때의 첫 발견 / 기록이 쌓인 뒤의 AI 취향 요약 / 근거 기록 확인
- 메뉴판 최대 5장 → 기기 OCR → 서버 메뉴 해석 → 사용자 수정 → 내 취향 기반 추천
- 처음 보는 술과 내 기록의 닮은 점·다른 점, 제품 정보 출처, 원본 메뉴판 위치 확인

**AI 취향 요약과 메뉴판 분석은 출시 전 필수 범위입니다.** 멘토 데모는 전체 흐름이 실제 저장·실제 AI 호출로 이어지는 것을 목표로 합니다. 정확한 데모 마감 날짜는 아직 확인되지 않았으며 임의의 날짜를 확정하지 않았습니다.

## 기술 방향

| 영역 | 기본안 |
|---|---|
| 앱 | React Native + Expo Development Build + TypeScript + Expo Router |
| UI | StyleSheet 기반 토큰·공통 컴포넌트, Noto Sans KR |
| 상태 | TanStack Query: 서버 데이터 / Zustand: 작성 중 상태 |
| 서버 | Supabase Auth + PostgreSQL + Private Storage + TypeScript Edge Functions |
| OCR | 기기 실행을 우선. ONNX는 후보이며 ML Kit와 실기기 검증 후 결정 |
| 추천 | 서버에서 제품 확인·출처 있는 특징·내 기록을 비교. AI는 근거에 맞춰 설명 |
| 빌드 | EAS 또는 로컬 네이티브 빌드. iOS·Android 모두 검증 |

## AI가 작업을 시작하는 순서

1. [AGENTS.md](AGENTS.md)를 읽습니다.
2. [제품 범위](docs/product.md), [디자인 기준](docs/design.md), [구조](docs/architecture.md)를 읽습니다.
3. 이슈의 선행 작업과 완료 조건을 확인하고 기능별 브랜치에서 작업합니다.
4. 구현 → 관련 검증 → 스크린샷·한계가 포함된 PR → 문서 갱신 순서로 진행합니다.
5. 화면만 붙이거나 예시 응답을 반환한 상태를 실제 기능 완료로 보고하지 않습니다.

## 문서

- [개발 이슈 지도와 전체 체크리스트](docs/issue-map.md)

- [제품 정의와 사용자 흐름](docs/product.md)
- [디자인·피그마 화면 지도](docs/design.md)
- [기술 구조와 저장소 구성](docs/architecture.md)
- [데이터 모델](docs/data-model.md)
- [서버 API·OCR 계약](docs/api-contracts.md)
- [AI 취향 요약·OCR·추천 파이프라인](docs/ai-pipeline.md)
- [주종별 질문 기본안](docs/tasting-guide.md)
- [검증·평가 기준](docs/testing.md)
- [개발 순서와 멘토 데모](docs/milestones.md)
- [환경 설정·운영](docs/setup.md)
- [AI 작업 전달·PR 규칙](docs/development-workflow.md)
- [확정 사항·남은 결정](docs/decisions.md)
- [주종별 일러스트](assets/illustrations/README.md)

## 디자인

[Figma · 모금](https://www.figma.com/design/T99YyZulPfJaSkW7tq4xcn/모금) → `04 · 화면 정리본`을 기준으로 합니다. 최신 메뉴판 흐름은 **32 → 40 → 33 → 37 → 38 → 39**, 추천 메뉴 원본은 **41**입니다. 화면 번호와 실제 이동 순서는 다릅니다. Figma 접근 권한은 별도로 필요할 수 있습니다.

## 실행 안내

아직 package.json, 앱 코드, Supabase 마이그레이션은 없습니다. 부트스트랩 이슈에서 실제 설치 버전을 고정하고 실행·검증 명령을 이 문서에 추가합니다. [환경 변수 예시](.env.example)에 비밀 값은 포함하지 않았습니다. Public 레포이므로 실제 키·개인 사진·로그인 토큰을 커밋하지 않습니다.
