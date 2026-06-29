import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
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
import {
  listHuntsSchema,
  type ListHuntsQuery,
} from '../hunts/dto/list-hunts.dto';
import { shareSchema, type ShareDto } from './dto/share.dto';
import { SharingService } from './sharing.service';

@Controller('hunts')
@UseGuards(JwtAuthGuard)
export class HuntShareController {
  constructor(private readonly sharing: SharingService) {}

  @Post(':id/share')
  share(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(shareSchema)) dto: ShareDto,
  ) {
    return this.sharing.share(user.userId, id, dto.userId);
  }

  @Delete(':id/share/:userId')
  @HttpCode(204)
  unshare(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.sharing.unshare(user.userId, id, userId);
  }
}

@Controller('shared')
@UseGuards(JwtAuthGuard)
export class SharedController {
  constructor(private readonly sharing: SharingService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(listHuntsSchema)) query: ListHuntsQuery,
  ) {
    return this.sharing.listShared(user.userId, {
      page: query.page,
      pageSize: query.pageSize,
    });
  }
}
