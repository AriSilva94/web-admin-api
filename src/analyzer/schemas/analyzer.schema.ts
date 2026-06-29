import { z } from 'zod';

const bigintField = z.bigint();
const countedEntrySchema = z.object({
  name: z.string().min(1),
  count: z.number().int().positive(),
});

export const parsedSoloSchema = z.object({
  rawXpGain: bigintField,
  xpGain: bigintField,
  rawXpPerHour: bigintField,
  xpPerHour: bigintField,
  loot: bigintField,
  supplies: bigintField,
  balance: bigintField,
  damage: bigintField,
  damagePerHour: bigintField,
  healing: bigintField,
  healingPerHour: bigintField,
  killedMonsters: z.array(countedEntrySchema).min(1),
  lootedItems: z.array(countedEntrySchema).min(1),
});

export const parsedPartyMemberSchema = z.object({
  name: z.string().min(1),
  isLeader: z.boolean(),
  loot: bigintField,
  supplies: bigintField,
  balance: bigintField,
  damage: bigintField,
  healing: bigintField,
});

export const parsedPartySchema = z.object({
  lootType: z.string().min(1),
  totalLoot: bigintField,
  totalSupplies: bigintField,
  totalBalance: bigintField,
  members: z.array(parsedPartyMemberSchema).min(1),
});

export type ParsedSolo = z.infer<typeof parsedSoloSchema>;
export type ParsedParty = z.infer<typeof parsedPartySchema>;

export interface ParsedAnalyzer {
  type: 'SOLO' | 'PARTY';
  startedAt: Date;
  endedAt: Date;
  sessionDurationMinutes: number;
  raw: string;
  solo?: ParsedSolo;
  party?: ParsedParty;
}
