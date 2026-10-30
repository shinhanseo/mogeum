# 실제 네이티브 빌드 번호 확인 · #146

EAS 화면의 빌드 순번이나 Expo JS 설정을 설치 산출물의 실제 번호로 간주하지 않는다. `npm run beta:native -- <파일> <예상 번호> <android|ios-device|ios-simulator>`는 APK의 aapt2 package/versionCode, app/IPA의 CFBundleVersion·CFBundleSupportedPlatforms를 읽고 com.hanseo.mogeum·예상 번호·플랫폼이 모두 맞을 때만 성공한다. APK는 먼저 서명 검사도 수행한다. IPA는 Payload 바로 아래 앱 Info.plist가 정확히 하나인 경우만 읽고 임시 plist는 삭제한다. 키/인증·앱 내부 사용자 파일을 읽지 않는다.

이 명령은 별도의 JS 비밀키/개발 probe 검사(beta:scan)를 대체하지 않는다. 배포 파일은 두 검사를 모두 통과해야 한다.

## 실제 산출물 확인

- Android EAS code16 APK: id=com.hanseo.mogeum, version0.1.0, 실제 code16, android → 성공. beta:scan safe=true 및 서명 검사도 통과했다.
- 기존 EAS iOS simulator build12 app: 실제 CFBundleVersion1을 읽었고 예상12와 달라 exit1로 거절했다. 이전에 알고 있던 불일치를 자동으로 막는 검사다.
- 이 검사는 Expo 원격 번호와 simulator 번호 불일치의 원인을 수정한 것이 아니다. 실제 새 iPhone 서명 IPA의 번호 검증·제출은 아직 남아 있으므로 #146을 닫지 않는다.

참고: https://docs.expo.dev/build-reference/app-versions/ (EAS remote version 관리), https://developer.apple.com/documentation/BundleResources/Information-Property-List/CFBundleVersion (실제 bundle build 번호).
