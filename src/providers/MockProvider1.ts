import { EmailMessage, EmailStatus } from '../core/types';
import { BaseEmailProvider } from './BaseEmailProvider';
import { ERROR_CODES } from '../core/constants';

export class MockProvider1 extends BaseEmailProvider {
  private failureRate: number;
  private latency: number;

  constructor(failureRate = 0.2, latency = 100) {
    super('MockProvider1');
    this.failureRate = failureRate;
    this.latency = latency;
  }

  async send(message: EmailMessage): Promise<EmailStatus> {
    await this.simulateLatency();

    if (Math.random() < this.failureRate) {
      throw this.throwProviderError(
        'Mock provider 1 failed to send email',
        'PROVIDER_ERROR',
        new Error('Simulated failure')
      );
    }

    return this.createSuccessStatus(message);
  }

  protected async healthCheck(): Promise<void> {
    await this.simulateLatency();
    // Simulate occasional health check failures
    if (Math.random() < 0.1) {
      throw new Error('Health check failed');
    }
  }

  private simulateLatency(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, this.latency + Math.random() * 50);
    });
  }
}