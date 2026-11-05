# Multtek — Gestão de Atividades de Expansão

React/Vinext, API Cloudflare Workers, PostgreSQL no Supabase e anexos privados no R2.

Configuração e migração: [SUPABASE.md](./SUPABASE.md).

Validação: `npm ci`, `npm test`, `npx tsc --noEmit`, `npm run build:cloudflare`.

A migração SQL é versionada em supabase/migrations. A pasta drizzle contém somente o histórico SQLite anterior. A alteração prepara a estrutura e as comunicações; importação de dados e validação remota dependem do acesso às bases.
