# 모금 · Mogeum

사진으로 가볍게 남기는 술 기록과 내 취향 기반 메뉴판 추천 앱.

위스키·와인·맥주·전통주를 가리지 않고 즐기지만 긴 테이스팅 노트는 부담스러운 사람을 위한 iOS·Android 앱입니다. 사진만 저장해도 기록이 되고, 느낌이 쌓이면 좋아했던 술을 다시 찾거나 처음 보는 술을 고를 때 활용합니다.

## 현재 상태

**실제 Supabase 개발 프로젝트에 기록 DB를 적용하고 앱 연결을 구현 중입니다.** Figma 기준 로그인·술장·기록 UI, 공통 컴포넌트와 사진/주종/날짜/평가/빈티지 입력이 있습니다. 기본 저장 버튼은 인증 세션의 사진 업로드→기록 RPC→술장 재조회로 연결했고 저장 요청 재시도를 보관합니다. Apple·카카오 실제 iOS 로그인과 Apple 재실행 세션 복원을 확인했습니다. 관리형 임시 계정의 실제 사진/기록/노트 저장도 검증했으며 양 플랫폼 전체 앱 검증은 진행 중입니다. 4주종의 가볍게 5문항·심화 9/11/10/8문항, 문장 미리보기·직접 수정과 동일 기록에 노트를 보충하는 RPC도 연결했습니다. 저장 후 상세와 재음용·기본 수정/삭제를 연결했습니다. 내 취향 요약·근거 UI와 집계/캐시/AI 서버 호출부를 연결했습니다. Gemini 서버 키 등록과 합성 기록의 실제 모델 호출을 검증했으며, 관리형 임시 인증 계정의 기록→실제 모델→DB 요약 저장도 검증했습니다. 여러 장 메뉴판의 기기 OCR·확인/수정·제한된 출처 카탈로그와 기록 비교 추천도 연결했습니다. [메뉴판 구현과 현재 지원 범위](docs/verification/menu-ocr.md)를 참고하세요. [노트 구현·iOS 검증과 남은 범위](docs/verification/tasting-notes.md)를 참고하세요. [현재 연결·검증과 제약](docs/verification/live-records.md), [개발 로드맵](docs/milestones.md), [이슈 지도](docs/issue-map.md)를 참고하세요.

다음 한 잔은 좋게 남긴 감각이 제품 특징과 실제로 연결될 때만 추천합니다. 기록 0개·사진만 있는 상태에는 카탈로그를 자동으로 노출하지 않고 기록 안내를 제공합니다. [추천 근거 없는 목록 수정](docs/verification/discovery-no-evidence/README.md).

다음 한 잔의 출처 기반 추천·저장 목록·추천 이유 상세도 연결했습니다. 실제 로컬 인증으로 iOS/Android 저장·기록·해제를 확인했으며 [추천 이유 화면과 검증 범위](docs/verification/discovery-reason/README.md)를 참고하세요.

앱 복귀 시 다음 한 잔을 최신화합니다. 양 플랫폼에서 별도 합성 세션의 북마크 변경이 복귀 직후 반영되는 것을 확인했습니다. [검증과 남은 실패 시나리오](docs/verification/discovery-foreground/README.md).

추천 조회 도중 기록이 바뀌면 이전 근거와 새 이력을 섞어 반환하지 않도록 버전을 재확인합니다. [snapshot 경계의 서버 검증](docs/verification/discovery-snapshot.md).

내 취향의 갱신 실패 시 이전 요약/사진을 숨기고 재시도를 제공합니다. Android의 실제 로컬 API 연결 단절→복구를 확인했습니다. [내 취향 복구 검증](docs/verification/taste-refresh/README.md).

메뉴판 사진 준비 중 취소·부분 실패는 미반영 파일만 정리하고 다음 준비 작업과 순서를 맞춥니다. [사진 준비/교체 검증과 제약](docs/verification/menu-preparation/README.md).

iOS 컨테이너 경로가 달라져도 현재 앱 폴더에 남아 있는 메뉴판 사진은 계정·세션·판본을 검사해 복구합니다. [보존된 초안 복구 검증](docs/verification/menu-container-restore/README.md).

