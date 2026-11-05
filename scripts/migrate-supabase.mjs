import { existsSync, readFileSync } from 'node:fs';
import pg from 'pg';

if (existsSync('.env.supabase.local')) process.loadEnvFile('.env.supabase.local');
const connectionString = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error('Configure DATABASE_URL no arquivo ignorado .env.supabase.local.');
const target = new URL(connectionString);
const project = 'szchrowkauayfhibstft';
if (!(target.hostname === `db.${project}.supabase.co` ||
  target.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(target.username).endsWith(`.${project}`))) {
  throw new Error('A conexão não pertence ao projeto Supabase solicitado.');
}
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: true, ca: readFileSync('supabase/prod-ca-2021.crt','utf8') }, connectionTimeoutMillis: 15000 });
await client.connect();
try {
  const existing = await client.query("SELECT to_regnamespace('multtek') present");
  if (existing.rows[0].present) throw new Error('O schema multtek já existe. Inspecione seu estado e backup antes de qualquer alteração.');
  await client.query(readFileSync('supabase/migrations/202611050001_multtek.sql', 'utf8'));
  console.log('Schema Multtek criado no Supabase; nenhuma tabela existente foi substituída.');
} finally { await client.end(); }
