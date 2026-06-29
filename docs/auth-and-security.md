# Autenticação e segurança

## Credenciais

Senhas são transformadas com Argon2 antes da persistência. Login usa mensagem genérica para não revelar se o e-mail existe.

## Tokens

| Token | Validade local | Uso |
| --- | --- | --- |
| access | 15 minutos | autenticação Bearer das rotas protegidas |
| refresh | 7 dias | emissão de um novo par |

Segredos e validades são configurados por ambiente. Access e refresh usam segredos distintos.

## Persistência e rotação

A API persiste somente o hash do refresh token, sua expiração e eventual revogação. No refresh, procura tokens ativos do usuário, compara o hash, revoga o registro usado e emite/persiste novo par. Um token inválido, expirado ou revogado retorna 401.

Logout procura e revoga o refresh token quando possível. A operação é idempotente: token inválido não impede resposta de sucesso.

## Autenticação HTTP

A Passport JWT strategy valida o access token e cria o usuário autenticado com `userId` e e-mail. `JwtAuthGuard` protege hunts, friends, sharing e dashboard, além de `/auth/me`.

## Autorização

- criação de hunt ignora qualquer owner vindo do cliente e usa o usuário autenticado;
- listagem e dashboard consultam somente hunts próprias;
- detalhe permite proprietário ou destinatário de `HuntShare`;
- PATCH, DELETE, share e unshare exigem propriedade;
- vínculo de amizade é obrigatório para criar share;
- remoção da amizade revoga shares entre o par;
- negações sobre hunts usam 404 para ocultar existência;
- destinatários de share recebem acesso somente de leitura.

## Responsabilidade do frontend

O frontend guarda tokens em cookies `httpOnly`, mas a API não depende dessa implementação: seu contrato é Bearer para access e body para refresh/logout. Autorização nunca é delegada à interface.
