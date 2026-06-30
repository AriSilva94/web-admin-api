# Modelo de dados

## Convenções

- PostgreSQL é acessado exclusivamente por Prisma.
- Chaves primárias são strings cuid.
- Valores inteiros potencialmente grandes usam `BigInt` e chegam ao JSON como string.
- Relações dependentes usam cascade delete quando o pai é removido.
- Existe uma migration inicial em `prisma/migrations/20260622120000_init`.

## Enums

| Enum | Valores |
| --- | --- |
| `HuntType` | `SOLO`, `PARTY` |
| `Visibility` | `PRIVATE`, `FRIENDS` |
| `FriendRequestStatus` | `PENDING`, `ACCEPTED`, `REJECTED` |

## Entidades

### User

Identidade, e-mail único, hash de senha, nome de exibição e timestamps. Relaciona hunts, refresh tokens, requests enviados/recebidos, amizades nos dois lados e shares recebidos.

### RefreshToken

Pertence a um usuário e guarda somente hash, expiração, revogação opcional e criação. O índice por usuário suporta a busca durante refresh/logout. É removido com o usuário.

### Character

Pertence a um usuário e armazena o snapshot do personagem Tibia: nome, sexo, vocação, nível e mundo. O par `ownerId`/`name` é único por conta. É removido com o usuário (`onDelete: Cascade`). O limite é de 10 personagens por conta.

### Hunt

Pertence ao proprietário e contém tipo, metadados, visibilidade, analyzer bruto, período e duração. Possui exatamente um conjunto de stats solo ou party conforme o tipo, além de coleções de monstros, itens e shares. Índices atendem owner, tipo, local, personagem e início. A relação `characterId` aponta para o personagem usado na sessão; hunts legadas mantêm esse campo nulo (`onDelete: SetNull`).

### SoloHuntStats

Relação um-para-um com hunt. Armazena XP, loot, supplies, balance, damage e healing, incluindo valores por hora.

### PartyHuntStats e PartyMemberStats

`PartyHuntStats` é um-para-um com hunt e guarda `lootType` e totais. Seus membros guardam nome, liderança e stats individuais. Membros são removidos com os stats da party.

### KilledMonster e LootedItem

Coleções de hunt solo com nome e quantidade. Ambas possuem índice por hunt e cascade delete.

### FriendRequest

Liga remetente e destinatário, registra status e timestamps. A direção é única por par `fromUserId`/`toUserId`; há índice para requests recebidos.

### Friendship

Representa relação não direcionada por dois IDs ordenados lexicograficamente. A chave composta impede duplicidade independentemente de quem iniciou o request.

### HuntShare

Liga uma hunt a um destinatário. A chave composta hunt/destinatário impede duplicidade. O índice por destinatário suporta `/shared`. Excluir hunt ou usuário remove o share.

## Cascatas de domínio

- excluir usuário remove tokens, hunts, personagens, requests, amizades e shares relacionados;
- excluir personagem anula `characterId` nas hunts associadas, preservando o histórico;
- excluir hunt remove stats, membros, monstros, itens e shares;
- remover amizade pelo service também apaga shares existentes entre os dois usuários nos dois sentidos;
- atualizar metadados não recria stats nem altera analyzer bruto.

## Visibilidade e compartilhamento

`Visibility` descreve a intenção de apresentação da hunt, mas não substitui autorização. A permissão de leitura por outro usuário é representada exclusivamente por `HuntShare`.
