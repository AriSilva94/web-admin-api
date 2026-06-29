import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { HuntsService } from './hunts.service';

function huntRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'hunt-1',
    ownerId: 'user-1',
    type: 'SOLO',
    title: 'Solo hunt',
    huntingSpot: null,
    characterName: null,
    vocation: null,
    level: null,
    tags: [],
    notes: null,
    visibility: 'PRIVATE',
    rawAnalyzer: 'raw',
    startedAt: new Date('2026-06-22T17:22:32Z'),
    endedAt: new Date('2026-06-22T18:16:15Z'),
    sessionDurationMinutes: 53,
    createdAt: new Date('2026-06-22T18:16:16Z'),
    updatedAt: new Date('2026-06-22T18:16:16Z'),
    soloStats: null,
    partyStats: null,
    killedMonsters: [],
    lootedItems: [],
    shares: [],
    ...overrides,
  };
}

function makePrisma() {
  const prisma = {
    hunt: {
      findUnique: jest.fn(),
      findMany: jest.fn<(args: unknown) => Promise<unknown[]>>(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(async (operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
  };
  return prisma;
}

describe('HuntsService', () => {
  it('returns analyzer issues as 422 on invalid creation input', async () => {
    const service = new HuntsService(makePrisma() as never);

    await expect(
      service.create('user-1', {
        raw: 'not an analyzer',
        visibility: 'PRIVATE',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('allows the owner to read a hunt', async () => {
    const prisma = makePrisma();
    prisma.hunt.findUnique.mockResolvedValue(huntRecord());
    const service = new HuntsService(prisma as never);

    await expect(service.getById('user-1', 'hunt-1')).resolves.toMatchObject({
      id: 'hunt-1',
    });
  });

  it('allows a shared recipient to read a hunt', async () => {
    const prisma = makePrisma();
    prisma.hunt.findUnique.mockResolvedValue(
      huntRecord({ shares: [{ sharedWithId: 'user-2' }] }),
    );
    const service = new HuntsService(prisma as never);

    await expect(service.getById('user-2', 'hunt-1')).resolves.toMatchObject({
      id: 'hunt-1',
    });
  });

  it('hides hunts from strangers', async () => {
    const prisma = makePrisma();
    prisma.hunt.findUnique.mockResolvedValue(huntRecord());
    const service = new HuntsService(prisma as never);

    await expect(service.getById('user-x', 'hunt-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects metadata updates from non-owners', async () => {
    const prisma = makePrisma();
    prisma.hunt.findUnique.mockResolvedValue({ ownerId: 'user-1' });
    const service = new HuntsService(prisma as never);

    await expect(
      service.update('user-2', 'hunt-1', { title: 'Renamed' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.hunt.update).not.toHaveBeenCalled();
  });

  it('builds owner-scoped list filters and pagination', async () => {
    const prisma = makePrisma();
    let findManyArgument: unknown;
    prisma.hunt.findMany.mockImplementation((argument) => {
      findManyArgument = argument;
      return Promise.resolve([]);
    });
    prisma.hunt.count.mockResolvedValue(0);
    const service = new HuntsService(prisma as never);

    await service.list('user-1', {
      type: 'SOLO',
      tags: 'profit,boss',
      page: 2,
      pageSize: 10,
    });

    expect(findManyArgument).toMatchObject({
      where: {
        ownerId: 'user-1',
        type: 'SOLO',
        tags: { hasEvery: ['profit', 'boss'] },
      },
      skip: 10,
      take: 10,
    });
  });
});
