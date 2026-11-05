import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {connectDatabase} from '../db/postgres.ts';
const db=await connectDatabase(process.env.MIGRATION_DATABASE_URL);
try {
 await db.query('BEGIN');
 await db.query('SELECT pg_advisory_xact_lock(740441)');
 await db.query('CREATE SCHEMA IF NOT EXISTS multtek_migrations');
 await db.query('REVOKE ALL ON SCHEMA multtek_migrations FROM PUBLIC');
 await db.query('CREATE TABLE IF NOT EXISTS multtek_migrations.applied(name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
 await db.query('ALTER TABLE multtek_migrations.applied ENABLE ROW LEVEL SECURITY');
 for(const name of readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql')).sort()){
  const sql=readFileSync('supabase/migrations/'+name,'utf8'),checksum=createHash('sha256').update(sql).digest('hex');
  const old=(await db.query('SELECT checksum FROM multtek_migrations.applied WHERE name=$1',[name])).rows[0];
  if(old){if(old.checksum!==checksum)throw new Error('Migração aplicada foi modificada: '+name);continue;}
  await db.query(sql);
  await db.query('INSERT INTO multtek_migrations.applied(name,checksum) VALUES($1,$2)',[name,checksum]);
  console.log('Aplicada:',name);
 }
 await db.query('COMMIT');
} catch(e){await db.query('ROLLBACK');console.error('Migração revertida:',e.code||e.message);process.exitCode=1;} finally{await db.close();}
