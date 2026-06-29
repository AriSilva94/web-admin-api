# Analyzer e parser

## Objetivo

Converter o texto exportado pelo jogo em uma estrutura confiável sem aceitar silenciosamente conteúdo malformado. O mesmo parser atende preview e criação de hunt; somente a criação persiste.

## Formatos suportados

### Solo

Exige período da sessão, duração, Raw XP Gain, XP Gain, Raw XP/h, XP/h, Loot, Supplies, Balance, Damage, Damage/h, Healing, Healing/h, seção Killed Monsters e seção Looted Items.

### Party

Exige período, duração, Loot Type, Loot, Supplies, Balance e pelo menos um membro. Cada membro exige Loot, Supplies, Balance, Damage e Healing. O sufixo `(Leader)` identifica liderança e não faz parte do nome persistido.

## Normalização

- números aceitam separadores por vírgula e são convertidos em inteiros;
- balance negativo é preservado;
- datas usam `YYYY-MM-DD, HH:mm:ss`;
- duração usa `HH:mmh` e vira minutos;
- linhas vazias externas são toleradas pela normalização;
- o texto bruto original é preservado em `raw`/`rawAnalyzer`.

## Pipeline

1. normalização das linhas;
2. tokenização em pares de campo/valor e seções;
3. detecção inequívoca de solo ou party;
4. parsing específico do formato;
5. validação do resultado com schema Zod;
6. retorno estruturado ou `AnalyzerValidationError` com issues.

## Erros

Formato desconhecido, campo obrigatório ausente, número inválido, data inválida, seção ausente ou membro incompleto produz 422. Cada issue contém campo e mensagem. O parser não tenta inferir valores ausentes.

## Shapes resultantes

Todo resultado inclui tipo, raw, início, fim e duração. Solo inclui stats, monstros e itens. Party inclui totais e membros. Valores de stats são `BigInt` internamente e strings no JSON.

## Frontend

O frontend possui parser equivalente para prévia resiliente. A validação desta API continua autoritativa: `POST /hunts` executa o parser novamente antes de persistir.
