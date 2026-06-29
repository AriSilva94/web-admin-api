import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { parseAnalyzer } from '../src/analyzer/parser/parse-analyzer';
import { PARTY_RAW, SOLO_RAW } from '../src/analyzer/parser/fixtures';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await argon2.hash('password123');
  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      email: 'alice@example.com',
      passwordHash,
      displayName: 'Alice',
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      email: 'bob@example.com',
      passwordHash,
      displayName: 'Bob',
    },
  });

  await prisma.hunt.deleteMany({ where: { ownerId: alice.id } });

  const solo = parseAnalyzer(SOLO_RAW);
  const { killedMonsters, lootedItems, ...soloStatFields } = solo.solo!;
  await prisma.hunt.create({
    data: {
      ownerId: alice.id,
      type: 'SOLO',
      title: 'Cobra Bastion solo',
      huntingSpot: 'Cobra Bastion',
      characterName: 'Alice',
      tags: ['cobra', 'solo'],
      visibility: 'PRIVATE',
      rawAnalyzer: solo.raw,
      startedAt: solo.startedAt,
      endedAt: solo.endedAt,
      sessionDurationMinutes: solo.sessionDurationMinutes,
      soloStats: { create: soloStatFields },
      killedMonsters: { create: killedMonsters },
      lootedItems: { create: lootedItems },
    },
  });

  const party = parseAnalyzer(PARTY_RAW);
  const partyHunt = await prisma.hunt.create({
    data: {
      ownerId: alice.id,
      type: 'PARTY',
      title: 'Party hunt',
      huntingSpot: 'Unknown',
      tags: ['party'],
      visibility: 'FRIENDS',
      rawAnalyzer: party.raw,
      startedAt: party.startedAt,
      endedAt: party.endedAt,
      sessionDurationMinutes: party.sessionDurationMinutes,
      partyStats: {
        create: {
          lootType: party.party!.lootType,
          totalLoot: party.party!.totalLoot,
          totalSupplies: party.party!.totalSupplies,
          totalBalance: party.party!.totalBalance,
          members: { create: party.party!.members },
        },
      },
    },
  });

  const [userAId, userBId] =
    alice.id < bob.id ? [alice.id, bob.id] : [bob.id, alice.id];
  await prisma.friendship.upsert({
    where: { userAId_userBId: { userAId, userBId } },
    update: {},
    create: { userAId, userBId },
  });

  await prisma.huntShare.create({
    data: { huntId: partyHunt.id, sharedWithId: bob.id },
  });

  console.log('Seed complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
