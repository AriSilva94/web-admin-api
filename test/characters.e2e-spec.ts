import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import '../src/common/bigint-serializer';
import { SOLO_RAW } from '../src/analyzer/parser/fixtures';
import { AppModule } from '../src/app.module';
import { TibiaService } from '../src/tibia/tibia.service';

interface AuthResponseBody {
  accessToken: string;
}

interface CharacterBody {
  id: string;
  name: string;
  sex: string;
  vocation: string;
  level: number;
  world: string;
}

const mockTibiaService = {
  fetchCharacter: async (name: string) => ({
    name,
    sex: 'male',
    vocation: 'Knight',
    level: 100,
    world: 'Calmera',
  }),
};

describe('Characters (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;
  let characterId: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(TibiaService)
      .useValue(mockTibiaService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const registration = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `chars_${suffix}@test.com`,
        password: 'password123',
        displayName: 'Chars E2E',
      })
      .expect(201);
    accessToken = (registration.body as AuthResponseBody).accessToken;
  });

  afterAll(async () => app.close());

  it('POST /characters creates a character (201) with correct fields', async () => {
    const authorization = `Bearer ${accessToken}`;
    const res = await request(app.getHttpServer())
      .post('/characters')
      .set('Authorization', authorization)
      .send({ name: 'TestChar' })
      .expect(201);

    const body = res.body as CharacterBody;
    expect(body.name).toBe('TestChar');
    expect(body.sex).toBe('male');
    expect(body.vocation).toBe('Knight');
    expect(body.level).toBe(100);
    expect(body.world).toBe('Calmera');
    characterId = body.id;
  });

  it('GET /characters lists the created character', async () => {
    const authorization = `Bearer ${accessToken}`;
    const res = await request(app.getHttpServer())
      .get('/characters')
      .set('Authorization', authorization)
      .expect(200);

    const body = res.body as CharacterBody[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((c) => c.id === characterId)).toBe(true);
  });

  it('POST /characters returns 409 for a duplicate name on the same account', async () => {
    const authorization = `Bearer ${accessToken}`;
    await request(app.getHttpServer())
      .post('/characters')
      .set('Authorization', authorization)
      .send({ name: 'TestChar' })
      .expect(409);
  });

  it('POST /characters returns 409 when adding an 11th character', async () => {
    const authorization = `Bearer ${accessToken}`;
    // Add chars 2–10 (TestChar is already #1)
    for (let i = 2; i <= 10; i++) {
      await request(app.getHttpServer())
        .post('/characters')
        .set('Authorization', authorization)
        .send({ name: `TestChar${i}` })
        .expect(201);
    }
    // The 11th should be rejected
    await request(app.getHttpServer())
      .post('/characters')
      .set('Authorization', authorization)
      .send({ name: 'TestChar11' })
      .expect(409);
  });

  it('POST /characters/:id/refresh returns 201 with an updated snapshot', async () => {
    const authorization = `Bearer ${accessToken}`;
    const res = await request(app.getHttpServer())
      .post(`/characters/${characterId}/refresh`)
      .set('Authorization', authorization)
      .expect(201);

    const body = res.body as CharacterBody;
    expect(body.id).toBe(characterId);
    expect(body.name).toBe('TestChar');
  });

  it('DELETE /characters/:id returns 204 and subsequent GET no longer lists it', async () => {
    const authorization = `Bearer ${accessToken}`;

    // Delete the character
    await request(app.getHttpServer())
      .delete(`/characters/${characterId}`)
      .set('Authorization', authorization)
      .expect(204);

    // It should no longer appear in the list
    const res = await request(app.getHttpServer())
      .get('/characters')
      .set('Authorization', authorization)
      .expect(200);

    const body = res.body as CharacterBody[];
    expect(body.some((c) => c.id === characterId)).toBe(false);
  });

  it('POST /hunts with a valid owned characterId and raw returns 201', async () => {
    const authorization = `Bearer ${accessToken}`;

    // Create a fresh character to use as the hunt owner
    const charRes = await request(app.getHttpServer())
      .post('/characters')
      .set('Authorization', authorization)
      .send({ name: 'HuntChar' })
      .expect(201);
    const huntCharId = (charRes.body as CharacterBody).id;

    const res = await request(app.getHttpServer())
      .post('/hunts')
      .set('Authorization', authorization)
      .send({ raw: SOLO_RAW, characterId: huntCharId, huntingSpot: 'Test Spot' })
      .expect(201);

    expect((res.body as { id: string }).id).toBeTruthy();
  });

  it('POST /hunts with a missing/non-owned characterId returns 422', async () => {
    const authorization = `Bearer ${accessToken}`;
    await request(app.getHttpServer())
      .post('/hunts')
      .set('Authorization', authorization)
      .send({ raw: SOLO_RAW, characterId: 'non-existent-id' })
      .expect(422);
  });
});
