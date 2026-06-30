# Referência canônica da API

Base local: `http://localhost:3000`. Não há prefixo global. Rotas protegidas exigem `Authorization: Bearer <accessToken>`.

## Convenções

- IDs são strings cuid.
- Datas de resposta usam ISO 8601.
- Valores monetários, XP, damage e healing são strings decimais, inclusive quando negativos.
- Validação de DTO ou analyzer retorna 422 e uma lista `issues` com campo e mensagem.
- Credenciais inválidas ou ausentes retornam 401.
- Duplicidades de domínio retornam 409.
- Recursos ausentes ou não autorizados retornam 404.
- Listas paginadas retornam `data`, `page`, `pageSize` e `total`.

## Health

| Método | Rota | Auth | Sucesso |
| --- | --- | --- | --- |
| GET | `/` | não | 200 com texto `Hello World!` |

## Auth

| Método | Rota | Entrada | Sucesso | Erros principais |
| --- | --- | --- | --- | --- |
| POST | `/auth/register` | `email`, senha mínima de 8 caracteres, `displayName` | 201 com tokens e usuário | 409 e-mail existente; 422 validação |
| POST | `/auth/login` | `email`, `password` | 201 com tokens e usuário | 401 credenciais; 422 validação |
| POST | `/auth/refresh` | `refreshToken` | 201 com novo par de tokens | 401 token inválido; 422 validação |
| POST | `/auth/logout` | `refreshToken` | 201 com sucesso | logout permanece idempotente para token inválido |
| GET | `/auth/me` | access token | 200 com usuário público | 401 |

O usuário público contém `id`, `email`, `displayName` e `createdAt`.

## Analyzer

| Método | Rota | Entrada | Sucesso | Erros |
| --- | --- | --- | --- | --- |
| POST | `/analyzer/preview` | `raw` não vazio | 201 com analyzer solo ou party estruturado | 422 com issues detalhadas |

Preview não persiste dados e não exige autenticação.

## Characters

Todas as rotas exigem autenticação. O limite é de 10 personagens por conta. O nome é único por conta.

| Método | Rota | Entrada | Sucesso | Erros principais |
| --- | --- | --- | --- | --- |
| POST | `/characters` | `name` | 201 com personagem | 409 limite de 10 atingido ou nome duplicado na conta; 422 nome vazio |
| GET | `/characters` | — | 200 com lista de personagens do usuário | — |
| POST | `/characters/:id/refresh` | — | 200 com personagem atualizado via TibiaData | 404 personagem não encontrado; 502 erro upstream |
| DELETE | `/characters/:id` | — | 204 | 404 personagem não encontrado |

`POST /characters` busca o personagem na TibiaData v4 no momento do cadastro. Nome inexistente retorna 404; falha upstream retorna 502. `POST /characters/:id/refresh` repete a mesma busca para atualizar o snapshot armazenado.

## Hunts

### Criação

`POST /hunts` exige autenticação. Campos obrigatórios: `raw` e `characterId`. O personagem informado deve pertencer ao usuário autenticado; personagem ausente ou de outra conta retorna 422. O serviço desnormaliza `characterName`, `vocation` e `level` diretamente do registro Character — esses campos não são aceitos no body. `visibility` assume `PRIVATE`. Metadados opcionais: `title`, `huntingSpot`, `tags` e `notes`. Limites: título e local 120 caracteres, até 30 tags e notas com até 2000 caracteres. Retorna 201 com a hunt completa. Analyzer inválido retorna 422.

### Listagem

`GET /hunts` retorna somente hunts do usuário autenticado. Filtros:

| Query | Regra |
| --- | --- |
| `type` | `SOLO` ou `PARTY` |
| `from`, `to` | data ISO ou datetime ISO com offset |
| `huntingSpot` | contém, sem diferenciar maiúsculas |
| `characterName` | contém, sem diferenciar maiúsculas |
| `tags` | lista separada por vírgula; exige todas as tags |
| `visibility` | `PRIVATE` ou `FRIENDS` |
| `page`, `pageSize` | inteiros positivos; default 1/20 e máximo 100 |

Ordenação: `startedAt` decrescente.

### Detalhe e mutações

| Método | Rota | Regra | Sucesso |
| --- | --- | --- | --- |
| GET | `/hunts/:id` | proprietário ou destinatário de share | 200 |
| PATCH | `/hunts/:id` | somente proprietário; metadados estritos | 200 |
| DELETE | `/hunts/:id` | somente proprietário | 204 |

O PATCH aceita os metadados da criação; campos anuláveis podem receber `null`. Analyzer e stats não são aceitos.

### Resposta de hunt

Campos comuns: identidade, proprietário, tipo, título, metadados, visibilidade, analyzer bruto, início, fim, duração, timestamps e `sharedWith`.

Hunt solo inclui stats de XP, loot, supplies, balance, damage e healing, além de monstros mortos e itens coletados. Hunt party inclui `lootType`, totais e membros com nome, liderança e stats individuais.

## Friends

| Método | Rota | Entrada/resultado | Sucesso |
| --- | --- | --- | --- |
| POST | `/friends/requests` | e-mail do destinatário; retorna request | 201 |
| GET | `/friends/requests` | requests recebidos em `PENDING` | 200 |
| POST | `/friends/requests/:id/accept` | aceita request recebido pendente | 200 |
| POST | `/friends/requests/:id/reject` | rejeita request recebido pendente | 204 |
| GET | `/friends` | lista amizades do usuário | 200 |
| DELETE | `/friends/:id` | remove amizade e shares entre o par | 204 |

Não é permitido adicionar a si mesmo, adicionar amigo existente ou manter requests pendentes duplicados/recíprocos.

## Sharing

| Método | Rota | Regra | Sucesso |
| --- | --- | --- | --- |
| POST | `/hunts/:id/share` | proprietário informa `userId` de um amigo | 201 |
| DELETE | `/hunts/:id/share/:userId` | proprietário remove o share; idempotente | 204 |
| GET | `/shared` | lista paginada de hunts recebidas | 200 |

`visibility=FRIENDS` não concede acesso automaticamente. A leitura por terceiro depende de `HuntShare` explícito.

## Dashboard

`GET /dashboard/summary` agrega somente hunts do usuário autenticado e retorna:

- total de hunts, lucro, loot e supplies;
- balance médio por hunt com divisão inteira;
- melhor hunt por balance ou `null`;
- até cinco locais mais frequentes;
- contagens solo e party;
- até cinco hunts recentes, ordenadas por início decrescente.
