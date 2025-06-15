import { EmailMessage, EmailProvider, EmailStatus, EmailError } from '../core/types';
import { ERROR_CODES } from '../core/constants';

export abstract class BaseEmailProvider implements EmailProvider {
  protected constructor(public readonly name: string) {}

  abstract send(message: EmailMessage): Promise<EmailStatus>;

  async isAvailable(): Promise<boolean> {
    try {
      // Implement a simple health check
      await this.healthCheck();
      return true;
    } catch (error) {
      return false;
    }
  }

  protected abstract healthCheck(): Promise<void>;

  protected createSuccessStatus(message: EmailMessage): EmailStatus {
    return {
      messageId: message.id,
      status: 'sent',
      provider: this.name,
      attempts: 1,
      lastAttempt: new Date(),
    };
  }

  protected createErrorStatus(
    message: EmailMessage,
    error: Error,
    attempts: number
  ): EmailStatus {
    return {
      messageId: message.id,
      status: 'failed',
      provider: this.name,
      attempts,
      lastAttempt: new Date(),
      error: error.message,
    };
  }

  protected throwProviderError(message: string, code: keyof typeof ERROR_CODES, originalError?: Error): never {
    throw new EmailError(message, ERROR_CODES[code], originalError);
  }
}