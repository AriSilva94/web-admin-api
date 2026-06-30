import { createHuntSchema } from './create-hunt.dto';
import { listHuntsSchema } from './list-hunts.dto';
import { updateHuntSchema } from './update-hunt.dto';

describe('createHuntSchema', () => {
  it('accepts the minimum payload and defaults visibility', () => {
    expect(
      createHuntSchema.parse({ raw: 'Session data', characterId: 'c1' }),
    ).toEqual({
      raw: 'Session data',
      characterId: 'c1',
      visibility: 'PRIVATE',
    });
  });

  it('accepts valid metadata', () => {
    const payload = {
      raw: 'Session data',
      characterId: 'c1',
      title: 'Cobra hunt',
      huntingSpot: 'Cobra Bastion',
      tags: ['profit'],
      notes: 'Clean session',
      visibility: 'FRIENDS' as const,
    };

    expect(createHuntSchema.parse(payload)).toEqual(payload);
  });

  it('rejects empty raw data and invalid metadata', () => {
    expect(() =>
      createHuntSchema.parse({ raw: '', level: 0, visibility: 'PUBLIC' }),
    ).toThrow();
  });
});

describe('updateHuntSchema', () => {
  it('accepts nullable metadata fields', () => {
    const payload = {
      huntingSpot: null,
      characterName: null,
      vocation: null,
      level: null,
      notes: null,
    };

    expect(updateHuntSchema.parse(payload)).toEqual(payload);
  });

  it('rejects analyzer and stats fields', () => {
    expect(() => updateHuntSchema.parse({ raw: 'changed' })).toThrow();
    expect(() => updateHuntSchema.parse({ totalLoot: '1000' })).toThrow();
  });
});

describe('listHuntsSchema', () => {
  it('coerces pagination query values from strings', () => {
    expect(
      listHuntsSchema.parse({
        type: 'SOLO',
        page: '2',
        pageSize: '50',
        tags: 'profit,solo',
      }),
    ).toEqual({ type: 'SOLO', page: 2, pageSize: 50, tags: 'profit,solo' });
  });

  it('rejects invalid enums and non-positive pagination', () => {
    expect(() => listHuntsSchema.parse({ type: 'DUO' })).toThrow();
    expect(() => listHuntsSchema.parse({ page: '0' })).toThrow();
    expect(() => listHuntsSchema.parse({ pageSize: '1.5' })).toThrow();
  });

  it('aceita datas ISO e rejeita filtros de data inválidos', () => {
    expect(
      listHuntsSchema.parse({
        from: '2026-06-01',
        to: '2026-06-30T23:59:59Z',
      }),
    ).toMatchObject({ from: '2026-06-01', to: '2026-06-30T23:59:59Z' });
    expect(() => listHuntsSchema.parse({ from: 'not-a-date' })).toThrow();
    expect(() => listHuntsSchema.parse({ to: '2026-13-40' })).toThrow();
  });
});
