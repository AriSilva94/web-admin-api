import { AnalyzerIssue, AnalyzerValidationError } from '../analyzer.errors';
import { ParsedAnalyzer, parsedSoloSchema } from '../schemas/analyzer.schema';
import { normalizeNumber, parseDate, parseDuration } from './normalize';

const FIELD_LABELS: Record<string, string> = {
  'Raw XP Gain': 'rawXpGain',
  'XP Gain': 'xpGain',
  'Raw XP/h': 'rawXpPerHour',
  'XP/h': 'xpPerHour',
  Loot: 'loot',
  Supplies: 'supplies',
  Balance: 'balance',
  Damage: 'damage',
  'Damage/h': 'damagePerHour',
  Healing: 'healing',
  'Healing/h': 'healingPerHour',
};

export function parseSolo(lines: string[], raw: string): ParsedAnalyzer {
  const issues: AnalyzerIssue[] = [];
  const values: Record<string, bigint> = {};
  const killedMonsters: { name: string; count: number }[] = [];
  const lootedItems: { name: string; count: number }[] = [];

  let startedAt: Date | undefined;
  let endedAt: Date | undefined;
  let durationMinutes: number | undefined;
  let section: 'none' | 'killed' | 'looted' = 'none';

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
      section = 'none';
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
      section = 'none';
      continue;
    }

    if (line === 'Killed Monsters:') {
      section = 'killed';
      continue;
    }
    if (line === 'Looted Items:') {
      section = 'looted';
      continue;
    }

    const field = line.match(/^(.+?): (.+)$/);
    if (field && FIELD_LABELS[field[1]]) {
      const key = FIELD_LABELS[field[1]];
      try {
        values[key] = normalizeNumber(field[2]);
      } catch (error) {
        issues.push({ field: key, message: (error as Error).message });
      }
      section = 'none';
      continue;
    }

    const item = line.match(/^(\d+)x (.+)$/);
    if (item && (section === 'killed' || section === 'looted')) {
      const entry = { count: Number(item[1]), name: item[2].trim() };
      if (section === 'killed') {
        killedMonsters.push(entry);
      } else {
        lootedItems.push(entry);
      }
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

  const result = parsedSoloSchema.safeParse({
    ...values,
    killedMonsters,
    lootedItems,
  });
  if (!result.success) {
    for (const issue of result.error.issues) {
      issues.push({
        field: issue.path.join('.') || 'solo',
        message: issue.message,
      });
    }
  }

  if (issues.length > 0) {
    throw new AnalyzerValidationError(issues);
  }

  return {
    type: 'SOLO',
    startedAt: startedAt!,
    endedAt: endedAt!,
    sessionDurationMinutes: durationMinutes!,
    raw,
    solo: result.data,
  };
}
