import { AnalyzerValidationError } from '../analyzer.errors';
import { PARTY_RAW, SOLO_RAW } from './fixtures';
import { parseAnalyzer } from './parse-analyzer';

describe('parseAnalyzer - solo', () => {
  it('parses a valid solo analyzer', () => {
    const result = parseAnalyzer(SOLO_RAW);

    expect(result.type).toBe('SOLO');
    expect(result.sessionDurationMinutes).toBe(53);
    expect(result.solo?.xpGain).toBe(9827031n);
    expect(result.solo?.loot).toBe(1553582n);
    expect(result.solo?.killedMonsters).toHaveLength(3);
    expect(result.solo?.killedMonsters[0]).toEqual({
      name: 'cobra assassin',
      count: 460,
    });
    expect(result.solo?.lootedItems).toHaveLength(3);
    expect(result.raw).toBe(SOLO_RAW);
  });
});

describe('parseAnalyzer - party', () => {
  it('parses a valid party analyzer', () => {
    const result = parseAnalyzer(PARTY_RAW);

    expect(result.type).toBe('PARTY');
    expect(result.sessionDurationMinutes).toBe(73);
    expect(result.party?.lootType).toBe('Market');
    expect(result.party?.totalBalance).toBe(2269910n);
    expect(result.party?.members).toHaveLength(3);
  });

  it('detects the leader', () => {
    const result = parseAnalyzer(PARTY_RAW);
    const leader = result.party?.members.find((member) => member.isLeader);

    expect(leader?.name).toBe('Eismagier');
    expect(
      result.party?.members.filter((member) => member.isLeader),
    ).toHaveLength(1);
  });
});

describe('parseAnalyzer - negative balance', () => {
  it('parses negative member balance', () => {
    const raw = PARTY_RAW.replace('Balance: 945,039', 'Balance: -945,039');
    const result = parseAnalyzer(raw);
    const arizoka = result.party?.members.find(
      (member) => member.name === 'Arizoka',
    );

    expect(arizoka?.balance).toBe(-945039n);
  });
});

describe('parseAnalyzer - invalid', () => {
  it('rejects unrecognized format', () => {
    expect(() => parseAnalyzer('just some text')).toThrow(
      AnalyzerValidationError,
    );
  });

  it('rejects solo missing a required field', () => {
    const raw = SOLO_RAW.split('\n')
      .filter((line) => !line.startsWith('XP Gain:'))
      .join('\n');

    expect(() => parseAnalyzer(raw)).toThrow(AnalyzerValidationError);
  });

  it('rejects malformed number', () => {
    const raw = SOLO_RAW.replace('Loot: 1,553,582', 'Loot: abc');

    expect(() => parseAnalyzer(raw)).toThrow(AnalyzerValidationError);
  });

  it('rejects an unknown extra line', () => {
    expect(() => parseAnalyzer(`${SOLO_RAW}\nMystery Field: 123`)).toThrow(
      AnalyzerValidationError,
    );
  });

  it('reports detailed issues', () => {
    const raw = SOLO_RAW.replace('Loot: 1,553,582', 'Loot: abc');

    try {
      parseAnalyzer(raw);
      fail('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AnalyzerValidationError);
      expect((error as AnalyzerValidationError).issues.length).toBeGreaterThan(
        0,
      );
    }
  });
});
