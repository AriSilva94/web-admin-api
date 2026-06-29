import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import '../src/common/bigint-serializer';
import { SOLO_RAW } from '../src/analyzer/parser/fixtures';
import { AppModule } from '../src/app.module';

interface AuthResponseBody {
  accessToken: string;
}

interface HuntBody {
  id: string;
  title: string;
  type: string;
  huntingSpot: string | null;
  visibility: string;
  soloStats: { loot: string };
  sharedWith: string[];
}

interface HuntsListBody {
  data: HuntBody[];
}

describe('Hunts (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();

    const registration = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `hunts_${Date.now()}@test.com`,
        password: 'password123',
        displayName: 'Hunts E2E',
      })
      .expect(201);
    accessToken = (registration.body as AuthResponseBody).accessToken;
  });

  afterAll(async () => app.close());

  it('creates, lists, gets, patches and deletes a solo hunt', async () => {
    const authorization = `Bearer ${accessToken}`;
    const created = await request(app.getHttpServer())
      .post('/hunts')
      .set('Authorization', authorization)
      .send({ raw: SOLO_RAW, huntingSpot: 'Cobra Bastion' })
      .expect(201);

    const createdBody = created.body as HuntBody;
    expect(createdBody).toMatchObject({
      type: 'SOLO',
      huntingSpot: 'Cobra Bastion',
      visibility: 'PRIVATE',
      soloStats: { loot: '1553582' },
      sharedWith: [],
    });
    expect(createdBody.title).toContain('Cobra Bastion');
    const id = createdBody.id;

    const listed = await request(app.getHttpServer())
      .get('/hunts?type=SOLO&page=1&pageSize=10')
      .set('Authorization', authorization)
      .expect(200);
    const listedBody = listed.body as HuntsListBody;
    expect(listedBody.data.some((hunt) => hunt.id === id)).toBe(true);

    const fetched = await request(app.getHttpServer())
      .get(`/hunts/${id}`)
      .set('Authorization', authorization)
      .expect(200);
    expect((fetched.body as HuntBody).id).toBe(id);

    const patched = await request(app.getHttpServer())
      .patch(`/hunts/${id}`)
      .set('Authorization', authorization)
      .send({ title: 'Renamed hunt', notes: null })
      .expect(200);
    expect((patched.body as HuntBody).title).toBe('Renamed hunt');

    await request(app.getHttpServer())
      .delete(`/hunts/${id}`)
      .set('Authorization', authorization)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/hunts/${id}`)
      .set('Authorization', authorization)
      .expect(404);
  });
});
