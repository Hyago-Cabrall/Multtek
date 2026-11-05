# Multtek — PostgreSQL no Supabase

O código usa PostgreSQL por `pg`, exclusivamente no Worker. As 12 tabelas ficam no schema privado `multtek`; não adicione esse schema aos schemas expostos pela Data API. A autenticação atual (PBKDF2, sessão HttpOnly, perfis) é preservada; não exige Supabase Auth nem chave service_role no navegador.

## Instalação

1. No projeto Supabase Multtek, obtenha a conexão PostgreSQL em Connect. Para o Worker, use o transaction pooler (porta 6543). O driver usa consultas sem prepared statements nomeados e define search_path dentro de cada transação.
2. Configure `MIGRATION_DATABASE_URL` no ambiente local seguro com conexão direta ou session pooler do proprietário do banco. Execute `npm ci` e `npm run db:migrate`. O instalador aplica SQL em uma transação, registra checksums e recusa migrações já aplicadas que foram alteradas. Não imprime a conexão.
3. Execute supabase/runtime-role.sql como proprietário das migrações e defina senha e LOGIN de forma segura. O script cria uma role exclusiva `multtek_app`, inicialmente NOLOGIN, sem SUPERUSER/CREATEDB/CREATEROLE, com senha gerada no painel ou gerenciador seguro. Conceda USAGE no schema multtek; SELECT, INSERT, UPDATE, DELETE em suas tabelas; USAGE, SELECT em suas sequências. Não conceda acesso aos schemas auth/storage ou ao schema de controle das migrações. Não use anon/authenticated como role do Worker.
4. Usando a conexão dessa role, configure `DATABASE_URL` com `npx wrangler secret put DATABASE_URL --config wrangler.cloudflare.json`. TLS verifica certificados; não aceita desativar essa verificação por sslmode.
5. Configure `SETUP_TOKEN` (mínimo 32 caracteres aleatórios) pelo mesmo comando. A primeira instalação pública exige essa chave e nunca a devolve ao navegador.
6. Ative R2 e crie o bucket privado multtek-anexos antes de publicar. Anexos continuam no R2; o PostgreSQL guarda metadados e relacionamentos. Configure VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT se desejar push.
7. Execute `npm test`, `npx tsc --noEmit`, `npm run build:cloudflare` e `npm run deploy:cloudflare`. A publicação não executa mais migrações D1.

## Mapeamento e integridade

As tabelas users, sessions, settings, attempts, clients, stages, origins, tasks, history, notifications, attachments e subscriptions mantêm todos os campos anteriores. IDs textuais preservam compatibilidade com dados antigos. tasks.id passa a identity PostgreSQL. expires e next_attempt são bigint para milissegundos. Flags continuam inteiros 0/1 com CHECK. Datas ISO e subscriptions.data permanecem text para manter o contrato existente; as datas são escritas pelo servidor. CNPJ é texto único, permite alfanumérico e nulo para clientes legados; dígitos verificadores continuam validados na API.

Chaves estrangeiras, índices, unicidade e gatilhos preservam proteção do último administrador, responsáveis ativos, criador imutável e bloqueio de inativação com tarefas abertas. A API serializa escritas com advisory lock dentro de uma transação; alterações, histórico e notificações confirmam juntos. Scripts administrativos também devem adquirir `pg_advisory_xact_lock(740441)` antes de alterar dados de negócio para respeitar a mesma coordenação.

## Dados existentes e entrada em produção

Esta migração cria a estrutura; não extrai automaticamente registros nem objetos da instalação anterior. Os arquivos drizzle/*.sql são histórico SQLite, não devem ser executados no PostgreSQL. Nenhuma base anterior é apagada.

Antes de trocar o endereço público: congelar escritas na origem, exportar backup SQLite/D1 e objetos R2, importar na ordem users/settings/attempts/clients/stages/origins/sessions/tasks/history/notifications/attachments/subscriptions, preservando IDs e hashes. Importar tarefas antes de inativar responsáveis legados se houver tarefas concluídas atribuídas a usuários inativos. Ajustar a sequence de tasks ao maior ID importado. Conferir contagens, relacionamentos, objetos, login e operações com a role multtek_app. Manter backup e configuração antiga para retorno; alterações posteriores ao corte exigem reconciliação antes de retornar.

Validação local usa PGlite (motor PostgreSQL WASM), não uma conexão ao Supabase. Validação de TLS, pooler, credenciais, privilégios da role real, entrega push e R2 deve ocorrer no ambiente provisionado antes de considerar a migração concluída.

Antes da publicação, informe a região real do projeto Supabase para configurar o posicionamento do Worker próximo ao banco.

## Aplicação em 05/11/2026

Estrutura aplicada no projeto szchrowkauayfhibstft (Multtek, Grupo HW), região AWS us-west-2. As 12 tabelas/72 campos foram conferidos no painel. RLS habilitado, sem políticas para anon/authenticated. A role multtek_app recebe políticas exclusivas para o backend no script runtime-role.sql; essas permissões ainda dependem de autorização e provisionamento no ambiente real. DATABASE_URL e testes via Cloudflare permanecem pendentes. Não foram importados dados da base anterior.
