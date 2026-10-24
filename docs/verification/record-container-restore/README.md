# 기록 사진 컨테이너 복구 네이티브 검증

`/dev/record-restore-probe`는 __DEV__ 전용이며 로그인·서버·사용자 pending 키를 사용하지 않는다. 번들 합성 사진을 실제 `preparePhoto`로 Documents에 저장하고 고유 작업 키에 JSON을 보관한다. 해당 작업의 키/사진만 정리한다. 리포트에는 계정·기기 경로·토큰을 담지 않는다.

- iOS 26.5 / iPhone 17 Pro: 실제 현재 Documents 사진을 준비하고 컨테이너 UUID만 이전 값으로 바꾼 합성 URI를 JSON에 넣었다. 기록 및 사진 교체 요청의 decoder가 현재 URI를 반환하며 현재 파일을 읽을 수 있고 보관 원문이 바뀌지 않는 것을 확인했다.
- Android API 37 / Mogeum SDK58 Verify: 같은 사진 준비·저장·두 decoder·파일 읽기·원문 보존 검사를 통과했다. Android의 다른 sandbox 경로는 의도적으로 복구하지 않으므로 기존 정확 경로를 사용했다.
- 두 플랫폼 화면의 status=passed를 CUA로 확인했다. 스크린샷: [iOS](ios.png), [Android](android.png).

이 결과는 실제 iOS 재설치/OS 업데이트, 앱 강제 종료 도중 저장, 인증된 서버 업로드·RPC를 새로 검증했다는 의미가 아니다. 순수 회귀 테스트는 다른 operation/owner/root 차단과 복구 후 재시도의 단일 업로드·단일 mutation을 별도로 확인한다. 제품 UI/디자인 변경 없음.
