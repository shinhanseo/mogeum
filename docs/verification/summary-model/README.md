# 요약 모델 생성 지연 개선 · 2026-10-26

이전 gemini-3.8-flash의25초 생성 시간 초과를 실제 관리형/직접 합성 호출에서 확인했다. 새 감각을 쓰게 하지 않고 계산된 근거 ID만 고르는 작업에 맞춰, API 모델 목록에서 사용 가능하고 구조화 출력이 지원되는 stable `gemini-3.5-flash-lite`를 비교했다. [공식 모델 문서](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite). 모델 식별자를 latest alias로 두지 않는다.

동일한 production selectHighlights·strict schema·validateSelection·low thinking·25초 제한·자동 재시도0을 유지했다. [합성3케이스](provider-cases.json): 초기 기록1367ms, 여러 감각1279ms, 상반된 선호841ms. 모두 실제 API 호출이며 제공된 긍정 근거 ID만 선택하고 부정 기록에만 있는 연기 향은 선택하지 않았다. 표본3개의 결과로 일반 지연/의미 품질을 보장하지 않는다.

개발 프로젝트 GEMINI_MODEL을 명시적으로 등록하고 source의 기본값도 동일하게 변경했다. 기존 키·결제 설정·요금제는 바꾸지 않았으며 서버에 자동 다중 모델 fallback을 추가하지 않았다. 같은 입력으로 만들어둔 유효한 이전 cache는 그대로 사용하고 새 생성에 새 모델을 적용한다.

[관리형 실제 통합 결과](managed-report.json): synthetic 기록3개→실제 Gemini 생성200/ready→DB model/선택 근거 저장→같은 요청200/ready/cached 확인. 다음 술19개·메뉴2장12개·저장 재시도·메뉴 추천1개·Galaxy 모호한 가격4개 미확정·타인 보호·계정 정리도 통과했다. 사용자 실제 기록/사진·계정은 사용하지 않았다. 시간 초과 코드는 그대로 유지하며 timeout 발생을 성공으로 바꾸지 않는다.

## 다시 확인

`MOGEUM_VERIFY_AI_PROVIDER=1 deno run --config=supabase/tests/deno.json --env-file=<비밀 설정 파일> --allow-env --allow-net --allow-sys supabase/tests/verify-summary-provider.ts`로 합성 데이터3케이스를 명시적으로 호출할 수 있다. 개인 기록을 읽지 않으며 키·응답 본문은 출력하지 않는다. 실제 API 호출이므로 일반 CI에서 자동 실행하지 않는다.

TypeScript 앱 검사와 Deno endpoint/검증 스크립트 check를 수행했다. 생성 캐시를 재조회하는 관리형 harness도 갱신했다. 물리 iPhone·전체 UI 및 실제 Apple/Kakao grant revoke는 여전히 별도다.

서버 verifier의 CI 검사는 앱 node_modules에 AI 의존성이 있다고 가정하지 않는다. 별도 Deno config의 global cache mode와 verifier lockfile을 명시해 앱 npm 설치와 분리한다. 실제 API 호출은 opt-in 실행에만 둔다.
