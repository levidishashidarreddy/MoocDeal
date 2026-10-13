/**
 * Rate Limiter for MoocDeal
 * Prevents spamming and abuse for sensitive actions like WhatsApp link sharing and reporting.
 */

interface RateLimitRecord {
  timestamps: number[];
}

class RateLimiterService {
  private inMemoryStore: Map<string, number[]> = new Map();
  private storageKeyPrefix = 'srmap_ratelimit_';

  private getTimestamps(key: string): number[] {
    const memory = this.inMemoryStore.get(key);
    if (memory) return memory;

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = localStorage.getItem(`${this.storageKeyPrefix}${key}`);
        if (stored) {
          const parsed = JSON.parse(stored) as number[];
          if (Array.isArray(parsed)) {
            this.inMemoryStore.set(key, parsed);
            return parsed;
          }
        }
      } catch (e) {
        // Fall back to memory
      }
    }
    return [];
  }

  private saveTimestamps(key: string, timestamps: number[]): void {
    this.inMemoryStore.set(key, timestamps);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(`${this.storageKeyPrefix}${key}`, JSON.stringify(timestamps));
      } catch (e) {
        // Ignore storage errors
      }
    }
  }

  /**
   * Check if an action is within allowed rate limits.
   * @param action Identifier for the action (e.g. 'link_update', 'report')
   * @param identifier User ID or IP/session ID
   * @param maxRequests Maximum requests allowed in the time window
   * @param windowMs Time window in milliseconds
   */
  checkRateLimit(
    action: string,
    identifier: string,
    maxRequests: number,
    windowMs: number
  ): {
    allowed: boolean;
    remaining: number;
    retryAfterSeconds: number;
  } {
    const key = `${action}:${identifier}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    const timestamps = this.getTimestamps(key).filter(t => t > windowStart);
    const count = timestamps.length;

    if (count >= maxRequests) {
      const oldestInWindow = timestamps[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldestInWindow + windowMs - now) / 1000));
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
      };
    }

    return {
      allowed: true,
      remaining: maxRequests - count,
      retryAfterSeconds: 0,
    };
  }

  /**
   * Record that an action occurred.
   */
  recordAction(action: string, identifier: string): void {
    const key = `${action}:${identifier}`;
    const now = Date.now();
    const timestamps = this.getTimestamps(key);
    timestamps.push(now);
    this.saveTimestamps(key, timestamps);
  }

  /**
   * Assert rate limit and record action in one step. Throws an Error if limit exceeded.
   */
  assertRateLimit(
    action: string,
    identifier: string,
    maxRequests: number,
    windowMs: number,
    friendlyActionName: string = 'requests'
  ): void {
    const result = this.checkRateLimit(action, identifier, maxRequests, windowMs);
    if (!result.allowed) {
      const mins = Math.ceil(result.retryAfterSeconds / 60);
      throw new Error(
        `Rate limit reached: Too many ${friendlyActionName}. Please wait ${mins} minute${
          mins > 1 ? 's' : ''
        } before trying again.`
      );
    }
    this.recordAction(action, identifier);
  }

  /**
   * Clear all limits (useful for testing)
   */
  reset(): void {
    this.inMemoryStore.clear();
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(this.storageKeyPrefix)) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
      } catch (e) {
        // Ignore
      }
    }
  }
}

export const rateLimiter = new RateLimiterService();
