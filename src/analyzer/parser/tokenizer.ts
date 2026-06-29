export type AnalyzerType = 'SOLO' | 'PARTY';

export function toLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function detectType(lines: string[]): AnalyzerType {
  const hasLootType = lines.some((line) => /^Loot Type:/.test(line));
  const hasSoloMarker = lines.some((line) =>
    /^Raw XP Gain:|^Killed Monsters:/.test(line),
  );

  if (hasSoloMarker) {
    return 'SOLO';
  }
  if (hasLootType) {
    return 'PARTY';
  }

  throw new Error('Unrecognized analyzer format');
}
