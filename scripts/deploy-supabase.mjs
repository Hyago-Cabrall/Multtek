import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
function run(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run('node_modules/vite/bin/vite.js', ['build', '--config', 'vite.supabase.config.ts']);
const built = JSON.parse(readFileSync('dist/server/wrangler.json', 'utf8'));
if (built.account_id !== 'e9fe3d3233f2b304d5782c262819175e' || built.name !== 'multtek' ||
    built.vars?.DATABASE_PROVIDER !== 'supabase' || built.vars?.PUBLIC_DEPLOYMENT !== 'true' || built.d1_databases?.length) {
  throw new Error('O build não corresponde ao destino Supabase + Cloudflare solicitado.');
}
run('node_modules/wrangler/bin/wrangler.js', ['deploy', '--config', 'dist/server/wrangler.json',
  ...(existsSync('.env.supabase.secrets.json') ? ['--secrets-file', '.env.supabase.secrets.json'] : [])]);
