import { MockProvider1 } from '../../src/providers/MockProvider1';
import { EmailMessage } from '../../src/core/types';
import { ERROR_CODES } from '../../src/core/constants';

describe('MockProvider1', () => {
  let provider: MockProvider1;
  const testMessage: EmailMessage = {
    id: 'test-1',
    to: 'test@example.com',
    from: 'sender@example.com',
    subject: 'Test Subject',
    body: 'Test Body',
  };

  beforeEach(() => {
    provider = new MockProvider1(0.2, 100); 
  });

  describe('send', () => {
    it('should successfully send an email', async () => {
      // Mock Math.random to always return a value above failure rate
      jest.spyOn(Math, 'random').mockReturnValue(0.3);

      const result = await provider.send(testMessage);

      expect(result).toEqual({
        messageId: testMessage.id,
        status: 'sent',
        provider: 'MockProvider1',
        attempts: 1,
        lastAttempt: expect.any(Date),
      });
    });

    it('should fail to send an email based on failure rate', async () => {
      // Mock Math.random to always return 
      jest.spyOn(Math, 'random').mockReturnValue(0.1);

      await expect(provider.send(testMessage)).rejects.toThrow();
      await expect(provider.send(testMessage)).rejects.toMatchObject({
        code: ERROR_CODES.PROVIDER_ERROR,
      });
    });

    it('should respect the configured latency', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.3);
      const startTime = Date.now();

      await provider.send(testMessage);

      const endTime = Date.now();
      const elapsedTime = endTime - startTime;
      expect(elapsedTime).toBeGreaterThanOrEqual(100); // Base latency
      expect(elapsedTime).toBeLessThanOrEqual(150); // Base latency + max random (50ms)
    });
  });

  describe('isAvailable', () => {
    it('should return true when health check passes', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.2); // Above 0.1 failure rate

      const isAvailable = await provider.isAvailable();
      expect(isAvailable).toBe(true);
    });

    it('should return false when health check fails', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.05); // Below 0.1 failure rate

      const isAvailable = await provider.isAvailable();
      expect(isAvailable).toBe(false);
    });
  });
});
