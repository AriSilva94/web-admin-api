import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { AnalyzerValidationError } from './analyzer.errors';
import { parseAnalyzer } from './parser/parse-analyzer';
import { ParsedAnalyzer } from './schemas/analyzer.schema';

@Injectable()
export class AnalyzerService {
  preview(raw: string): ParsedAnalyzer {
    try {
      return parseAnalyzer(raw);
    } catch (error) {
      if (error instanceof AnalyzerValidationError) {
        throw new UnprocessableEntityException({
          message: 'Invalid analyzer',
          issues: error.issues,
        });
      }

      throw error;
    }
  }
}
