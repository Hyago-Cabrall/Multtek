import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const config = JSON.parse(readFileSync('wrangler.cloudflare.json', 'utf8'));
if (config.vars?.PUBLIC_DEPLOYMENT !== 'true') {
  throw new Error('PUBLIC_DEPLOYMENT precisa estar ativo para proteger a instalação pública.');
}

function run(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('node_modules/vite/bin/vite.js', ['build', '--config', 'vite.cloudflare.config.ts']);
const built = JSON.parse(readFileSync('dist/server/wrangler.json', 'utf8'));
if (built.name !== config.name || built.vars?.PUBLIC_DEPLOYMENT !== 'true') {
  throw new Error('O build não corresponde à configuração pública da Cloudflare.');
}
run('node_modules/wrangler/bin/wrangler.js', ['deploy', '--config', 'dist/server/wrangler.json']);
