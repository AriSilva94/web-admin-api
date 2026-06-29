import { DashboardService } from './dashboard.service';

function makePrisma(hunts: unknown[]) {
  return {
    hunt: {
      findMany: jest.fn().mockResolvedValue(hunts),
    },
  } as never;
}

const soloHunt = (id: string, balance: bigint, loot: bigint, spot: string) => ({
  id,
  ownerId: 'u1',
  title: id,
  type: 'SOLO' as const,
  huntingSpot: spot,
  characterName: null,
  vocation: null,
  level: null,
  tags: [],
  notes: null,
  visibility: 'PRIVATE' as const,
  rawAnalyzer: 'raw',
  startedAt: new Date(),
  endedAt: new Date(),
  sessionDurationMinutes: 60,
  createdAt: new Date(),
  updatedAt: new Date(),
  soloStats: {
    id: `${id}-stats`,
    huntId: id,
    rawXpGain: 0n,
    xpGain: 0n,
    rawXpPerHour: 0n,
    xpPerHour: 0n,
    loot,
    supplies: 0n,
    balance,
    damage: 0n,
    damagePerHour: 0n,
    healing: 0n,
    healingPerHour: 0n,
  },
  partyStats: null,
  killedMonsters: [],
  lootedItems: [],
  shares: [],
});

const partyHunt = (
  id: string,
  balance: bigint,
  loot: bigint,
  supplies: bigint,
) => ({
  ...soloHunt(id, 0n, 0n, 'Party Spot'),
  type: 'PARTY' as const,
  soloStats: null,
  partyStats: {
    id: `${id}-party`,
    huntId: id,
    lootType: 'Leader',
    totalLoot: loot,
    totalSupplies: supplies,
    totalBalance: balance,
    members: [],
  },
});

describe('DashboardService.summary', () => {
  it('agrega valores BigInt e devolve dinheiro como string', async () => {
    const prisma = makePrisma([
      soloHunt('a', 100n, 200n, 'X'),
      soloHunt('b', -40n, 60n, 'X'),
    ]);
    const service = new DashboardService(prisma);

    const summary = await service.summary('u1');

    expect(summary.totalHunts).toBe(2);
    expect(summary.totalProfit).toBe('60');
    expect(summary.totalLoot).toBe('260');
    expect(summary.averageBalancePerHunt).toBe('30');
    expect(summary.bestHuntByBalance).toMatchObject({
      id: 'a',
      balance: '100',
    });
    expect(summary.mostHuntedSpots[0]).toEqual({ spot: 'X', count: 2 });
    expect(summary.soloCount).toBe(2);
  });

  it('trata corretamente uma conta sem hunts', async () => {
    const service = new DashboardService(makePrisma([]));

    const summary = await service.summary('u1');

    expect(summary.totalHunts).toBe(0);
    expect(summary.averageBalancePerHunt).toBe('0');
    expect(summary.bestHuntByBalance).toBeNull();
  });

  it('agrega party hunts e limita listas do resumo', async () => {
    const hunts = [
      partyHunt('party', 300n, 500n, 200n),
      ...Array.from({ length: 5 }, (_, index) =>
        soloHunt(`solo-${index}`, 10n, 20n, `Spot ${index}`),
      ),
    ];
    const service = new DashboardService(makePrisma(hunts));

    const summary = await service.summary('u1');

    expect(summary.partyCount).toBe(1);
    expect(summary.soloCount).toBe(5);
    expect(summary.totalProfit).toBe('350');
    expect(summary.totalLoot).toBe('600');
    expect(summary.totalSupplies).toBe('200');
    expect(summary.bestHuntByBalance).toMatchObject({ id: 'party' });
    expect(summary.mostHuntedSpots).toHaveLength(5);
    expect(summary.recentHunts).toHaveLength(5);
  });
});
