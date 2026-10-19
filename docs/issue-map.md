# 개발 이슈 지도

[전체 진행 체크리스트](https://github.com/shinhanseo/mogeum/issues/24)

| 단계 | 작업 | 선행 이슈 |
|---|---|---|
| M0 | [#1 [설정] Expo·TypeScript 앱 초기화와 양 플랫폼 Development Build](https://github.com/shinhanseo/mogeum/issues/1) | 없음 |
| M0 | [#2 [UI] 디자인 토큰·공통 컴포넌트·탭과 에셋 연결](https://github.com/shinhanseo/mogeum/issues/2) | #1 |
| M0 | [#3 [서버] DB 마이그레이션·RLS·비공개 사진 저장소](https://github.com/shinhanseo/mogeum/issues/3) | #1 |
| M0 | [#4 [인증] Apple·카카오 로그인·세션·둘러보기·계정 삭제](https://github.com/shinhanseo/mogeum/issues/4) | #1, #3 |
| M0 | [#5 [기록] 사진 한 장으로 실제 저장하고 술장에서 다시 열기](https://github.com/shinhanseo/mogeum/issues/5) | #2, #3, #4 |
| M0 | [#6 [기록] 4주종 질문형 노트·재음용 의사·미리보기](https://github.com/shinhanseo/mogeum/issues/6) | #5 |
| M0 | [#7 [술장] 선반·전체 보기·이름 검색·주종/느낌 필터](https://github.com/shinhanseo/mogeum/issues/7) | #5, #6 |
| M0 | [#8 [기록] 사진/노트 상세·정보/느낌 수정·삭제](https://github.com/shinhanseo/mogeum/issues/8) | #6, #7 |
| M0 | [#9 [기록] 다시 마셨어요와 술별 경험 이력](https://github.com/shinhanseo/mogeum/issues/9) | #8 |
| M1 | [#10 [기술 검증] ONNX·ML Kit 기기 OCR 비교와 엔진 선정](https://github.com/shinhanseo/mogeum/issues/10) | #1 |
| M1 | [#11 [서버] AI 함수 공통 계약·작업 상태·키/호출 제한](https://github.com/shinhanseo/mogeum/issues/11) | #3, #4 |
| M1 | [#12 [제품 정보] 술 식별·별칭·출처 있는 맛 특징 카탈로그](https://github.com/shinhanseo/mogeum/issues/12) | #3, #11 |
| M1 | [#13 [AI 취향] 초기/축적 요약·상반된 선호·근거 기록](https://github.com/shinhanseo/mogeum/issues/13) | #8, #9, #11 |
| M2 | [#14 [메뉴판] 최대 5장 사진 관리·추가·삭제·재촬영](https://github.com/shinhanseo/mogeum/issues/14) | #5, #2 |
| M2 | [#15 [OCR] 기기 OCR 어댑터·좌표 매핑·사진별 실행 연결](https://github.com/shinhanseo/mogeum/issues/15) | #10, #14 |
| M2 | [#16 [메뉴 해석] 이름·가격·용량 구조화·중복/출처 연결](https://github.com/shinhanseo/mogeum/issues/16) | #11, #15 |
| M2 | [#17 [메뉴 확인] 통합 목록·원본별 필터·사용자 수정·확정](https://github.com/shinhanseo/mogeum/issues/17) | #16, #14 |
| M2 | [#18 [추천] 처음 보는 술·익숙한 술·확인 후보 개인화](https://github.com/shinhanseo/mogeum/issues/18) | #12, #13, #17 |
| M2 | [#19 [추천 근거] 닮은 점·다른 점 비교·내 기록·원본 위치](https://github.com/shinhanseo/mogeum/issues/19) | #18 |
| M3 | [#20 [품질] OCR·AI 요약·신규 추천 평가셋과 회귀 검증](https://github.com/shinhanseo/mogeum/issues/20) | #13, #18, #19 |
| M3 | [#21 [통합] 권한·오프라인·실패·재시도와 두 플랫폼 검증](https://github.com/shinhanseo/mogeum/issues/21) | #8, #9, #13, #19 |
| M3 | [#22 [베타] 테스터 빌드·피드백·핵심 행동 관측](https://github.com/shinhanseo/mogeum/issues/22) | #21, #20 |
| M3 | [#23 [출시 준비] 계정·권한·스토어 자료·운영 점검](https://github.com/shinhanseo/mogeum/issues/23) | #22 |
