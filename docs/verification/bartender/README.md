# AI 바텐더 검증 · 2026-11-05

구현 계약은 [AI 바텐더](../../ai-bartender.md), 작업 이슈는 #222.

## 확인

- 도메인/handler: 소유자 입력 거부, 잘못된 ID/감각/조건 거부, 사진 기록의 취향 근거 제외, 기록 기반/오늘 조건 분리, 부정 감각 차단, 12개 대화/6개 모델 이력 제한, provider 실패, 중복 요청·호출 한도, 명시적 조사, 기록 변경 후 이전 카드 숨김.
- 실제 SQL/PGlite: 인증 계정 분리, 서비스 RPC 권한 차단, lease·revision·중복 영수증, 실패 횟수 차감, 사용자30/전체1000 경계, 대화 비우기의 한도 유지, auth 삭제 cascade와 개인 사용량 삭제. PGlite는 독립 PostgreSQL 세션 동시성 검증을 대체하지 않는다.
- 관리형 mogeum-dev: 합성 계정만 사용. 실제 Gemini → 기록 없는 today 후보3개 → 같은 요청 replay → 실제 감각 기록 저장 → 근거 recordId가 연결된 추천3개 → 대화 복원·타계정 격리·대화 비우기. 임시 계정 삭제 확인. 개인 계정은 변경하지 않았다.
- iOS 26.5 / 별도 Mogeum Bartender QA 시뮬레이터: 실제 앱 route·합성 서버 계정, 텍스트 입력 → 실제 Gemini 응답 → 원본 주종 일러스트 → wishlist 저장됨 표시. 키보드 위 입력창과 Done 키 노출 확인. 반복 근거 버튼을 하나로 합치고 대안 후보를 접도록 수정.
- DB 마이그레이션 20261105010000/020000, bartender Edge Function을 기존 개발 프로젝트에 배포했다. App Store 앱이 자동 업데이트된다는 뜻은 아니다.

## 재현

```
npm run check
npx tsx --test tests/database.test.ts
cd supabase/functions && npx deno check --node-modules-dir=manual bartender/index.ts
MOGEUM_VERIFY_MANAGED_DEV=1 npx tsx scripts/verify-managed-bartender.ts
```

마지막 명령은 승인된 개발 프로젝트의 로컬 비공개 서비스 자격증명과 .env를 사용하며 임시 합성 계정을 만든 뒤 삭제한다. `MOGEUM_VERIFY_CHAT_RESEARCH=1`은 추가로 실제 미등록 제품 조사를 시도하므로 별도 비용·검색 예산을 소비할 수 있다. provider API 오류나 제조사 검증 미통과를 성공으로 간주하지 않는다. 비공개 실행 결과는 artifacts/verification/managed-bartender.json에 저장한다.

## 실제 조사 경계

부나하벤 18년 명시적 조사 요청은 모델의 조사 제안과 사용자의 별도 실행을 거쳐 제조사 원문 검증 미통과(`unresolved`)로 끝났다. 이 제품의 실제 검색 추천 성공을 주장하지 않는다. 검증 미통과 시 카드/맛 특징을 생성하지 않는 경로는 확인했다. 다른 제품·주종의 실검색 성공 범위는 추가 QA가 필요하다.

## 남음

Android 네이티브 키보드·접근성 글자 확대·실기기 전환/네트워크 단절 검증, iOS 앱 종료 후 pending 전송 UI 복구 검증, 실제 신규 빌드 설치. 가격/재고·페어링, 미등록 후보 저장은 미지원. 검색 원문을 확인하지 못한 제품은 안내만 반환한다.

## 일반 대화 전환 · 2026-11-05

현재 발화가 일상 대화이면 모델 intent를 conversation으로 받고 서버가 후보·조사 제안을 제거하며 오늘의 조건을 보존한다. 화면은 가장 최근 응답에 추천 카드가 있을 때만 술 조정 선택지를 노출한다. 친구를 만난 일상 이야기로 전환한 실제 Gemini 응답에서 추천 없음·조건 보존을 확인했다. 대화 중 로딩과 입력 안내도 일반 대화 문구로 수정했다.
