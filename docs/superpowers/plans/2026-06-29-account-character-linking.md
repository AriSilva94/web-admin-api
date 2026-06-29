# Account ↔ Character Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Link login accounts to Tibia characters (max 10/account), verified via TibiaData, and require selecting a character to create a hunt.

**Architecture:** A `tibia` module inside `web-admin-api` wraps TibiaData v4 (`GET /v4/character/{name}`). A `characters` module persists per-account character snapshots and enforces limits. Hunt creation requires an owned `characterId`. The Next.js frontend manages characters and forces character selection on the new-hunt form. Browser → Next proxy → `web-admin-api` → TibiaData; the browser never calls TibiaData directly.

**Tech Stack:** NestJS 11, Prisma 7 (PostgreSQL), Zod 4, Jest (backend). Next.js 16 App Router, react-hook-form, Zod, Vitest + Testing Library (frontend).

## Global Constraints

- Backend repo: `web-admin-api`. Frontend repo: `web-admin`. They are **separate git repos** — commit in the repo whose files changed.
- IDs are cuid strings. Money/XP/damage/healing stay decimal strings (do not touch).
- Validation via `ZodValidationPipe`; failures return 422 with `issues`.
- `PrismaService` is the only DB integration. `PrismaModule` is `@Global`.
- "No access" returns 404 to avoid leaking existence (existing invariant).
- Browser→API calls go only through `/api/proxy/[...path]`; never expose JWT to client JS.
- Character snapshot fields: `name`, `sex`, `vocation`, `level` (Int), `world`.
- Max 10 characters per account. Character name unique per account only (`@@unique([ownerId, name])`).
- TibiaData base URL from env `TIBIADATA_BASE_URL`, default `https://api.tibiadata.com`.
- Backend verify per change: `npm test`, `npm run lint`, `npm run build`. Frontend: `npm test`, `npm run lint`, `npm run build`.

---

## Task 1: Prisma schema — Character model + Hunt link

**Files:**
- Modify: `web-admin-api/prisma/schema.prisma`
- Create: `web-admin-api/prisma/migrations/<timestamp>_add_characters/migration.sql` (generated)

**Interfaces:**
- Produces: Prisma `Character` model with fields `id, ownerId, name, sex, vocation, level, world, createdAt, updatedAt`; `User.characters Character[]`; `Hunt.characterId String?` + `Hunt.character Character?`.

- [ ] **Step 1: Add the `Character` model and relations to `schema.prisma`**

Add the model at the end of the file:

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

In `model User`, add to the relations block:

```prisma
  characters Character[]
```

In `model Hunt`, add the fields (next to `characterName`) and an index:

```prisma
  characterId String?
  character   Character? @relation(fields: [characterId], references: [id], onDelete: SetNull)
```

And add to the `Hunt` index block:

```prisma
  @@index([characterId])
```

- [ ] **Step 2: Start the database (if not running)**

Run: `cd web-admin-api && npm run db:up`
Expected: postgres container `hunt-postgres` is up.

- [ ] **Step 3: Create the migration**

Run: `cd web-admin-api && npm run prisma:migrate -- --name add_characters`
Expected: a new folder under `prisma/migrations/` and Prisma Client regenerated. The migration only ADDs a table, a nullable column, and indexes — no data loss.

- [ ] **Step 4: Verify build picks up new client types**

Run: `cd web-admin-api && npm run build`
Expected: PASS (no type errors).

- [ ] **Step 5: Commit**

```bash
cd web-admin-api
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add Character model and Hunt.characterId link"
```

---

## Task 2: Tibia module (TibiaData client)

**Files:**
- Create: `web-admin-api/src/tibia/tibia.service.ts`
- Create: `web-admin-api/src/tibia/tibia.service.spec.ts`
- Create: `web-admin-api/src/tibia/tibia.module.ts`
- Modify: `web-admin-api/.env`, `web-admin-api/.env.example`

**Interfaces:**
- Produces:
  - `interface TibiaCharacter { name: string; sex: string; vocation: string; level: number; world: string }`
  - `class TibiaService { fetchCharacter(name: string): Promise<TibiaCharacter> }`
  - `TibiaModule` exports `TibiaService`.

- [ ] **Step 1: Write the failing test**

Create `web-admin-api/src/tibia/tibia.service.spec.ts`:

