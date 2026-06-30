import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TibiaService } from '../tibia/tibia.service';

const MAX_CHARACTERS = 10;

@Injectable()
export class CharactersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tibia: TibiaService,
  ) {}

  async add(ownerId: string, name: string) {
    const snapshot = await this.tibia.fetchCharacter(name);

    const count = await this.prisma.character.count({ where: { ownerId } });
    if (count >= MAX_CHARACTERS) {
      throw new ConflictException(
        `An account can have at most ${MAX_CHARACTERS} characters`,
      );
    }

    const existing = await this.prisma.character.findFirst({
      where: { ownerId, name: snapshot.name },
    });
    if (existing) {
      throw new ConflictException('Character already added to this account');
    }

    return this.prisma.character.create({
      data: { ownerId, ...snapshot },
    });
  }

  list(ownerId: string) {
    return this.prisma.character.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async refresh(ownerId: string, id: string) {
    const character = await this.findOwned(ownerId, id);
    const snapshot = await this.tibia.fetchCharacter(character.name);
    return this.prisma.character.update({
      where: { id: character.id },
      data: {
        sex: snapshot.sex,
        vocation: snapshot.vocation,
        level: snapshot.level,
        world: snapshot.world,
      },
    });
  }

  async remove(ownerId: string, id: string) {
    const character = await this.findOwned(ownerId, id);
    await this.prisma.character.delete({ where: { id: character.id } });
  }

  /** Used by HuntsService to validate the selected character. */
  findOwnedById(ownerId: string, id: string) {
    return this.prisma.character.findFirst({ where: { id, ownerId } });
  }

  private async findOwned(ownerId: string, id: string) {
    const character = await this.prisma.character.findFirst({
      where: { id, ownerId },
    });
    if (!character) {
      throw new NotFoundException('Character not found');
    }
    return character;
  }
}
