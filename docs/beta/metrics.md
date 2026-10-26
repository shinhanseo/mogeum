# 내부 베타의 읽기 전용 현황 집계

`npm run beta:metrics`는 운영자가 명시한 코호트와 UTC기간에 대해 기존 DB의 집계7개만 읽습니다. 새 이벤트/광고 SDK나 데이터 수집, 서버 API/RLS 권한 추가는 없습니다. 사용자 이름·이메일·사진 경로·메모·메뉴 원문·ID 목록은 결과에 넣지 않습니다. 연결·SQL·JSON 오류도 원문 대신 고정 코드만 출력합니다.

## 실행

1. 대상 테스트 사용자의 UUID 배열을 ignored `artifacts/beta/private-cohort.json`에 보관합니다. 실제 UUID 파일은 공개 GitHub나 채팅으로 보내지 않습니다. 코호트는 필수이며 중복 UUID를 제거하고 최대1000명만 허용합니다. QA/실사용자 구분은 운영자가 코호트를 선택할 때 확정합니다.
2. `MOGEUM_METRICS_DATABASE_URL`을 비공개 환경에 설정합니다. URL을 명령 인수/공개 파일에 넣지 않습니다. local은 loopback:54322/postgres, development는 등록된 mogeum-dev의 직접 DB 호스트만 허용합니다. 원격은 TLS 인증서 검증을 사용하며 URL의 임의 옵션을 허용하지 않습니다. 다른 프로젝트/production/pooler 호스트는 현재 지원하지 않습니다.
3. 아래처럼 UTC 시작 포함/종료 제외 기간을 지정합니다. 쿼리는 read only 트랜잭션과15초 statement timeout으로 실행하며 실제 transaction_read_only=on인지 확인합니다.

```sh
npm run --silent beta:metrics -- local 2026-10-26T00:00:00Z 2026-10-27T00:00:00Z artifacts/beta/private-cohort.json
# 등록된 개발 DB를 운영자가 별도 연결한 경우 target을 development로 지정
```

서버 비밀 키를 앱에 추가하지 않습니다. 코호트 UUID는 DB 조회 매개변수로만 사용하고 출력에는 요청한 인원 수만 남깁니다. 아직 존재하지 않는 ID와 삭제된 계정은 요청 인원에 포함될 수 있으므로 실제 남은 Auth 행 수를 별도 표시합니다. 계정 삭제로 사라진 과거 데이터를 복원하거나 추적하지 않습니다.

## 수치의 정확한 의미

| 출력 | 의미 |
|---|---|
| existing_cohort_accounts | 현재 남아 있는 해당 코호트의 Auth 행 수 |
| accounts_created_in_period | 그중 Auth 생성 시각이 기간 안인 행 수 |
| retained_records_created_in_period | 지금 남아 있고 생성 시각이 기간 안인 기록 수. 마신 날짜를 사용하지 않음 |
| users_with_retained_records_created_in_period | 위 기록을 가진 서로 다른 사용자 수 |
| period_records_with_current_confirmed_note | 위 기록 중 공백/탭/개행뿐인 글을 제외하고 현재 입력 판본과 확정 판본이 일치하는 노트가 있는 기록 수 |
| users_with_retained_ready_summary_generated_in_period | 현재 저장된 ready 요약 job의 생성 시각이 기간 안인 사용자 수. 이후 덮어쓴 과거 요청 이력은 없음 |
| retained_menu_sessions_last_saved_in_period | 지금 남아 있는 메뉴 세션 중 마지막 저장 시각이 기간 안인 세션 수 |

기록2개/사용자1명은 서로 다른 수치입니다. 현재 기록·노트의 상태를 집계하며 삭제 전 과거 생성 횟수, 노트 작성 날짜, 조회 시점의 취향 hash 유효성, 실제로 화면에 보여준 횟수를 증명하지 않습니다. 메뉴 저장과 추천 실행도 별개입니다. 따라서 다음 항목은0으로 만들지 않고 `unmeasured`의 null로 반환합니다.

- 설치 수, 앱 재방문
- 노트 완료 이벤트의 시점/횟수
- AI 요청 횟수, 메뉴 추천 실행 횟수

#22의 최소 이벤트 관측 전체와 외부 배포 준비는 아직 끝나지 않았습니다. 재방문·추천 실행을 실제로 관측하려면 별도 계측의 항목/보관/고지 결정을 마쳐야 합니다. 이 도구는 이를 대체한 것으로 표시하지 않습니다.

## 검증

모든 실제 마이그레이션을 적용한 격리 PGlite에서 코호트 분리·기간 양끝·동일 사용자의 여러 기록·현재 확정 판본·집계7개·read only 쓰기 차단을 확인했습니다. UUID/원문 canary가 결과에 없고 CLI 파싱 오류에도 경로·비밀 연결 값이 출력되지 않는 것을 검사했습니다.

실제 로컬 Supabase/PostgreSQL에서도 named synthetic 계정1개의 기록2개를 CLI로 읽었습니다. [비식별 집계 결과](../verification/beta-metrics/local-synthetic.json)는 합성 QA 예시이며 실제 베타 사용자 통계가 아닙니다. 조회만 수행했고 기존 기록은 변경하지 않았습니다. 관리형 DB 접속과 실제 베타 코호트의 집계는 아직 실행하지 않았습니다.

전체 코드 검사:403개 중395통과, 환경 의존8skip, 실패0. 관리형 DB/실사용 코호트 실행과 #22의 새 이벤트 계측은 이 검증에 포함하지 않습니다.
