import pg from 'pg';
import { supabaseCa } from './supabase-ca.mjs';

// Only server-owned SQL reaches this adapter. Values always remain parameters.
export function postgresSql(sql: string) {
  let parameter = 0;
  return sql.replace(/'(?:''|[^'])*'|\?/g, token => token === '?' ? `$${++parameter}` : token)
    .replaceAll('CASE WHEN expires<', 'CASE WHEN attempts.expires<')
    .replaceAll('ELSE count+1 END', 'ELSE attempts.count+1 END')
    .replaceAll('ELSE expires END', 'ELSE attempts.expires END')
    .replace(/lower\(hex\(randomblob\(16\)\)\)/g, "replace(gen_random_uuid()::text, '-', '')")
    .replace(/\b(FROM|JOIN|INTO|UPDATE)\s+(users|sessions|settings|attempts|clients|stages|origins|tasks|history|notifications|attachments|subscriptions)\b/gi, '$1 multtek.$2');
}

type QueryResult = { rows: Record<string, unknown>[]; rowCount: number | null };
type Query = (sql: string, args: unknown[]) => Promise<QueryResult>;
export class PostgresStatement {
  readonly execute: Query;
  readonly sql: string;
  readonly args: unknown[];
  constructor(execute: Query, sql: string, args: unknown[] = []) {
    this.execute = execute; this.sql = sql; this.args = args;
  }
  bind(...args: unknown[]) { return new PostgresStatement(this.execute, this.sql, args); }
  async first<T>() { return (await this.execute(this.sql, this.args)).rows[0] as T ?? null; }
  async all<T>() { return { results: (await this.execute(this.sql, this.args)).rows as T[] }; }
  async run() {
    const result = await this.execute(this.sql, this.args);
    return { success: true, meta: { changes: result.rowCount ?? 0 } };
  }
}

export async function openPostgres(connectionString: string, managed = false) {
  const client = new pg.Client({ connectionString, ...(managed ? {} : { ssl: { rejectUnauthorized: true, ca: supabaseCa } }),
    connectionTimeoutMillis: 10000, query_timeout: 15000,
    types: { getTypeParser: (oid: number, format?: string) => oid === 20
      ? (value: string) => { const n = Number(value); if (!Number.isSafeInteger(n)) throw new Error('Unsafe database integer'); return n; }
      : pg.types.getTypeParser(oid, format as 'text') },
  });
  await client.connect();
  return postgresAdapter(client);
}

export function postgresAdapter(client: { query: (sql: string, args?: unknown[]) => Promise<QueryResult>; end: () => Promise<void> }) {
  let tail: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = tail.then(operation); tail = result.catch(() => {}); return result;
  };
  const query: Query = async (sql, args) => {
    try { return await client.query(postgresSql(sql), args); }
    catch (error) {
      const failure = error as Error & { code?: string; constraint?: string };
      if (failure.code === '23505') failure.message = failure.constraint?.includes('clients_cnpj')
        ? 'UNIQUE constraint: clients.cnpj' : 'UNIQUE constraint';
      throw failure;
    }
  };
  return {
    prepare: (sql: string) => new PostgresStatement((s, args) => enqueue(() => query(s, args)), sql),
    batch: (jobs: PostgresStatement[]) => enqueue(async () => {
      await client.query('BEGIN');
      try {
        const results = [];
        for (const job of jobs) {
          const result = await query(job.sql, job.args);
          results.push({ success: true, meta: { changes: result.rowCount ?? 0 } });
        }
        await client.query('COMMIT'); return results;
      } catch (error) { await client.query('ROLLBACK'); throw error; }
    }),
    close: () => enqueue(() => client.end()),
  };
}
