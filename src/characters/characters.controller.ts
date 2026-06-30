import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  createCharacterSchema,
  type CreateCharacterDto,
} from './dto/create-character.dto';
import { CharactersService } from './characters.service';

@Controller('characters')
@UseGuards(JwtAuthGuard)
export class CharactersController {
  constructor(private readonly characters: CharactersService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createCharacterSchema)) dto: CreateCharacterDto,
  ) {
    return this.characters.add(user.userId, dto.name);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.characters.list(user.userId);
  }

  @Post(':id/refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.characters.refresh(user.userId, id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.characters.remove(user.userId, id);
  }
}