```typescript
import { BadGatewayException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TibiaService } from './tibia.service';

function makeConfig(): ConfigService {
  return {
    get: jest.fn().mockReturnValue('https://tibia.test'),
  } as unknown as ConfigService;
}

describe('TibiaService', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it('returns the normalized character on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        character: {
          character: {
            name: 'Bobeek',
            sex: 'male',
            vocation: 'Elder Druid',
            level: 3067,
            world: 'Bona',
            extra: 'ignored',
          },
        },
      }),
    }) as unknown as typeof fetch;

    const service = new TibiaService(makeConfig());
    await expect(service.fetchCharacter('Bobeek')).resolves.toEqual({
      name: 'Bobeek',
      sex: 'male',
      vocation: 'Elder Druid',
      level: 3067,
      world: 'Bona',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://tibia.test/v4/character/Bobeek',
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it('throws NotFound when the character name is empty', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ character: { character: { name: '' } } }),
    }) as unknown as typeof fetch;

    const service = new TibiaService(makeConfig());
    await expect(service.fetchCharacter('Ghost')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws BadGateway when the upstream is not ok', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 503 }) as unknown as typeof fetch;

    const service = new TibiaService(makeConfig());
    await expect(service.fetchCharacter('Bobeek')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('throws BadGateway when fetch rejects', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network')) as unknown as typeof fetch;

    const service = new TibiaService(makeConfig());
    await expect(service.fetchCharacter('Bobeek')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web-admin-api && npx jest src/tibia/tibia.service.spec.ts`
Expected: FAIL — cannot find module `./tibia.service`.

- [ ] **Step 3: Implement `TibiaService`**

Create `web-admin-api/src/tibia/tibia.service.ts`:

```typescript
import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TibiaCharacter {
  name: string;
  sex: string;
  vocation: string;
  level: number;
  world: string;
}

interface TibiaResponse {
  character?: {
    character?: Partial<TibiaCharacter>;
  };
}

const DEFAULT_BASE_URL = 'https://api.tibiadata.com';
const REQUEST_TIMEOUT_MS = 8000;

@Injectable()
export class TibiaService {
  constructor(private readonly config: ConfigService) {}

  async fetchCharacter(name: string): Promise<TibiaCharacter> {
    const base =
      this.config.get<string>('TIBIADATA_BASE_URL') ?? DEFAULT_BASE_URL;
    const url = `${base}/v4/character/${encodeURIComponent(name)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } catch {
      throw new BadGatewayException('Tibia data source unavailable');
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new BadGatewayException('Tibia data source unavailable');
    }

    const body = (await response.json()) as TibiaResponse;
    const char = body.character?.character;
    if (!char?.name) {
      throw new NotFoundException('Character not found on Tibia');
    }

    return {
      name: char.name,
      sex: char.sex ?? '',
      vocation: char.vocation ?? '',
      level: char.level ?? 0,
      world: char.world ?? '',
    };
  }
}
```

- [ ] **Step 4: Create the module**

Create `web-admin-api/src/tibia/tibia.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TibiaService } from './tibia.service';

@Module({
  providers: [TibiaService],
  exports: [TibiaService],
})
export class TibiaModule {}
```

- [ ] **Step 5: Add the env var**

Append to `web-admin-api/.env` and `web-admin-api/.env.example`:

```
TIBIADATA_BASE_URL="https://api.tibiadata.com"
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd web-admin-api && npx jest src/tibia/tibia.service.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
cd web-admin-api
git add src/tibia .env.example
git commit -m "feat(tibia): add TibiaData character client module"
```

(Note: `.env` is gitignored; only `.env.example` is committed. Update `.env` locally.)

---

## Task 3: Characters module (CRUD + limits)

**Files:**
- Create: `web-admin-api/src/characters/dto/create-character.dto.ts`
- Create: `web-admin-api/src/characters/characters.service.ts`
- Create: `web-admin-api/src/characters/characters.service.spec.ts`
- Create: `web-admin-api/src/characters/characters.controller.ts`
- Create: `web-admin-api/src/characters/characters.module.ts`
- Modify: `web-admin-api/src/app.module.ts`

**Interfaces:**
- Consumes: `TibiaService.fetchCharacter` (Task 2), `PrismaService`.
- Produces:
  - `createCharacterSchema` / `CreateCharacterDto` (`{ name: string }`).
  - `CharactersService` with `add(ownerId, name)`, `list(ownerId)`, `refresh(ownerId, id)`, `remove(ownerId, id)`.
  - Routes: `POST /characters`, `GET /characters`, `POST /characters/:id/refresh`, `DELETE /characters/:id`.
  - `CharactersService` is exported (Hunts uses it in Task 4).

- [ ] **Step 1: Create the DTO**

Create `web-admin-api/src/characters/dto/create-character.dto.ts`:

```typescript
import { z } from 'zod';

export const createCharacterSchema = z.object({
  name: z.string().min(1).max(60),
});

export type CreateCharacterDto = z.infer<typeof createCharacterSchema>;
```

- [ ] **Step 2: Write the failing service test**

Create `web-admin-api/src/characters/characters.service.spec.ts`:

```typescript
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CharactersService } from './characters.service';
import type { TibiaService } from '../tibia/tibia.service';

const SNAPSHOT = {
  name: 'Bobeek',
  sex: 'male',
  vocation: 'Elder Druid',
  level: 3067,
  world: 'Bona',
};

