# Hunt Analyzer - API

API REST do MVP Hunt Analyzer. O backend autentica usuários, valida analyzers solo e party, persiste hunts estruturadas, aplica regras de acesso, gerencia amizades e compartilhamentos e produz os agregados do dashboard.

## Capacidades entregues

- autenticação JWT com access token, refresh token, rotação e logout;
- preview e validação estrita de analyzers solo e party;
- CRUD de hunts com metadados, filtros e paginação;
- leitura por proprietário ou por compartilhamento explícito;
- solicitações de amizade, aceite, rejeição e remoção;
- compartilhamento somente entre amigos, com revogação ao remover a amizade;
- dashboard com totais, médias, melhor hunt, locais frequentes e sessões recentes;
- PostgreSQL via Prisma, migration inicial e seed de demonstração.

## Stack validada em 2026-06-24

- NestJS 11 e TypeScript 5.9.3;
- Prisma 7.8 com adapter PostgreSQL;
- PostgreSQL 16;
- Zod 4.4;
- JWT, Passport e Argon2;
- Jest 30, ts-jest e Supertest;
- Docker Compose.

## Pré-requisitos

- Node.js e npm compatíveis com as dependências instaladas;
- Docker Desktop para o PostgreSQL local;
- porta 5432 disponível para o banco;
- porta 3000 disponível para a API.

## Ambiente

Copie `.env.example` para `.env`. As variáveis são:

| Variável | Valor local | Finalidade |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://hunt:hunt@localhost:5432/hunt?schema=public` | conexão Prisma |
| `JWT_ACCESS_SECRET` | segredo local | assinatura do access token |
| `JWT_REFRESH_SECRET` | segredo local | assinatura do refresh token |
| `JWT_ACCESS_EXPIRES` | `15m` | validade do access token |
| `JWT_REFRESH_EXPIRES` | `7d` | validade do refresh token |
| `PORT` | `3000` | porta HTTP |

Troque os segredos em qualquer ambiente que não seja desenvolvimento local.

## Banco e inicialização

```bash
npm install
npm run db:up
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

O seed é repetível. Ele cria Alice e Bob, duas hunts da Alice, uma amizade e o compartilhamento da hunt party com Bob.

## Execução

```bash
npm run start:dev
```

A API fica em `http://localhost:3000`, sem prefixo global. `GET /` responde `Hello World!` e serve como smoke básico.

Para produção local, execute `npm run build` e `npm run start:prod`.

## Usuários de demonstração

| Usuário | Senha |
| --- | --- |
| `alice@example.com` | `password123` |
| `bob@example.com` | `password123` |

## Verificação

```bash
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run build
npx eslint "{src,test}/**/*.ts" prisma/seed.ts
npx prisma migrate status
```

## Mapa documental

- [Arquitetura](docs/architecture.md)
- [Referência da API](docs/api-reference.md)
- [Modelo de dados](docs/data-model.md)
- [Autenticação e segurança](docs/auth-and-security.md)
- [Analyzer e parser](docs/analyzer.md)
- [Testes e operações](docs/testing-and-operations.md)
- [Contexto de manutenção](CLAUDE.md)

O índice geral do produto está no [`plano.md`](../web-admin/plano.md) do frontend.
