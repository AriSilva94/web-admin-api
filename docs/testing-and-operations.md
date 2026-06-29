# Testes e operações do backend

## Topologia local

| Serviço | Endereço |
| --- | --- |
| PostgreSQL 16 | `localhost:5432` |
| API NestJS | `http://localhost:3000` |
| frontend consumidor | `http://localhost:3001` |

O container chama-se `hunt-postgres` e usa o volume `hunt-pg-data`.

## Rotina de banco

```bash
npm run db:up
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npx prisma migrate status
```

O seed pode ser repetido. Ele recria as hunts da Alice, mantém Alice/Bob, garante amizade e compartilha a hunt party com Bob.

## Execução

```bash
npm run start:dev
```

Build e processo compilado:

```bash
npm run build
npm run start:prod
```

O artefato principal é `dist/src/main.js`, já usado pelo script de produção.

## Suites

Fotografia de 2026-06-24:

- 15 arquivos de teste unitário em `src`;
- 3 arquivos E2E em `test`;
- 78 testes unitários e 3 E2E na última verificação completa.

Cobertura principal: normalização/tokenização/parser; auth; paginação; DTOs; mapper e service de hunts; controllers; friends; sharing; dashboard; fluxo real de criação/CRUD; amizade, compartilhamento e revogação.

## Comandos de validação

```bash
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run build
npx eslint "{src,test}/**/*.ts" prisma/seed.ts
npx prisma migrate status
```

O script `npm run lint` usa correção automática. Para uma checagem sem alterar arquivos, prefira o comando explícito de ESLint acima.

## Smoke integrado

1. confirmar PostgreSQL ouvindo em 5432;
2. confirmar `GET /` com status 200;
3. fazer login como `alice@example.com` com `password123`;
4. confirmar frontend `/login` em 3001.

## Limitação observada

Os E2E emitem aviso de depreciação do `pg` sobre `client.query()` enquanto o client já executa query. Os testes passam, mas o aviso deve ser reavaliado antes de migração para `pg` 9.
