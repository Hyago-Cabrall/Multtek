# Multtek — Gestão de Expansão

Aplicação web para acompanhar implantações e manutenções. Interface React/TypeScript, API em Cloudflare Workers, banco SQL D1/SQLite com migrations Drizzle e arquivos privados no R2. O projeto preserva a integração de build do Sites/Vinext.

## Primeiro acesso

1. Abra o endereço privado publicado.
2. Preencha o formulário do primeiro administrador (nome, usuário, senha de pelo menos 10 caracteres, e-mail, CPF válido e celular).
3. Cadastre clientes e usuários, depois crie as primeiras tarefas.
4. Na central de notificações, clique em **Ativar push** e permita as notificações do navegador.

A criação inicial é única e atômica. Nenhuma senha padrão, conta fictícia ou dado de teste é colocado em produção. Não há recuperação de senha por e-mail. Administradores podem definir uma nova senha de um membro no cadastro; sessões e inscrições push anteriores são revogadas nesse caso.

A publicação começa privada, acessível ao proprietário autenticado na plataforma. O login da Multtek é uma segunda camada. Cadastrar usuários na Multtek não concede acesso ao site na plataforma: a liberação do site para a equipe é uma decisão de compartilhamento separada, ainda não realizada.

## Funcionalidades

- Login, logout, hash PBKDF2-SHA256 com salt aleatório e 100.000 iterações; cookies HttpOnly/SameSite e Secure em HTTPS; sessões de 12 horas e limitação de tentativas.
- Usuários com CPF válido, unicidade de usuário/e-mail/CPF, perfil, atividade e exclusão lógica. Membros não recebem CPF/celular/e-mail de colegas pela API.
- Clientes com nome, CNPJ numérico ou alfanumérico, UF, cidade, filtros e inativação preservando vínculos. CNPJ opcional para compatibilidade com os cadastros anteriores; quando preenchido, exige dígitos verificadores válidos e é único inclusive entre clientes inativos. A normalização remove a máscara e converte letras para maiúsculas. Índice UNIQUE no banco protege contra concorrência.
- Origens sem CRUD: WhatsApp, Ligação, Ticket e Implantação.
- Kanban configurável com cores, ordenação, etapa inicial, etapas conclusivas e transferência atômica ao excluir uma etapa.
- Tarefas com resumo de até 2.000 palavras, criador imutável, responsável, duração em minutos, histórico e exclusão lógica.
- Quadro com arrastar e soltar e mudança de etapa pelo formulário; lista, pesquisa e filtros.
- Concorrência otimista nas tarefas. Alterações, histórico e eventos de notificação são gravados na mesma transação.
- Anexos privados: JPEG/PNG/WebP, MP3/WAV/OGG/M4A/WebM e PDF; 20 MB/arquivo, 10/tarefa; validação de assinatura e extensão, download autenticado, visualização de imagem e reprodução de áudio.
- Central de notificações, Web Push com VAPID, Service Worker, criptografia RFC 8291, inscrições por dispositivo e fila persistente de eventos.

## Desenvolvimento

Requer Node.js 24 para os testes de integração (node:sqlite) e Node.js compatível com o starter para o aplicativo. Não execute o comando de preparação novamente em um checkout existente.

```sh
npm ci
npm run db:generate # apenas quando houver nova alteração de schema
npm run build
```

