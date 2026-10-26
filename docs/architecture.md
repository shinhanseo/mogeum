# 기술 구조

현재 Expo 58 / RN 0.88 / Router 58 앱, 관리형 개발 DB의 11개 마이그레이션과 기록 RPC·메뉴/취향·계정 삭제 Edge 함수를 구현했다. 외부 제공자 credential 기반과 복구인 12·13번째도 개발 서버에 적용했다. iOS·Android native + 로컬 Auth/Storage/DB의 저장·재시도·권한·삭제 통합 경로를 검증했다. 관리형 Apple·카카오·Gemini 설정과 iOS Apple/카카오 실제 로그인, 관리형 임시 계정의 실제 Gemini 요약·삭제 API를 확인했다. 외부 제공자 연결 해제와 출시 검증은 남아 있다. 메뉴 geometry-v4([배포 근거](verification/menu-skew/README.md))와 next-drinks 번들을 개발 프로젝트에 배포했으며, 관리형 synthetic 계정의 인증 후 메뉴 추천·타인 보호·저장 재시도를 확인했다. Gemini 생성 시간 초과를 재현한 뒤 근거 ID 선택에 맞는 Flash-Lite로 변경해 실제 생성·DB 저장·동일 입력 cache 재사용을 다시 확인했다. 검증 범위와 표본 한계는 summary-model 문서에 남겼다. 아래의 권장/목표 구조는 현재 코드와 구분한다.

## 구성

React Native + Expo Development Build + TypeScript 앱이 Supabase Auth로 인증한다. 일반 기록 CRUD는 RLS가 적용된 Supabase Data API/SDK를 사용한다. 사진은 비공개 Storage에 직접 업로드하고 DB에는 경로·크기·상태를 저장한다. AI/공통 제품 정보 갱신/복수 테이블 확정 작업은 Edge Functions 또는 트랜잭션 RPC가 담당한다.

서버 함수는 검증된 사용자 JWT를 확인하고 요청 소유권을 검사한다. 서버 권한으로 읽는 경우에도 사용자 범위를 명시한다. 클라이언트의 userId나 분석 결과는 신뢰할 수 있는 권한 근거가 아니다. 공통 제품 정보는 클라이언트가 직접 출처 검증 완료로 쓸 수 없게 한다.

## 앱 경계

- Expo Router: 탭·기록 작성·상세·메뉴 추천 스택. +는 composer 진입.
- 현재 원격 조회는 SDK/repository와 화면의 상태·generation/focus 가드로 처리한다. TanStack Query는 아직 도입하지 않은 목표 도구이며, 도입 시 키에 사용자·세션·버전을 포함한다.
- 현재 질문·작성 draft는 React 상태와 버전이 있는 AsyncStorage 복구로 처리한다. Zustand는 아직 도입하지 않은 목표 도구다. 인증 토큰이나 서버 데이터 전체를 중복 저장하지 않는다.
- Repository/service 모듈: 화면과 SDK/AI/OCR 구현 분리.
- OCR adapter: 사진 ID, canonical 이미지 크기, 텍스트와 정규화 좌표를 반환. ONNX와 ML Kit 교체 가능.
- 서버 결과 schema validation: 런타임 검증 라이브러리는 부트스트랩에서 고정.

## 권장 폴더 구조

현재 app/, src/lib/, tests/가 생성됐다. 아래는 후속 기능을 포함한 목표 구조다. 단일 Expo 앱으로 시작한다.

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

## 네이티브 인증 암호화

Supabase PKCE에서 plain fallback이 관찰돼 native client 생성 전에 expo-crypto 기반 최소 S256 브리지를 적용했다. 기존 crypto 구현과 browser는 보존하고 SHA-256 실패는 전파한다. docs/verification/native-pkce에 native 표준값·SDK 요청 검증이 있다. provider 인증 성공과는 구분한다.

### 메뉴판 저장·복원 순서

계정별 공유 요청 큐가 서버 저장과 revision 영수증의 기기 저장이 끝날 때까지 재진입 복원을 기다리게 한다. 로컬 메뉴 저장/파일 정리 큐와는 별도여서 영수증 저장을 기다리는 중 교착하지 않는다. 취소 후에도 전송한 요청의 응답은 보관하되 새 추천 결과를 표시하지 않으며, 대기 중 취소된 다음 요청은 서버 재전송과 영수증 변경을 시작하지 않는다. 서버 오류 이후에는 기존 pendingSave를 복원해 같은 payload부터 재전송한다.
