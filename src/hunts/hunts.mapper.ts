import { Prisma } from '@prisma/client';
import { ParsedAnalyzer } from '../analyzer/schemas/analyzer.schema';

export const HUNT_INCLUDE = {
  soloStats: true,
  killedMonsters: true,
  lootedItems: true,
  partyStats: { include: { members: true } },
  shares: { select: { sharedWithId: true } },
} as const satisfies Prisma.HuntInclude;

export type HuntWithRelations = Prisma.HuntGetPayload<{
  include: typeof HUNT_INCLUDE;
}>;

type HuntBaseResponse = Pick<
  HuntWithRelations,
  | 'id'
  | 'ownerId'
  | 'type'
  | 'title'
  | 'huntingSpot'
  | 'characterName'
  | 'vocation'
  | 'level'
  | 'tags'
  | 'notes'
  | 'wheelCode'
  | 'visibility'
  | 'rawAnalyzer'
  | 'startedAt'
  | 'endedAt'
  | 'sessionDurationMinutes'
  | 'createdAt'
  | 'updatedAt'
>;

type SoloStatsResponse = Omit<
  NonNullable<HuntWithRelations['soloStats']>,
  'id' | 'huntId'
>;

type PartyMemberResponse = Omit<
  NonNullable<HuntWithRelations['partyStats']>['members'][number],
  'id' | 'partyStatsId'
>;

type PartyStatsResponse = Omit<
  NonNullable<HuntWithRelations['partyStats']>,
  'id' | 'huntId' | 'members'
> & { members: PartyMemberResponse[] };

export type HuntResponse = HuntBaseResponse & {
  sharedWith: string[];
  soloStats?: SoloStatsResponse;
  killedMonsters?: { name: string; count: number }[];
  lootedItems?: { name: string; count: number }[];
  partyStats?: PartyStatsResponse;
};

export interface HuntMetadataInput {
  title?: string;
  huntingSpot?: string | null;
  characterName?: string | null;
  vocation?: string | null;
  level?: number | null;
  tags?: string[];
  notes?: string | null;
  wheelCode?: string | null;
  visibility?: 'PRIVATE' | 'FRIENDS';
}

export function autoTitle(
  parsed: ParsedAnalyzer,
  metadata: HuntMetadataInput,
): string {
  if (metadata.title?.trim()) return metadata.title.trim();

  const base =
    metadata.huntingSpot?.trim() ||
    (parsed.type === 'SOLO' ? 'Solo hunt' : 'Party hunt');
  return `${base} — ${parsed.startedAt.toISOString().slice(0, 10)}`;
}

export function toCreateData(
  parsed: ParsedAnalyzer,
  metadata: HuntMetadataInput,
  ownerId: string,
): Prisma.HuntCreateInput {
  const base: Prisma.HuntCreateInput = {
    owner: { connect: { id: ownerId } },
    type: parsed.type,
    title: autoTitle(parsed, metadata),
    huntingSpot: metadata.huntingSpot ?? null,
    characterName: metadata.characterName ?? null,
    vocation: metadata.vocation ?? null,
    level: metadata.level ?? null,
    tags: metadata.tags ?? [],
    notes: metadata.notes ?? null,
    wheelCode: metadata.wheelCode ?? null,
    visibility: metadata.visibility ?? 'PRIVATE',
    rawAnalyzer: parsed.raw,
    startedAt: parsed.startedAt,
    endedAt: parsed.endedAt,
    sessionDurationMinutes: parsed.sessionDurationMinutes,
  };

  if (parsed.type === 'SOLO' && parsed.solo) {
    const { killedMonsters, lootedItems, ...stats } = parsed.solo;
    return {
      ...base,
      soloStats: { create: stats },
      killedMonsters: { create: killedMonsters },
      lootedItems: { create: lootedItems },
    };
  }

  if (parsed.type === 'PARTY' && parsed.party) {
    const { members, ...totals } = parsed.party;
    return {
      ...base,
      partyStats: {
        create: {
          ...totals,
          members: { create: members },
        },
      },
    };
  }

  throw new Error(`Missing parsed payload for ${parsed.type} hunt`);
}

export function toResponse(hunt: HuntWithRelations): HuntResponse {
  const base = {
    id: hunt.id,
    ownerId: hunt.ownerId,
    type: hunt.type,
    title: hunt.title,
    huntingSpot: hunt.huntingSpot,
    characterName: hunt.characterName,
    vocation: hunt.vocation,
    level: hunt.level,
    tags: hunt.tags,
    notes: hunt.notes,
    wheelCode: hunt.wheelCode,
    visibility: hunt.visibility,
    rawAnalyzer: hunt.rawAnalyzer,
    startedAt: hunt.startedAt,
    endedAt: hunt.endedAt,
    sessionDurationMinutes: hunt.sessionDurationMinutes,
    createdAt: hunt.createdAt,
    updatedAt: hunt.updatedAt,
    sharedWith: hunt.shares.map((share) => share.sharedWithId),
  };

  if (hunt.soloStats) {
    const stats = hunt.soloStats;
    return {
      ...base,
      soloStats: {
        rawXpGain: stats.rawXpGain,
        xpGain: stats.xpGain,
        rawXpPerHour: stats.rawXpPerHour,
        xpPerHour: stats.xpPerHour,
        loot: stats.loot,
        supplies: stats.supplies,
        balance: stats.balance,
        damage: stats.damage,
        damagePerHour: stats.damagePerHour,
        healing: stats.healing,
        healingPerHour: stats.healingPerHour,
      },
      killedMonsters: hunt.killedMonsters.map(({ name, count }) => ({
        name,
        count,
      })),
      lootedItems: hunt.lootedItems.map(({ name, count }) => ({ name, count })),
    };
  }

  if (hunt.partyStats) {
    const stats = hunt.partyStats;
    return {
      ...base,
      partyStats: {
        lootType: stats.lootType,
        totalLoot: stats.totalLoot,
        totalSupplies: stats.totalSupplies,
        totalBalance: stats.totalBalance,
        members: stats.members.map((member) => ({
          name: member.name,
          isLeader: member.isLeader,
          loot: member.loot,
          supplies: member.supplies,
          balance: member.balance,
          damage: member.damage,
          healing: member.healing,
        })),
      },
    };
  }

  return base;
}
