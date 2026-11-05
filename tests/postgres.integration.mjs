import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { postgresAdapter, postgresSql } from '../lib/postgres-db.ts';
import {testClientImport} from './client-import-scenarios.mjs';

const engine = new PGlite();
await engine.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
await engine.exec(readFileSync(new URL('../supabase/migrations/202611050001_multtek.sql', import.meta.url), 'utf8'));
const db = postgresAdapter({
  async query(sql, args = []) {
    let result;
    try { result = await engine.query(sql, args); }
    catch (error) { if (error.code !== '23505') console.error(sql, error.message); throw error; }
    return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
  },
  end: () => engine.close(),
});

// Run the exact same application scenarios against PostgreSQL, not a SQL mock.
const source = readFileSync(new URL('./api.integration.mjs', import.meta.url), 'utf8');
const scenarios = source.slice(source.indexOf('const objects='))
  .replace("check(sqlite.prepare('SELECT COUNT(*) n FROM users').get().n===0", "check((await db.prepare('SELECT COUNT(*) n FROM users').first()).n==0")
  .replace("assert.throws(()=>sqlite.prepare('INSERT INTO clients(id,name,uf,city,cnpj) VALUES(?,?,?,?,?)').run('race','Concorrente','GO','Goiânia','12ABC34501DE35'),/UNIQUE/)", "await assert.rejects(()=>db.prepare('INSERT INTO clients(id,name,uf,city,cnpj) VALUES(?,?,?,?,?)').bind('race','Concorrente','GO','Goiânia','12ABC34501DE35').run(),/UNIQUE/)")
  .replace("check(sqlite.prepare('SELECT COUNT(*) n FROM history WHERE task_id=?').get(t.id).n>=9", "check((await db.prepare('SELECT COUNT(*) n FROM history WHERE task_id=?').bind(t.id).first()).n>=9")
  .replace('sqlite.close();', '');
const { default: assert } = await import('node:assert/strict');
const { api } = await import('../lib/api.ts');
try {
  await new (Object.getPrototypeOf(async function(){}).constructor)('db','assert','api','testClientImport',scenarios)(db,assert,api,testClientImport);
  assert.equal(postgresSql("SELECT '?' AS literal FROM users WHERE id=?"), "SELECT '?' AS literal FROM multtek.users WHERE id=$1");
  const isolation = await engine.query("SELECT has_schema_privilege('anon','multtek','USAGE') allowed");
  assert.equal(isolation.rows[0].allowed, false);
  console.log('PASSOU: migração PostgreSQL, isolamento do schema e parâmetros SQL.');
} finally { await db.close(); }
