-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "HuntType" AS ENUM ('SOLO', 'PARTY');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PRIVATE', 'FRIENDS');

-- CreateEnum
CREATE TYPE "FriendRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hunt" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "type" "HuntType" NOT NULL,
    "title" TEXT NOT NULL,
    "huntingSpot" TEXT,
    "characterName" TEXT,
    "vocation" TEXT,
    "level" INTEGER,
    "tags" TEXT[],
    "notes" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "rawAnalyzer" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "sessionDurationMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hunt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoloHuntStats" (
    "id" TEXT NOT NULL,
    "huntId" TEXT NOT NULL,
    "rawXpGain" BIGINT NOT NULL,
    "xpGain" BIGINT NOT NULL,
    "rawXpPerHour" BIGINT NOT NULL,
    "xpPerHour" BIGINT NOT NULL,
    "loot" BIGINT NOT NULL,
    "supplies" BIGINT NOT NULL,
    "balance" BIGINT NOT NULL,
    "damage" BIGINT NOT NULL,
    "damagePerHour" BIGINT NOT NULL,
    "healing" BIGINT NOT NULL,
    "healingPerHour" BIGINT NOT NULL,

    CONSTRAINT "SoloHuntStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyHuntStats" (
    "id" TEXT NOT NULL,
    "huntId" TEXT NOT NULL,
    "lootType" TEXT NOT NULL,
    "totalLoot" BIGINT NOT NULL,
    "totalSupplies" BIGINT NOT NULL,
    "totalBalance" BIGINT NOT NULL,

    CONSTRAINT "PartyHuntStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyMemberStats" (
    "id" TEXT NOT NULL,
    "partyStatsId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isLeader" BOOLEAN NOT NULL DEFAULT false,
    "loot" BIGINT NOT NULL,
    "supplies" BIGINT NOT NULL,
    "balance" BIGINT NOT NULL,
    "damage" BIGINT NOT NULL,
    "healing" BIGINT NOT NULL,

    CONSTRAINT "PartyMemberStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KilledMonster" (
    "id" TEXT NOT NULL,
    "huntId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "KilledMonster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LootedItem" (
    "id" TEXT NOT NULL,
    "huntId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "LootedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FriendRequest" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "status" "FriendRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FriendRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HuntShare" (
    "id" TEXT NOT NULL,
    "huntId" TEXT NOT NULL,
    "sharedWithId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HuntShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "Hunt_ownerId_idx" ON "Hunt"("ownerId");

-- CreateIndex
CREATE INDEX "Hunt_type_idx" ON "Hunt"("type");

-- CreateIndex
CREATE INDEX "Hunt_huntingSpot_idx" ON "Hunt"("huntingSpot");

-- CreateIndex
CREATE INDEX "Hunt_characterName_idx" ON "Hunt"("characterName");

-- CreateIndex
CREATE INDEX "Hunt_startedAt_idx" ON "Hunt"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SoloHuntStats_huntId_key" ON "SoloHuntStats"("huntId");

-- CreateIndex
CREATE UNIQUE INDEX "PartyHuntStats_huntId_key" ON "PartyHuntStats"("huntId");

-- CreateIndex
CREATE INDEX "PartyMemberStats_partyStatsId_idx" ON "PartyMemberStats"("partyStatsId");

-- CreateIndex
CREATE INDEX "KilledMonster_huntId_idx" ON "KilledMonster"("huntId");

-- CreateIndex
CREATE INDEX "LootedItem_huntId_idx" ON "LootedItem"("huntId");

-- CreateIndex
CREATE INDEX "FriendRequest_toUserId_idx" ON "FriendRequest"("toUserId");

-- CreateIndex
CREATE UNIQUE INDEX "FriendRequest_fromUserId_toUserId_key" ON "FriendRequest"("fromUserId", "toUserId");

-- CreateIndex
CREATE INDEX "Friendship_userBId_idx" ON "Friendship"("userBId");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_userAId_userBId_key" ON "Friendship"("userAId", "userBId");

-- CreateIndex
CREATE INDEX "HuntShare_sharedWithId_idx" ON "HuntShare"("sharedWithId");

-- CreateIndex
CREATE UNIQUE INDEX "HuntShare_huntId_sharedWithId_key" ON "HuntShare"("huntId", "sharedWithId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hunt" ADD CONSTRAINT "Hunt_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoloHuntStats" ADD CONSTRAINT "SoloHuntStats_huntId_fkey" FOREIGN KEY ("huntId") REFERENCES "Hunt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyHuntStats" ADD CONSTRAINT "PartyHuntStats_huntId_fkey" FOREIGN KEY ("huntId") REFERENCES "Hunt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyMemberStats" ADD CONSTRAINT "PartyMemberStats_partyStatsId_fkey" FOREIGN KEY ("partyStatsId") REFERENCES "PartyHuntStats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KilledMonster" ADD CONSTRAINT "KilledMonster_huntId_fkey" FOREIGN KEY ("huntId") REFERENCES "Hunt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LootedItem" ADD CONSTRAINT "LootedItem_huntId_fkey" FOREIGN KEY ("huntId") REFERENCES "Hunt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendRequest" ADD CONSTRAINT "FriendRequest_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendRequest" ADD CONSTRAINT "FriendRequest_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuntShare" ADD CONSTRAINT "HuntShare_huntId_fkey" FOREIGN KEY ("huntId") REFERENCES "Hunt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HuntShare" ADD CONSTRAINT "HuntShare_sharedWithId_fkey" FOREIGN KEY ("sharedWithId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
