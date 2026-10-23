# 모금 · Mogeum

사진으로 가볍게 남기는 술 기록과 내 취향 기반 메뉴판 추천 앱.

위스키·와인·맥주·전통주를 가리지 않고 즐기지만 긴 테이스팅 노트는 부담스러운 사람을 위한 iOS·Android 앱입니다. 사진만 저장해도 기록이 되고, 느낌이 쌓이면 좋아했던 술을 다시 찾거나 처음 보는 술을 고를 때 활용합니다.

## 현재 상태

**실제 Supabase 개발 프로젝트에 기록 DB를 적용하고 앱 연결을 구현 중입니다.** Figma 기준 로그인·술장·기록 UI, 공통 컴포넌트와 사진/주종/날짜/평가/빈티지 입력이 있습니다. 기본 저장 버튼은 인증 세션의 사진 업로드→기록 RPC→술장 재조회로 연결했고 저장 요청 재시도를 보관합니다. Apple·카카오 provider 등록이 아직 없어 실제 소셜 로그인 및 사용자 프로젝트에서 앱 저장 성공 검증은 남아 있습니다. 4주종의 가볍게 5문항·심화 9/11/10/8문항, 문장 미리보기·직접 수정과 동일 기록에 노트를 보충하는 RPC도 연결했습니다. 저장 후 상세와 재음용·기본 수정/삭제를 연결했습니다. 내 취향 요약·근거 UI와 집계/캐시/AI 서버 호출부를 연결했습니다. 실제 모델 호출은 Gemini 서버 키 설정 후 검증해야 하며 여러 장 메뉴판의 기기 OCR·확인/수정·제한된 출처 카탈로그와 기록 비교 추천도 연결했습니다. [메뉴판 구현과 현재 지원 범위](docs/verification/menu-ocr.md)를 참고하세요. [노트 구현·iOS 검증과 남은 범위](docs/verification/tasting-notes.md)를 참고하세요. [현재 연결·검증과 제약](docs/verification/live-records.md), [개발 로드맵](docs/milestones.md), [이슈 지도](docs/issue-map.md)를 참고하세요.

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

Node **24.22.0**, npm **11.12.1**, Expo **58.0.17**, React Native **0.88.0**, React **19.3.0** 기준입니다. 실제 의존성은 package-lock.json에 고정합니다.

```sh
nvm use
npm ci
npm run check
npm run web
```

설정 없이도 개발 상태 화면이 열립니다. 서버를 연결할 때 `.env.example`을 `.env`로 복사하고 Supabase URL/Publishable key를 설정합니다. 앱이 표시하는 설정 확인은 네트워크 연결 성공을 뜻하지 않습니다.

Development Build는 `npm run ios` / `npm run android`로 만듭니다. Xcode 또는 Android SDK와 JDK가 필요하며 번들 식별자를 환경 변수로 지정해야 합니다. [개발 환경 설정](docs/setup.md)의 명령을 참고하세요. 네이티브 앱 설치 후 `npm start`로 Metro를 실행합니다. Web 확인은 네이티브 OCR·실기기 검증을 대체하지 않습니다.

기록 상세 연결: 술장 카드에서 최근 경험을 열고 날짜별 기록을 전환할 수 있습니다. 사진/확정 노트·별점·재음용 의사·빈티지를 표시하며 노트 저장 후 동일 기록 상세로 돌아옵니다. 실제 계정 iOS E2E는 남아 있습니다. 사진 교체·경험 이동은 후속 연결했습니다. [검증 범위](docs/verification/record-detail.md).

반복 음용: 상세의 ‘한 번 더 기록하기’에서 이름·주종만 채운 새 경험을 기존 술장에 연결합니다. 사진·평가·답변은 복사하지 않으며, 연결 ID도 재시도 중 유지됩니다. [검증과 남은 범위](docs/verification/repeat-record.md).

기본 정보 수정·삭제: 이름·날짜·평가·별점·와인 빈티지를 같은 기록에서 수정하고, 개별 날짜의 기록을 삭제할 수 있습니다. 파일 정리는 실패 시 다음 접속에서 재시도합니다. [검증·제약](docs/verification/record-edit.md).

이름 입력 시 내 술장의 기존 후보를 보여주고 사용자가 선택한 술에만 새 기록을 연결합니다. [검증](docs/verification/existing-drink-choice.md).

