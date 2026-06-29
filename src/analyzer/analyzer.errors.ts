export interface AnalyzerIssue {
  field: string;
  message: string;
}

export class AnalyzerValidationError extends Error {
  constructor(public readonly issues: AnalyzerIssue[]) {
    super(
      `Analyzer validation failed: ${issues.map((issue) => issue.field).join(', ')}`,
    );
    this.name = 'AnalyzerValidationError';
  }
}
