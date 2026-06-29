import { SOLO_RAW, PARTY_RAW } from './fixtures';
import { detectType, toLines } from './tokenizer';

describe('toLines', () => {
  it('trims and drops empty lines', () => {
    expect(toLines('a\n\n  b  \n')).toEqual(['a', 'b']);
  });
});

describe('detectType', () => {
  it('detects solo', () => {
    expect(detectType(toLines(SOLO_RAW))).toBe('SOLO');
  });

  it('detects party', () => {
    expect(detectType(toLines(PARTY_RAW))).toBe('PARTY');
  });

  it('throws on garbage', () => {
    expect(() => detectType(toLines('hello world'))).toThrow(
      'Unrecognized analyzer format',
    );
  });
});
