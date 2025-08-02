import { EmailService } from '../src/core/EmailService';
import { MockProvider1 } from '../src/providers/MockProvider1';
import { MockProvider2 } from '../src/providers/MockProvider2';
import { EmailMessage, EmailError, EmailStatus } from '../src/core/types';
import { ERROR_CODES, EMAIL_STATUS, CIRCUIT_STATE } from '../src/core/constants';
import { METRICS } from '../src/core/constants';


// Mock the providers
jest.mock('../src/providers/MockProvider1', () => {
  return {
    MockProvider1: jest.fn().mockImplementation(() => ({
    

      isAvailable: jest.fn().mockResolvedValue(true),
    })),
  };
});

jest.mock('../src/providers/MockProvider2', () => {
  return {
    MockProvider2: jest.fn().mockImplementation(() => ({
      name: 'MockProvider2',
      send: jest.fn(),
      isAvailable: jest.fn().mockResolvedValue(true),
    })),
  };
});

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-123')
}));

describe('EmailService', () => {
  let emailService: EmailService;
  let mockProvider1: jest.Mocked<MockProvider1>;
  let mockProvider2: jest.Mocked<MockProvider2>;
  let mockGetCurrentTime: jest.Mock;
  let currentTime: number;
  const testMessage: EmailMessage = {
    id: 'test-123',
    to: 'test@example.com',
    from: 'sender@example.com',
    subject: 'Test Subject',
    body: 'Test Body',
  };

  beforeEach(() => {
    jest.useFakeTimers();
    currentTime = 1000;
    mockGetCurrentTime = jest.fn(() => currentTime);
    // Create new instances with the correct names
    mockProvider1 = new MockProvider1() as jest.Mocked<MockProvider1>;
    mockProvider2 = new MockProvider2() as jest.Mocked<MockProvider2>;
    (uuidv4 as jest.Mock).mockReturnValue('test-123');
  });

  afterEach(async () => {
    jest.useRealTimers();
  
    if (emailService) {
      emailService.clearSentMessageIds();
      emailService.clearQueue();
      emailService.resetCircuitBreakers();
    }
  });

  describe('constructor', () => {
    it('should throw error if no providers are configured', () => {
      expect(() => new EmailService({ providers: [] })).toThrow(EmailError);
      expect(() => new EmailService({ providers: [] })).toThrow('At least one provider must be configured');
    });

    it('should initialize with default config if not provided', () => {
      emailService = new EmailService({ providers: [mockProvider1] });
      expect(emailService).toBeDefined();
    });
  });

  describe('sendEmail', () => {
    beforeEach(() => {
      emailService = new EmailService({
        providers: [mockProvider1, mockProvider2],
        retryConfig: {
          maxAttempts: 2,
          initialDelay: 100,
          maxDelay: 1000,
          backoffFactor: 2,
        },
      }, mockGetCurrentTime);
    });

    it('should successfully send email through first available provider', async () => {
      const successStatus: EmailStatus = {
        messageId: testMessage.id,
        status: EMAIL_STATUS.SENT,
        provider: mockProvider1.name,
        attempts: 1,
        lastAttempt: new Date(currentTime),
      };
      mockProvider1.send.mockResolvedValue(successStatus);

      const promise = emailService.sendEmail(
        testMessage.to,
        testMessage.from,
        testMessage.subject,
        testMessage.body
      );

      // Fast-forward timers to process the queue
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      const result = await promise;
      expect(result).toEqual(successStatus);
      expect(mockProvider1.send).toHaveBeenCalledWith(testMessage);
      expect(mockProvider2.send).not.toHaveBeenCalled();
    });

    it('should throw error if all providers fail', async () => {
      const error = new EmailError('Provider failed', ERROR_CODES.PROVIDER_ERROR);
      mockProvider1.send.mockRejectedValue(error);
      mockProvider2.send.mockRejectedValue(error);

      const promise = emailService.sendEmail(
        testMessage.to,
        testMessage.from,
        testMessage.body
      );
      
      // Fast-forward timers to process retries
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      await expect(promise).rejects.toThrow(EmailError);
      expect(mockProvider1.send).toHaveBeenCalled();
      expect(mockProvider2.send).toHaveBeenCalled();
    });

    it('should prevent duplicate message IDs', async () => {
      const successStatus: EmailStatus = {
        messageId: testMessage.id,
        status: EMAIL_STATUS.SENT,
        provider: mockProvider1.name,
        attempts: 1,
        lastAttempt: new Date(currentTime),
      };
      mockProvider1.send.mockResolvedValue(successStatus);

      // First send should succeed
      const promise1 = emailService.sendEmail(
        testMessage.to,
        testMessage.from,
        testMessage.subject,
        testMessage.body
      );

      // Fast-forward timers to process the queue
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      const result1 = await promise1;
      expect(result1).toEqual(successStatus);

      // Second send with same ID should fail
      const promise2 = emailService.sendEmail(
        testMessage.to,
        testMessage.from,
        testMessage.subject,
        testMessage.body
      );

      // Fast-forward timers to process the queue
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      await expect(promise2).rejects.toThrow('Duplicate message ID detected');
    });
  });

  describe('circuit breaker', () => {
    beforeEach(() => {
      emailService = new EmailService({
        providers: [mockProvider1],
        circuitBreakerConfig: {
          failureThreshold: 2,
          resetTimeout: 1000,
        },
      }, mockGetCurrentTime);
    });

    it('should open circuit after threshold failures', async () => {
      const error = new EmailError('Provider failed', ERROR_CODES.PROVIDER_ERROR);
      mockProvider1.send.mockRejectedValue(error);

      // First attempt should fail
      const promise1 = emailService.sendEmail(
        testMessage.to,
        testMessage.from,
        testMessage.subject,
        testMessage.body
      );

      // Fast-forward timers to process retries
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      await expect(promise1).rejects.toThrow();

      // Clear sent message IDs to allow retry
      emailService.clearSentMessageIds();

      // Second attempt should fail
      const promise2 = emailService.sendEmail(
        testMessage.to,
        testMessage.from,
        testMessage.subject,
        testMessage.body
      );

      // Fast-forward timers to process retries
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      await expect(promise2).rejects.toThrow();

      // Clear sent message IDs to allow retry
      emailService.clearSentMessageIds();

      // Third attempt should fail with circuit breaker error
      const promise3 = emailService.sendEmail(
        testMessage.to,
        testMessage.from,
        testMessage.subject,
        testMessage.body
      );

      // Fast-forward timers to process retries
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      await expect(promise3).rejects.toThrow(/CIRCUIT_OPEN/);

      // Verify circuit breaker state
      const status = await emailService.getProviderStatus();
      expect(status[mockProvider1.name]).toBe(CIRCUIT_STATE.OPEN);
    });

    it('should reset circuit after timeout', async () => {
      const error = new EmailError('Provider failed', ERROR_CODES.PROVIDER_ERROR);
      mockProvider1.send.mockRejectedValue(error);

      // Open the circuit
      const promise1 = emailService.sendEmail(
        testMessage.to,
        testMessage.from,
        testMessage.subject,
        testMessage.body
      );

      // Fast-forward timers to process retries
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      await expect(promise1).rejects.toThrow();

      // Clear sent message IDs to allow retry
      emailService.clearSentMessageIds();

      const promise2 = emailService.sendEmail(
        testMessage.to,
        testMessage.from,
        testMessage.subject,
        testMessage.body
      );

      // Fast-forward timers to process retries
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      await expect(promise2).rejects.toThrow();

      // Clear sent message IDs to allow retry
      emailService.clearSentMessageIds();

      const promise3 = emailService.sendEmail(
        testMessage.to,
        testMessage.from,
        testMessage.subject,
        testMessage.body
      );

      // Fast-forward timers to process retries
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      await expect(promise3).rejects.toThrow(/CIRCUIT_OPEN/);

      // Advance time past circuit breaker timeout
      currentTime += 1500;
      jest.advanceTimersByTime(1500);
      await Promise.resolve();

      // Clear sent message IDs to allow retry
      emailService.clearSentMessageIds();

      // Should try again after timeout
      const successStatus: EmailStatus = {
        messageId: testMessage.id,
        status: EMAIL_STATUS.SENT,
        provider: mockProvider1.name,
        attempts: 1,
        lastAttempt: new Date(currentTime),
      };
      mockProvider1.send.mockResolvedValue(successStatus);

      const promise4 = emailService.sendEmail(
        testMessage.to,
        testMessage.from,
        testMessage.subject,
        testMessage.body
      );

      // Fast-forward timers to process the queue
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      await expect(promise4).resolves.toEqual(successStatus);
    });
  });

  describe('rate limiting', () => {
    beforeEach(() => {
      emailService = new EmailService({
        providers: [mockProvider1],
        rateLimiterConfig: {
          maxRequests: 2,
          timeWindow: 1000,
        },
      }, mockGetCurrentTime);
    });

    it('should respect rate limits', async () => {
      const successStatus: EmailStatus = {
        messageId: testMessage.id,
        status: EMAIL_STATUS.SENT,
        provider: mockProvider1.name,
        attempts: 1,
        lastAttempt: new Date(currentTime),
      };
      mockProvider1.send.mockResolvedValue(successStatus);

      // First request should succeed
      const promise1 = emailService.sendEmail(
        testMessage.to,
        testMessage.from,
        testMessage.subject,
        testMessage.body
      );

      // Fast-forward timers to process the queue
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      await expect(promise1).resolves.toEqual(successStatus);

      // Clear sent message IDs to allow retry
      emailService.clearSentMessageIds();

      // Second request should succeed
      const promise2 = emailService.sendEmail(
        testMessage.to,
        testMessage.from,
        testMessage.subject,
        testMessage.body
      );

      // Fast-forward timers to process the queue
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      await expect(promise2).resolves.toEqual(successStatus);

      // Clear sent message IDs to allow retry
      emailService.clearSentMessageIds();

      // Third request should be rate limited
      const promise3 = emailService.sendEmail(
        testMessage.to,
        testMessage.from,
        testMessage.subject,
        testMessage.body
      );

      // Fast-forward timers to process the queue
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      await expect(promise3).rejects.toThrow(/RATE_LIMIT/);

      // Advance time past rate limit window
      currentTime += 1500;
      jest.advanceTimersByTime(1500);
      await Promise.resolve();

      // Clear sent message IDs to allow retry
      emailService.clearSentMessageIds();

      // Should succeed again
      const promise4 = emailService.sendEmail(
        testMessage.to,
        testMessage.from,
        testMessage.subject,
        testMessage.body
      );

      // Fast-forward timers to process the queue
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      await expect(promise4).resolves.toEqual(successStatus);
    });
  });

  describe('metrics', () => {
    beforeEach(() => {
      emailService = new EmailService({
        providers: [mockProvider1],
      }, mockGetCurrentTime);
    });

    it('should track success and failure metrics', async () => {
      const successStatus: EmailStatus = {
        messageId: testMessage.id,
        status: EMAIL_STATUS.SENT,
        provider: mockProvider1.name,
        attempts: 1,
        lastAttempt: new Date(currentTime),
      };
      const error = new EmailError('Provider failed', ERROR_CODES.PROVIDER_ERROR);

      // Mock alternating success and failure
      mockProvider1.send
        .mockResolvedValueOnce(successStatus)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(successStatus);

      // Send three emails
      const promise1 = emailService.sendEmail(
        testMessage.to,
        testMessage.from,
        testMessage.subject,
        testMessage.body
      );

      // Fast-forward timers to process the queue
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      await expect(promise1).resolves.toEqual(successStatus);

      // Clear sent message IDs to allow retry
      emailService.clearSentMessageIds();

      const promise2 = emailService.sendEmail(
        testMessage.to,
        testMessage.from,
        testMessage.subject,
        testMessage.body
      );

      // Fast-forward timers to process the queue
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      await expect(promise2).rejects.toThrow();

      // Clear sent message IDs to allow retry
      emailService.clearSentMessageIds();

      const promise3 = emailService.sendEmail(
        testMessage.to,
        testMessage.from,
        testMessage.subject,
        testMessage.body
      );

      // Fast-forward timers to process the queue
      jest.advanceTimersByTime(100);
      await Promise.resolve();

      await expect(promise3).resolves.toEqual(successStatus);

      const metrics = emailService.getMetrics();
      const successCount = metrics.get(METRICS.SUCCESS_COUNTER) || 0;
      const failureCount = metrics.get(METRICS.FAILURE_COUNTER) || 0;
      expect(successCount).toBe(2);
      expect(failureCount).toBe(1);
      expect(successCount + failureCount).toBe(3);
    });
  });
});
