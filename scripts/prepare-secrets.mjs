import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { randomBytes } from 'node:crypto';

const connection = parseEnv(readFileSync('.env.supabase.local','utf8')).DATABASE_URL;
const key = parseEnv(readFileSync('.env.supabase.storage.local','utf8')).SUPABASE_SECRET_KEY;
if (!connection?.startsWith('postgresql://') || connection.includes('YOUR-PASSWORD') || !key?.startsWith('sb_secret_')) throw new Error('Configure as credenciais locais antes de preparar os segredos.');
const setupFile = '.env.supabase.setup.local';
const token = existsSync(setupFile) ? parseEnv(readFileSync(setupFile,'utf8')).SETUP_TOKEN : randomBytes(32).toString('hex');
if (!token || token.length < 32) throw new Error('Chave de instalação inválida.');
writeFileSync(setupFile, `SETUP_TOKEN=${token}\n`);
writeFileSync('.env.supabase.secrets.json', JSON.stringify({ DATABASE_URL: connection, SUPABASE_SECRET_KEY: key, SETUP_TOKEN: token }));
console.log('Segredos preparados em arquivos locais ignorados pelo Git.');
