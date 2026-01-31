import { Injectable } from '@nestjs/common';

export type RetryOptions = {
  attempts: number;
  backoffMs: number;
};

@Injectable()
export class RetryService {
  async execute<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt < options.attempts) {
          await this.delay(options.backoffMs * attempt);
        }
      }
    }

    throw lastError;
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
