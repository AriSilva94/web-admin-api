# Account ↔ Character Linking — Design

Date: 2026-06-29
Status: Approved (ready for implementation plan)
Scope: cross-repo — `web-admin-api` (NestJS) and `web-admin` (Next.js).

## Goal

Link a login account to its Tibia characters (max 10 per account). Characters
are added by name and verified/enriched via TibiaData. An account with zero
characters cannot create new hunts. Creating a hunt requires selecting one of
the account's characters from a list.

Stored character fields: `name`, `sex`, `vocation`, `level`, `world`.

## Decisions (locked)

- **tibia-api = a module inside `web-admin-api`** (no separate microservice).
  Flow: frontend → `web-admin-api` → TibiaData. The browser never calls
  TibiaData directly; it always goes through our backend proxy.
- **Snapshot + manual refresh** for character stats (no background jobs).
- **Hunt link = required FK for new hunts, nullable for legacy.** No backfill.
- Character name is **not** globally unique — unique only per account.
- Deleting a character keeps hunt history: `Hunt.characterId` is set to null,
  hunts are not cascade-deleted.

## 1. tibia-api module (TibiaData client)

New module `src/tibia/` in `web-admin-api`.

- `TibiaService.fetchCharacter(name: string): Promise<TibiaCharacter>`
  - GET `${TIBIADATA_BASE_URL}/v4/character/${encodeURIComponent(name)}`.
  - TibiaData v4 response shape:
    `{ character: { character: { name, sex, vocation, level, world, ... } } }`.
  - Parse `character.character`. Return `{ name, sex, vocation, level, world }`.
  - Empty `name` in response ⇒ `NotFoundException('Character not found on Tibia')`.
  - Network/timeout/non-2xx ⇒ `BadGatewayException('Tibia data source unavailable')`.
  - Use a request timeout (e.g. AbortController) so a slow upstream can't hang.
- Only `CharactersService` consumes `TibiaService`. No other module imports it.
- No persistence in this module.

Env: `TIBIADATA_BASE_URL`. Default `https://api.tibiadata.com`. Overridable per
environment (prod env var, dev `.env`, tests point at a mock/fixture).

## 2. Data model (Prisma)

New model:

```prisma
model Character {
  id        String   @id @default(cuid())
  ownerId   String
  owner     User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  name      String
  sex       String
  vocation  String
  level     Int
  world     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  hunts Hunt[]

  @@unique([ownerId, name])
  @@index([ownerId])
}
```

Changes to existing models:

- `User` gains `characters Character[]`.
- `Hunt` gains:
  - `characterId String?`
  - `character   Character? @relation(fields: [characterId], references: [id], onDelete: SetNull)`
  - `@@index([characterId])`
- Existing `Hunt.characterName`, `Hunt.vocation`, `Hunt.level` are retained
  (denormalized display + legacy hunts).

Max-10 limit is enforced in the service via a count check, not the schema.

Migration: additive only (new table, new nullable column + index). No data
backfill. Legacy hunts keep `characterId = null`.

## 3. API endpoints (`CharactersModule`, all JWT-guarded)

- `POST /characters` body `{ name }`
  - `TibiaService.fetchCharacter(name)`.
  - Reject if owner already has 10 characters ⇒ `409 Conflict`.
  - Reject duplicate `(ownerId, name)` ⇒ `409 Conflict`.
  - Not found on Tibia ⇒ `404`.
  - Persist snapshot, return the character.
- `GET /characters` → owner's characters, newest first.
- `POST /characters/:id/refresh` → re-fetch from TibiaData, update
  `sex/vocation/level/world`, return updated. Not owner / missing ⇒ `404`.
- `DELETE /characters/:id` → `204`. Not owner / missing ⇒ `404` (consistent
  with existing "no access returns 404" invariant). Linked hunts have
  `characterId` set to null by the FK rule.

DTO: `createCharacterSchema = z.object({ name: z.string().min(1).max(60) })`,
validated with the existing `ZodValidationPipe` (422 on failure).

## 4. Hunt-create enforcement

- `createHuntSchema` gains `characterId: z.string()` (**required**).
- `HuntsService.create(userId, dto)`:
  - Load `Character` by `{ id: dto.characterId, ownerId: userId }`.
    Missing/not owned ⇒ `422` ("no valid character selected"), matching
    validation semantics — the selected character isn't a usable input.
  - Set `hunt.characterId` and denormalize `characterName`, `vocation`, `level`
    from the Character record (stop trusting client-supplied free text for
    these fields).
- An account with 0 characters cannot produce a valid `characterId`, so the
  server rejects the create even though the UI also blocks it.

## 5. Frontend (`web-admin`)

- New feature `features/characters/`: `api.ts`, `schema.ts`, components
  (`CharacterList`, `AddCharacterForm`, card with refresh/delete).
- New page `app/(app)/characters/page.tsx`: server-rendered list + client
  add/refresh/delete. Add a nav entry in the `(app)` layout.
- `AnalyzerPasteForm` (new hunt):
  - Load `/api/proxy/characters` (client) on mount.
  - 0 characters ⇒ hide Save, show notice + CTA link to `/characters`
    ("Add a character before logging a hunt").
  - ≥1 ⇒ clickable character selector. `characterId` required to enable Save.
    Include `characterId` in the `POST /api/proxy/hunts` body.
- All browser→API calls go through `/api/proxy/[...path]`. No JWT exposed to
  client JS; tokens stay in httpOnly cookies (existing pattern).

## 6. dev / prd environment separation

- `web-admin-api`:
  - Add `TIBIADATA_BASE_URL="https://api.tibiadata.com"` to `.env` and
    `.env.example`. Production overrides via real environment variables.
  - Read through `ConfigService` (keep existing global `ConfigModule` pattern).
- `web-admin`:
  - No new public env. Characters are reached through the existing proxy using
    `API_BASE_URL` (dev `http://localhost:3000`, prod the deployed API URL).
  - Cookies already use `secure` only when `NODE_ENV === 'production'`.
- Tests must not hit live TibiaData — mock `TibiaService` / `fetch`.

## 7. Testing

`web-admin-api`:
- Unit: `TibiaService` (parse success, empty-name → 404, upstream-fail → 502;
  mock fetch), `CharactersService` (max-10, duplicate, owner scoping, refresh),
  `HuntsService` (requires character, ownership, denormalization), DTO specs.
- E2E: characters CRUD; hunt create requires a valid owned character; hunt
  create rejected with 0 characters.

`web-admin`:
- `features/characters/api.ts`, add/list/delete components.
- `AnalyzerPasteForm`: 0-character block + CTA; selector required to submit;
  `characterId` sent in payload.

## Out of scope (YAGNI)

- Proving real ownership of a Tibia character.
- Background/scheduled refresh of character stats.
- Backfilling legacy hunts' `characterId`.
- Multi-world or scraping features (covered by the separate
  `hunt-compare/tibia-data-api` project).

## Affected files (indicative)

`web-admin-api`: `prisma/schema.prisma` (+ migration), `src/tibia/*`,
`src/characters/*`, `src/hunts/hunts.service.ts`,
`src/hunts/dto/create-hunt.dto.ts`, `src/app.module.ts`, `.env`, `.env.example`,
docs (`data-model.md`, `api-reference.md`, `architecture.md`).

`web-admin`: `features/characters/*`, `app/(app)/characters/page.tsx`,
`app/(app)/layout.tsx` (nav), `features/analyzer/components/AnalyzerPasteForm.tsx`,
relevant tests and docs.
