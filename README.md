# 모금 · Mogeum

사진으로 가볍게 남기는 술 기록과 내 취향 기반 메뉴판 추천 앱.

위스키·와인·맥주·전통주를 가리지 않고 즐기지만 긴 테이스팅 노트는 부담스러운 사람을 위한 iOS·Android 앱입니다. 사진만 저장해도 기록이 되고, 느낌이 쌓이면 좋아했던 술을 다시 찾거나 처음 보는 술을 고를 때 활용합니다.

## 현재 상태

**공통 UI와 술장·기록 진입 화면을 구현 중입니다.** 색상·폰트 토큰, 버튼·선택 칩·가운데 + 바텀탭, 3열 선반과 빈 술장, 사진 선택→기본 정보→평가 화면과 날짜·주종·빈티지 선택이 있습니다. 기록 DB 마이그레이션·RLS·저장/수정/이동 RPC 기반을 추가했습니다. 앱의 실제 저장·로그인·AI·배포된 백엔드는 아직 연결되지 않았습니다. 저장 버튼은 미연결 상태를 표시합니다. [Figma 정렬 결과와 남은 검증](docs/verification/figma-alignment.md)를 참고하세요. 개발 시작점은 [개발 로드맵](docs/milestones.md)과 [이슈 지도](docs/issue-map.md)입니다.

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
- [기록 저장 기반 검증](docs/verification/record-storage.md)
- [앱 초기 설정 검증 결과](docs/verification/bootstrap.md)

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

Node **24.22.0**, npm **11.12.1**, Expo **58.0.14**, React Native **0.88.0**, React **19.3.0** 기준입니다. 실제 의존성은 package-lock.json에 고정합니다.

```sh
nvm use
npm ci
npm run check
npm run web
```

설정 없이도 개발 상태 화면이 열립니다. 서버를 연결할 때 `.env.example`을 `.env`로 복사하고 Supabase URL/Publishable key를 설정합니다. 앱이 표시하는 설정 확인은 네트워크 연결 성공을 뜻하지 않습니다.

Development Build는 `npm run ios` / `npm run android`로 만듭니다. Xcode 또는 Android SDK와 JDK가 필요하며 번들 식별자를 환경 변수로 지정해야 합니다. [개발 환경 설정](docs/setup.md)의 명령을 참고하세요. 네이티브 앱 설치 후 `npm start`로 Metro를 실행합니다. Web 확인은 네이티브 OCR·실기기 검증을 대체하지 않습니다.
