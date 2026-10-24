# 메뉴 사진 준비의 임시 파일 정리

원본 JPEG 생성→필요 시 최대 2200px 축소→내구 저장소 copy 순서, 비율, 압축 품질은 기존과 같다. 준비 과정에서 새로 생성한 ImageManipulator 결과 URI만 추적하고 finally에서 cacheDirectory 내부의 해당 파일을 정리한다. 같은 URI는 한 번만 처리하며 선택한 원본, 문서 디렉터리의 확정 draft, 다른 캐시 파일은 삭제하지 않는다. 정리 실패는 성공한 사진 준비를 실패로 바꾸지 않는다. 기존 메뉴 metadata 저장/퇴역 사진 정리 순서는 변경하지 않는다.

실제 iOS Vision·Android ML Kit 합성 메뉴 14종씩을 실행했다. 두 플랫폼 모두 sourcePreserved=true, ImageManipulator 디렉터리의 이번 준비에서 새로 남은 파일 0개, OCR/계약 오류 0개였다. 가격 연결 지표는 geometry-v2 직후의 각 플랫폼 결과와 같다. 큰 원본은 양 플랫폼에서 1650×2200으로 유지됐다. [iOS 원본 보고서](ocr-benchmark/ios-photo-cache-cleanup.json), [Android 원본 보고서](ocr-benchmark/android-photo-cache-cleanup.json)에 photoPipeline=jpeg-cache-cleanup-v1을 남겼다. 이는 개인 사진·물리 기기 성능·강제 디스크 오류 전체 검증은 아니다.

바로 2200px로 decode하고 JPEG를 한 번 저장하는 후보도 비교했지만, Android 큰 원본 가격 연결이 4→2개(품질 0.9), 3개(품질 1.0)로 바뀌고 다른 조건에서도 차이가 생겨 이번 변경에 채택하지 않았다. 메모리 절감이나 OCR 품질 향상을 주장하지 않는다. 최종 코드는 기존 변환 결과를 유지하고 임시 파일만 정리한다.

Android 재빌드 성공 후 에뮬레이터 여유 공간 부족으로 업데이트 설치가 거절됐다. 모금 개발 앱에만 데이터 보존 uninstall(-k)→같은 서명의 재설치를 적용해 설치를 완료했다. 다른 앱/기기 데이터는 삭제하지 않았다. 개발 빌드 재실행 후 위 native 검증 보고서를 새로 생성했다. Android 화면 터치/권한 E2E와 물리 기기 저메모리 검증은 여전히 남는다.
