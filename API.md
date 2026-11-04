# API Multtek

Base `/api`. Retorno JSON, exceto download de arquivos. Erros: `{ "error": "mensagem" }`. As gravações exigem cabeçalho Origin igual ao site e sessão em cookie HttpOnly. Segredos de login nunca são retornados. 401=sem sessão; 403=sem permissão; 404=não encontrado; 409=conflito; 429=limite de tentativas.

| Método | Caminho | Uso / permissão |
| --- | --- | --- |
| GET | `/auth` | Sessão atual, necessidade de setup e chave pública push |
| POST | `/setup` | Primeiro administrador, apenas uma vez, protegido pelo site privado |
| POST | `/login` | `{username,password}`; cria sessão de 12h |
| POST | `/logout` | Encerra sessão; `{endpoint?}` remove inscrição do dispositivo |
| GET | `/data` | Usuário, usuários visíveis, clientes, etapas, origens, tarefas e notificações próprias |
| POST | `/users` | Admin: cria ou atualiza com `id`; dados de usuário e `active`, `role` |
| DELETE | `/users/:id` | Admin: exclusão lógica; exige ausência de tarefas abertas |
| POST | `/clients` | Membros/admin: `{id?,name,cnpj?,uf,city,active}` |
| DELETE | `/clients/:id` | Inativa cliente, preserva tarefas |
| POST | `/stages` | Admin: `{id?,name,color,initial,done}` |
| POST | `/stages/order` | Admin: `{ids:[...todos os ids na ordem desejada]}` |
| DELETE | `/stages/:id?target=:id` | Admin: transfere tarefas e remove etapa atomicamente |
| POST | `/tasks` | Cria/atualiza tarefa; ver abaixo |
| GET | `/tasks/:id` | Tarefa, histórico e anexos |
| DELETE | `/tasks/:id` | Admin/criador: exclusão lógica |
| POST | `/upload` | Multipart `task_id` e `file`; usuário autenticado |
| GET | `/files/:id` | Arquivo privado; `?download=1` força download |
| DELETE | `/files/:id` | Admin, criador da tarefa ou remetente do arquivo |
| POST | `/notifications/read` | Marca notificações próprias como lidas |
| POST | `/push` | `{subscription}` do PushManager; vincula ao usuário atual |

## Tarefa

```json
{
  "id": 123,
  "version": 2,
  "summary": "Descrição da atividade",
  "client_id": "uuid",
  "origin_id": "4",
  "stage_id": "uuid",
  "assignee_id": "uuid",
  "duration": 1575
}
```

Na criação omita `id`/`version`; a API escolhe a etapa inicial, o criador e as datas. Na atualização informe a versão recebida. Duração é inteiro de minutos ou null, com limite operacional de 5.256.000 minutos. Resumo é texto puro, até 2.000 palavras separadas por espaços/quebras. O frontend escapa o texto e não renderiza HTML do usuário.

`role` aceita `admin` ou `member`. `active`, `initial` e `done` aceitam booleanos ou 0/1. CPF e telefone são normalizados para dígitos. A senha de usuário, quando vazia na edição, é mantida. Usuário de acesso admite letras, números, ponto, hífen e sublinhado, entre 3 e 50 caracteres; usuário e e-mail são normalizados para minúsculas.

CNPJ do cliente: string opcional com 12 posições alfanuméricas e 2 dígitos numéricos válidos, com ou sem máscara. É armazenado sem máscara em maiúsculas. Vazio vira null; omitir o campo na edição preserva o valor existente. Duplicidade (inclusive em cliente inativo) retorna 409.
