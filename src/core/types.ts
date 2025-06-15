import { EMAIL_STATUS, CIRCUIT_STATE, ERROR_CODES } from './constants';

export type EmailStatusType = typeof EMAIL_STATUS[keyof typeof EMAIL_STATUS];
export type CircuitStateType = typeof CIRCUIT_STATE[keyof typeof CIRCUIT_STATE];
export type ErrorCodeType = typeof ERROR_CODES[keyof typeof ERROR_CODES];

export interface EmailMessage {
  id: string;
  to: string;
  from: string;
  subject: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export interface EmailStatus {
  messageId: string;
  status: EmailStatusType;
  provider: string;
  attempts: number;
  lastAttempt: Date;
  error?: string;
}

export interface EmailProvider {
  name: string;
  send(message: EmailMessage): Promise<EmailStatus>;
  isAvailable(): Promise<boolean>;
}

export interface RateLimiterConfig {
  maxRequests: number;
  timeWindow: number; // in milliseconds
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number; // in milliseconds
  maxDelay: number; // in milliseconds
  backoffFactor: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number; // in milliseconds
}

export interface EmailServiceConfig {
  providers: EmailProvider[];
  retryConfig?: Partial<RetryConfig>;
  rateLimiterConfig?: Partial<RateLimiterConfig>;
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>;
}

export interface Metrics {
  // Using string keys to match METRICS constants
  [key: string]: number;
}

export class EmailError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCodeType,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'EmailError';
  }
}

// Type guards
export const isEmailStatus = (status: string): status is EmailStatusType => {
  return Object.values(EMAIL_STATUS).includes(status as any);
};

export const isCircuitState = (state: string): state is CircuitStateType => {
  return Object.values(CIRCUIT_STATE).includes(state as any);
};

export const isErrorCode = (code: string): code is ErrorCodeType => {
  return Object.values(ERROR_CODES).includes(code as any);
};