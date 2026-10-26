import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { betaMetricsSql, metricsDatabase, metricsInput, metricsReport } from '../src/lib/beta-metrics';
const safeErrors = new Set(['METRICS_ARGUMENTS_INVALID', 'METRICS_DATABASE_REQUIRED', 'METRICS_DATABASE_INVALID', 'METRICS_TARGET_MISMATCH', 'METRICS_COHORT_INVALID', 'METRICS_PERIOD_INVALID', 'METRICS_RESULT_INVALID', 'METRICS_READ_ONLY_REQUIRED']);

async function main() {
  let client: ReturnType<typeof postgres> | undefined;
  try {
    const [target, start, end, cohortFile, ...extra] = process.argv.slice(2);
    if (!target || !start || !end || !cohortFile || extra.length) throw Error('METRICS_ARGUMENTS_INVALID');
    const connection = process.env.MOGEUM_METRICS_DATABASE_URL;
    if (!connection) throw Error('METRICS_DATABASE_REQUIRED');
    const { remote } = metricsDatabase(target, connection);
    const cohortText = await readFile(cohortFile, 'utf8');
    if (cohortText.length > 100000) throw Error('METRICS_COHORT_INVALID');
    const input = metricsInput(start, end, JSON.parse(cohortText));
    client = postgres(connection, { max: 1, connect_timeout: 10, onnotice: () => {}, ssl: remote ? { rejectUnauthorized: true } : false });
    const rows = await client.begin('read only', async sql => {
      const [mode] = await sql`select current_setting('transaction_read_only') as read_only`;
      if (mode?.read_only !== 'on') throw Error('METRICS_READ_ONLY_REQUIRED');
      await sql`set local statement_timeout = '15s'`;
      return sql.unsafe(betaMetricsSql, [input.start, input.end, sql.array(input.cohort, 2950)]);
    });
    if (rows.length !== 1) throw Error('METRICS_RESULT_INVALID');
    console.log(JSON.stringify({ target, readOnly: true, ...metricsReport(input, rows[0]) }, null, 2));
  } catch (error) {
    const code = error instanceof Error && safeErrors.has(error.message) ? error.message : 'METRICS_QUERY_FAILED';
    // Connection/DB/JSON errors can contain credentials, queries or source values.
    console.error(JSON.stringify({ error: code }));
    process.exitCode = 1;
  } finally {
    await client?.end({ timeout: 5 }).catch(() => {});
  }
}
void main();
