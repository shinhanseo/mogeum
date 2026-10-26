# 기본 기록의 변환 이미지 캐시 정리 · #142

iOS26.5 개발 빌드의 로컬 테스트 계정에서 사진 한 장 선택 후 안정적인 작성 초안 파일 외에 ImageManipulator JPEG1개(58,656 bytes)가 남는 것을 재현했습니다. prepareComposerPhoto와 preparePhoto가 복사한 중간 이미지를 정리하지 않는 문제였습니다.

두 네이티브 경로를 공통 수명 처리로 연결했습니다. 디렉터리 생성·복사 성공/실패 뒤 finally에서 이번 호출의 변환 결과만 제거합니다. cacheDirectory 아래 정확한 ImageManipulator JPEG 경로에만 적용하고 원본과 같은 파일(URI 표기가 다른 경우 포함), Documents 복구용 파일, ImagePicker 선택본·기존 다른 캐시는 제외합니다. 정리 실패는 기존 복사 오류를 가리지 않고 성공한 저장 사진도 실패로 바꾸지 않습니다. Web base64 경로는 그대로입니다. 기존 캐시를 일괄 청소하지 않습니다.

## 네이티브 검증

- iOS 실제 사진 교체 UI: 변경 전에는 ImageManipulator 파일1개 증가. 수정 후에는 기존147개 목록이 그대로이고 새 잔여0. 이번 계정의 이전 작성 사진은 새 파일1개로 교체됐으며 다른 로컬 테스트 계정의 사진은 SHA256까지 동일했습니다. 과거147개를 이번에 만들었거나 모두 누수라고 판단하지 않습니다.
- iOS 앱 프로세스 종료/재실행 → 기록하기에서 교체한 사진이 다시 표시됩니다. 중간 캐시가 없어도 복구용 파일을 읽습니다. 로컬 증거 `artifacts/qa/record-cache/ios-replacement-restored.png`.
- iOS/Android 실제 preparePhoto 모듈 probe도 새로 실행해 복구용 JPEG 읽기·pending/attachment 원문 보존·경로 복구를 확인했습니다. 각 실행 전후 새 ImageManipulator 파일0. iOS의 이전 컨테이너 URI는 probe가 구성한 합성 경로이며 실제 앱 재설치 검증으로 표시하지 않습니다. [원시 보고서](native-reports.json).

전체 check394개 중386통과, 환경 의존8skip, 실패0. 전용4회귀는 실제 파일 복사 후 원본/이전 캐시/복구용 파일 보존, 실패 때 중간 파일 해제, 경로/원본 보호와 정리 실패의 오류 보존을 검사합니다. Android 실제 터치·삼성 키보드·저장 공간 부족의 기기 오류 주입은 미검증입니다.

## 추가 계정 초안 격리 · #115

현재 local named synthetic C에서 새 기록/재음용 초안2개와 재음용 사진1개를 보관한 뒤 실제 계정 화면에서 로그아웃했습니다. 다른 named synthetic D로 로그인해 기록하기→사진 없이 이름으로 기록을 열었을 때 이름·주종·사진은 비어 있었습니다. C의 초안2개/사진1개는 남고 D의 초안은 별도 소유자 경로로 저장됩니다. 실제 사용자 세션·운영 서버는 사용하지 않았습니다. 증거 `artifacts/qa/composer-native/ios-other-owner-empty.png`.

이전의 같은 계정 new/entry context UI 검사도 새 기록 이름과 기존 술의 빈티지2021을 섞지 않고 각각 복구했습니다. 추천 product prefill·계정 복귀·쓰기 실패/사진 교체 동시 경합의 모든 경우를 통과했다는 뜻은 아니며 #115는 열어둡니다.
