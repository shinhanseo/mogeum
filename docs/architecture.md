# 기술 구조

상태: 구현 전 기본 설계. 실제 라이브러리 버전과 OCR 엔진은 검증 이슈에서 고정한다.

## 구성

React Native + Expo Development Build + TypeScript 앱이 Supabase Auth로 인증한다. 일반 기록 CRUD는 RLS가 적용된 Supabase Data API/SDK를 사용한다. 사진은 비공개 Storage에 직접 업로드하고 DB에는 경로·크기·상태를 저장한다. AI/공통 제품 정보 갱신/복수 테이블 확정 작업은 Edge Functions 또는 트랜잭션 RPC가 담당한다.

서버 함수는 검증된 사용자 JWT를 확인하고 요청 소유권을 검사한다. 서버 권한으로 읽는 경우에도 사용자 범위를 명시한다. 클라이언트의 userId나 분석 결과는 신뢰할 수 있는 권한 근거가 아니다. 공통 제품 정보는 클라이언트가 직접 출처 검증 완료로 쓸 수 없게 한다.

## 앱 경계

- Expo Router: 탭·기록 작성·상세·메뉴 추천 스택. +는 composer 진입.
- TanStack Query: 원격 기록·술장·취향 요약·분석 상태. 키에 사용자·세션·버전 포함.
- Zustand: 질문 답변·사진 선택·수정 중 draft. 인증 토큰이나 서버 데이터 전체를 중복 저장하지 않는다.
- Repository/service 모듈: 화면과 SDK/AI/OCR 구현 분리.
- OCR adapter: 사진 ID, canonical 이미지 크기, 텍스트와 정규화 좌표를 반환. ONNX와 ML Kit 교체 가능.
- 서버 결과 schema validation: 런타임 검증 라이브러리는 부트스트랩에서 고정.

## 권장 폴더 구조

아직 아래 앱 폴더는 생성되지 않았다. 부트스트랩 이슈에서 불필요한 패키지 분리를 피하고 단일 Expo 앱으로 시작한다.

```text
app/                     Expo Router routes
src/components/          Button, ChoiceChip, BottomTabBar, cards
src/theme/               colors, typography, spacing
src/features/            records, cellar, taste, menu
src/lib/                 supabase, queryClient, env
src/services/ocr/         engine adapter, coordinate mapping
src/contracts/           runtime schemas and shared DTOs
assets/illustrations/    committed static SVGs
supabase/migrations/     schema, RLS, indexes, RPC
supabase/functions/      taste-summary, menu-parse, recommend-menu
supabase/seed.sql         synthetic development data only
tests/fixtures/          synthetic OCR and AI fixtures
```

## 처리를 잃지 않는 설계

사진마다 upload/ocr/parse 상태를 영속화하고 세션 상태를 집계한다. 앱 재시작 후에도 사진 접근이 가능하도록 안정적인 앱 영역에 draft를 보관한다. 취소·실패·재시도·완료를 구분한다.

사진 업로드 성공·DB 저장 실패의 고아 파일과 DB 저장 성공·응답 단절의 중복 저장을 처리한다. client operation ID와 unique 제약을 사용한다. DB와 Storage가 원자적 트랜잭션이라고 가정하지 않는다. 삭제는 소유권 확인 후 DB 상태와 재시도 가능한 파일 삭제 작업을 일치시킨다.

## AI 처리

외부 모델 호출·동시 처리·횟수·재시도는 서버에서 제어한다. Edge Functions 실행 시간 제약을 고려해 사진별로 처리한다. 필요하면 durable queue와 consumer를 추가한다. 큐 자체가 작업을 실행하는 것은 아니며 메모리의 background promise를 내구성 있는 작업의 대체물로 쓰지 않는다. 세부 사항은 docs/ai-pipeline.md.

## 아직 고정하지 않는 것

특정 AI 모델명, OCR 모델/변환 방식, 벡터 DB, 큐 제품, 유료 요금제. 도입 시 공식 문서·실기기·의존성 호환성을 확인하고 선정 이유를 docs/decisions.md에 기록한다.
