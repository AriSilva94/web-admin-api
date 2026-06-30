import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AnalyzerValidationError } from '../analyzer/analyzer.errors';
import { parseAnalyzer } from '../analyzer/parser/parse-analyzer';
import { ParsedAnalyzer } from '../analyzer/schemas/analyzer.schema';
import { paginate, parsePagination } from '../common/pagination';
import { CharactersService } from '../characters/characters.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHuntDto } from './dto/create-hunt.dto';
import { ListHuntsQuery } from './dto/list-hunts.dto';
import { UpdateHuntDto } from './dto/update-hunt.dto';
import { HUNT_INCLUDE, toCreateData, toResponse } from './hunts.mapper';

@Injectable()
export class HuntsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly characters: CharactersService,
  ) {}

  async create(ownerId: string, dto: CreateHuntDto) {
    const character = await this.characters.findOwnedById(
      ownerId,
      dto.characterId,
    );
    if (!character) {
      throw new UnprocessableEntityException({
        message: 'Select one of your characters',
        issues: [{ field: 'characterId', message: 'Character not found' }],
      });
    }

    let parsed: ParsedAnalyzer;
    try {
      parsed = parseAnalyzer(dto.raw);
    } catch (error) {
      if (error instanceof AnalyzerValidationError) {
        throw new UnprocessableEntityException({
          message: 'Invalid analyzer',
          issues: error.issues,
        });
      }
      throw error;
    }

    const data = toCreateData(
      parsed,
      {
        ...dto,
        characterName: character.name,
        vocation: character.vocation,
        level: character.level,
      },
      ownerId,
    );
    data.character = { connect: { id: character.id } };

    const hunt = await this.prisma.hunt.create({
      data,
      include: HUNT_INCLUDE,
    });
    return toResponse(hunt);
  }

  async list(ownerId: string, query: ListHuntsQuery) {
    const { page, pageSize, skip, take } = parsePagination(query);
    const where: Prisma.HuntWhereInput = { ownerId };

    if (query.type) where.type = query.type;
    if (query.visibility) where.visibility = query.visibility;
    if (query.huntingSpot) {
      where.huntingSpot = {
        contains: query.huntingSpot,
        mode: 'insensitive',
      };
    }
    if (query.characterName) {
      where.characterName = {
        contains: query.characterName,
        mode: 'insensitive',
      };
    }
    if (query.from || query.to) {
      where.startedAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }
    if (query.tags) {
      const tags = query.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
      if (tags.length > 0) where.tags = { hasEvery: tags };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.hunt.findMany({
        where,
        include: HUNT_INCLUDE,
        orderBy: { startedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.hunt.count({ where }),
    ]);

    return paginate(rows.map(toResponse), total, page, pageSize);
  }

  async getById(userId: string, id: string) {
    const hunt = await this.prisma.hunt.findUnique({
      where: { id },
      include: HUNT_INCLUDE,
    });
    if (!hunt) throw new NotFoundException('Hunt not found');

    const isShared = hunt.shares.some((share) => share.sharedWithId === userId);
    if (hunt.ownerId !== userId && !isShared) {
      throw new NotFoundException('Hunt not found');
    }

    return toResponse(hunt);
  }

  async update(userId: string, id: string, dto: UpdateHuntDto) {
    await this.assertOwner(userId, id);
    const hunt = await this.prisma.hunt.update({
      where: { id },
      data: dto,
      include: HUNT_INCLUDE,
    });
    return toResponse(hunt);
  }

  async remove(userId: string, id: string) {
    await this.assertOwner(userId, id);
    await this.prisma.hunt.delete({ where: { id } });
  }

  private async assertOwner(userId: string, id: string) {
    const hunt = await this.prisma.hunt.findUnique({
      where: { id },
      select: { ownerId: true },
    });
    if (!hunt || hunt.ownerId !== userId) {
      throw new NotFoundException('Hunt not found');
    }
  }
}
