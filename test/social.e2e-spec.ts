import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { SOLO_RAW } from '../src/analyzer/parser/fixtures';
import { AppModule } from '../src/app.module';
import '../src/common/bigint-serializer';
import { TibiaService } from '../src/tibia/tibia.service';

interface RegisteredUser {
  accessToken: string;
  user: { id: string; email: string };
}

interface HuntBody {
  id: string;
  soloStats: { balance: string };
}

interface CharacterBody {
  id: string;
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

interface FriendRequestBody {
  id: string;
  fromEmail: string;
}

interface FriendBody {
  id: string;
  userId: string;
}

interface SharedListBody {
  total: number;
  data: Array<{ id: string }>;
}

interface DashboardBody {
  totalHunts: number;
  totalProfit: string;
  recentHunts: Array<{ id: string }>;
}

describe('Social e dashboard (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(TibiaService)
      .useValue(mockTibiaService)
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => app.close());

  it('percorre amizade, compartilhamento e dashboard de ponta a ponta', async () => {
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const alice = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `alice_${suffix}@test.com`,
          password: 'password123',
          displayName: 'Alice E2E',
        })
        .expect(201)
    ).body as RegisteredUser;
    const bob = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `bob_${suffix}@test.com`,
          password: 'password123',
          displayName: 'Bob E2E',
        })
        .expect(201)
    ).body as RegisteredUser;
    const aliceAuth = `Bearer ${alice.accessToken}`;
    const bobAuth = `Bearer ${bob.accessToken}`;

    // Create a character for Alice — required by the hunt-requires-character rule
    const aliceCharRes = await request(app.getHttpServer())
      .post('/characters')
      .set('Authorization', aliceAuth)
      .send({ name: 'AliceSocialChar' })
      .expect(201);
    const aliceCharId = (aliceCharRes.body as CharacterBody).id;

    const hunt = await request(app.getHttpServer())
      .post('/hunts')
      .set('Authorization', aliceAuth)
      .send({
        raw: SOLO_RAW,
        huntingSpot: 'Social Test Spot',
        visibility: 'FRIENDS',
        characterId: aliceCharId,
      })
      .expect(201);
    const huntBody = hunt.body as HuntBody;
    const huntId = huntBody.id;

    await request(app.getHttpServer())
      .post('/friends/requests')
      .set('Authorization', aliceAuth)
      .send({ email: bob.user.email })
      .expect(201);

    const incoming = await request(app.getHttpServer())
      .get('/friends/requests')
      .set('Authorization', bobAuth)
      .expect(200);
    const incomingBody = incoming.body as FriendRequestBody[];
    expect(incomingBody).toHaveLength(1);
    expect(incomingBody[0].fromEmail).toBe(alice.user.email);

    const accepted = await request(app.getHttpServer())
      .post(`/friends/requests/${incomingBody[0].id}/accept`)
      .set('Authorization', bobAuth)
      .expect(200);
    expect(accepted.body as { success: boolean }).toEqual({ success: true });

    const aliceFriends = await request(app.getHttpServer())
      .get('/friends')
      .set('Authorization', aliceAuth)
      .expect(200);
    const aliceFriendsBody = aliceFriends.body as FriendBody[];
    expect(aliceFriendsBody).toHaveLength(1);
    expect(aliceFriendsBody[0].userId).toBe(bob.user.id);
    const friendshipId = aliceFriendsBody[0].id;

    const bobFriends = await request(app.getHttpServer())
      .get('/friends')
      .set('Authorization', bobAuth)
      .expect(200);
    expect((bobFriends.body as FriendBody[])[0].userId).toBe(alice.user.id);

    await request(app.getHttpServer())
      .post(`/hunts/${huntId}/share`)
      .set('Authorization', aliceAuth)
      .send({ userId: bob.user.id })
      .expect(201);

    const shared = await request(app.getHttpServer())
      .get('/shared')
      .set('Authorization', bobAuth)
      .expect(200);
    const sharedBody = shared.body as SharedListBody;
    expect(sharedBody.total).toBe(1);
    expect(sharedBody.data[0].id).toBe(huntId);

    const sharedHunt = await request(app.getHttpServer())
      .get(`/hunts/${huntId}`)
      .set('Authorization', bobAuth)
      .expect(200);
    expect((sharedHunt.body as HuntBody).id).toBe(huntId);

    const dashboard = await request(app.getHttpServer())
      .get('/dashboard/summary')
      .set('Authorization', aliceAuth)
      .expect(200);
    const dashboardBody = dashboard.body as DashboardBody;
    expect(dashboardBody.totalHunts).toBe(1);
    expect(dashboardBody.totalProfit).toBe(huntBody.soloStats.balance);
    expect(dashboardBody.recentHunts[0].id).toBe(huntId);

    await request(app.getHttpServer())
      .delete(`/hunts/${huntId}/share/${bob.user.id}`)
      .set('Authorization', aliceAuth)
      .expect(204);

    const emptyShared = await request(app.getHttpServer())
      .get('/shared')
      .set('Authorization', bobAuth)
      .expect(200);
    expect((emptyShared.body as SharedListBody).total).toBe(0);

    await request(app.getHttpServer())
      .post(`/hunts/${huntId}/share`)
      .set('Authorization', aliceAuth)
      .send({ userId: bob.user.id })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/friends/${friendshipId}`)
      .set('Authorization', aliceAuth)
      .expect(204);

    await request(app.getHttpServer())
      .get('/shared')
      .set('Authorization', bobAuth)
      .expect(200)
      .expect(({ body }: { body: SharedListBody }) =>
        expect(body.total).toBe(0),
      );

    await request(app.getHttpServer())
      .get(`/hunts/${huntId}`)
      .set('Authorization', bobAuth)
      .expect(404);

    const emptyFriends = await request(app.getHttpServer())
      .get('/friends')
      .set('Authorization', bobAuth)
      .expect(200);
    expect(emptyFriends.body as FriendBody[]).toEqual([]);
  });
});
