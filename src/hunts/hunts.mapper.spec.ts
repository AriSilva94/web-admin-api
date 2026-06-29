import { ParsedAnalyzer } from '../analyzer/schemas/analyzer.schema';
import { autoTitle, toCreateData, toResponse } from './hunts.mapper';

const parsedSolo: ParsedAnalyzer = {
  type: 'SOLO',
  startedAt: new Date('2026-06-22T17:22:32Z'),
  endedAt: new Date('2026-06-22T18:16:15Z'),
  sessionDurationMinutes: 53,
  raw: 'raw analyzer',
  solo: {
    rawXpGain: 1n,
    xpGain: 2n,
    rawXpPerHour: 3n,
    xpPerHour: 4n,
    loot: 5n,
    supplies: 6n,
    balance: -1n,
    damage: 7n,
    damagePerHour: 8n,
    healing: 9n,
    healingPerHour: 10n,
    killedMonsters: [{ name: 'cobra assassin', count: 1 }],
    lootedItems: [{ name: 'terra boots', count: 2 }],
  },
};

describe('autoTitle', () => {
  it('keeps a provided title', () => {
    expect(autoTitle(parsedSolo, { title: 'My hunt' })).toBe('My hunt');
  });

  it('uses hunting spot and date', () => {
    expect(autoTitle(parsedSolo, { huntingSpot: 'Cobra Bastion' })).toBe(
      'Cobra Bastion — 2026-06-22',
    );
  });

  it('falls back to hunt type and date', () => {
    expect(autoTitle(parsedSolo, {})).toBe('Solo hunt — 2026-06-22');
  });
});

describe('toCreateData', () => {
  it('maps solo relations and preserves bigint values', () => {
    const data = toCreateData(parsedSolo, {}, 'user-1');

    expect(data.owner).toEqual({ connect: { id: 'user-1' } });
    expect(data.soloStats).toMatchObject({ create: { balance: -1n } });
    expect(data.killedMonsters).toEqual({
      create: [{ name: 'cobra assassin', count: 1 }],
    });
  });
});

describe('toResponse', () => {
  it('extracts shared user ids and shapes party stats', () => {
    const result = toResponse({
      id: 'hunt-1',
      ownerId: 'user-1',
      type: 'PARTY',
      title: 'Party',
      huntingSpot: null,
      characterName: null,
      vocation: null,
      level: null,
      tags: [],
      notes: null,
      visibility: 'FRIENDS',
      rawAnalyzer: 'raw',
      startedAt: new Date('2026-04-24T18:08:31Z'),
      endedAt: new Date('2026-04-24T19:22:12Z'),
      sessionDurationMinutes: 73,
      createdAt: new Date('2026-04-24T19:22:13Z'),
      updatedAt: new Date('2026-04-24T19:22:13Z'),
      soloStats: null,
      killedMonsters: [],
      lootedItems: [],
      partyStats: {
        id: 'party-1',
        huntId: 'hunt-1',
        lootType: 'Market',
        totalLoot: 1n,
        totalSupplies: 2n,
        totalBalance: 3n,
        members: [
          {
            id: 'member-1',
            partyStatsId: 'party-1',
            name: 'Eismagier',
            isLeader: true,
            loot: 1n,
            supplies: 1n,
            balance: 1n,
            damage: 1n,
            healing: 1n,
          },
        ],
      },
      shares: [{ sharedWithId: 'user-2' }, { sharedWithId: 'user-3' }],
    });

    expect(result.sharedWith).toEqual(['user-2', 'user-3']);
    expect(result.partyStats?.members).toHaveLength(1);
    expect(result.soloStats).toBeUndefined();
  });
});
