/**
 * In-Memory Redis Cache Service Mock for AI Studio.
 * When external Redis is not connected, cache is bypassed to ensure transactional consistency.
 */
export class RedisCacheService {
  private static instance: RedisCacheService;
  private store: Map<string, { value: string; expiresAt?: number }> = new Map();

  private constructor() {}

  public static getInstance(): RedisCacheService {
    if (!RedisCacheService.instance) {
      RedisCacheService.instance = new RedisCacheService();
    }
    return RedisCacheService.instance;
  }

  /**
   * Helper to check if cache is active and usable.
   */
  public isActive(): boolean {
    return false;
  }

  /**
   * Fetches data from in-memory cache.
   */
  public async get<T>(key: string): Promise<T | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    try {
      return JSON.parse(item.value) as T;
    } catch {
      return null;
    }
  }

  /**
   * Saves data into in-memory cache.
   */
  public async set<T>(key: string, value: T, ttlSeconds: number = 3600): Promise<void> {
    const serialized = JSON.stringify(value);
    const expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : undefined;
    this.store.set(key, { value: serialized, expiresAt });
  }

  /**
   * Evicts a single key from cache.
   */
  public async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  /**
   * Evicts keys matching a wildcard pattern.
   */
  public async deletePattern(pattern: string): Promise<void> {
    const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
    for (const key of Array.from(this.store.keys())) {
      if (regex.test(key)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Clears all cache entries.
   */
  public async clearAll(): Promise<void> {
    this.store.clear();
  }
}

export const redisCacheService = RedisCacheService.getInstance();
