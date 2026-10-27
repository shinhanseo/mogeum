# Gemini 출처 기반 제품 조사 어댑터 · #171

AI SDK7.0.148/@ai-sdk/google4.0.102의 설치된 타입·소스와 [공식 Google provider 문서](https://ai-sdk.dev/providers/ai-sdk-providers/google), [Google Search grounding](https://ai.google.dev/gemini-api/docs/google-search)을 확인했다. 기존 direct Google 서버 키 구조를 사용하며 새 Gateway 계정/결제는 추가하지 않았다.

## 구현 범위

내부 researchProduct는 제품명·주종·판본만 입력으로 받고 google_search 도구로 조사한다. 모델명과 키는 호출자가 서버에서 제공한다. 한 SDK 요청·재시도0·출력1800토큰·20초 한도를 둔다. Google 내부 검색 질의 수는 한 SDK 호출과 동일하지 않으므로 검색 비용 상한으로 오인하지 않는다. 공개 endpoint나 앱 요청에는 아직 연결하지 않았다. 전체 사용자/월 예산·durable 호출 제한은 #176/#171 후속 연결 조건이다.

실제 provider 메타데이터의 검색 질의·HTTPS 출처·검색 지원 문장 구간을 검사한다. 원 답변에 없는 인용 문구, 없는 source index, 내부 URL, 출처 미포함 답변은 수용하지 않는다. 존재하는 검색 인용은 실제 제품/판본/특징이 정확하다는 증거를 자동 보장하지 않으며 결과는 candidate다. 원출처 식별·redirect 확인·주장 지지/판본 확인·특징 정규화·DB 후보 저장·검증 승격은 다음 단계다. Google attribution entry HTML은 메타데이터로만 보존하며 native UI에서 그대로 실행하지 않는다.

## 검증

- Deno typecheck 통과.
- 실제 SDK + 가짜 HTTP transport 테스트3/3통과. Google Search 요청·제품 입력·응답 grounding 처리, 개인 context 입력 거부, 출처 없는 답변 거부를 확인했다. 테스트는 --allow-net 없이 실행하며 유료 API를 호출하지 않는다. SDK import의 hostname 조회와 env 접근 권한만 부여한다.
- npm run check422개 중411통과·환경 의존11제외.
- 실제 Gemini 검색·비용·정확도, 관리형 배포·앱 개인화는 아직 검증하지 않았다. 이를 현재 AI 추천 완료로 표시하지 않는다.

후속 [공유 조사 캐시·서버 호출 예약](../research-budget/README.md)을 추가했다. 내부 service가 예약→provider→candidate 저장을 연결한다. 공개 endpoint·실제 제품 사실 검증·자동 승격·앱 Gemini 추천은 여전히 연결되지 않았다.
