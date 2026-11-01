# 모금 브랜드 에셋

2026-11-01 사용자가 선택한 크림 바탕·버건디 한 모금 심볼을 앱 아이콘으로 사용한다. `icon-master-approved.png`는 첨부한 승인 원본이며 임의의 색상/형태 변경 없이 보관한다.

`npm run beta:assets`로 iOS/일반 아이콘과 Android adaptive foreground를 1024px PNG로 재생성한다. 대응 SVG는 원본 PNG를 포함한 내보내기 wrapper이며 순수 벡터 로고가 아니다. 두 PNG에는 원본 배경이 포함되며 Android backgroundColor는 기존 크림 토큰이다. 심볼은 adaptive 중앙 안전 영역에 들어간다.

이번 변경은 앱 아이콘만 대상으로 한다. `splash` 및 앱 내부 모구는 기존 Figma 벡터를 유지한다.
