import { EmailMessage, EmailStatus } from '../core/types';
import { BaseEmailProvider } from './BaseEmailProvider';
import { ERROR_CODES } from '../core/constants';

export class MockProvider2 extends BaseEmailProvider {
  private failureRate: number;
  private latency: number;
  private consecutiveFailures: number = 0;
  private maxConsecutiveFailures: number = 3;

  constructor(failureRate = 0.1, latency = 200) {
    super('MockProvider2');
    this.failureRate = failureRate;
    this.latency = latency;
  }

  async send(message: EmailMessage): Promise<EmailStatus> {
    await this.simulateLatency();

    // Simulate occasional service degradation
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      // Reset consecutive failures after max is reached
      this.consecutiveFailures = 0;
      return this.createSuccessStatus(message);
    }

    if (Math.random() < this.failureRate) {
      this.consecutiveFailures++;
      throw this.throwProviderError(
        'Mock provider 2 failed to send email',
        'PROVIDER_ERROR',
        new Error(`Simulated failure (consecutive: ${this.consecutiveFailures})`)
      );
    }

    this.consecutiveFailures = 0;
    return this.createSuccessStatus(message);
  }

  protected async healthCheck(): Promise<void> {
    await this.simulateLatency();
    // Simulate more reliable health checks
    if (Math.random() < 0.05) {
      throw new Error('Health check failed');
    }
  }

  private simulateLatency(): Promise<void> {
    return new Promise((resolve) => {
      // Simulate higher but more consistent latency
      const baseLatency = this.latency;
      const randomLatency = Math.random() * 20; // Add up to 20mss of random latency
      const spikeChance = Math.random() < 0.1; // 10% chance of a latency spike
      const spikeLatency = spikeChance ? 500 : 0; // 500ms spike if triggered
      
      setTimeout(resolve, baseLatency + randomLatency + spikeLatency);
    });
  }
}

export default MockProvider2;
