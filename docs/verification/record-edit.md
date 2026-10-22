# 기본 기록 수정·삭제 검증

## 구현

상세 수정 → 해당 경험의 이름/현지 날짜/재음용 의사/별점/와인 빈티지 편집 → revision 검증 RPC → 같은 기록 상세 재조회. 뒤로/닫기의 미저장 변경 확인과 취소 복원. 노트/답변은 기본 수정 payload에 들어가지 않는다.

개별 날짜 삭제는 확인창 이후 소유자/id/revision 조건으로 처리한다. 다른 날짜를 삭제하지 않는다. 현재 기록이 이미 없으면 응답 유실 재시도로 인정하고, 존재하지만 revision이 바뀌었으면 최신 기록 확인을 요구한다. 파일 삭제 실패는 DB job에 남고 다음 접속에서 재시도한다. 완료 확인 RPC는 실제 Storage 메타데이터 부재도 검사한다. 서버 상시 worker·계정 삭제 이후 정리는 미구현이다.

## 실행 결과

- npm run check: 56개 중 54 pass / 2 skip(로컬 HTTP/독립 PostgreSQL 미기동). 날짜 윤년/넘침·빈티지·경험 ID 보존, 삭제 revision/이미 삭제된 재시도, DB 소유권/단일 항목 이름 동기화/다중 경험 보존/파일 완료 확인 권한을 검증했다.
- 실 PostgreSQL+Auth/Storage CI 테스트에 실제 SDK 상세 읽기→기본 수정→개별 삭제/재시도→binary 정리→done 영수증 검증을 추가했다. 실행 결과는 PR checks에서 확인한다.
- iOS 26.5 / iPhone 17 Pro의 명시적 fixture에서 원본과 같은 카드 톤/세로 사진, 평가 바텀시트, 변경 취소와 원본 복원, 날짜 변경 후 로컬 재표시를 확인했다. `ios-record-edit.png` 보관. 실제 계정 로그인 클라우드 E2E와 Android는 미검증이다.
- Expo 호환 검사 권장값 변경으로 이전 PR의 App checks가 실패하여 SDK 58 패치와 관련 패키지를 공식 `expo install --fix`로 맞췄다. `expo install --check` 통과. native Pods를 업데이트하고 iOS 빌드를 다시 진행했다. [공식 업데이트 절차](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/).

## 개발 DB 적용

20261022160000_record_edit.sql을 mogeum-dev SQL Editor에서 begin/commit으로 적용했다. edit_ready=true / cleanup_ready=true를 확인하고 `supabase-record-edit.png`에 보관했다. 사용자 데이터 삭제는 실행하지 않았다. 기존 CLI migration history repair는 여전히 필요하며 db push로 이전 마이그레이션을 중복 실행하면 안 된다.

## 남은 #8

사진 교체·주종 변경·경험 이동·대표 사진 관리, 상시 파일 정리 worker, 향후 AI 요약의 stale UI가 남아 있다. 기본 정보 수정/삭제 연결이 #8 전체 완료를 의미하지 않는다. 이름이 여러 경험의 공유 술장 이름과 다른 경우 안내를 제공한다.
