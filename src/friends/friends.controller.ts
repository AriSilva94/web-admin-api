import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
  createRequestSchema,
  type CreateRequestDto,
} from './dto/create-request.dto';
import { FriendsService } from './friends.service';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private readonly friends: FriendsService) {}

  @Post('requests')
  send(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createRequestSchema)) dto: CreateRequestDto,
  ) {
    return this.friends.sendRequest(user.userId, dto.email);
  }

  @Get('requests')
  incoming(@CurrentUser() user: AuthUser) {
    return this.friends.incomingRequests(user.userId);
  }

  @Post('requests/:id/accept')
  @HttpCode(200)
  accept(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.friends.accept(user.userId, id);
  }

  @Post('requests/:id/reject')
  @HttpCode(204)
  reject(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.friends.reject(user.userId, id);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.friends.listFriends(user.userId);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.friends.removeFriend(user.userId, id);
  }
}
