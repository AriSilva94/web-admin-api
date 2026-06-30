import { ConflictException, NotFoundException } from '@nestjs/common';
import { CharactersService } from './characters.service';
import type { TibiaService } from '../tibia/tibia.service';

const SNAPSHOT = {
  name: 'Bobeek',
  sex: 'male',
  vocation: 'Elder Druid',
  level: 3067,
  world: 'Bona',
};

function makePrisma() {
  return {
    character: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

function makeTibia(): TibiaService {
  return {
    fetchCharacter: jest.fn().mockResolvedValue(SNAPSHOT),
  } as unknown as TibiaService;
}

describe('CharactersService', () => {
  describe('add', () => {
    it('persists a verified snapshot for the owner', async () => {
      const prisma = makePrisma();
      prisma.character.count.mockResolvedValue(0);
      prisma.character.findFirst.mockResolvedValue(null);
      prisma.character.create.mockResolvedValue({ id: 'c1', ...SNAPSHOT });
      const service = new CharactersService(prisma as never, makeTibia());

      const result = await service.add('user-1', 'Bobeek');

      expect(result).toMatchObject({ id: 'c1', name: 'Bobeek', level: 3067 });
      expect(prisma.character.create).toHaveBeenCalledWith({
        data: { ownerId: 'user-1', ...SNAPSHOT },
      });
    });

    it('rejects when the owner already has 10 characters', async () => {
      const prisma = makePrisma();
      prisma.character.count.mockResolvedValue(10);
      const service = new CharactersService(prisma as never, makeTibia());

      await expect(service.add('user-1', 'Bobeek')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.character.create).not.toHaveBeenCalled();
    });

    it('rejects a duplicate name for the same owner', async () => {
      const prisma = makePrisma();
      prisma.character.count.mockResolvedValue(1);
      prisma.character.findFirst.mockResolvedValue({ id: 'existing' });
      const service = new CharactersService(prisma as never, makeTibia());

      await expect(service.add('user-1', 'Bobeek')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('refresh', () => {
    it('re-fetches and updates an owned character', async () => {
      const prisma = makePrisma();
      prisma.character.findFirst.mockResolvedValue({
        id: 'c1',
        name: 'Bobeek',
      });
      prisma.character.update.mockResolvedValue({ id: 'c1', ...SNAPSHOT });
      const service = new CharactersService(prisma as never, makeTibia());

      const result = await service.refresh('user-1', 'c1');

      expect(result).toMatchObject({ level: 3067 });
      expect(prisma.character.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: {
          sex: SNAPSHOT.sex,
          vocation: SNAPSHOT.vocation,
          level: SNAPSHOT.level,
          world: SNAPSHOT.world,
        },
      });
    });

    it('throws 404 when the character is not owned', async () => {
      const prisma = makePrisma();
      prisma.character.findFirst.mockResolvedValue(null);
      const service = new CharactersService(prisma as never, makeTibia());

      await expect(service.refresh('user-1', 'c1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('throws 404 when the character is not owned', async () => {
      const prisma = makePrisma();
      prisma.character.findFirst.mockResolvedValue(null);
      const service = new CharactersService(prisma as never, makeTibia());

      await expect(service.remove('user-1', 'c1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
