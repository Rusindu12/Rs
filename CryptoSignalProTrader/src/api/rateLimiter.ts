import { RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS } from '../utils/constants';

interface RequestRecord {
  timestamp: number;
}

class RateLimiter {
  private requests: RequestRecord[] = [];
  private queue: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];
  private isProcessing = false;
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = RATE_LIMIT_MAX_REQUESTS, windowMs: number = RATE_LIMIT_WINDOW_MS) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  private cleanupOldRequests(): void {
    const now = Date.now();
    this.requests = this.requests.filter(r => now - r.timestamp < this.windowMs);
  }

  private canMakeRequest(): boolean {
    this.cleanupOldRequests();
    return this.requests.length < this.maxRequests;
  }

  async waitForSlot(): Promise<void> {
    if (this.canMakeRequest()) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      if (this.canMakeRequest()) {
        const next = this.queue.shift();
        if (next) next.resolve();
      } else {
        const oldestRequest = this.requests[0];
        const waitTime = this.windowMs - (Date.now() - oldestRequest.timestamp) + 100;
        await new Promise(r => setTimeout(r, Math.min(waitTime, 1000)));
      }
    }

    this.isProcessing = false;
  }

  recordRequest(): void {
    this.requests.push({ timestamp: Date.now() });
  }

  async throttle<T>(fn: () => Promise<T>): Promise<T> {
    await this.waitForSlot();
    this.recordRequest();
    return fn();
  }

  getRequestCount(): number {
    this.cleanupOldRequests();
    return this.requests.length;
  }

  getRemainingRequests(): number {
    this.cleanupOldRequests();
    return Math.max(0, this.maxRequests - this.requests.length);
  }

  getResetTime(): number {
    if (this.requests.length === 0) return 0;
    const oldest = this.requests[0].timestamp;
    return Math.max(0, this.windowMs - (Date.now() - oldest));
  }

  reset(): void {
    this.requests = [];
    this.queue.forEach(({ resolve }) => resolve());
    this.queue = [];
  }
}

export const rateLimiter = new RateLimiter();
export default RateLimiter;
