export function normalizeNumber(raw: string): bigint {
  const cleaned = raw.replace(/,/g, '').trim();
  if (!/^-?\d+$/.test(cleaned)) {
    throw new Error(`Invalid number: "${raw}"`);
  }

  return BigInt(cleaned);
}

export function parseDate(raw: string): Date {
  const match = raw
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2}), (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid date: "${raw}"`);
  }

  const [, y, mo, d, h, mi, s] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(s);

  const date = new Date(year, month - 1, day, hour, minute, second);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second
  ) {
    throw new Error(`Invalid date: "${raw}"`);
  }

  return date;
}

export function parseDuration(raw: string): number {
  const match = raw.trim().match(/^(\d{2}):(\d{2})h$/);
  if (!match) {
    throw new Error(`Invalid duration: "${raw}"`);
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59) {
    throw new Error(`Invalid duration: "${raw}"`);
  }

  return hours * 60 + minutes;
}

export function parseMemberName(raw: string): {
  name: string;
  isLeader: boolean;
} {
  const trimmed = raw.trim();
  const isLeader = / \(Leader\)$/.test(trimmed);

  return {
    name: trimmed.replace(/ \(Leader\)$/, '').trim(),
    isLeader,
  };
}
