import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { paginate, parsePagination } from '../common/pagination';
import { FriendsService } from '../friends/friends.service';
import { HUNT_INCLUDE, toResponse } from '../hunts/hunts.mapper';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SharingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly friends: FriendsService,
  ) {}

  async share(ownerId: string, huntId: string, targetUserId: string) {
    await this.assertOwner(ownerId, huntId);

    if (!(await this.friends.areFriends(ownerId, targetUserId))) {
      throw new BadRequestException('You can only share with friends');
    }

    const existing = await this.prisma.huntShare.findUnique({
      where: {
        huntId_sharedWithId: { huntId, sharedWithId: targetUserId },
      },
    });
    if (existing) {
      throw new ConflictException('Already shared with this user');
    }

    const share = await this.prisma.huntShare.create({
      data: { huntId, sharedWithId: targetUserId },
    });
    return {
      id: share.id,
      huntId: share.huntId,
      sharedWithId: share.sharedWithId,
      createdAt: share.createdAt,
    };
  }

  async unshare(ownerId: string, huntId: string, targetUserId: string) {
    await this.assertOwner(ownerId, huntId);
    await this.prisma.huntShare
      .delete({
        where: {
          huntId_sharedWithId: { huntId, sharedWithId: targetUserId },
        },
      })
      .catch(() => undefined);
  }

  async listShared(
    userId: string,
    query: { page?: number; pageSize?: number },
  ) {
    const { page, pageSize, skip, take } = parsePagination(query);
    const [shares, total] = await this.prisma.$transaction([
      this.prisma.huntShare.findMany({
        where: { sharedWithId: userId },
        include: { hunt: { include: HUNT_INCLUDE } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.huntShare.count({ where: { sharedWithId: userId } }),
    ]);

    return paginate(
      shares.map((share) => toResponse(share.hunt)),
      total,
      page,
      pageSize,
    );
  }

  private async assertOwner(ownerId: string, huntId: string) {
    const hunt = await this.prisma.hunt.findUnique({
      where: { id: huntId },
      select: { ownerId: true },
    });
    if (!hunt || hunt.ownerId !== ownerId) {
      throw new NotFoundException('Hunt not found');
    }
  }
}
