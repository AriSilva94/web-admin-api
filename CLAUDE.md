# Contexto de manutenção - backend

Estado de referência: 2026-06-24. Leia o [README](README.md), a [arquitetura](docs/architecture.md), a [referência da API](docs/api-reference.md) e o [modelo de dados](docs/data-model.md) antes de alterar contratos.

## Limites arquiteturais

- Controllers cuidam da camada HTTP e delegam regras aos services.
- DTOs usam schemas Zod e `ZodValidationPipe`; falhas retornam 422 com `issues`.
- `AnalyzerModule` concentra detecção, normalização, parsing e validação dos formatos suportados.
- `PrismaService` é a única integração persistente com PostgreSQL.
- `HUNT_INCLUDE` e o mapper de hunts definem a resposta canônica de hunt.
- Listagens usam o helper comum de paginação.

## Regras invariantes

- IDs são strings cuid.
- Campos monetários, XP, damage e healing são `BigInt` no banco e strings decimais no JSON.
- O analyzer bruto e as estatísticas parseadas são imutáveis após criação; somente metadados podem ser alterados.
- A ausência de título gera título automático com local ou tipo e data da sessão.
- O proprietário pode editar e excluir. O destinatário de um `HuntShare` pode apenas ler.
- `FRIENDS` é metadado de visibilidade; acesso remoto exige compartilhamento explícito.
- Sharing só pode ser criado entre amigos.
- Remover amizade elimina shares existentes entre o par nos dois sentidos.
- Recursos sem acesso retornam 404 para não expor sua existência.

## Auth

Senhas usam Argon2. Access e refresh tokens têm segredos e validades separados. Apenas o hash do refresh token é persistido. Refresh válido revoga o registro anterior e emite novo par. Consulte [auth e segurança](docs/auth-and-security.md).

## Parser

São aceitos exatamente os formatos solo e party documentados em [analyzer](docs/analyzer.md). Não flexibilize campos obrigatórios sem atualizar fixtures, schemas, testes, frontend e documentação.

## Qualidade

Testes unitários ficam ao lado do source; E2E ficam em `test`. Mudanças de domínio exigem regressão unitária e, quando atravessam módulos ou banco, E2E. Antes de concluir, execute testes unitários, E2E, build, ESLint e status das migrations conforme [testes e operações](docs/testing-and-operations.md).
