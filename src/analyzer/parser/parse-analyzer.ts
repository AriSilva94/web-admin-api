import { AnalyzerValidationError } from '../analyzer.errors';
import { ParsedAnalyzer } from '../schemas/analyzer.schema';
import { parseParty } from './parse-party';
import { parseSolo } from './parse-solo';
import { detectType, toLines } from './tokenizer';

export function parseAnalyzer(raw: string): ParsedAnalyzer {
  const lines = toLines(raw);
  if (lines.length === 0) {
    throw new AnalyzerValidationError([
      { field: 'raw', message: 'Empty analyzer input' },
    ]);
  }

  try {
    return detectType(lines) === 'SOLO'
      ? parseSolo(lines, raw)
      : parseParty(lines, raw);
  } catch (error) {
    if (error instanceof AnalyzerValidationError) {
      throw error;
    }

    throw new AnalyzerValidationError([
      { field: 'type', message: (error as Error).message },
    ]);
  }
}
