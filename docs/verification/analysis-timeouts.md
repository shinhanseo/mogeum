# 분석 네트워크 대기 제한

메뉴 해석/추천 Edge 호출은 30초, 취향 요약은 35초(서버 provider 25초/handler 27초보다 길게), 취향 context 및 메뉴 저장 RPC는 20초에 취소 신호를 보낸다. Supabase Functions SDK timeout과 PostgREST abortSignal을 사용하며 설치된 RN 0.88 AbortSignal.timeout 구현을 확인했다.

시간 초과도 기존 안전한 오류/재시도 흐름으로 처리한다. 메뉴 사진·원문·확인 입력을 초기화하지 않는다. 저장 RPC는 서버가 이미 커밋했을 수 있으므로 pendingSave를 버리지 않고 다음 시도에 동일 revision/입력을 먼저 replay한다. 자동 무한 재시도하지 않는다. 요약 재시도 역시 기존 서버 lease/hash 계약을 따른다.

실제 설치된 Supabase Functions SDK에 응답하지 않는 transport를 연결한 회귀에서 소유자 JWT를 고정해 전송하고 35초 시점에 signal이 abort되어 안전한 ANALYSIS_FAILED로 반환되는 것을 가상 시간으로 확인했다. 기존 저장 응답 유실→pending replay→수정본 저장 회귀도 통과한다. 이 테스트는 실제 provider 호출이나 실기기 단절 E2E가 아니다. 사진 signed URL/사진 목록 조회 전체 대기 시간과 iOS·Android 시스템 네트워크 단절 조작은 추가 검증이 필요하다. 백그라운드에서 JS 타이머가 중지된 시간은 정확한 벽시계 제한으로 보장하지 않는다.

화면·문구·디자인 토큰 변경 없음. 관리형 함수 배포나 Gemini 키 등록을 완료한 것으로 보지 않는다.

## 근거 사진 후속 보완

근거 사진 목록 조회에도 20초 abortSignal을 적용했다. Storage batch signing은 현재 SDK에 개별 abort 옵션이 없어 UI 대기만 10초로 제한하고 늦은 응답은 버린다. 서버 요청을 강제로 취소했다고 주장하지 않는다. 사진 실패 시 기존 caller가 빈 사진으로 처리해 텍스트 근거는 유지한다. RN 백그라운드 타이머 중단에 관한 한계는 같다.
