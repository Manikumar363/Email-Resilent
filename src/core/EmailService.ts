import { v4 as uuidv4 } from 'uuid';
import {
  EmailMessage,
  EmailStatus,
  EmailProvider,

} from './types';
import {
  DEFAULT_CONFIG,
  EMAIL_STATUS,
  CIRCUIT_STATE,
  VALIDATION,
  METRICS,
  CACHE,
} from './constants';
import { RateLimiter } from '../utils/RateLimiter';
import { CircuitBreaker } from '../utils/CircuitBreaker';
import { Queue } from '../utils/Queue';

export class EmailService {
  private rateLimiter: RateLimiter;
  private circuitBreakers: Map<string, CircuitBreaker>;
  private queue: Queue;
  private providers: EmailProvider[];
  private retryConfig: RetryConfig;
  private sentMessageIds: Set<string> = new Set();
  private metrics: Map<string, number> = new Map();
  private readonly getCurrentTime: () => number;

  constructor(config: EmailServiceConfig, getCurrentTime: () => number = Date.now) {
    this.validateConfig(config);
    this.providers = config.providers;
    this.getCurrentTime = getCurrentTime;
    this.retryConfig = {
      maxAttempts: DEFAULT_CONFIG.RETRY.MAX_ATTEMPTS,
      initialDelay: DEFAULT_CONFIG.RETRY.INITIAL_DELAY,
      maxDelay: DEFAULT_CONFIG.RETRY.MAX_DELAY,
      backoffFactor: DEFAULT_CONFIG.RETRY.BACKOFF_FACTOR,
      ...config.retryConfig,
    };
    this.rateLimiter = new RateLimiter({
      maxRequests: DEFAULT_CONFIG.RATE_LIMITER.MAX_REQUESTS,
      timeWindow: DEFAULT_CONFIG.RATE_LIMITER.TIME_WINDOW,
      ...config.rateLimiterConfig,
    }, getCurrentTime);
    this.circuitBreakers = new Map(
      this.providers.map(provider => [
        provider.name,
        new CircuitBreaker({
          failureThreshold: DEFAULT_CONFIG.CIRCUIT_BREAKER.FAILURE_THRESHOLD,
          resetTimeout: DEFAULT_CONFIG.CIRCUIT_BREAKER.RESET_TIMEOUT,
          ...config.circuitBreakerConfig,
        }, getCurrentTime)
      ])
    );
    this.queue = new Queue(this.retryConfig.maxAttempts, getCurrentTime);
    this.initializeMetrics();
  }

  private validateConfig(config: EmailServiceConfig): void {
    if (!config.providers || config.providers.length === 0) {
      throw new EmailError(
        'At least one provider must be configured',
        ERROR_CODES.INVALID_CONFIG
      );
    }

    if (config.retryConfig?.maxAttempts && config.retryConfig.maxAttempts < 1) {
      throw new EmailError(
        'Max attempts must be at least 1',
        ERROR_CODES.INVALID_CONFIG
      );
    }
  }

  private initializeMetrics(): void {
    this.metrics.set(METRICS.SUCCESS_COUNTER, 0);
    this.metrics.set(METRICS.FAILURE_COUNTER, 0);
    this.metrics.set(METRICS.QUEUE_SIZE_GAUGE, 0);
  }

