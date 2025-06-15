import { RateLimiterConfig } from '../core/types';

export class RateLimiter {
  private requestTimestamps: number[] = [];
  private readonly maxRequests: number;
  private readonly timeWindow: number;
  private readonly getCurrentTime: () => number;

  constructor(config: RateLimiterConfig, getCurrentTime: () => number = Date.now) {
    this.maxRequests = config.maxRequests;
    this.timeWindow = config.timeWindow;
    this.getCurrentTime = getCurrentTime;
  }

  async acquire(): Promise<void> {
    const now = this.getCurrentTime();
    this.cleanupOldRequests(now);

    if (this.requestTimestamps.length >= this.maxRequests) {
      const oldestRequest = this.requestTimestamps[0];
      const waitTime = oldestRequest + this.timeWindow - now;
      
      if (waitTime > 0) {
        throw new Error('RATE_LIMIT');
      }
    }

    this.requestTimestamps.push(now);
  }

  private cleanupOldRequests(now: number): void {
    const cutoff = now - this.timeWindow;
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => timestamp > cutoff
    );
  }

  getCurrentRequestCount(): number {
    return this.requestTimestamps.length;
  }

  getTimeUntilNextAvailable(): number {
    if (this.requestTimestamps.length < this.maxRequests) {
      return 0;
    }

    const oldestRequest = this.requestTimestamps[0];
    const waitTime = oldestRequest + this.timeWindow - Date.now();
    return Math.max(0, waitTime);
  }
}