import { Body, Controller, Post, UsePipes } from '@nestjs/common';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AnalyzerService } from './analyzer.service';
import { previewSchema } from './dto/preview.dto';
import type { PreviewDto } from './dto/preview.dto';

@Controller('analyzer')
export class AnalyzerController {
  constructor(private readonly analyzer: AnalyzerService) {}

  @Post('preview')
  @UsePipes(new ZodValidationPipe(previewSchema))
  preview(@Body() body: PreviewDto) {
    return this.analyzer.preview(body.raw);
  }
}
