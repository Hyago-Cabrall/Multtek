# Publicação Supabase + Cloudflare

Preparação local para o projeto `szchrowkauayfhibstft` e conta Cloudflare
`e9fe3d3233f2b304d5782c262819175e`. O frontend e a API são servidos pelo Worker
`multtek`. PostgreSQL e anexos privados ficam no Supabase.

No projeto remoto já existe o schema `multtek`, com as 12 tabelas e RLS ativo,
sem usuários, clientes ou tarefas na inspeção de 05/11/2026. A migração inicial
não deve ser executada novamente. O bucket privado `multtek-anexos` foi criado
com limite de 20 MB. Publicação concluída em 05/11/2026:
[Multtek](https://multtek.hyagocabrall.workers.dev).
A API `/api/auth` respondeu HTTP 200 e confirmou acesso ao PostgreSQL.
Falta apenas o proprietário cadastrar o primeiro administrador na interface.
Não transfere registros ou arquivos de uma instalação anterior: o GitHub contém
o schema e o código, não um backup dos registros em produção.

## Banco

A migração `supabase/migrations/202611050001_multtek.sql` cria o schema isolado
`multtek`. Preserva IDs, hashes de senha, flags e regras da aplicação. Não concede
acesso a `anon` ou `authenticated`; toda autorização continua na API do Worker.
Não inclua esse schema nos schemas expostos pelo Data API do Supabase.

Inspecione o banco antes da execução. A migração falha se o schema já existir;
nunca remova um schema existente apenas para executar novamente.

Configure `DATABASE_URL` em `.env.supabase.local` (ignorado pelo Git) com a URI
fornecida pelo painel. Use o pooler em modo sessão (porta 5432) para a migração.
`MIGRATION_DATABASE_URL` pode separar a conexão de migração da conexão do runtime.
Nenhuma credencial deve ser colocada em chat, código, argumentos ou variáveis públicas.

Em um banco novo, execute `node scripts/migrate-supabase.mjs` apenas após conferir o projeto.
O script verifica a referência antes de executar qualquer DDL.

## Arquivos e segredos

Crie no Supabase Storage o bucket privado `multtek-anexos`, com limite de 20 MB.
O Worker usa `SUPABASE_SECRET_KEY` apenas no servidor; não crie política de
leitura pública. Uploads, downloads e exclusões passam pelas permissões da API.

O Worker usa o binding `HYPERDRIVE`, configuração `multtek-supabase`
(`6394b45293fc4afc8698ead2d9190446`). O Hyperdrive conecta ao pooler de sessão do
Supabase na porta 5432, com TLS `verify-full` e a CA oficial do Supabase
(`b5397f48-b39c-4aa2-b96b-18f98a1163f8`). O cache SQL está desativado para evitar
leituras antigas de sessões e tarefas; o limite de conexões de origem é 5.
O Worker foi posicionado em `aws:us-west-2`, próximo ao banco.

Configure como segredos no Worker: `DATABASE_URL` (fallback), `SUPABASE_SECRET_KEY` e
`SETUP_TOKEN` (32 a 256 caracteres aleatórios). A chave de instalação é solicitada
apenas para criar o primeiro administrador e pode ser removida depois.

Web Push é opcional e depende dos segredos VAPID descritos em `CLOUDFLARE.md`.

Para a preparação local, `node scripts/check-supabase.mjs` normaliza a URI e
verifica a autenticação com TLS e certificado oficial do Supabase.
`node scripts/prepare-secrets.mjs` reúne os segredos dos arquivos ignorados e
gera a chave de instalação em `.env.supabase.setup.local`. O deploy carrega esse
arquivo protegido com `--secrets-file`, sem passar valores em argumentos.
A configuração de produção usa o binding gerenciado, pois o driver direto no
runtime Workers não estabeleceu conexão com o pooler Supabase.

## Validação e publicação

Use os comandos do `package.json`: `npm test`, `npm run test:postgres`,
`npm run build:supabase` e `npm run deploy:supabase`.
Confirme as credenciais da conta com `wrangler whoami` antes do deploy.
O comando de publicação compila, confere os recursos e publica o build; não aplica
a migração automaticamente nem provisiona segredos.

Antes de liberar para a equipe, valide a API `/api/auth`, criação do administrador,
login, permissões, CRUD, histórico e anexos no endereço público. Guarde backups do
PostgreSQL e do Storage separadamente do código.

Referências: [conexões Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres),
[Node.js no Workers](https://developers.cloudflare.com/workers/runtime-apis/nodejs/).
