import { readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import pg from 'pg';
import { supabaseCa } from '../lib/supabase-ca.mjs';

const file = '.env.supabase.local';
const content = readFileSync(file, 'utf8');
const parsed = parseEnv(content);
let value = parsed.DATABASE_URL;
if (!value) {
  const lines = content.split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith('#'));
  if (lines.length === 1 && !lines[0].includes('=')) value = lines[0].trim();
}
if (!value || value.includes('YOUR-PASSWORD')) throw new Error('A senha real ainda não está configurada.');
const prefix = value.match(/^postgres(?:ql)?:\/\/postgres\.szchrowkauayfhibstft:/)?.[0];
const suffix = '@aws-1-us-west-2.pooler.supabase.com:6543/postgres';
if (prefix && value.endsWith(suffix)) {
  let password = value.slice(prefix.length, -suffix.length);
  try { password = decodeURIComponent(password); } catch { /* Raw percent signs in passwords are encoded below. */ }
  value = prefix + encodeURIComponent(password) + suffix;
  writeFileSync(file, `# Conexão privada. Não compartilhar ou versionar.\nDATABASE_URL=${JSON.stringify(value)}\n`);
}
if (!/^postgres(?:ql)?:\/\//.test(value)) {
  value = `postgresql://postgres.szchrowkauayfhibstft:${encodeURIComponent(value)}@aws-1-us-west-2.pooler.supabase.com:6543/postgres`;
  writeFileSync(file, `# Conexão privada. Não compartilhar ou versionar.\nDATABASE_URL=${JSON.stringify(value)}\n`);
}
let url;
try { url = new URL(value); } catch { throw new Error('A conexão local não é uma URL PostgreSQL válida.'); }
if (url.hostname !== 'aws-1-us-west-2.pooler.supabase.com' || decodeURIComponent(url.username) !== 'postgres.szchrowkauayfhibstft') throw new Error('Destino PostgreSQL diferente do projeto solicitado.');
if (process.argv.includes('--without-placeholder-brackets')) {
  const password = decodeURIComponent(url.password);
  if (password.startsWith('[') && password.endsWith(']')) {
    url.password = encodeURIComponent(password.slice(1, -1)); value = url.toString();
  }
}
const client = new pg.Client({ connectionString: value, ssl: { rejectUnauthorized: true, ca: supabaseCa }, connectionTimeoutMillis: 10000 });
try {
  await client.connect();
  writeFileSync(file, `# Conexão privada. Não compartilhar ou versionar.\nDATABASE_URL=${JSON.stringify(value)}\n`);
  const result = await client.query('SELECT count(*)::integer users FROM multtek.users');
  console.log({ connected: true, users: result.rows[0].users });
} catch (error) {
  console.error({ connected: false, code: error.code || 'CONNECTION_FAILED' }); process.exitCode = 1;
} finally { await client.end(); }
