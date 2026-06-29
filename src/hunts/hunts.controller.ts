import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { createHuntSchema, type CreateHuntDto } from './dto/create-hunt.dto';
import { listHuntsSchema, type ListHuntsQuery } from './dto/list-hunts.dto';
import { updateHuntSchema, type UpdateHuntDto } from './dto/update-hunt.dto';
import { HuntsService } from './hunts.service';

@Controller('hunts')
@UseGuards(JwtAuthGuard)
export class HuntsController {
  constructor(private readonly hunts: HuntsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createHuntSchema)) dto: CreateHuntDto,
  ) {
    return this.hunts.create(user.userId, dto);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(listHuntsSchema)) query: ListHuntsQuery,
  ) {
    return this.hunts.list(user.userId, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.hunts.getById(user.userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateHuntSchema)) dto: UpdateHuntDto,
  ) {
    return this.hunts.update(user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.hunts.remove(user.userId, id);
  }
}
