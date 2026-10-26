import { BACKEND_TARGETS } from './backend-release';

export function metricsInput(start: string, end: string, cohort: unknown) {
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
  if (!iso.test(start) || !iso.test(end) || !Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || Date.parse(start) >= Date.parse(end)) throw Error('METRICS_PERIOD_INVALID');
  for (const value of [start, end]) if (new Date(value).toISOString().replace('.000Z', 'Z') !== value.replace('.000Z', 'Z')) throw Error('METRICS_PERIOD_INVALID');
  if (!Array.isArray(cohort) || !cohort.length || cohort.length > 1000 || cohort.some(id => typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) throw Error('METRICS_COHORT_INVALID');
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString(), cohort: [...new Set(cohort.map(id => (id as string).toLowerCase()))] };
}

export function metricsDatabase(target: string, connection: string) {
  const url = new URL(connection);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.pathname !== '/postgres' || url.search || url.hash) throw Error('METRICS_DATABASE_INVALID');
  if (target === 'local' && url.port === '54322' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) return { remote: false };
  if (target === 'development' && url.hostname === `db.${BACKEND_TARGETS.development.ref}.supabase.co`) return { remote: true };
  throw Error('METRICS_TARGET_MISMATCH');
}

// Aggregate fields only: never return source rows, identifiers, note text or menu JSON.
export const betaMetricsSql = `
with cohort as (
  select id, created_at from auth.users where id = any($3::uuid[])
), records as (
  select r.id, r.user_id from public.tasting_records r
  join cohort c on c.id = r.user_id
  where r.created_at >= $1::timestamptz and r.created_at < $2::timestamptz
)
select
 (select count(*) from cohort) as existing_cohort_accounts,
 (select count(*) from cohort where created_at >= $1::timestamptz and created_at < $2::timestamptz) as accounts_created_in_period,
 (select count(*) from records) as retained_records_created_in_period,
 (select count(distinct user_id) from records) as users_with_retained_records_created_in_period,
 (select count(*) from records r where exists (
   select 1 from public.record_notes n where n.record_id = r.id and n.user_id = r.user_id
    and nullif(btrim(n.confirmed_note, E' \\t\\r\\n'), '') is not null and n.confirmed_input_revision = n.input_revision
 )) as period_records_with_current_confirmed_note,
 (select count(*) from private.taste_summary_jobs j join cohort c on c.id = j.user_id
  where j.status = 'ready' and j.result is not null and j.generated_at >= $1::timestamptz and j.generated_at < $2::timestamptz
 ) as users_with_retained_ready_summary_generated_in_period,
 (select count(*) from public.menu_sessions m join cohort c on c.id = m.user_id
  where m.updated_at >= $1::timestamptz and m.updated_at < $2::timestamptz
 ) as retained_menu_sessions_last_saved_in_period
`;

export const metricNames = [
  'existing_cohort_accounts', 'accounts_created_in_period',
  'retained_records_created_in_period', 'users_with_retained_records_created_in_period',
  'period_records_with_current_confirmed_note', 'users_with_retained_ready_summary_generated_in_period',
  'retained_menu_sessions_last_saved_in_period',
] as const;

export function metricsReport(input: ReturnType<typeof metricsInput>, row: Record<string, unknown>) {
  const counts = Object.fromEntries(metricNames.map(name => {
    const raw = row[name];
    if (!(typeof raw === 'number' || typeof raw === 'string' && /^\d+$/.test(raw))) throw Error('METRICS_RESULT_INVALID');
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 0) throw Error('METRICS_RESULT_INVALID');
    return [name, value];
  }));
  return {
    schemaVersion: 1, period: { startInclusive: input.start, endExclusive: input.end },
    requestedCohortSize: input.cohort.length, counts,
    unmeasured: { installs: null, appRevisits: null, noteCompletionEvents: null, aiRequestCount: null, menuRecommendationExecutions: null },
  };
}