Aplique somente migrations ainda não aplicadas ao banco local, na ordem:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_curvy_ezekiel_stane.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_integrity.sql
npm run dev
```

No ambiente gerenciado, o preview é iniciado pelo comando `sites-preview start /caminho/checkout`. A produção e o preview usam bancos distintos. Migrations aplicadas não devem ser reescritas. Os dados iniciais são criados no primeiro cadastro, fora das migrations.

`.openai/hosting.json` declara DB e BUCKET. A plataforma provisiona os bindings e aplica as migrations na publicação. O diretório `.wrangler` contém somente dados locais e não faz parte do Git.

## Push

Gere um par VAPID com `web-push.generateVAPIDKeys()` e configure `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` no runtime. Nunca salve a chave privada no frontend ou no repositório. As chaves da versão publicada foram configuradas como segredos. Após mudança de ambiente, publique novamente.

O envio é disparado em background após atribuição/conclusão. Eventos não enviados ficam na tabela `notifications`, com até cinco tentativas e backoff. O sistema tenta drenar a fila também em consultas de dados (o frontend consulta a cada 30 segundos) e novas inscrições. A reivindicação de cada evento evita processamentos concorrentes. Sem dispositivos inscritos, o evento continua disponível internamente.

**Limite desta versão:** não há agendador independente para retentativas enquanto não houver solicitações à aplicação. O envio inicial usa `waitUntil` e continua após a resposta, mas retentativas posteriores dependem de nova atividade. Para operação com SLA de notificações, conecte uma fila/agendador ao serviço de envio. A entrega efetiva também depende do serviço do navegador, permissão do usuário e sistema operacional. O site privado pode exigir sessão da plataforma para carregar o Service Worker; valide no navegador final. A confirmação de recebimento em dispositivo real ainda deve ser feita pelo usuário.

## Verificação

```sh
node --test tests/rules.test.mjs
node tests/api.integration.mjs
npx tsc --noEmit
npm run build
```

`tests/api.integration.mjs` executa a API real sobre SQLite em memória, com adaptador D1 e armazenamento de arquivos simulado. Testa autenticação, autorização, CRUD, conflitos, transferências, histórico, notificações, validação de arquivos e limitação de login. Não substitui teste ponta a ponta no provedor D1/R2 ou navegador real. Dados de teste não são enviados para produção.

O layout do quadro, formulário e clientes foi inspecionado em navegador com fixtures temporárias. Essas fixtures e a rota visual não fazem parte da publicação. A tela real de configuração inicial também foi inspecionada. Não houve login de produção nem criação de conta em nome do usuário.

## Validação manual

1. Crie o administrador; saia e entre novamente. Confira erro com senha incorreta.
2. Cadastre dois membros e dois clientes. Confira CPF inválido e unicidade.
3. Crie uma tarefa e atribua a um membro; use a conta do membro para conferir aviso interno.
4. Edite o resumo, informe 26h e 15min, salve e recarregue.
5. Anexe uma imagem, áudio e PDF. Abra, reproduza, baixe e exclua conforme permissões.
6. Arraste entre etapas. Confira persistência e histórico. Teste mudança de etapa pelo formulário em celular.
7. Conclua e confira aviso para o criador. Reabra e conclua novamente; confira outro evento.
8. Edite a mesma tarefa em duas abas; a gravação da versão antiga deve retornar conflito.
9. Crie e reordene etapas; exclua uma com tarefas escolhendo um destino.
10. Tente inativar um responsável com tarefas abertas e remover o último administrador: ambas operações devem falhar.
11. Entre como membro: CRUD de usuários/etapas e exclusão de tarefa de outro criador devem ser proibidos.
12. Ative push em HTTPS e teste atribuição com navegador em segundo plano. Negue a permissão em outro navegador e confira a central interna.
13. Confira uso em celular e acessibilidade por teclado.

## Limites conhecidos

- Não há integração de e-mail, cronômetro, importação de clientes, geolocalização de municípios ou CRUD de origens.
- Listagem de tarefas não possui paginação nesta primeira versão; adequada para validação e equipes pequenas. Para alto volume, adicionar paginação e consultas de indicadores no servidor.
- A verificação de anexos identifica formato/assinatura; não inclui antivírus ou sanitização de PDF.
- Migrations adicionam proteção transacional para último administrador e vínculos abertos, índices e imutabilidade do criador. Alterações de tarefa usam versionamento; os demais formulários não possuem controle de versão por registro.
- Há estilos responsivos, mas a verificação visual realizada foi em viewport desktop; validação física em dispositivos móveis permanece recomendada.

Veja `API.md` para contratos e permissões.

## CNPJ alfanumérico

Migration adicional: `drizzle/0002_parallel_doomsday.sql`. Adiciona coluna nullable e índice único, preservando registros existentes. Cálculo conforme Receita Federal: https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj/manual-dv-cnpj.pdf . Aceita CNPJs numéricos anteriores. Valida formato e DV; não consulta situação cadastral na Receita.
