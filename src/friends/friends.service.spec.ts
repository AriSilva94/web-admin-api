import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { FriendsService, orderPair } from './friends.service';

function makePrisma() {
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    friendship: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    friendRequest: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    huntShare: {
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(async (operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
  };

  return prisma;
}

describe('orderPair', () => {
  it('orders user IDs lexicographically', () => {
    expect(orderPair('b', 'a')).toEqual(['a', 'b']);
    expect(orderPair('a', 'b')).toEqual(['a', 'b']);
  });
});

describe('FriendsService', () => {
  describe('areFriends', () => {
    it('uses the ordered compound key', async () => {
      const prisma = makePrisma();
      prisma.friendship.findUnique.mockResolvedValue({ id: 'friendship-1' });

      await expect(
        new FriendsService(prisma as never).areFriends('user-b', 'user-a'),
      ).resolves.toBe(true);
      expect(prisma.friendship.findUnique).toHaveBeenCalledWith({
        where: {
          userAId_userBId: { userAId: 'user-a', userBId: 'user-b' },
        },
      });
    });
  });

  describe('sendRequest', () => {
    it('rejects a request to the same user', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'me@example.com',
      });

      await expect(
        new FriendsService(prisma as never).sendRequest(
          'user-1',
          'me@example.com',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an unknown email', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        new FriendsService(prisma as never).sendRequest(
          'user-1',
          'unknown@example.com',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects users who are already friends', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        email: 'friend@example.com',
      });
      prisma.friendship.findUnique.mockResolvedValue({ id: 'friendship-1' });

      await expect(
        new FriendsService(prisma as never).sendRequest(
          'user-1',
          'friend@example.com',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects an existing pending request', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        email: 'friend@example.com',
      });
      prisma.friendship.findUnique.mockResolvedValue(null);
      prisma.friendRequest.findUnique.mockResolvedValue({
        id: 'request-1',
        status: 'PENDING',
      });

      await expect(
        new FriendsService(prisma as never).sendRequest(
          'user-1',
          'friend@example.com',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a pending request in the opposite direction', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        email: 'friend@example.com',
      });
      prisma.friendship.findUnique.mockResolvedValue(null);
      prisma.friendRequest.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'request-2', status: 'PENDING' });

      await expect(
        new FriendsService(prisma as never).sendRequest(
          'user-1',
          'friend@example.com',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates and maps a new request', async () => {
      const createdAt = new Date('2026-06-24T12:00:00Z');
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        email: 'friend@example.com',
      });
      prisma.friendship.findUnique.mockResolvedValue(null);
      prisma.friendRequest.findUnique.mockResolvedValue(null);
      prisma.friendRequest.create.mockResolvedValue({
        id: 'request-1',
        fromUserId: 'user-1',
        toUserId: 'user-2',
        status: 'PENDING',
        createdAt,
        fromUser: { email: 'sender@example.com' },
      });

      await expect(
        new FriendsService(prisma as never).sendRequest(
          'user-1',
          'friend@example.com',
        ),
      ).resolves.toEqual({
        id: 'request-1',
        fromUserId: 'user-1',
        toUserId: 'user-2',
        fromEmail: 'sender@example.com',
        status: 'PENDING',
        createdAt,
      });
      expect(prisma.friendRequest.create).toHaveBeenCalledWith({
        data: { fromUserId: 'user-1', toUserId: 'user-2' },
        include: { fromUser: { select: { email: true } } },
      });
    });

    it('reopens a rejected request', async () => {
      const prisma = makePrisma();
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        email: 'friend@example.com',
      });
      prisma.friendship.findUnique.mockResolvedValue(null);
      prisma.friendRequest.findUnique.mockResolvedValue({
        id: 'request-1',
        status: 'REJECTED',
      });
      prisma.friendRequest.update.mockResolvedValue({
        id: 'request-1',
        fromUserId: 'user-1',
        toUserId: 'user-2',
        status: 'PENDING',
        createdAt: new Date('2026-06-24T12:00:00Z'),
        fromUser: { email: 'sender@example.com' },
      });

      await new FriendsService(prisma as never).sendRequest(
        'user-1',
        'friend@example.com',
      );

      expect(prisma.friendRequest.update).toHaveBeenCalledWith({
        where: { id: 'request-1' },
        data: { status: 'PENDING' },
        include: { fromUser: { select: { email: true } } },
      });
    });
  });

  describe('incomingRequests', () => {
    it('lists pending requests with sender email', async () => {
      const createdAt = new Date('2026-06-24T12:00:00Z');
      const prisma = makePrisma();
      prisma.friendRequest.findMany.mockResolvedValue([
        {
          id: 'request-1',
          fromUserId: 'user-1',
          toUserId: 'user-2',
          status: 'PENDING',
          createdAt,
          fromUser: { email: 'sender@example.com' },
        },
      ]);

      await expect(
        new FriendsService(prisma as never).incomingRequests('user-2'),
      ).resolves.toEqual([
        {
          id: 'request-1',
          fromUserId: 'user-1',
          toUserId: 'user-2',
          fromEmail: 'sender@example.com',
          status: 'PENDING',
          createdAt,
        },
      ]);
    });
  });

  describe('accept', () => {
    it('rejects a request not addressed to the user', async () => {
      const prisma = makePrisma();
      prisma.friendRequest.findUnique.mockResolvedValue({
        id: 'request-1',
        fromUserId: 'user-1',
        toUserId: 'other-user',
        status: 'PENDING',
      });

      await expect(
        new FriendsService(prisma as never).accept('user-2', 'request-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a request that is not pending', async () => {
      const prisma = makePrisma();
      prisma.friendRequest.findUnique.mockResolvedValue({
        id: 'request-1',
        fromUserId: 'user-1',
        toUserId: 'user-2',
        status: 'REJECTED',
      });

      await expect(
        new FriendsService(prisma as never).accept('user-2', 'request-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts the request and creates an ordered friendship atomically', async () => {
      const prisma = makePrisma();
      prisma.friendRequest.findUnique.mockResolvedValue({
        id: 'request-1',
        fromUserId: 'user-b',
        toUserId: 'user-a',
        status: 'PENDING',
      });
      prisma.friendRequest.update.mockResolvedValue({});
      prisma.friendship.create.mockResolvedValue({});

      await expect(
        new FriendsService(prisma as never).accept('user-a', 'request-1'),
      ).resolves.toEqual({ success: true });
      expect(prisma.friendship.create).not.toHaveBeenCalled();
      expect(prisma.friendship.findUnique).not.toHaveBeenCalled();
      expect(prisma.friendship.delete).not.toHaveBeenCalled();
      expect(prisma.friendship.upsert).toHaveBeenCalledWith({
        where: { userAId_userBId: { userAId: 'user-a', userBId: 'user-b' } },
        update: {},
        create: { userAId: 'user-a', userBId: 'user-b' },
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('reject', () => {
    it('rejects a request not addressed to the user', async () => {
      const prisma = makePrisma();
      prisma.friendRequest.findUnique.mockResolvedValue(null);

      await expect(
        new FriendsService(prisma as never).reject('user-2', 'request-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('marks the request as rejected', async () => {
      const prisma = makePrisma();
      prisma.friendRequest.findUnique.mockResolvedValue({
        id: 'request-1',
        toUserId: 'user-2',
        status: 'PENDING',
      });
      prisma.friendRequest.update.mockResolvedValue({});

      await new FriendsService(prisma as never).reject('user-2', 'request-1');

      expect(prisma.friendRequest.update).toHaveBeenCalledWith({
        where: { id: 'request-1' },
        data: { status: 'REJECTED' },
      });
    });

    it('rejects a request that is no longer pending', async () => {
      const prisma = makePrisma();
      prisma.friendRequest.findUnique.mockResolvedValue({
        id: 'request-1',
        toUserId: 'user-2',
        status: 'ACCEPTED',
      });

      await expect(
        new FriendsService(prisma as never).reject('user-2', 'request-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('listFriends', () => {
    it('maps the opposite user from each friendship', async () => {
      const createdAt = new Date('2026-06-24T12:00:00Z');
      const prisma = makePrisma();
      prisma.friendship.findMany.mockResolvedValue([
        {
          id: 'friendship-1',
          userAId: 'user-1',
          userBId: 'user-2',
          createdAt,
          userA: {
            id: 'user-1',
            email: 'me@example.com',
            displayName: 'Me',
          },
          userB: {
            id: 'user-2',
            email: 'friend@example.com',
            displayName: 'Friend',
          },
        },
      ]);

      await expect(
        new FriendsService(prisma as never).listFriends('user-1'),
      ).resolves.toEqual([
        {
          id: 'friendship-1',
          userId: 'user-2',
          email: 'friend@example.com',
          displayName: 'Friend',
          since: createdAt,
        },
      ]);
    });
  });

  describe('removeFriend', () => {
    it('does not expose another users friendship', async () => {
      const prisma = makePrisma();
      prisma.friendship.findUnique.mockResolvedValue({
        id: 'friendship-1',
        userAId: 'user-1',
        userBId: 'user-2',
      });

      await expect(
        new FriendsService(prisma as never).removeFriend(
          'user-3',
          'friendship-1',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deletes a friendship belonging to the user', async () => {
      const prisma = makePrisma();
      prisma.friendship.findUnique.mockResolvedValue({
        id: 'friendship-1',
        userAId: 'user-1',
        userBId: 'user-2',
      });
      prisma.friendship.delete.mockResolvedValue({});

      await new FriendsService(prisma as never).removeFriend(
        'user-1',
        'friendship-1',
      );

      expect(prisma.friendship.delete).toHaveBeenCalledWith({
        where: { id: 'friendship-1' },
      });
      expect(prisma.huntShare.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { sharedWithId: 'user-2', hunt: { ownerId: 'user-1' } },
            { sharedWithId: 'user-1', hunt: { ownerId: 'user-2' } },
          ],
        },
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });
});
