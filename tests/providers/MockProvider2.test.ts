import { MockProvider2 } from '../../src/providers/MockProvider2';
import { EmailMessage } from '../../src/core/types';
import { ERROR_CODES } from '../../src/core/constants';

describe('MockProvider2', () => {
  let provider: MockProvider2;
  const testMessage: EmailMessage = {
    id: 'test-2',

    subject: 'Test Subject',
    body: 'Test Body',
  };

  beforeEach(() => {
    provider = new MockProvider2(0.3, 150); // 30% failure rate, 150ms latency
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('send', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should successfully send an email', async () => {
      // Mock Math.random to always return a value above failure rate
      jest.spyOn(Math, 'random').mockReturnValue(0.4);

      const sendPromise = provider.send(testMessage);
      jest.advanceTimersByTime(200); // Advance past latency
      const result = await sendPromise;

      expect(result).toEqual({
        messageId: testMessage.id,
        status: 'sent',
        provider: 'MockProvider2',
        attempts: 1,
        lastAttempt: expect.any(Date),
      });
    });

    it('should fail to send an email based on failure rate', async () => {
      // Mock Math.random to always return a value below failure rate
      jest.spyOn(Math, 'random').mockReturnValue(0.2);

      const sendPromise = provider.send(testMessage);
      jest.advanceTimersByTime(200);

      await expect(sendPromise).rejects.toThrow();
      await expect(sendPromise).rejects.toMatchObject({
        code: ERROR_CODES.PROVIDER_ERROR,
      });
    });

    it('should simulate burst failures', async () => {
      // Mock Math.random to trigger failures
      jest.spyOn(Math, 'random').mockReturnValue(0.2);

      // First attempt should fail
      const firstAttempt = provider.send(testMessage);
      jest.advanceTimersByTime(200);
      await expect(firstAttempt).rejects.toThrow();

      // Second attempt should also fail
      const secondAttempt = provider.send(testMessage);
      jest.advanceTimersByTime(200);
      await expect(secondAttempt).rejects.toThrow();

      // Third attempt should also fail
      const thirdAttempt = provider.send(testMessage);
      jest.advanceTimersByTime(200);
      await expect(thirdAttempt).rejects.toThrow();

      // Fourth attempt should succeed (max consecutive failures reached)
      const fourthAttempt = provider.send(testMessage);
      jest.advanceTimersByTime(200);
      const result = await fourthAttempt;
      expect(result).toBeDefined();
      expect(result.status).toBe('sent');
    });

    it('should respect the configured latency with occasional spikes', async () => {
      // Mock Math.random to control both failure rate and spike chance
      jest.spyOn(Math, 'random')
        .mockReturnValueOnce(0.3) // Success for send
        .mockReturnValueOnce(0.05) // Trigger spike
        .mockReturnValueOnce(0.3); // Success for send

      const startTime = Date.now();
      const sendPromise = provider.send(testMessage);
      jest.advanceTimersByTime(700); // Advance past latency + spike
      const result = await sendPromise;

      expect(result.status).toBe('sent');
      const endTime = Date.now();
      const elapsedTime = endTime - startTime;
      expect(elapsedTime).toBeGreaterThanOrEqual(150); // Base latency
      expect(elapsedTime).toBeLessThanOrEqual(750); // Base latency + spike (500ms) + max random (100ms)
    });
  });

  describe('isAvailable', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return true when health check passes', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.3); // Above 0.05 failure rate

      const isAvailablePromise = provider.isAvailable();
      // Advance timers to handle all pending timeouts
      jest.runAllTimers();
      const isAvailable = await isAvailablePromise;
      expect(isAvailable).toBe(true);
    });

    it('should return false when health check fails', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.01); // Below 0.05 failure rate

      const isAvailablePromise = provider.isAvailable();
      // Advance timers to handle all pending timeouts
      jest.runAllTimers();
      const isAvailable = await isAvailablePromise;
      expect(isAvailable).toBe(false);
    });
  });
});
