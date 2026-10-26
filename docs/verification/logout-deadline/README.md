# 로그아웃 요청 대기 제한 · #135

현재 Supabase SDK의 signOut(scope=local)은 Auth 서버 응답을 기다립니다. 응답이 멈추면 요청이 계속 진행 중이 될 수 있어, 설정된 백엔드의 정확한 `/auth/v1/logout` origin/path에만 20초 fetch deadline을 적용했습니다. OAuth 교환/refresh/Storage/기록/함수 경로의 signal/수명은 이 wrapper로 바꾸지 않습니다. 기존 caller 취소 신호는 보존합니다.

이 SDK 버전은 로그아웃 통신 오류가 나도 현재 기기의 세션을 정리하고 SIGNED_OUT을 보냅니다. 서버 refresh token 폐기나 Apple/Kakao 제공자 grant 해제가 확인됐다는 뜻은 아닙니다. 해당 외부 인증 검증과는 구분합니다.

실제 SDK + 로컬 HTTP 테스트: 로그인 응답 → 로그아웃 응답을 보내지 않음 → deadline 종료 → SIGNED_OUT/세션 null → 새 로그인 → 이전 서버 응답 종료 → 새 세션 유지. 다른 origin/path 신호 보존과 이미 취소된 Request의 미전송도 확인했습니다. full check 378개 중 370 통과, 환경 의존 8 skip, 실패 0.

iOS26.5 development build + 로컬 Supabase의 manifest로 확인한 합성 계정에서 계정→로그아웃 확인→gateway 중단→로그아웃 요청을 실행했습니다. 대기 종료 후 로그인 화면으로 이동했고 AsyncStorage의 Auth key가 사라졌습니다. 기존 tasting draft key 2개와 DB 기록4/노트2는 유지됐습니다. gateway watchdog 복구와 paused=false도 확인했습니다.

이어서 다른 named local synthetic run으로 로그인해 다음 한 잔의 근거 없음/저장0, 술장의 기록0·빈 선반을 확인했습니다. 이전 계정 기록/초안은 새 계정 화면에 노출되지 않았습니다. 이는 해당 두 계정·이 경로의 검증이며 모든 계정 전환 경로를 통과했다고 주장하지 않습니다.

로컬 증거: artifacts/qa/logout-deadline/ios-timeout-signed-out.png 및 ios-next-owner-empty.png. 실제 사용자 계정·관리형 서버는 사용하지 않았습니다. Android/실기기/관리형 장애 주입은 아직 확인하지 않았습니다.

새 합성 계정의 정상 온라인 로그아웃도 즉시 로그인 화면으로 돌아오는 것을 확인했습니다. 실제 제공자 grant 해제는 실행하지 않았습니다.
