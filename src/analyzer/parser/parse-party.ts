import { AnalyzerIssue, AnalyzerValidationError } from '../analyzer.errors';
import { ParsedAnalyzer, parsedPartySchema } from '../schemas/analyzer.schema';
import {
  normalizeNumber,
  parseDate,
  parseDuration,
  parseMemberName,
} from './normalize';

interface MemberAccum {
  name: string;
  isLeader: boolean;
  loot?: bigint;
  supplies?: bigint;
  balance?: bigint;
  damage?: bigint;
  healing?: bigint;
}

const MEMBER_FIELDS: Record<string, keyof MemberAccum> = {
  Loot: 'loot',
  Supplies: 'supplies',
  Balance: 'balance',
  Damage: 'damage',
  Healing: 'healing',
};

export function parseParty(lines: string[], raw: string): ParsedAnalyzer {
  const issues: AnalyzerIssue[] = [];
  const members: MemberAccum[] = [];

  let startedAt: Date | undefined;
  let endedAt: Date | undefined;
  let durationMinutes: number | undefined;
  let lootType: string | undefined;
  let totalLoot: bigint | undefined;
  let totalSupplies: bigint | undefined;
  let totalBalance: bigint | undefined;
  let current: MemberAccum | undefined;
  let inMembers = false;

  const setTotal = (key: string, value: string) => {
    try {
      const parsed = normalizeNumber(value);
      if (key === 'Loot') totalLoot = parsed;
      if (key === 'Supplies') totalSupplies = parsed;
      if (key === 'Balance') totalBalance = parsed;
    } catch (error) {
      issues.push({
        field: `total${key}`,
        message: (error as Error).message,
      });
    }
  };

  for (const line of lines) {
    const sessionData = line.match(/^Session data: From (.+?) to (.+)$/);
    if (sessionData) {
      try {
        startedAt = parseDate(sessionData[1]);
        endedAt = parseDate(sessionData[2]);
      } catch (error) {
        issues.push({
          field: 'sessionData',
          message: (error as Error).message,
        });
      }
      continue;
    }

    const sessionDuration = line.match(/^Session: (.+)$/);
    if (sessionDuration) {
      try {
        durationMinutes = parseDuration(sessionDuration[1]);
      } catch (error) {
        issues.push({
          field: 'sessionDuration',
          message: (error as Error).message,
        });
      }
      continue;
    }

    const lootTypeMatch = line.match(/^Loot Type: (.+)$/);
    if (lootTypeMatch) {
      lootType = lootTypeMatch[1].trim();
      continue;
    }

    const field = line.match(/^(.+?): (.+)$/);
    if (
      field &&
      ['Loot', 'Supplies', 'Balance'].includes(field[1]) &&
      !inMembers
    ) {
      setTotal(field[1], field[2]);
      continue;
    }

    if (field && current && MEMBER_FIELDS[field[1]]) {
      try {
        current[MEMBER_FIELDS[field[1]]] = normalizeNumber(field[2]) as never;
      } catch (error) {
        issues.push({
          field: `${current.name}.${String(MEMBER_FIELDS[field[1]])}`,
          message: (error as Error).message,
        });
      }
      continue;
    }

    if (field && MEMBER_FIELDS[field[1]] && !current) {
      issues.push({
        field: 'member',
        message: `Member stat before member name: "${line}"`,
      });
      continue;
    }

    if (!field) {
      inMembers = true;
      current = parseMemberName(line);
      members.push(current);
      continue;
    }

    issues.push({
      field: 'unknownLine',
      message: `Unrecognized line: "${line}"`,
    });
  }

  if (!startedAt || !endedAt) {
    issues.push({ field: 'sessionData', message: 'Missing session data' });
  }
  if (durationMinutes === undefined) {
    issues.push({
      field: 'sessionDuration',
      message: 'Missing session duration',
    });
  }

  const result = parsedPartySchema.safeParse({
    lootType,
    totalLoot,
    totalSupplies,
    totalBalance,
    members,
  });
  if (!result.success) {
    for (const issue of result.error.issues) {
      issues.push({
        field: issue.path.join('.') || 'party',
        message: issue.message,
      });
    }
  }

  if (issues.length > 0) {
    throw new AnalyzerValidationError(issues);
  }

  return {
    type: 'PARTY',
    startedAt: startedAt!,
    endedAt: endedAt!,
    sessionDurationMinutes: durationMinutes!,
    raw,
    party: result.data,
  };
}