노트 조회·저장 요청은 20초 동안 응답이 없으면 실패 상태로 돌아오고 작성 내용을 보존합니다. iOS 로컬 서버 중단 후 같은 노트 재시도를 확인했습니다. [대기 제한 검증](docs/verification/tasting-request-deadline.md).

노트 미리보기·문장 수정 단계도 초안에 보관합니다. iOS 앱 종료 후 두 화면 복원을 확인했습니다. [단계 복구 검증](docs/verification/tasting-stage-restore.md).

노트 초안의 읽기·쓰기·정리를 직렬화하고, 완료 후 더 새롭게 작성된 초안은 보존합니다. [초안 순서·정리 검증](docs/verification/tasting-draft-order.md). Android 작성 단계의 시스템 Back 연결은 추가했으며 네이티브 동작 확인은 남아 있습니다. [미완료 검증 범위](docs/verification/composer-back/README.md).

기본 기록도 전송 전에 사진·입력·평가 단계를 계정/진입 경로별로 보관하고, 저장 완료 뒤 해당 초안을 정리합니다. iOS/Android 로컬 합성 계정에서 사진 입력→종료→복구→실제 저장을 확인했으며 입력별·장애별 추가 검증은 진행 중입니다. [기본 기록 초안 검증과 남은 범위](docs/verification/composer-draft/README.md).

기본 기록·사진 교체 전송은 20초 동안 응답이 없으면 같은 요청으로 재시도할 수 있습니다. iOS/Android 기본 저장과 Android 사진 업로드에서 로컬 서버 중단→시간 초과→복구 후 재시도를 확인했습니다. [저장 대기 제한 검증과 남은 범위](docs/verification/write-deadlines/README.md). 사진 교체 오류는 작은 세로 미리보기와 재시도 버튼 위 안내로 표시합니다. [실패 화면 기준](docs/verification/attachment-error-layout.md).

사진만 저장한 이름 없는 술도 `한 번 더 기록하기`에서 새 사진·이름 없이 경험을 추가할 수 있습니다. 기존 사진·감상은 복사하지 않고 같은 술장 카드에 묶습니다. [Android 실제 저장과 DB 경계 검증](docs/verification/unnamed-repeat/README.md).

기록 저장·사진 교체의 동시 요청과 완료 정리를 계정/기록별로 직렬화합니다. [보관 요청 동시 실행 검증](docs/verification/record-request-order.md).

술 상세도 앱 복귀 시 기록·사진·이력을 재확인하고, 만료/실패한 사진 URL은 한 번만 재발급합니다. [iOS 실제 수정·삭제 복귀 검증과 제약](docs/verification/detail-refresh/README.md). 상세 DB 조회는 20초, 사진 서명 UI 대기는 10초로 제한하며 사진 없음/불러오기 실패를 구분합니다. [대기 제한·실패 검증](docs/verification/detail-deadlines/README.md).

계정 관리에 기기 로그아웃과 영구 삭제 확인·재시도 흐름을 추가했습니다. 기기 로그아웃은 Auth 서버 응답이 멈춰도 20초 후 대기를 끝냅니다. iOS 로컬 장애·기기 세션 정리·초안/기록 보존·다른 계정 빈 술장을 확인했습니다. [로그아웃 대기 검증](docs/verification/logout-deadline/README.md). 삭제 API는 로컬 임시 계정의 실제 Auth/Storage로 검증했고 관리형 배포·임시 계정 E2E는 확인했고 외부 OAuth 해제와 양 플랫폼 전체 삭제 UI 검증은 남아 있습니다. [계정 삭제 검증과 남은 범위](docs/verification/account-deletion/README.md).

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

Node **24.22.0**, npm **11.12.1**, Expo **58.0.19**, React Native **0.88.0**, React **19.3.0** 기준입니다. 실제 의존성은 package-lock.json에 고정합니다.

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

기록 저장·사진 교체 복구에서 작업별 사진 경로와 저장 receipt를 확인하고 손상된 요청을 보존합니다. iOS 컨테이너가 바뀌면 동일 작업 사진을 현재 Documents 경로로 복구하며 서버 요청과 receipt는 유지합니다. [파일 경로·복구 회귀](docs/verification/record-draft-paths.md).

