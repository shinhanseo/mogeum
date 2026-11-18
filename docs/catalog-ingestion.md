# 대량 제품 인벤토리 수집

2026-11-18 사용자 지시로 제품명·이미지·가격을 확장한다. 기존 37개 추천 카탈로그와 별도로 검색/식별용 원본 인벤토리를 만든다. 수집한 사실과 검증된 추천 feature를 혼동하지 않는다.

## 실행

```sh
python3 -m venv /tmp/mogeum-catalog
/tmp/mogeum-catalog/bin/pip install -r scripts/catalog/requirements.txt
/tmp/mogeum-catalog/bin/python scripts/catalog/collect.py --seed all --limit 200 --images 200
/tmp/mogeum-catalog/bin/python scripts/catalog/collect.py --limit 1000 --images 1000
/tmp/mogeum-catalog/bin/python scripts/catalog/export.py
/tmp/mogeum-catalog/bin/python -m unittest discover -s scripts/catalog -p 'test_*.py' -v
```

출력은 Git에서 제외된 `artifacts/catalog-ingestion/`에 저장한다. `catalog.sqlite`는 실제 SQLite DB, `products.jsonl`은 재처리용, `products.csv`는 확인용이다. 수집 큐는 같은 DB에 영속화된다. 종료 중 요청은 pending 상태여서 재시작하면 이어지고, HTTP 404/410은 gone, 일시 오류는 failed로 기록한다. `--retry`는 실패한 제품만 최대 3회까지 재시도 대상으로 되돌린다. 중복 실행은 정상 결과를 덮어쓰지 않도록 한 작업만 실행한다.

## 출처와 범위

- 데일리샷 공개 상품 사이트맵의 URL만 큐에 넣는다. 공개 JSON-LD/Information의 제품명, 외국어명, 분류, 도수, 용량, 국가, 가격 범위와 이미지 URL을 추출한다.
- 더술 우리술 찾기 공개 목록에서 실제 발견한 제품 ID만 추가한다. 종류, 원재료, 도수, 용량, 수상 정보 및 이미지 URL을 추출한다.
- 호스트별 초당 최대 1회 제품 요청, 최대 3개 작업을 기본으로 한다. robots.txt를 읽어 정책을 DB에 보관하고 금지 URL은 수집하지 않는다. 응답은 최대 12MiB, 이미지 최대 4천만 픽셀이다. 인증이나 접근 제한을 우회하지 않는다.
- Open Food Facts 운영 API는 이 환경에서 503을 반환했다. `.net` 응답은 분류와 실제 반환 제품이 일치하지 않아 사용하지 않았다.
- 고객 리뷰·작성자 이름·별점·리뷰 본문·상품 설명 전문은 제품 DB에 넣지 않는다. 초기 구조 분석용 HTML은 로컬 raw 폴더에만 있다.
- source + source_id가 기본 키다. 같은 이름, 다른 용량/빈티지/도수/묶음/판매처를 이름만 보고 합치지 않는다. 정규화한 이름과 FTS는 탐색용이며 제품 확정 근거가 아니다.
- 맥주/와인/위스키/전통주 외 주종이나 미확인 제품은 `other`로 유지한다. 국내 증류주를 판별하려면 국가 정보도 확인한다.

## 이미지와 가격

원본은 바이트 해시 이름으로 저장하고 EXIF 회전만 보정한 768px 이하 WebP를 추가한다. 종횡비를 유지하고 크롭/누끼/업스케일을 하지 않는다. 같은 이미지 바이트는 해시 경로를 공유한다. 다운로드 성공 여부, 실제 크기, 오류, 원본 출처를 기록한다.

수집 가능 여부와 재배포 권한은 별도다. 이미지 권한은 `permission_unconfirmed`이며 앱의 공개 Storage나 번들에 자동 배포하지 않는다. 공개 활용 전 제조사 제공/사용 허락/명시된 라이선스를 확인하고 출처를 함께 표시한다. 가격은 날짜가 있는 해당 판매처의 관측값이며 구매 내역이나 사용자가 실제 지출한 금액으로 계산하지 않는다.

## 앱/추천 반영 경계

수집 데이터는 아직 기존 `public.product_catalog`의 verified 레코드가 아니다. 기존 추천 API에는 자동 추가하지 않는다. 제품 이미지 권한 검토, 용량/빈티지 연결, 출처 대조와 feature 검토 후 제품별로 승격한다. 상품 수집 숫자를 검증된 추천 가능 제품 수로 보고하지 않는다. 전체 인터넷을 전수 수집했다고 표시하지 않는다.

