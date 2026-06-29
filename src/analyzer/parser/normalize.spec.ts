import {
  normalizeNumber,
  parseDate,
  parseDuration,
  parseMemberName,
} from './normalize';

describe('normalizeNumber', () => {
  it('parses comma-grouped integers', () => {
    expect(normalizeNumber('1,553,582')).toBe(1553582n);
  });

  it('parses negative values', () => {
    expect(normalizeNumber('-262,740')).toBe(-262740n);
  });

  it('parses plain integers', () => {
    expect(normalizeNumber('42')).toBe(42n);
  });

  it('throws on non-numeric input', () => {
    expect(() => normalizeNumber('abc')).toThrow();
  });
});

describe('parseDate', () => {
  it('parses YYYY-MM-DD, HH:mm:ss', () => {
    const d = parseDate('2026-06-22, 17:22:32');

    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(22);
    expect(d.getHours()).toBe(17);
    expect(d.getMinutes()).toBe(22);
    expect(d.getSeconds()).toBe(32);
  });

  it('throws on bad format', () => {
    expect(() => parseDate('22/06/2026 17:22')).toThrow();
  });
});

describe('parseDuration', () => {
  it('parses HH:mmh to minutes', () => {
    expect(parseDuration('00:53h')).toBe(53);
    expect(parseDuration('01:13h')).toBe(73);
  });

  it('throws on bad format', () => {
    expect(() => parseDuration('53 min')).toThrow();
  });
});

describe('parseMemberName', () => {
  it('detects leader', () => {
    expect(parseMemberName('Eismagier (Leader)')).toEqual({
      name: 'Eismagier',
      isLeader: true,
    });
  });

  it('parses plain member', () => {
    expect(parseMemberName('Arizoka')).toEqual({
      name: 'Arizoka',
      isLeader: false,
    });
  });
});
