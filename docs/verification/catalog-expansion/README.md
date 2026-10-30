# 제조사 원문 기반 추가 묶음 · #175

2026-10-30 제조사 제품 페이지를 직접 열어 아래4개를 검토했다. 모델이 작성한 제품이나 개인 감상을 제품 사실로 승격하지 않았다. 가격·재고·판매처 정보는 추가하지 않는다. 기존32개 bundled/legacy 계약을 유지하고 shared product_catalog에만 새 문서를 추가한다. 이 묶음 배포 후 총36개(위스키10·맥주10·와인8·전통주8)이며120제품군 목표 완료는 아니다.

|제품|확인한 근거와 반영 범위|원문|
|---|---|---|
|탈리스커10년|제조사 시향의 피트 연기, 긴 마무리. 연기/피트와 긴 여운의 기존 질문 코드만 연결.|[Talisker10](https://www.malts.com/en/products/talisker-10-year-old)|
|오반14년|시향의 익은 과일/오렌지와 긴 마무리. 과일 향과 긴 여운으로만 연결.|[Oban14](https://www.malts.com/en-us/products/oban-14-year-old-single-malt-scotch-whisky-750ml)|
|듀벨오리지널8.5%|제조사 프로필의 과일 향과 살짝 쌉쌀한 뒷맛. 6.66/Single Fermented와 구분.|[Duvel](https://www.duvel.com/en/the-beer/duvel)|
|블루문벨지안화이트5.4%|제조사의 오렌지/감귤 계열 향. 넓은 과일 향으로 연결하며 레몬·자몽을 느낀 것으로 구체화하지 않음. Light/Non-Alcoholic 제외.|[Blue Moon](https://www.bluemoonbrewingcompany.com/en-GB/currently-available/blue-moon-belgian-white)|

원문에는 더 다양한 특징이 있으나 현재 질문 코드로 정확히 대응할 수 없는 감각은 설명에만 두고 매칭 특징을 만들지 않는다. 특징이 있다는 것을 개인이 좋아한다는 뜻으로 쓰지 않는다.

## 데이터/검증

- `supabase/catalog/2026-10-30-reviewed.json`은 검토된 문서다. `scripts/build-reviewed-catalog.ts`는 오프라인 검증/SQL 생성만 한다. --check로 JSON과 migration 정합성을 확인한다.
- migration은 기존 ID와 충돌하면 아무것도 덮어쓰지 않는다. 이미 보류한 제품을 다시 verified로 바꾸지 않는다.
- 식별 별칭/제품 ID 충돌, 다른 연산/도수/레시피 거절, 기존 질문 특징 ID, 빈 기록에 선호를 만들지 않는 비교, DB 제약/RLS를 검사한다.
- 전체 check454통과/환경14제외. 로컬 메뉴판 HTTP9개 통과. 다음 한 잔은 오래 실행 중인 로컬 Edge에서 번들 갱신을 못 읽었으나 Edge 런타임만 재시작한 뒤 실제HTTP9개가 통과했고 소스 복구도 확인했다. DB 초기화는 하지 않았다.

## 관리형 실제 반영

승인된 개발 DB에20261030020000만 적용했다. `MOGEUM_VERIFY_MANAGED_DEV=1 npx tsx scripts/verify-managed-catalog.ts`로 임시 인증 계정에서36개(whisky10/beer10/wine8/traditional8), 추가4개 문서와 원본 JSON 일치, 메뉴 이름/가격에서4개 제품 식별, 빈 기록에는 unmatched/0점/모델 미호출을 확인했다. 임시 계정을 삭제했고 사람 기록은 변경하지 않았다. 기존32개 bundled 계약을 변경하지 않아 이미 만든 최신 Android code18/iOS Release도 공통DB의 추가 제품을 조회한다.
