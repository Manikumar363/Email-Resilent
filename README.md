# Resilient Email Service

A robust email sending service implemented in TypeScript that provides high availability, fault tolerance, and reliability through various resilience patterns.

## Features

- **Multiple Provider Support**: Works with multiple email providers with automatic failover
- **Retry Logic**: Implements exponential backoff with jitter for retries
- **Circuit Breaker**: Prevents cascading failures when providers are down
- **Rate Limiting**: Controls request rates to prevent overwhelming providers
- **Queue System**: Manages email sending with retry capabilities
- **Idempotency**: Prevents duplicate email sends
- **Status Tracking**: Monitors email sending attempts and provider status

## Installation

```bash
npm install
```

## Usage

```typescript
import { EmailService, MockProvider1, MockProvider2 } from './src';

// Configure the service
const emailService = new EmailService({
  providers: [
    new MockProvider1(0.2, 100), // 20% failure rate, 100ms latency
    new MockProvider2(0.1, 200), // 10% failure rate, 200ms latency
  ],
  retryConfig: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
  },
  rateLimiterConfig: {
    maxRequests: 10,
    timeWindow: 1000, // 1 second
  },
  circuitBreakerConfig: {
    failureThreshold: 5,
    resetTimeout: 30000, // 30 seconds
  },
});

// Send an email
try {
  const status = await emailService.sendEmail(
    'recipient@example.com',
    'sender@example.com',
    'Test Subject',
    'Hello, World!',
    { priority: 'high' }
  );
  console.log('Email sent:', status);
} catch (error) {
  console.error('Failed to send email:', error);
}

// Monitor service status
const providerStatus = await emailService.getProviderStatus();
console.log('Provider status:', providerStatus);

const queueLength = emailService.getQueueLength();
console.log('Queue length:', queueLength);

const rateLimit = emailService.getCurrentRateLimit();
console.log('Rate limit:', rateLimit);
```

## Architecture

The service is built with several key components:

1. **EmailService**: The main service class that orchestrates all components
2. **Providers**: Abstract and concrete implementations of email providers
3. **RateLimiter**: Controls request rates to prevent overwhelming providers
4. **CircuitBreaker**: Prevents cascading failures
5. **Queue**: Manages email sending with retry capabilities

### Resilience Patterns

- **Retry with Exponential Backoff**: Automatically retries failed requests with increasing delays
- **Circuit Breaker**: Prevents sending requests to failing providers
- **Fallback**: Automatically switches to backup providers
- **Rate Limiting**: Prevents overwhelming providers with too many requests
- **Queue**: Manages request flow and provides retry capabilities
- **Idempotency**: Prevents duplicate sends using unique message IDs

## Testing

```bash
npm test
```

## Configuration

The service can be configured through the `EmailServiceConfig` interface:

```typescript
interface EmailServiceConfig {
  providers: EmailProvider[];
  retryConfig: {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffFactor: number;
  };
  rateLimiterConfig: {
    maxRequests: number;
    timeWindow: number;
  };
  circuitBreakerConfig: {
    failureThreshold: number;
    resetTimeout: number;
  };
}
```

## Error Handling

The service uses custom error types and provides detailed error information:

```typescript
class EmailError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: Error
  );
}
```

Common error codes:
- `DUPLICATE_MESSAGE`: Attempt to send a duplicate message
- `ALL_PROVIDERS_FAILED`: All providers failed to send the email
- `PROVIDER_ERROR`: Provider-specific error
- `SERVICE_DEGRADED`: Provider is experiencing degraded service

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

MIT