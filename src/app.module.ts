import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalyzerModule } from './analyzer/analyzer.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { FriendsModule } from './friends/friends.module';
import { HuntsModule } from './hunts/hunts.module';
import { PrismaModule } from './prisma/prisma.module';
import { SharingModule } from './sharing/sharing.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AnalyzerModule,
    UsersModule,
    AuthModule,
    HuntsModule,
    DashboardModule,
    FriendsModule,
    SharingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
