# Arquitetura do backend

## Visão geral

O backend é uma aplicação NestJS modular, sem prefixo global. O fluxo padrão é controller, validação Zod, service de domínio e Prisma. O parser é uma exceção deliberada: permanece isolado do HTTP e da persistência para ser testável como função de domínio.

## Módulos

| Módulo | Responsabilidade |
| --- | --- |
| `PrismaModule` | conexão PostgreSQL e ciclo de vida do Prisma Client |
| `AnalyzerModule` | preview, detecção, parsing e validação solo/party |
| `UsersModule` | criação e consulta de usuários para auth |
| `AuthModule` | registro, login, refresh, logout, JWT strategy e guard |
| `HuntsModule` | criação, listagem, detalhe, metadados e exclusão de hunts |
| `FriendsModule` | requests e amizades; exporta verificação de vínculo |
| `SharingModule` | share, unshare e listagem recebida |
| `DashboardModule` | agregações das hunts do proprietário |

`AppModule` registra todos os módulos e torna `ConfigModule` global.

## Fluxos principais

### Requisição autenticada

O `JwtAuthGuard` aciona a Passport strategy, valida o access token e disponibiliza `userId` e e-mail ao decorator `CurrentUser`. Controllers nunca recebem `ownerId` do body.

### Validação

Cada body ou query passa por um schema Zod no parâmetro correspondente. A resposta de erro contém `issues`, com campo e mensagem, e status 422. O analyzer adiciona erros semânticos próprios no mesmo status.

### Criação de hunt

O service executa o parser autoritativo, monta dados aninhados para o tipo detectado, persiste hunt e stats em uma operação Prisma e mapeia a entidade para a resposta canônica.

### Leitura e autorização

Listagens de `/hunts` são restritas ao proprietário. O detalhe aceita o proprietário ou usuário presente em `HuntShare`. Edição e exclusão exigem propriedade. O acesso negado é apresentado como 404.

### Social

Amizades usam um par de IDs ordenado lexicograficamente. Requests recíprocos pendentes são bloqueados. O aceite usa upsert para não duplicar o par. Sharing consulta essa amizade antes de criar o vínculo.

## Componentes compartilhados

- paginação: defaults de página 1 e 20 itens, máximo de 100;
- `HUNT_INCLUDE`: relações necessárias para montar uma hunt completa;
- mapper: título automático, escrita aninhada e shape de resposta;
- serializador global: converte `BigInt` para string decimal no JSON.

## Fontes relacionadas

- [API](api-reference.md)
- [Modelo de dados](data-model.md)
- [Autenticação e segurança](auth-and-security.md)
- [Analyzer](analyzer.md)
