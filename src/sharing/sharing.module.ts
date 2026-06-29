import { Module } from '@nestjs/common';
import { FriendsModule } from '../friends/friends.module';
import { HuntShareController, SharedController } from './sharing.controller';
import { SharingService } from './sharing.service';

@Module({
  imports: [FriendsModule],
  controllers: [HuntShareController, SharedController],
  providers: [SharingService],
})
export class SharingModule {}