function makePrisma() {
  return {
    character: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

function makeTibia(): TibiaService {
  return {
    fetchCharacter: jest.fn().mockResolvedValue(SNAPSHOT),
  } as unknown as TibiaService;
}

describe('CharactersService', () => {
  describe('add', () => {
    it('persists a verified snapshot for the owner', async () => {
      const prisma = makePrisma();
      prisma.character.count.mockResolvedValue(0);
      prisma.character.findFirst.mockResolvedValue(null);
      prisma.character.create.mockResolvedValue({ id: 'c1', ...SNAPSHOT });
      const service = new CharactersService(prisma as never, makeTibia());

      const result = await service.add('user-1', 'Bobeek');

      expect(result).toMatchObject({ id: 'c1', name: 'Bobeek', level: 3067 });
      expect(prisma.character.create).toHaveBeenCalledWith({
        data: { ownerId: 'user-1', ...SNAPSHOT },
      });
    });

    it('rejects when the owner already has 10 characters', async () => {
      const prisma = makePrisma();
      prisma.character.count.mockResolvedValue(10);
      const service = new CharactersService(prisma as never, makeTibia());

      await expect(service.add('user-1', 'Bobeek')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.character.create).not.toHaveBeenCalled();
    });

    it('rejects a duplicate name for the same owner', async () => {
      const prisma = makePrisma();
      prisma.character.count.mockResolvedValue(1);
      prisma.character.findFirst.mockResolvedValue({ id: 'existing' });
      const service = new CharactersService(prisma as never, makeTibia());

      await expect(service.add('user-1', 'Bobeek')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('refresh', () => {
    it('re-fetches and updates an owned character', async () => {
      const prisma = makePrisma();
      prisma.character.findFirst.mockResolvedValue({ id: 'c1', name: 'Bobeek' });
      prisma.character.update.mockResolvedValue({ id: 'c1', ...SNAPSHOT });
      const service = new CharactersService(prisma as never, makeTibia());

      const result = await service.refresh('user-1', 'c1');

      expect(result).toMatchObject({ level: 3067 });
      expect(prisma.character.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: {
          sex: SNAPSHOT.sex,
          vocation: SNAPSHOT.vocation,
          level: SNAPSHOT.level,
          world: SNAPSHOT.world,
        },
      });
    });

    it('throws 404 when the character is not owned', async () => {
      const prisma = makePrisma();
      prisma.character.findFirst.mockResolvedValue(null);
      const service = new CharactersService(prisma as never, makeTibia());

      await expect(service.refresh('user-1', 'c1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('throws 404 when the character is not owned', async () => {
      const prisma = makePrisma();
      prisma.character.findFirst.mockResolvedValue(null);
      const service = new CharactersService(prisma as never, makeTibia());

      await expect(service.remove('user-1', 'c1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd web-admin-api && npx jest src/characters/characters.service.spec.ts`
Expected: FAIL — cannot find module `./characters.service`.

- [ ] **Step 4: Implement the service**

Create `web-admin-api/src/characters/characters.service.ts`:

```typescript
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TibiaService } from '../tibia/tibia.service';

const MAX_CHARACTERS = 10;

@Injectable()
export class CharactersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tibia: TibiaService,
  ) {}

  async add(ownerId: string, name: string) {
    const snapshot = await this.tibia.fetchCharacter(name);

    const count = await this.prisma.character.count({ where: { ownerId } });
    if (count >= MAX_CHARACTERS) {
      throw new ConflictException(
        `An account can have at most ${MAX_CHARACTERS} characters`,
      );
    }

    const existing = await this.prisma.character.findFirst({
      where: { ownerId, name: snapshot.name },
    });
    if (existing) {
      throw new ConflictException('Character already added to this account');
    }

    return this.prisma.character.create({
      data: { ownerId, ...snapshot },
    });
  }

  list(ownerId: string) {
    return this.prisma.character.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async refresh(ownerId: string, id: string) {
    const character = await this.findOwned(ownerId, id);
    const snapshot = await this.tibia.fetchCharacter(character.name);
    return this.prisma.character.update({
      where: { id: character.id },
      data: {
        sex: snapshot.sex,
        vocation: snapshot.vocation,
        level: snapshot.level,
        world: snapshot.world,
      },
    });
  }

  async remove(ownerId: string, id: string) {
    const character = await this.findOwned(ownerId, id);
    await this.prisma.character.delete({ where: { id: character.id } });
  }

  /** Used by HuntsService to validate the selected character. */
  findOwnedById(ownerId: string, id: string) {
    return this.prisma.character.findFirst({ where: { id, ownerId } });
  }

  private async findOwned(ownerId: string, id: string) {
    const character = await this.prisma.character.findFirst({
      where: { id, ownerId },
    });
    if (!character) {
      throw new NotFoundException('Character not found');
    }
    return character;
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd web-admin-api && npx jest src/characters/characters.service.spec.ts`
Expected: PASS.

- [ ] **Step 6: Create the controller**

Create `web-admin-api/src/characters/characters.controller.ts`:

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  createCharacterSchema,
  type CreateCharacterDto,
} from './dto/create-character.dto';
import { CharactersService } from './characters.service';

@Controller('characters')
@UseGuards(JwtAuthGuard)
export class CharactersController {
  constructor(private readonly characters: CharactersService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createCharacterSchema)) dto: CreateCharacterDto,
  ) {
    return this.characters.add(user.userId, dto.name);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.characters.list(user.userId);
  }

  @Post(':id/refresh')
  refresh(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.characters.refresh(user.userId, id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.characters.remove(user.userId, id);
  }
}
```

- [ ] **Step 7: Create the module**

Create `web-admin-api/src/characters/characters.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TibiaModule } from '../tibia/tibia.module';
import { CharactersController } from './characters.controller';
import { CharactersService } from './characters.service';

@Module({
  imports: [TibiaModule],
  controllers: [CharactersController],
  providers: [CharactersService],
  exports: [CharactersService],
})
export class CharactersModule {}
```

- [ ] **Step 8: Register the module in `app.module.ts`**

In `web-admin-api/src/app.module.ts`, import `CharactersModule` and add it to the `imports` array (after `HuntsModule`):

```typescript
import { CharactersModule } from './characters/characters.module';
```
```typescript
    HuntsModule,
    CharactersModule,
```

- [ ] **Step 9: Verify lint + build + full unit suite**

Run: `cd web-admin-api && npm run lint && npm run build && npm test`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
cd web-admin-api
git add src/characters src/app.module.ts
git commit -m "feat(characters): add character CRUD with TibiaData verification and 10-per-account limit"
```

---

## Task 4: Require a selected character to create a hunt

**Files:**
- Modify: `web-admin-api/src/hunts/dto/create-hunt.dto.ts`
- Modify: `web-admin-api/src/hunts/hunts.service.ts`
- Modify: `web-admin-api/src/hunts/hunts.module.ts`
- Modify: `web-admin-api/src/hunts/hunts.service.spec.ts`

**Interfaces:**
- Consumes: `CharactersService.findOwnedById(ownerId, id)` (Task 3).
- Produces: `createHuntSchema` now requires `characterId: string`; `HuntsService.create` links the hunt to the owned character and denormalizes `characterName/vocation/level` from it.

- [ ] **Step 1: Add `characterId` to the create schema**

In `web-admin-api/src/hunts/dto/create-hunt.dto.ts`, add as the first field after `raw`:

```typescript
  characterId: z.string().min(1),
```

(Remove `characterName`, `vocation`, `level` from `createHuntSchema` — they are now derived server-side. Leave them in `updateHuntSchema`.)

- [ ] **Step 2: Write the failing service test**

Add to `web-admin-api/src/hunts/hunts.service.spec.ts` a describe block. First, locate the existing prisma mock factory in that file and extend it with a `character` mock. Add this test (adapt the `makePrisma`/sample-raw helpers already present in the file):

```typescript
import { UnprocessableEntityException } from '@nestjs/common';

describe('HuntsService.create character link', () => {
  const SOLO_RAW = `Session data: From 2025-09-08, 12:06:17 to 2025-09-08, 13:04:38
Session: 00:58h
Raw XP Gain: 5,023,071
XP Gain: 7,534,442
Raw XP/h: 5,133,253
XP/h: 7,699,700
Loot: 1,126,184
Supplies: 196,507
Balance: 929,677
Damage: 5,498,537
Damage/h: 5,498,537
Healing: 995,411
Healing/h: 995,411
Killed Monsters:
  88x arachnophobica
Looted Items:
  5x a platinum coin`;

  function makeCharacters(found: unknown) {
    return {
      findOwnedById: jest.fn().mockResolvedValue(found),
    };
  }

  it('rejects when the selected character is not owned', async () => {
    const prisma = { hunt: { create: jest.fn() } };
    const characters = makeCharacters(null);
    const service = new HuntsService(prisma as never, characters as never);

    await expect(
      service.create('user-1', { raw: SOLO_RAW, characterId: 'c1' } as never),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.hunt.create).not.toHaveBeenCalled();
  });

  it('links and denormalizes from the owned character', async () => {
    const created = { id: 'h1', shares: [] };
    const prisma = {
      hunt: { create: jest.fn().mockResolvedValue(created) },
    };
    const characters = makeCharacters({
      id: 'c1',
      name: 'Bobeek',
      vocation: 'Elder Druid',
      level: 3067,
    });
    const service = new HuntsService(prisma as never, characters as never);

    await service.create('user-1', {
      raw: SOLO_RAW,
      characterId: 'c1',
    } as never);

    const arg = prisma.hunt.create.mock.calls[0][0];
    expect(arg.data.character).toEqual({ connect: { id: 'c1' } });
    expect(arg.data.characterName).toBe('Bobeek');
    expect(arg.data.vocation).toBe('Elder Druid');
    expect(arg.data.level).toBe(3067);
  });
});
```

> Note: the existing `HuntsService` constructor takes only `PrismaService`. This task adds a second constructor arg. Update any existing `new HuntsService(...)` calls in the spec to pass a characters stub (e.g. `{ findOwnedById: jest.fn() }`).

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd web-admin-api && npx jest src/hunts/hunts.service.spec.ts`
Expected: FAIL — `HuntsService` constructor arity / `character` not set.

- [ ] **Step 4: Update `HuntsService.create`**

In `web-admin-api/src/hunts/hunts.service.ts`:

Add the import:

```typescript
import { CharactersService } from '../characters/characters.service';
```

Update the constructor:

```typescript
  constructor(
    private readonly prisma: PrismaService,
    private readonly characters: CharactersService,
  ) {}
```

Replace the body of `create` with:

```typescript
  async create(ownerId: string, dto: CreateHuntDto) {
    const character = await this.characters.findOwnedById(
      ownerId,
      dto.characterId,
    );
    if (!character) {
      throw new UnprocessableEntityException({
        message: 'Select one of your characters',
        issues: [{ field: 'characterId', message: 'Character not found' }],
      });
    }

    let parsed: ParsedAnalyzer;
    try {
      parsed = parseAnalyzer(dto.raw);
    } catch (error) {
      if (error instanceof AnalyzerValidationError) {
        throw new UnprocessableEntityException({
          message: 'Invalid analyzer',
          issues: error.issues,
        });
      }
      throw error;
    }

    const data = toCreateData(
      parsed,
      {
        ...dto,
        characterName: character.name,
        vocation: character.vocation,
        level: character.level,
      },
      ownerId,
    );
    data.character = { connect: { id: character.id } };

    const hunt = await this.prisma.hunt.create({
      data,
      include: HUNT_INCLUDE,
    });
    return toResponse(hunt);
  }
```

- [ ] **Step 5: Wire `CharactersModule` into `HuntsModule`**

In `web-admin-api/src/hunts/hunts.module.ts`, import `CharactersModule` and add it to `imports`:

```typescript
import { CharactersModule } from '../characters/characters.module';
```
```typescript
@Module({
  imports: [CharactersModule],
  controllers: [HuntsController],
  providers: [HuntsService],
})
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd web-admin-api && npx jest src/hunts/hunts.service.spec.ts`
Expected: PASS.

- [ ] **Step 7: Verify lint + build + full unit suite**

Run: `cd web-admin-api && npm run lint && npm run build && npm test`
Expected: PASS. (Fix any other `hunts.controller.spec`/`hunts-dto.spec` expectations that referenced the removed create fields.)

- [ ] **Step 8: Commit**

```bash
cd web-admin-api
git add src/hunts
git commit -m "feat(hunts): require an owned character to create a hunt"
```

---

## Task 5: E2E — characters CRUD + hunt requires character

**Files:**
- Create: `web-admin-api/test/characters.e2e-spec.ts` (follow the existing `test/*.e2e-spec.ts` setup — app bootstrap, auth helper, DB reset)
- Reference: existing files under `web-admin-api/test/`

**Interfaces:**
- Consumes: all backend routes from Tasks 2–4.

- [ ] **Step 1: Inspect existing E2E harness**

Read an existing `web-admin-api/test/*.e2e-spec.ts` to copy its app-bootstrap, register/login helper, and DB-cleanup pattern. Reuse them; do not invent a new harness.

- [ ] **Step 2: Write the E2E spec**

Mock TibiaData by overriding `TibiaService` in the testing module so no live HTTP call is made:

```typescript
// In the Test.createTestingModule(...) chain:
// .overrideProvider(TibiaService).useValue({
//   fetchCharacter: async (name: string) => ({
//     name, sex: 'male', vocation: 'Knight', level: 100, world: 'Calmera',
//   }),
// })
```

Cover, as separate `it` blocks, using supertest against the booted app and an authenticated token:
1. `POST /characters { name: 'Test' }` → 201, body has `name/sex/vocation/level/world`.
2. `GET /characters` → array contains the created character.
3. Adding an 11th character → 409.
4. Adding a duplicate name → 409.
5. `POST /characters/:id/refresh` → 200, updated snapshot.
6. `DELETE /characters/:id` → 204; subsequent `GET` no longer lists it.
7. `POST /hunts` with a valid `characterId` and valid `raw` → 201.
8. `POST /hunts` with a missing/non-owned `characterId` → 422.

- [ ] **Step 3: Run the E2E suite**

Run: `cd web-admin-api && npm run test:e2e`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd web-admin-api
git add test/characters.e2e-spec.ts
git commit -m "test(e2e): characters CRUD and hunt-requires-character"
```

---

## Task 6: Frontend — Character type + API + schema

**Files:**
- Modify: `web-admin/types/index.ts`
- Create: `web-admin/features/characters/api.ts`
- Create: `web-admin/features/characters/schema.ts`
- Create: `web-admin/features/characters/schema.test.ts`

**Interfaces:**
- Produces:
  - `Character` type `{ id, ownerId, name, sex, vocation, level, world, createdAt, updatedAt }`.
  - `listCharacters(): Promise<Character[]>` (server-side, via `serverFetch`).
  - `addCharacterSchema` / `AddCharacterInput` (`{ name: string }`).

- [ ] **Step 1: Add the `Character` type**

In `web-admin/types/index.ts`, add:

```typescript
export interface Character {
  id: string;
  ownerId: string;
  name: string;
  sex: string;
  vocation: string;
  level: number;
  world: string;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Create the API helper**

Create `web-admin/features/characters/api.ts`:

```typescript
import { serverFetch } from "@/lib/api/server";
import type { Character } from "@/types";

export function listCharacters(): Promise<Character[]> {
  return serverFetch<Character[]>("/characters");
}
```

- [ ] **Step 3: Write the failing schema test**

Create `web-admin/features/characters/schema.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { addCharacterSchema } from "./schema";

describe("addCharacterSchema", () => {
  it("accepts a non-empty name", () => {
    expect(addCharacterSchema.safeParse({ name: "Bobeek" }).success).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(addCharacterSchema.safeParse({ name: "" }).success).toBe(false);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd web-admin && npx vitest run features/characters/schema.test.ts`
Expected: FAIL — cannot resolve `./schema`.

- [ ] **Step 5: Create the schema**

Create `web-admin/features/characters/schema.ts`:

```typescript
import { z } from "zod";

export const addCharacterSchema = z.object({
  name: z.string().min(1, "Enter a character name").max(60),
});

export type AddCharacterInput = z.infer<typeof addCharacterSchema>;
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd web-admin && npx vitest run features/characters/schema.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd web-admin
git add types/index.ts features/characters/api.ts features/characters/schema.ts features/characters/schema.test.ts
git commit -m "feat(characters): add Character type, API helper, and add-character schema"
```

---

## Task 7: Frontend — Characters page, components, nav

**Files:**
- Create: `web-admin/features/characters/components/AddCharacterForm.tsx`
- Create: `web-admin/features/characters/components/AddCharacterForm.test.tsx`
- Create: `web-admin/features/characters/components/CharacterList.tsx`
- Create: `web-admin/features/characters/components/CharacterCard.tsx`
- Create: `web-admin/app/(app)/characters/page.tsx`
- Modify: `web-admin/components/layout/AppNav.tsx`
- Modify: `web-admin/proxy.ts`

**Interfaces:**
- Consumes: `listCharacters` (Task 6), `addCharacterSchema`, `Character` type.

- [ ] **Step 1: Write the failing `AddCharacterForm` test**

Create `web-admin/features/characters/components/AddCharacterForm.test.tsx` modeled on `web-admin/features/friends/components/AddFriendForm.test.tsx` (read it first). Assert that submitting a name POSTs to `/api/proxy/characters` with `{ name }` and calls `router.refresh` on success, and that a server error message is shown on failure. Mock `next/navigation` and `global.fetch` exactly as the friends test does.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web-admin && npx vitest run features/characters/components/AddCharacterForm.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Create `AddCharacterForm`**

Create `web-admin/features/characters/components/AddCharacterForm.tsx` (mirror `AddFriendForm`, swap field to `name` and endpoint to `/api/proxy/characters`):

```tsx
"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { ErrorMessage } from "@/components/feedback/ErrorMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addCharacterSchema,
  type AddCharacterInput,
} from "@/features/characters/schema";

function requestError(body: unknown): string {
  if (!body || typeof body !== "object") return "Request failed";
  const message = (body as { message?: unknown }).message;
  if (Array.isArray(message)) return message.map(String).join(", ");
  return typeof message === "string" ? message : "Request failed";
}

export function AddCharacterForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddCharacterInput>({ resolver: zodResolver(addCharacterSchema) });

  async function onSubmit(values: AddCharacterInput) {
    setServerError(null);
    try {
      const response = await fetch("/api/proxy/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        setServerError(requestError(await response.json().catch(() => null)));
        return;
      }
      reset();
      router.refresh();
    } catch {
      setServerError("Could not reach the server");
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="codex-panel flex flex-wrap items-start gap-3 p-5"
    >
      <div className="flex w-full max-w-sm flex-col gap-1">
        <Input
          type="text"
          aria-label="Character name"
          placeholder="Character name"
          {...register("name")}
        />
        <ErrorMessage message={errors.name?.message} />
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Adding..." : "Add character"}
      </Button>
      <ErrorMessage message={serverError} className="w-full" />
    </form>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd web-admin && npx vitest run features/characters/components/AddCharacterForm.test.tsx`
Expected: PASS.

- [ ] **Step 5: Create `CharacterCard` (refresh + delete actions)**

Create `web-admin/features/characters/components/CharacterCard.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/feedback/ErrorMessage";
import type { Character } from "@/types";

export function CharacterCard({ character }: { character: Character }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(path: string, method: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(path, { method });
      if (!response.ok) {
        setError("Action failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="codex-panel flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <p className="codex-heading text-base">{character.name}</p>
        <p className="text-2xl text-[var(--color-muted)]">
          {character.vocation} · level {character.level} · {character.world} ·{" "}
          {character.sex}
        </p>
        <ErrorMessage message={error} />
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          disabled={busy}
          onClick={() =>
            call(`/api/proxy/characters/${character.id}/refresh`, "POST")
          }
        >
          Refresh
        </Button>
        <Button
          type="button"
          disabled={busy}
          onClick={() => call(`/api/proxy/characters/${character.id}`, "DELETE")}
        >
          Remove
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create `CharacterList`**

Create `web-admin/features/characters/components/CharacterList.tsx`:

```tsx
import type { Character } from "@/types";
import { CharacterCard } from "./CharacterCard";

export function CharacterList({ characters }: { characters: Character[] }) {
  if (characters.length === 0) {
    return (
      <p className="codex-panel px-6 py-8 text-2xl text-[var(--color-muted)]">
        No characters yet. Add one above to start logging hunts.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {characters.map((character) => (
        <CharacterCard key={character.id} character={character} />
      ))}
    </div>
  );
}
```

- [ ] **Step 7: Create the page**

Create `web-admin/app/(app)/characters/page.tsx`:

```tsx
import { ErrorMessage } from "@/components/feedback/ErrorMessage";
import { listCharacters } from "@/features/characters/api";
import { AddCharacterForm } from "@/features/characters/components/AddCharacterForm";
import { CharacterList } from "@/features/characters/components/CharacterList";
import type { Character } from "@/types";

export default async function CharactersPage() {
  let characters: Character[] = [];
  let loadError: string | null = null;

  try {
    characters = await listCharacters();
  } catch (error) {
    loadError = (error as Error).message;
  }

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6">
      <div>
        <p className="codex-label">Roster</p>
        <h1 className="codex-heading text-2xl">Characters</h1>
        <p className="text-2xl text-[var(--color-muted)]">
          Up to 10 characters per account.
        </p>
      </div>
      {loadError ? (
        <ErrorMessage message={loadError} />
      ) : (
        <>
          <AddCharacterForm />
          <CharacterList characters={characters} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Add the nav link**

In `web-admin/components/layout/AppNav.tsx`, add to `links` (after the Hunts entries):

```typescript
  { href: "/characters", label: "Characters" },
```

- [ ] **Step 9: Protect the route in `proxy.ts`**

In `web-admin/proxy.ts`, add `/characters` to the `PROTECTED` array:

```typescript
const PROTECTED = ["/dashboard", "/hunts", "/friends", "/shared", "/characters"];
```

- [ ] **Step 10: Verify lint + build + tests**

Run: `cd web-admin && npm run lint && npm test && npm run build`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
cd web-admin
git add features/characters components/layout/AppNav.tsx "app/(app)/characters" proxy.ts
git commit -m "feat(characters): characters management page, components, and nav"
```

---

## Task 8: Frontend — New-hunt requires character selection

**Files:**
- Modify: `web-admin/features/analyzer/components/AnalyzerPasteForm.tsx`
- Modify: `web-admin/features/analyzer/components/AnalyzerPasteForm.test.tsx` (if present) or create it
- Modify: `web-admin/app/(app)/hunts/new/page.tsx`

**Interfaces:**
- Consumes: `listCharacters` (Task 6), `Character` type.

- [ ] **Step 1: Load characters server-side and pass them in**

Change `web-admin/app/(app)/hunts/new/page.tsx` to a server component that fetches characters and passes them to the form:

```tsx
import { listCharacters } from "@/features/characters/api";
import { AnalyzerPasteForm } from "@/features/analyzer/components/AnalyzerPasteForm";
import type { Character } from "@/types";

export default async function NewHuntPage() {
  let characters: Character[] = [];
  try {
    characters = await listCharacters();
  } catch {
    characters = [];
  }
  return <AnalyzerPasteForm characters={characters} />;
}
```

- [ ] **Step 2: Write the failing form test**

Create/extend `web-admin/features/analyzer/components/AnalyzerPasteForm.test.tsx`. Add two cases:
1. With `characters={[]}`: the Save button is absent/disabled and a notice with a link to `/characters` is rendered.
2. With one character: selecting it and pasting a valid analyzer enables Save, and submitting POSTs to `/api/proxy/hunts` with `characterId` in the JSON body.

Mock `next/navigation` `useRouter` and `global.fetch` (mirror existing analyzer tests; read the current test file first).

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd web-admin && npx vitest run features/analyzer/components/AnalyzerPasteForm.test.tsx`
Expected: FAIL — prop/selector/`characterId` not present.

- [ ] **Step 4: Update `AnalyzerPasteForm`**

In `web-admin/features/analyzer/components/AnalyzerPasteForm.tsx`:

Add the prop and imports:

```tsx
import Link from "next/link";
import type { Character } from "@/types";
```

Change the signature:

```tsx
export function AnalyzerPasteForm({
  characters,
}: {
  characters: Character[];
}) {
```

Add selection state near the other `useState` hooks:

```tsx
  const [characterId, setCharacterId] = useState<string | null>(
    characters.length === 1 ? characters[0].id : null,
  );
  const hasCharacters = characters.length > 0;
```

Extend `canSubmit` to require a character:

```tsx
  const canSubmit =
    result?.ok === true &&
    result.data.raw === raw &&
    confirmed &&
    !checking &&
    !submitting &&
    !isExample &&
    characterId !== null;
```

Include `characterId` in the POST body:

```tsx
        body: JSON.stringify({
          tags: [],
          visibility: "PRIVATE",
          raw,
          characterId,
          wheelCode: wheelCode || undefined,
        }),
```

In the preview column, just before the `<Button type="submit">`, render either the block notice or the selector:

```tsx
          {!hasCharacters ? (
            <p
              role="note"
              className="codex-panel px-6 py-8 text-2xl leading-7 text-[var(--color-muted)]"
            >
              You need a character before logging a hunt.{" "}
              <Link href="/characters" className="underline">
                Add a character
              </Link>
              .
            </p>
          ) : (
            <div className="space-y-2">
              <p className="codex-label">Character</p>
              <div className="flex flex-wrap gap-2">
                {characters.map((character) => (
                  <button
                    key={character.id}
                    type="button"
                    aria-pressed={characterId === character.id}
                    onClick={() => setCharacterId(character.id)}
                    className={
                      characterId === character.id
                        ? "border border-[var(--color-brand)] bg-[var(--color-brand)] px-3 py-2 text-[var(--color-brand-fg)]"
                        : "border border-[#0e0a06] px-3 py-2 text-[var(--color-muted)]"
                    }
                  >
                    {character.name} · {character.level}
                  </button>
                ))}
              </div>
            </div>
          )}
```

Wrap the existing `<Button type="submit">` so it only renders when `hasCharacters` (zero-character accounts cannot submit):

```tsx
          {hasCharacters ? (
            <Button type="submit" disabled={!canSubmit} className="w-full">
              {submitting ? "Saving..." : "Save hunt"}
            </Button>
          ) : null}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd web-admin && npx vitest run features/analyzer/components/AnalyzerPasteForm.test.tsx`
Expected: PASS.

- [ ] **Step 6: Verify lint + build + full test suite**

Run: `cd web-admin && npm run lint && npm test && npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd web-admin
git add "app/(app)/hunts/new/page.tsx" features/analyzer/components/AnalyzerPasteForm.tsx features/analyzer/components/AnalyzerPasteForm.test.tsx
git commit -m "feat(hunts): require selecting a character on the new-hunt form"
```

---

## Task 9: Docs

**Files:**
- Modify: `web-admin-api/docs/data-model.md`, `web-admin-api/docs/api-reference.md`, `web-admin-api/docs/architecture.md`
- Modify: `web-admin/docs/backend-integration.md`, `web-admin/docs/routes-and-flows.md`

- [ ] **Step 1: Update backend docs**

Document the `Character` model, the `characters` endpoints, the TibiaData client module + `TIBIADATA_BASE_URL`, and the new hunt-create requirement (`characterId` required, character not owned → 422). Match the tone/format of the existing docs.

- [ ] **Step 2: Update frontend docs**

Document the `/characters` route, the new-hunt character selector, and the zero-character block.

- [ ] **Step 3: Commit (per repo)**

```bash
cd web-admin-api && git add docs && git commit -m "docs: characters, tibia client, hunt-create requirement"
cd ../web-admin && git add docs && git commit -m "docs: characters page and new-hunt character selection"
```

---

## Self-Review Notes

- **Spec coverage:** tibia module (T2) ✓; Character model + Hunt FK (T1) ✓; endpoints incl. refresh/delete (T3) ✓; max-10 + per-account uniqueness (T3) ✓; hunt requires character + denormalize (T4) ✓; E2E (T5) ✓; frontend type/api/schema (T6) ✓; characters page + nav + proxy protection (T7) ✓; new-hunt selector + zero-char block (T8) ✓; dev/prd env via `TIBIADATA_BASE_URL` + proxy `API_BASE_URL` (T2/global) ✓; docs (T9) ✓.
- **Decisions honored:** snapshot + manual refresh (T3 `refresh`); legacy hunts nullable, no backfill (T1 `SetNull`, no data migration); name unique per account only (T1 `@@unique([ownerId,name])`); delete keeps hunt history (T1 `onDelete: SetNull`); hunt-create bad character → 422 (T4).
- **Type consistency:** `findOwnedById(ownerId,id)` defined in T3, consumed in T4; `TibiaCharacter` shape (T2) reused by `CharactersService` (T3) and frontend `Character` (T6) plus `ownerId/createdAt/updatedAt`.
