# AI 생성 시간 초과와 실제 관리형 검증 · 2026-10-26

실제 개발 프로젝트 synthetic 기록3개의 요약 요청이502/ANALYSIS_FAILED로 실패했다. 같은 production provider를 로컬 Deno에서 합성 데이터만으로 직접 호출해25,010ms의 TimeoutError를 확인했다. Google 모델 메타데이터는200/266ms로 조회됐으므로 키/모델 존재 조회가 가능하다는 뜻이지 생성 성공의 증거는 아니다.

서버의25초 모델 제한·27초 abort·단일 호출(자동 재시도0)을 유지하고 TimeoutError/AbortError를 ANALYSIS_TIMEOUT으로 구분한다. 실패 시 finish(null)로 lease를 해제하고 결과를 저장하지 않는다. 모든 요약 응답에 no-store를 적용한다. 앱은 기존 오류 영역에서 기록 보존·나중 재시도를 안내하며 컴포넌트/레이아웃을 변경하지 않았다. 새 문구의 Figma 픽셀 일치나 native UI 확인을 주장하지 않는다.

AI SDK7.0.148와 Google4.0.102의 캐시된 version-matched 문서도 확인했다. 최소 thinking 설정을 합성 direct probe에서 시험했으나 모델이 지원하지 않아400으로 거절했다. 해당 옵션은 되돌렸으며 서버에 배포하지 않았다. 모델 변경이나 비용 증가를 수반하는 자동 fallback을 도입하지 않았다. 생성 지연은 여전히 미해결이다.

## 관리형 결과

[실제 결과](managed-report.json): 수정된 handler에서502/ANALYSIS_TIMEOUT 확인. 재실행 harness는 이제 AI 요청이 ready/cache 저장으로 끝나지 않으면 failedStep와 실패 종료 코드를 남긴다. 메뉴 해석·저장·추천·다음 술 근거·계정 삭제는 독립적으로 끝까지 검사하고 테스트 계정을 정리한다. 전체 성공으로 보고하지 않는다.

실제 관리형에서 iOS native OCR2장 재생→12개 메뉴·저장/동일 요청 재실행·타인 접근 차단·추천1개, Galaxy 모호한 가격 원문 재생→후보4개/가격 확정0개/검토 필요, 기록 기반 다음 술19개, Auth/사진/노트/기록 삭제 및 다른 계정 보호가 확인됐다. 이전 원문을 서버로 재생한 것이며 새로운 카메라 OCR 검증이 아니다.

menu-recommend와 taste-summary 최신 소스를 CLI로 개발 프로젝트에 배포했다. CLI source 배포는 header가 source-development이며 dashboard 단일 bundle ID와 구분한다. 실제 모델 성공·물리 iPhone·스토어 출시 준비 완료를 주장하지 않는다. check343개 중335개 통과/환경 의존8개 skip, handler Deno check 통과.

## 후속 상태

위 생성 지연 미해결 기록 이후, 근거 ID 선택 작업에 맞춘 모델 비교와 변경으로 실제 관리형 요약 생성·DB 저장·cache 재사용을 확인했다. [후속 모델 검증](../summary-model/README.md). 기존 시간 초과 처리와 실패 판정은 유지한다.
