import { BadGatewayException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TibiaService } from './tibia.service';

function makeConfig(): ConfigService {
  return {
    get: jest.fn().mockReturnValue('https://tibia.test'),
  } as unknown as ConfigService;
}

describe('TibiaService', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it('returns the normalized character on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => ({
        character: {
          character: {
            name: 'Bobeek',
            sex: 'male',
            vocation: 'Elder Druid',
            level: 3067,
            world: 'Bona',
            extra: 'ignored',
          },
        },
      }),
    });

    const service = new TibiaService(makeConfig());
    await expect(service.fetchCharacter('Bobeek')).resolves.toEqual({
      name: 'Bobeek',
      sex: 'male',
      vocation: 'Elder Druid',
      level: 3067,
      world: 'Bona',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://tibia.test/v4/character/Bobeek',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it('throws NotFound when the character name is empty', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => ({ character: { character: { name: '' } } }),
    });

    const service = new TibiaService(makeConfig());
    await expect(service.fetchCharacter('Ghost')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws BadGateway when the upstream is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });

    const service = new TibiaService(makeConfig());
    await expect(service.fetchCharacter('Bobeek')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('throws BadGateway when fetch rejects', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network'));

    const service = new TibiaService(makeConfig());
    await expect(service.fetchCharacter('Bobeek')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});