**iOS·Android 실제 native + 로컬 서버 저장 검증 통과:** 사진 준비·업로드/RPC·응답 유실 재시도·타인 접근 차단·로컬/서버 사진 삭제를 합성 데이터로 확인했습니다. [검증 보고서와 재현](docs/verification/native-record-backend.md). 관리형 소셜 로그인·실제 계정 UI E2E는 별도입니다.

네이티브 메뉴판 연속 검증: [iOS·Android OCR 2장 → 로컬 Edge 해석 → 수정 복구·세션 저장 → 내 노트 근거 추천](docs/verification/native-menu-backend.md)을 확인했습니다. 관리형 로그인 UI E2E와 실물 메뉴판 정확도 검증은 별도입니다.

메뉴 해석 geometry-v3는 잘못 읽힌 금액 셀의 술 후보와 카탈로그에 있는 가격 없는 이름을 가격 null·미확정 상태로 보존합니다. [양 플랫폼 연속 검증·남은 배포](docs/verification/menu-price-review.md).

술장 사진 링크는 100개 단위로 묶어 발급하고 계정 전환 후 늦은 결과를 버립니다. [요청 수·양 플랫폼 검증·남은 대용량 범위](docs/verification/cellar-batch.md).

술장 홈은 30개씩 cursor로 읽고 검색·주종 필터를 서버 전체에 적용합니다. [실제 35개 DB·양 플랫폼 native·61개 합성 UI 검증](docs/verification/cellar-cursor.md).

술장 이미지 오류 시 현재 계정의 대표 사진 링크를 한 번 갱신합니다. [실제 만료·양 플랫폼 복원·반복 요청 차단](docs/verification/cellar-photo-renewal.md).

다음 한 잔의 기록 기반 추천/북마크 서버·DB와 앱 목록·저장 복구·기록 prefill을 연결했습니다. 개발 프로젝트 배포도 적용했고 전체 로그인 E2E는 남아 있습니다. [서버 기반](docs/verification/next-drinks-foundation.md), [앱 연결·양 플랫폼 17단계·UI 검증과 남은 범위](docs/verification/discovery-ui/README.md).

개발 서버 최신화: [geometry-v3·다음 한 잔 함수·북마크 DB 배포 및 인증 경계 검증](docs/verification/discovery-deployment/README.md).

기울어진 메뉴의 이름·가격 행 연결을 geometry-v4로 보완했습니다. [iOS·Android 네이티브 엔진 재실행, 기존39케이스 회귀 및 로컬 배포 번들 검증](docs/verification/menu-skew/README.md). Android 용량 OCR 오자는 그대로 확인 대상으로 남기며 실사 품질 검증은 별도입니다.

