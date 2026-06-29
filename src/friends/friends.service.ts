import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export function orderPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

@Injectable()
export class FriendsService {
  constructor(private readonly prisma: PrismaService) {}

  async areFriends(a: string, b: string): Promise<boolean> {
    const [userAId, userBId] = orderPair(a, b);
    const friendship = await this.prisma.friendship.findUnique({
      where: {
        userAId_userBId: { userAId, userBId },
      },
    });

    return Boolean(friendship);
  }

  async sendRequest(fromUserId: string, email: string) {
    const target = await this.prisma.user.findUnique({ where: { email } });
    if (!target) {
      throw new NotFoundException('User not found');
    }
    if (target.id === fromUserId) {
      throw new BadRequestException('Cannot friend yourself');
    }
    if (await this.areFriends(fromUserId, target.id)) {
      throw new ConflictException('Already friends');
    }

    const existing = await this.prisma.friendRequest.findUnique({
      where: {
        fromUserId_toUserId: { fromUserId, toUserId: target.id },
      },
    });
    if (existing?.status === 'PENDING') {
      throw new ConflictException('Request already pending');
    }

    const reverse = await this.prisma.friendRequest.findUnique({
      where: {
        fromUserId_toUserId: {
          fromUserId: target.id,
          toUserId: fromUserId,
        },
      },
    });
    if (reverse?.status === 'PENDING') {
      throw new ConflictException('Request already pending');
    }

    const request = existing
      ? await this.prisma.friendRequest.update({
          where: { id: existing.id },
          data: { status: 'PENDING' },
          include: { fromUser: { select: { email: true } } },
        })
      : await this.prisma.friendRequest.create({
          data: { fromUserId, toUserId: target.id },
          include: { fromUser: { select: { email: true } } },
        });

    return {
      id: request.id,
      fromUserId: request.fromUserId,
      toUserId: request.toUserId,
      fromEmail: request.fromUser.email,
      status: request.status,
      createdAt: request.createdAt,
    };
  }

  async incomingRequests(userId: string) {
    const requests = await this.prisma.friendRequest.findMany({
      where: { toUserId: userId, status: 'PENDING' },
      include: { fromUser: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((request) => ({
      id: request.id,
      fromUserId: request.fromUserId,
      toUserId: request.toUserId,
      fromEmail: request.fromUser.email,
      status: request.status,
      createdAt: request.createdAt,
    }));
  }

  async accept(userId: string, requestId: string) {
    const request = await this.prisma.friendRequest.findUnique({
      where: { id: requestId },
    });
    if (!request || request.toUserId !== userId) {
      throw new NotFoundException('Request not found');
    }
    if (request.status !== 'PENDING') {
      throw new BadRequestException('Request not pending');
    }

    const [userAId, userBId] = orderPair(request.fromUserId, request.toUserId);
    await this.prisma.$transaction([
      this.prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: 'ACCEPTED' },
      }),
      this.prisma.friendship.upsert({
        where: { userAId_userBId: { userAId, userBId } },
        update: {},
        create: { userAId, userBId },
      }),
    ]);

    return { success: true };
  }

  async reject(userId: string, requestId: string) {
    const request = await this.prisma.friendRequest.findUnique({
      where: { id: requestId },
    });
    if (!request || request.toUserId !== userId) {
      throw new NotFoundException('Request not found');
    }
    if (request.status !== 'PENDING') {
      throw new BadRequestException('Request not pending');
    }

    await this.prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED' },
    });
  }

  async listFriends(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      include: {
        userA: { select: { id: true, email: true, displayName: true } },
        userB: { select: { id: true, email: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return friendships.map((friendship) => {
      const friend =
        friendship.userAId === userId ? friendship.userB : friendship.userA;

      return {
        id: friendship.id,
        userId: friend.id,
        email: friend.email,
        displayName: friend.displayName,
        since: friendship.createdAt,
      };
    });
  }

  async removeFriend(userId: string, friendshipId: string) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: friendshipId },
    });
    if (
      !friendship ||
      (friendship.userAId !== userId && friendship.userBId !== userId)
    ) {
      throw new NotFoundException('Friendship not found');
    }

    const friendId =
      friendship.userAId === userId ? friendship.userBId : friendship.userAId;
    await this.prisma.$transaction([
      this.prisma.huntShare.deleteMany({
        where: {
          OR: [
            { sharedWithId: friendId, hunt: { ownerId: userId } },
            { sharedWithId: userId, hunt: { ownerId: friendId } },
          ],
        },
      }),
      this.prisma.friendship.delete({ where: { id: friendshipId } }),
    ]);
  }
}
