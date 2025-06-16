// Error Codes
export const ERROR_CODES = {
    DUPLICATE_MESSAGE: 'DUPLICATE_MESSAGE',
    ALL_PROVIDERS_FAILED: 'ALL_PROVIDERS_FAILED',
    PROVIDER_ERROR: 'PROVIDER_ERROR',
    SERVICE_DEGRADED: 'SERVICE_DEGRADED',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    RATE_LIMIT: 'RATE_LIMIT',
    CIRCUIT_BREAKER_OPEN: 'CIRCUIT_BREAKER_OPEN',
    INVALID_CONFIG: 'INVALID_CONFIG',
    QUEUE_FULL: 'QUEUE_FULL',
  } as const;
  
  // Default Configuration Values
  export const DEFAULT_CONFIG = {
    RETRY: {
      MAX_ATTEMPTS: 3,
      INITIAL_DELAY: 1000, // 1 second
      MAX_DELAY: 10000, // 10 seconds
      BACKOFF_FACTOR: 2,
    },
    RATE_LIMITER: {
      MAX_REQUESTS: 10,
      TIME_WINDOW: 1000, // 1 second
    },
    CIRCUIT_BREAKER: {
      FAILURE_THRESHOLD: 5,
      RESET_TIMEOUT: 30000, // 30 seconds
    },
    QUEUE: {
      MAX_SIZE: 1000,
      PROCESSING_INTERVAL: 100, // 100ms
    },
    PROVIDER: {
      HEALTH_CHECK_INTERVAL: 5000, // 5 seconds
      TIMEOUT: 5000, // 5 seconds
    },
  } as const;
  
  // Email Status Constants
  export const EMAIL_STATUS = {
    PENDING: 'pending',
    SENT: 'sent',
    FAILED: 'failed',
  } as const;
  
  // Circuit Breaker States
  export const CIRCUIT_STATE = {
    CLOSED: 'CLOSED',
    OPEN: 'OPEN',
    HALF_OPEN: 'HALF_OPEN',
  } as const;
  
  // Logging Levels
  export const LOG_LEVELS = {
    ERROR: 'ERROR',
    WARN: 'WARN',
    INFO: 'INFO',
    DEBUG: 'DEBUG',
  } as const;
  
  // Provider Names
  export const PROVIDER_NAMES = {
    MOCK_PROVIDER_1: 'MockProvider1',
    MOCK_PROVIDER_2: 'MockProvider2',
  } as const;
  
  // Validation Constants
  export const VALIDATION = {
    MAX_EMAIL_LENGTH: 254,
    MAX_SUBJECT_LENGTH: 78,
    MAX_BODY_LENGTH: 1000000, // 1MB
    EMAIL_REGEX: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  } as const;
  
  // Metrics Constants
  export const METRICS = {
    SUCCESS_COUNTER: 'email_send_success_total',
    FAILURE_COUNTER: 'email_send_failure_total',
    LATENCY_HISTOGRAM: 'email_send_latency_seconds',
    QUEUE_SIZE_GAUGE: 'email_queue_size',
    PROVIDER_STATUS_GAUGE: 'email_provider_status',
  } as const;
  
  // Cache Constants
  export const CACHE = {
    PROVIDER_STATUS_TTL: 30000, // 30 seconds
    RATE_LIMIT_TTL: 1000, // 1 second
    IDEMPOTENCY_TTL: 86400000, // 24 hours
  } as const;
  
  // Type Guards
  export const isEmailStatus = (status: string): status is typeof EMAIL_STATUS[keyof typeof EMAIL_STATUS] => {
    return Object.values(EMAIL_STATUS).includes(status as any);
  };
  
  export const isCircuitState = (state: string): state is typeof CIRCUIT_STATE[keyof typeof CIRCUIT_STATE] => {
    return Object.values(CIRCUIT_STATE).includes(state as any);
  };
  
  export const isLogLevel = (level: string): level is typeof LOG_LEVELS[keyof typeof LOG_LEVELS] => {
    return Object.values(LOG_LEVELS).includes(level as any);
  };
