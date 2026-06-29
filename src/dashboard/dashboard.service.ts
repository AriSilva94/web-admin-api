import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { HUNT_INCLUDE, toResponse } from '../hunts/hunts.mapper';

type DashboardHunt = Prisma.HuntGetPayload<{
  include: typeof HUNT_INCLUDE;
}>;

function balanceOf(hunt: DashboardHunt): bigint {
  return hunt.type === 'SOLO'
    ? (hunt.soloStats?.balance ?? 0n)
    : (hunt.partyStats?.totalBalance ?? 0n);
}

function lootOf(hunt: DashboardHunt): bigint {
  return hunt.type === 'SOLO'
    ? (hunt.soloStats?.loot ?? 0n)
    : (hunt.partyStats?.totalLoot ?? 0n);
}

function suppliesOf(hunt: DashboardHunt): bigint {
  return hunt.type === 'SOLO'
    ? (hunt.soloStats?.supplies ?? 0n)
    : (hunt.partyStats?.totalSupplies ?? 0n);
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(userId: string) {
    const hunts = await this.prisma.hunt.findMany({
      where: { ownerId: userId },
      include: HUNT_INCLUDE,
      orderBy: { startedAt: 'desc' },
    });

    let totalProfit = 0n;
    let totalLoot = 0n;
    let totalSupplies = 0n;
    let soloCount = 0;
    let partyCount = 0;
    let best: { id: string; title: string; balance: bigint } | null = null;
    const spots = new Map<string, number>();

    for (const hunt of hunts) {
      const balance = balanceOf(hunt);
      totalProfit += balance;
      totalLoot += lootOf(hunt);
      totalSupplies += suppliesOf(hunt);

      if (hunt.type === 'SOLO') soloCount += 1;
      else partyCount += 1;

      if (!best || balance > best.balance) {
        best = { id: hunt.id, title: hunt.title, balance };
      }

      if (hunt.huntingSpot) {
        spots.set(hunt.huntingSpot, (spots.get(hunt.huntingSpot) ?? 0) + 1);
      }
    }

    const totalHunts = hunts.length;
    const averageBalance =
      totalHunts > 0 ? totalProfit / BigInt(totalHunts) : 0n;
    const mostHuntedSpots = [...spots.entries()]
      .map(([spot, count]) => ({ spot, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalHunts,
      totalProfit: totalProfit.toString(),
      totalLoot: totalLoot.toString(),
      totalSupplies: totalSupplies.toString(),
      averageBalancePerHunt: averageBalance.toString(),
      bestHuntByBalance: best
        ? { id: best.id, title: best.title, balance: best.balance.toString() }
        : null,
      mostHuntedSpots,
      soloCount,
      partyCount,
      recentHunts: hunts.slice(0, 5).map((hunt) => toResponse(hunt)),
    };
  }
}