사진 접근 안내: 촬영/앨범 선택 전에 모구 안내 시트를 보여주고 카메라 거부 시 설정 열기를 제공합니다. 시스템 사진 picker로 선택한 사진만 가져옵니다. [검증과 실기기 잔여 항목](docs/verification/photo-access.md).

사진 교체·기록 이동: 수정 화면에서 세로 사진을 비교한 후 저장하거나, 기록 한 건을 기존 술장/새 술장에 옮깁니다. 날짜·평가·노트는 유지하고 재시도 요청을 보관합니다. [구현 및 검증](docs/verification/record-attachments.md).

AI 취향 요약: 내 취향 → 확정 답변·평가 기반 요약 요청 → 근거 기록 확인. 0/초기/축적 상태, 동일 술 반복 구분과 수정·삭제 후 stale 차단을 구현했습니다. [구현·키 설정·검증](docs/verification/taste-summary.md).

메뉴판 추천: 내 취향 → 메뉴판 최대 5장 → 기기 OCR → 확인/수정·제품 판본 확인 → 기록 기반 비교·근거·원본 위치. 현재 출처 카탈로그는 주종별 8개씩 32제품(빈티지·판본 포함)이며 미확인 제품은 맛을 생성하지 않습니다. [구현·네이티브 검증·제약](docs/verification/menu-ocr.md).

네이티브 OCR 검증: [14종 합성 메뉴와 양 플랫폼 한계](docs/verification/native-ocr-benchmark.md). iOS Vision 경계 좌표 수정 후 14종 계약 통과를 확인했으며 다단·기울임 가격 연결의 한계는 남아 있습니다. 최신 메뉴 함수는 개발 프로젝트에 배포했습니다. [배포 빌드·검증 범위](docs/verification/menu-deployment.md).

메뉴 해석 geometry-v2: 완결된 두 열 메뉴는 출처를 나눠 연결하고 % 오독은 원화로 쓰지 않습니다. 실제 합성 네이티브 재실행에서 두 열 가격 연결 iOS 6/6·Android 2/6이며 기울임·다음 줄 가격은 직접 확인이 필요합니다.

분석 요청 대기 제한: [메뉴·취향 요약 timeout과 저장 응답 유실 처리](docs/verification/analysis-timeouts.md). 입력을 보존하고 재시도하며 관리형 연결·실기기 네트워크 단절 검증은 별도입니다.

메뉴 사진 준비 후 생성된 임시 캐시 파일만 정리합니다. [양 플랫폼 원본 보존·잔여 파일 검증](docs/verification/menu-photo-cache.md).

취향·추천 근거 사진의 비공개 링크를 한 번에 발급하고 부분 실패·지연 응답을 격리합니다. [묶음 발급과 권한 검증](docs/verification/evidence-photo-batch.md).

메뉴 요청 본문을 읽는 도중 한도를 검사해 과대 입력을 중단합니다. [본문 한도·한글 stream 검증](docs/verification/menu-request-body.md).

기록 저장·사진 교체 복구에서 작업별 사진 경로와 저장 receipt를 확인하고 손상된 요청을 보존합니다. [파일 경로·복구 회귀](docs/verification/record-draft-paths.md).

**iOS·Android 실제 native + 로컬 서버 저장 검증 통과:** 사진 준비·업로드/RPC·응답 유실 재시도·타인 접근 차단·로컬/서버 사진 삭제를 합성 데이터로 확인했습니다. [검증 보고서와 재현](docs/verification/native-record-backend.md). 관리형 소셜 로그인·실제 계정 UI E2E는 별도입니다.

네이티브 메뉴판 연속 검증: [iOS·Android OCR 2장 → 로컬 Edge 해석 → 수정 복구·세션 저장 → 내 노트 근거 추천](docs/verification/native-menu-backend.md)을 확인했습니다. 관리형 로그인 UI E2E와 실물 메뉴판 정확도 검증은 별도입니다.

메뉴 해석 geometry-v3는 잘못 읽힌 금액 셀의 술 후보와 카탈로그에 있는 가격 없는 이름을 가격 null·미확정 상태로 보존합니다. [양 플랫폼 연속 검증·남은 배포](docs/verification/menu-price-review.md).

술장 사진 링크는 100개 단위로 묶어 발급하고 계정 전환 후 늦은 결과를 버립니다. [요청 수·양 플랫폼 검증·남은 대용량 범위](docs/verification/cellar-batch.md).