술장 조회는 사용 불가(`missing`) 사진을 제외하고 최근 정상 사진으로 대체합니다. 전부 없으면 기록을 유지한 채 사진 없이 표시합니다. [대표 사진 선택 계약](docs/data-model.md#술장-대표-사진-가용성--10번째-migration). 새 migration의 관리형 프로젝트 적용은 아직 남아 있습니다.

메뉴판 저장 응답 전에 화면을 닫고 다시 열어도, 계정별 저장·복원 순서를 지켜 이전 응답이 새 수정 사항을 덮지 않도록 처리합니다. [요청 순서 검증](docs/verification/menu-request-order/README.md).

취향 요약·메뉴 추천 근거는 사진 준비 후 기록 버전을 재확인합니다. 취향 근거 화면도 앱 복귀 때 수정·삭제를 다시 읽습니다. [회귀 및 iOS 실제 복귀 검증](docs/verification/evidence-snapshot-window/README.md).

2026-10-25 Apple·카카오 OAuth 공급자 활성화, 모금 전용 Gemini 서버 secret 등록 및 실제 provider 호출을 확인했습니다. [연결 상태·갱신 일정·검증 제약](docs/verification/auth-ai-connection/README.md).

[관리형 배포·Gemini·삭제 및 iOS Apple 실제 검증](docs/verification/managed-account-rollout/README.md).

[iOS·Android 네이티브 OCR부터 관리형 메뉴 저장·추천까지 실제 검증](docs/verification/managed-native-menu/README.md). 합성 이미지/임시 계정 전용이며 실사 메뉴판 품질·권한 UI·출시 빌드 검증은 별도입니다.

술장 배경 분리의 기기 처리·선택적 로컬 표시를 추가했습니다. [실제 Android 처리 결과와 남은 검증](docs/verification/cutout/README.md). 원본 보존·캐시 유실 시 원본 복귀이며 클라우드 동기화는 포함하지 않습니다.

테이스팅 노트의 공백 직접 입력 오류와 키보드 이동을 보정했습니다. 입력창 한글 잘림과 Done 처리도 수정했고 iOS 한국어 소프트 키보드의 완료·값 유지까지 확인했습니다. Android 완료 동작 검증은 남아 있습니다. [수정·회귀 검증 및 실기기 잔여 범위](docs/verification/tasting-input-keyboard.md).

외부 로그인 토큰 보관·연결 해제·재로그인 복구를 앱과 서버에 연결했습니다. [로컬·관리형 배포 검증과 남은 범위](docs/verification/provider-revocation-wiring.md). 실제 사용자 OAuth 연결 해제 검증은 포함하지 않습니다.

계정 삭제의 provider capture/해제 서버를 개발 프로젝트에 배포했습니다. 실제 관리형 synthetic 계정의 Auth·사진·기록 삭제/타인 보호/응답 유실 재확인을 검증했습니다. 실제 Apple/Kakao 테스트 계정의 grant 해제 전체 검증은 남아 있습니다. [배포와 검증 범위](docs/verification/provider-revocation-wiring.md).

AI 취향 요약의 생성 지연을 실제 서버에서 확인한 뒤 Gemini3.5 Flash-Lite로 조정했습니다. 합성3케이스와 관리형 기록→요약 저장→cache 재사용을 확인했으며 [모델 변경과 검증 범위](docs/verification/summary-model/README.md)를 참고하세요. 시간 초과 시 기록은 보존하고 재시도를 안내합니다.

베타 준비: [독립 실행 빌드·배포 조건](docs/beta/README.md), [테스터 안내](docs/beta/tester-guide.md), [데이터 처리 내역](docs/beta/data-inventory.md). 외부 배포 승인은 별도이며 실제 iPhone 서명과 개인정보 문서 게시가 남아 있습니다.

백엔드 배포: [환경 분리·검사·복구 절차](docs/deployment/README.md). `npm run backend:check -- development`는 개발 서버 메타데이터와 인증 거부 경계를 읽기 전용으로 확인합니다.

SQL Editor로 적용한 개발 DB 13개 변경의 CLI 이력을 스키마·권한 비교 후 정리했습니다. [479개 정의 비교·SQL 재적용 없는 이력 등록](docs/verification/schema-ledger/README.md).

기본 기록·수정의 이름/날짜/빈티지에도 Done을 연결했습니다. [iOS 완료 동작과 사진 포함 초안의 종료·복구·실제 저장 검증](docs/verification/record-input-done/README.md). Android 완료 동작은 별도 미검증입니다.

내부 베타 Android8/iOS EAS6의 설치·검사·포함 소스와 남은 범위는 [최신 베타 QA](docs/verification/beta-qa-batch/README.md)에 정리했습니다.

기본 기록 사진 변환의 중간 캐시 누적을 수정하고 iOS 사진 교체/재실행 및 양 플랫폼 native 모듈에서 확인했습니다. [캐시 정리·계정 초안 격리 검증](docs/verification/record-image-cache/README.md).

저장 실패 시 안내가 화면 아래에 숨지 않도록 새 오류 위치로 스크롤합니다. [실제 iOS 서버 실패·재시도와 pending 우선 복구 확인](docs/verification/record-error-visible/README.md).

검색·기록 이동·메뉴 수정의 추가 Done 처리와 실제 확인 범위는 [입력 완료 일관성](docs/verification/remaining-input-done.md)에 정리했습니다.

기록 이동 검색의 이전 응답·오류가 새 검색에 섞이지 않도록 보호했습니다. [요청 순서와 검증](docs/verification/move-target-search.md).
