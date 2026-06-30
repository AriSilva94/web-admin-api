import { Module } from '@nestjs/common';
import { TibiaService } from './tibia.service';

@Module({
  providers: [TibiaService],
  exports: [TibiaService],
})
export class TibiaModule {}
