# Publicação na sua conta Cloudflare

Arquitetura: frontend e API no mesmo Worker, dados no D1 e anexos privados no R2.
O endereço é público; os registros e anexos continuam exigindo login da Multtek.
Esta configuração é independente do site hospedado no ChatGPT e não o modifica.

## Preparação

Requer Node.js 24, npm e sua conta Cloudflare com Workers, D1 e R2 habilitados.
R2 possui franquia gratuita, mas pode exigir cadastro de pagamento e cobrar excedentes.
Nenhum plano pago é contratado pelos scripts deste repositório.

```sh
npm ci
npx wrangler login
npx wrangler whoami
npx wrangler d1 create multtek-db
npx wrangler r2 bucket create multtek-anexos
```

Confirme a conta desejada. Copie o `database_id` retornado para
`wrangler.cloudflare.json`, substituindo o UUID de exemplo. O ID não é senha.
Se já existirem recursos com esses nomes, confira-os e reutilize seus IDs;
não recrie nem substitua um banco com dados. Mantenha o bucket privado.

## Primeiro administrador

Defina um segredo `SETUP_TOKEN` com uma sequência aleatória de 32 a 256 caracteres,
gerada e guardada no seu gerenciador de senhas. Informe pelo prompt protegido:

```sh
npx wrangler secret put SETUP_TOKEN --config wrangler.cloudflare.json
```

O Wrangler pode pedir para criar o Worker antes de salvar o segredo. Não coloque a
chave em `vars`, código, GitHub, parâmetros de URL nem mensagens de chat.
Sem uma chave válida configurada no servidor, a instalação pública fica bloqueada.
A chave é solicitada apenas ao cadastrar o primeiro administrador. Após concluir,
novas instalações são recusadas mesmo com a chave correta. Você pode então remover
o segredo pelo painel Cloudflare.

## Validar e publicar

```sh
npm test
npx tsc --noEmit
npm run deploy:cloudflare
```

O comando de publicação valida o ID, compila, aplica apenas migrations pendentes e
publica o Worker com os arquivos estáticos. As migrations da pasta `drizzle` são
aplicadas na ordem, incluindo a coluna CNPJ. Se uma etapa falhar, o script para.
Em banco existente, faça uma exportação antes de aplicar migrations.

Abra o endereço `workers.dev` retornado e crie seu administrador com a chave.
Depois cadastre a equipe; não há cadastro público de novos membros.
Não é necessário comprar domínio para começar. Um domínio próprio pode ser
vinculado depois ao mesmo Worker.

### Publicação pelo GitHub no painel Cloudflare

Conecte apenas o repositório `Hyago-Cabrall/Multtek`, branch `main`, depois que o
`database_id` real estiver salvo nessa branch. Use Node.js 24. Comando de build:
`npm test && npx tsc --noEmit && npm run build:cloudflare`.
Comando de deploy: `npm run deploy:cloudflare` (refaz o build por segurança).
Desative deploys de branches de preview para que não compartilhem o banco real.
Configure `SETUP_TOKEN` como segredo de runtime do Worker antes do primeiro uso.

## Notificações

As notificações internas funcionam sem VAPID. Para Web Push, gere um novo par
de chaves no seu ambiente confiável e defina `VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` como segredos de runtime do Worker.
Use `wrangler secret put NOME --config wrangler.cloudflare.json` para cada um.
Nunca copie a chave privada para o frontend ou GitHub. A mudança de domínio exige
nova permissão/inscrição de cada navegador. As retentativas ainda dependem de
atividade na aplicação; esta versão não instala um agendador.

## Dados e backups

Criar um D1 novo inicia um banco vazio. Este procedimento não transfere clientes,
usuários, tarefas ou anexos do site atual. Se já houver dados, exporte e migre o
banco e os objetos R2 de forma coordenada antes de trocar o endereço da equipe.
Preserve IDs, hashes de senha e vínculos; revise sessões e inscrições push antigas.

Para exportar o banco, guarde a saída fora do repositório:

```sh
npx wrangler d1 export DB --remote --config wrangler.cloudflare.json --output ../multtek-backup.sql
```

Mantenha cópia dos anexos R2 separadamente e teste restauração. O histórico Git
protege o código, não os dados. Antes da liberação para a equipe, valide login,
permissões, upload/download e push no domínio final, e meça consumo de CPU e cotas
no painel. A compilação e os testes locais não garantem capacidade no plano Free.

## Validação já realizada nesta preparação

- Cinco testes de regras e 25 verificações de integração passaram.
- TypeScript e build para Cloudflare passaram.
- Publicação real e consumo do plano dependem do acesso à conta e validação final.
