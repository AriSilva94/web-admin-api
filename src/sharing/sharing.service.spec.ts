import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { SharingService } from './sharing.service';

function makeDependencies(areFriends = true) {
  const prisma = {
    hunt: { findUnique: jest.fn() },
    huntShare: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(async (operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
  };
  const friends = {
    areFriends: jest.fn().mockResolvedValue(areFriends),
  };

  return { prisma, friends };
}

describe('SharingService.share', () => {
  it('não expõe uma hunt que não pertence ao usuário', async () => {
    const { prisma, friends } = makeDependencies();
    prisma.hunt.findUnique.mockResolvedValue({ ownerId: 'other' });
    const service = new SharingService(prisma as never, friends as never);

    await expect(service.share('u1', 'h1', 'u2')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('permite compartilhar somente com amigos', async () => {
    const { prisma, friends } = makeDependencies(false);
    prisma.hunt.findUnique.mockResolvedValue({ ownerId: 'u1' });
    const service = new SharingService(prisma as never, friends as never);

    await expect(service.share('u1', 'h1', 'u2')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejeita um compartilhamento duplicado', async () => {
    const { prisma, friends } = makeDependencies();
    prisma.hunt.findUnique.mockResolvedValue({ ownerId: 'u1' });
    prisma.huntShare.findUnique.mockResolvedValue({ id: 'share-1' });
    const service = new SharingService(prisma as never, friends as never);

    await expect(service.share('u1', 'h1', 'u2')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('cria o compartilhamento com a chave esperada', async () => {
    const createdAt = new Date('2026-06-24T12:00:00Z');
    const { prisma, friends } = makeDependencies();
    prisma.hunt.findUnique.mockResolvedValue({ ownerId: 'u1' });
    prisma.huntShare.findUnique.mockResolvedValue(null);
    prisma.huntShare.create.mockResolvedValue({
      id: 'share-1',
      huntId: 'h1',
      sharedWithId: 'u2',
      createdAt,
    });
    const service = new SharingService(prisma as never, friends as never);

    await expect(service.share('u1', 'h1', 'u2')).resolves.toEqual({
      id: 'share-1',
      huntId: 'h1',
      sharedWithId: 'u2',
      createdAt,
    });
    expect(prisma.huntShare.create).toHaveBeenCalledWith({
      data: { huntId: 'h1', sharedWithId: 'u2' },
    });
  });
});
