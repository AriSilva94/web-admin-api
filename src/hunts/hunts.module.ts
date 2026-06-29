import { Module } from '@nestjs/common';
import { AnalyzerModule } from '../analyzer/analyzer.module';
import { HuntsController } from './hunts.controller';
import { HuntsService } from './hunts.service';

@Module({
  imports: [AnalyzerModule],
  controllers: [HuntsController],
  providers: [HuntsService],
  exports: [HuntsService],
})
export class HuntsModule {}