## 전체 수집과 진행 확인

```sh
/tmp/mogeum-catalog/bin/python scripts/catalog/import_public_csv.py
/tmp/mogeum-catalog/bin/python scripts/catalog/collect.py --continuous --limit 200 --images 250 --retry
/tmp/mogeum-catalog/bin/python scripts/catalog/export_sql.py
```

CSV가 없으면 importer가 공공데이터포털의 공식 다운로드 참조와 다운로드 제한 확인 단계를 거쳐 받는다. CAPTCHA가 필요한 응답이면 중단한다. 1,251행 중 동일 이름·양조장·용량·도수지만 내용이 다른 두 쌍도 별도 출처 레코드로 보존했다. 더술 목록의 페이지별 중복 때문에 확인한 제품 ID는 공공 CSV 전체 행 수보다 적을 수 있다.

`--continuous`는 남은 상품과 이미지 큐를 배치별로 처리하고 매 배치 CSV/JSONL/이미지 검토판을 갱신한다. collector.lock으로 동일 디렉터리 중복 실행을 차단한다. `report.json`의 sources/categories/jobs/images를 확인한다. 레코드 수에는 출처 간 중복, 선물세트, 용량 변형과 other 분류가 포함되어 고유 술 종류 수와 다르다.

이미지는 수집·검토용 로컬 파일이다. 크롭이나 흰 배경 제거를 일괄 적용하지 않아 배경이 있는 이미지도 포함된다. 권한 확인과 술장용 자산 선별은 별도 후속 단계다.

서버 반입용 `inventory-import.sql`은 `20261118010000_product_inventory.sql` 적용 후 관리자 권한으로 실행한다. private 인벤토리만 갱신하고 기존 reviewed/held 상태, 이미지 권한 승인은 보존한다. 실제 운영 DB 반영과 앱 표시 연결은 아직 수행하지 않았다.

## Expo 호환성 보완

2026-11-18 SDK 58의 권장 패치(Expo 58.0.26 및 대응 모듈)로 package/lock을 정렬하고 동적 설정에 expo-status-bar 플러그인을 추가했다. `expo install --check`, 타입/린트/전체 테스트(491 통과, 15 환경 의존 skip), 세 플랫폼 JS export를 확인했다. 수집기 Python 테스트 8개도 통과했다. 이번 검증은 새 네이티브 스토어 빌드 검증을 포함하지 않는다.

## DB-first recommendation contract (2026-11-19)

New clients opt into `shared-catalog-v2`. The original verified catalog and v1 source vocabulary remain available to released binaries. Source observations are normalized into edition-scoped `catalog_products`; exact normalized aliases and feature IDs have separate indexes. Menu requests fetch only exact current-menu matches (bounded to 950), while next-drink requests fetch up to 100 feature-matched products per category. No full-catalog mobile download is required.

`normalize.py` merges only matching name/strength/volume/producer identities. Unknown producers remain source-scoped. Volume units are normalized, but differing strengths, wine name years and gift sets remain separate. Structured retailer aroma terms never imply sweetness, ABV or personal experience. Unrecognized terms remain unmapped. Products without supported tasting terms are `identity-only`: searchable, but never personal recommendation evidence. The original source URL, date, source kind, literal evidence and raw observation links are retained. Public image reuse still requires a separately reviewed right; this migration does not publish image binaries.

`export_sql.py` prepares private source inventory imports plus bounded `inventory-sql/*.sql`; `export_canonical_sql.py` prepares replay-safe `canonical-sql/*.sql` after normalization. Apply source batches before canonical batches. Held decisions survive reimport. All generated data and SQL remain gitignored.

By default `next-drinks` and `menu-recommend` use evidence rules against the database without Gemini selection/search calls. Legacy provider selection can only be explicitly enabled server-side with `MOGEUM_RECOMMENDATION_ENGINE=gemini` for v1 clients. The bartender and note prose providers are separate features and unchanged. Old clients keep their catalog vocabulary; the expanded catalog requires the new app contract.

Validation includes normalization regressions, transport bounds, source provenance, SQL import replay, RLS, held products, wishlist family exclusion, legacy/v2 HTTP and missing-provider-key behavior. Production imports and function deployment must follow passing CI; collection counts are observations rather than unique verified drinks.