  async sendEmail(
    to: string,
    from: string,
    subject: string,
    body: string,
    metadata?: Record<string, unknown>
  ): Promise<EmailStatus> {
    this.validateEmailInput(to, from, subject, body);

    const message: EmailMessage = {
      id: uuidv4(),
      to,
      from,
      subject,
      body,
      metadata,
    };

    // Check idempotency
    if (this.sentMessageIds.has(message.id)) {
      throw new EmailError(
        'Duplicate message ID detected',
        ERROR_CODES.DUPLICATE_MESSAGE
      );
    }

    const startTime = Date.now();
    try {
      const status = await this.queue.enqueue(message, (msg) => this.processEmail(msg));
      this.recordSuccess(startTime);
      return status;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private validateEmailInput(
    to: string,
    from: string,
    subject: string,
    body: string
  ): void {
    if (!VALIDATION.EMAIL_REGEX.test(to) || !VALIDATION.EMAIL_REGEX.test(from)) {
      throw new EmailError(
        'Invalid email address format',
        ERROR_CODES.INVALID_CONFIG
      );
    }

    if (subject.length > VALIDATION.MAX_SUBJECT_LENGTH) {
      throw new EmailError(
        `Subject exceeds maximum length of ${VALIDATION.MAX_SUBJECT_LENGTH} characters`,
        ERROR_CODES.INVALID_CONFIG
      );
    }

    if (body.length > VALIDATION.MAX_BODY_LENGTH) {
      throw new EmailError(
        `Body exceeds maximum length of ${VALIDATION.MAX_BODY_LENGTH} characters`,
        ERROR_CODES.INVALID_CONFIG
      );
    }
  }

  private async processEmail(message: EmailMessage): Promise<EmailStatus> {
    try {
      await this.rateLimiter.acquire();
    } catch (error) {
      if (error instanceof Error && error.message === 'RATE_LIMIT') {
        throw new EmailError('Rate limit exceeded', ERROR_CODES.RATE_LIMIT);
      }
      throw error;
    }

    let lastError: Error | undefined;
    let attempts = 0;
    let lastProviderName: string | undefined;

    while (attempts < this.retryConfig.maxAttempts) {
      attempts++;
      const delay = this.calculateBackoffDelay(attempts);

      for (const provider of this.providers) {
        const circuitBreaker = this.circuitBreakers.get(provider.name)!;
        lastProviderName = provider.name;

        try {
          if (circuitBreaker.getState() === CIRCUIT_STATE.OPEN) {
            continue;
          }

          const status = await circuitBreaker.execute(() => provider.send(message));
          this.sentMessageIds.add(message.id);
          return {
            ...status,
            attempts,
            lastAttempt: new Date(this.getCurrentTime()),
          };
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          console.error(
            `Provider ${lastProviderName} failed: ${lastError.message}`
          );
        }
      }

      if (attempts < this.retryConfig.maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new EmailError(
      `All providers failed after ${attempts} attempts${lastProviderName ? ` (last provider: ${lastProviderName})` : ''}: ${lastError?.message}`,
      ERROR_CODES.ALL_PROVIDERS_FAILED,
      lastError
    );
  }

  private calculateBackoffDelay(attempt: number): number {
    const delay = Math.min(
      this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffFactor, attempt - 1),
      this.retryConfig.maxDelay
    );
    // Add jitter to prevent thundering herd
    return delay * (0.75 + Math.random() * 0.5);
  }

  private recordSuccess(startTime: number): void {
    const latency = Date.now() - startTime;
    this.metrics.set(
      METRICS.SUCCESS_COUNTER,
      (this.metrics.get(METRICS.SUCCESS_COUNTER) || 0) + 1
    );
    this.metrics.set(
      METRICS.LATENCY_HISTOGRAM,
      (this.metrics.get(METRICS.LATENCY_HISTOGRAM) || 0) + latency
    );
  }

  private recordFailure(): void {
    this.metrics.set(
      METRICS.FAILURE_COUNTER,
      (this.metrics.get(METRICS.FAILURE_COUNTER) || 0) + 1
    );
  }

  async getProviderStatus(): Promise<Record<string, typeof CIRCUIT_STATE[keyof typeof CIRCUIT_STATE]>> {
    const status: Record<string, typeof CIRCUIT_STATE[keyof typeof CIRCUIT_STATE]> = {};
    for (const [name, breaker] of this.circuitBreakers) {
      status[name] = breaker.getState();
    }
    return status;
  }

  getQueueLength(): number {
    const length = this.queue.getQueueLength();
    this.metrics.set(METRICS.QUEUE_SIZE_GAUGE, length);
    return length;
  }

  getCurrentRateLimit(): { current: number; max: number } {
    return {
      current: this.rateLimiter.getCurrentRequestCount(),
      max: this.rateLimiter.getTimeUntilNextAvailable(),
    };
  }

  getMetrics(): Map<string, number> {
    return new Map(this.metrics);
  }

  resetCircuitBreakers(): void {
    for (const breaker of this.circuitBreakers.values()) {
      breaker.reset();
    }
  }

  clearQueue(): void {
    this.queue.clear();
    this.metrics.set(METRICS.QUEUE_SIZE_GAUGE, 0);
  }

  clearSentMessageIds(): void {
    this.sentMessageIds.clear();
  }
}
