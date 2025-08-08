import { CIRCUIT_STATE } from '../core/constants';

export class CircuitBreaker {
  private state: typeof CIRCUIT_STATE[keyof typeof CIRCUIT_STATE] = CIRCUIT_STATE.CLOSED;
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly getCurrentTime: () => number;

  constructor(
    config: { failureThreshold: number; resetTimeout: number },
    getCurrentTime: () => number = Date.now
  ) {
    this.failureThreshold = config.failureThreshold;
    this.resetTimeout = config.resetTimeout;
    this.getCurrentTime = getCurrentTime;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CIRCUIT_STATE.OPEN) {
      const now = this.getCurrentTime();
      if (this.lastFailureTime && now - this.lastFailureTime >= this.resetTimeout) {
        this.state = CIRCUIT_STATE.HALF_OPEN;
      } else {
        throw new Error('CIRCUIT');
      }
    }

    try {
      const result = await fn();
      if (this.state === CIRCUIT_STATE.HALF_OPEN) {
        this.state = CIRCUIT_STATE.CLOSED;
        this.failureCount = 0;
        this.lastFailureTime = null;
      }
      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = this.getCurrentTime();

      if (this.failureCount >= this.failureThreshold) {
        this.state = CIRCUIT_STATE.OPEN;
      }
      throw error;
    }
  }

  getState(): typeof CIRCUIT_STATE[keyof typeof CIRCUIT_STATE] {
    return this.state;
  }

  reset(): void {
    this.state = CIRCUIT_STATE.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = null;
  }
}
