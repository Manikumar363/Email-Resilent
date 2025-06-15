import { EmailMessage, EmailStatus } from '../core/types';

type QueueItem = {
  message: EmailMessage;
  process: (message: EmailMessage) => Promise<EmailStatus>;
  attempts: number;
  resolve: (value: EmailStatus) => void;
  reject: (error: Error) => void;
};

export class Queue {
  private queue: QueueItem[] = [];
  private processing = false;
  private readonly maxAttempts: number;
  private readonly getCurrentTime: () => number;

  constructor(maxAttempts: number, getCurrentTime: () => number = Date.now) {
    this.maxAttempts = maxAttempts;
    this.getCurrentTime = getCurrentTime;
  }

  async enqueue(
    message: EmailMessage,
    processor: (message: EmailMessage) => Promise<EmailStatus>
  ): Promise<EmailStatus> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        message,
        process: processor,
        attempts: 0,
        resolve,
        reject,
      });

      if (!this.processing) {
        this.process();
      }
    });
  }

  private async process(): Promise<void> {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const item = this.queue[0];

    try {
      const status = await item.process(item.message);
      item.resolve(status);
    } catch (error) {
      if (item.attempts < this.maxAttempts) {
        item.attempts++;
        // Put the item back at the end of the queue
        this.queue.push(this.queue.shift()!);
      } else {
        item.reject(error as Error);
      }
    }

    // Remove the processed item
    this.queue.shift();

    // Process next item
    setImmediate(() => this.process());
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
    this.processing = false;
  }
}