import Redis from "ioredis";

export class RedisCacheService {
  private static instance: RedisCacheService;
  private client: Redis | null = null;
  private isEnabled: boolean = false;
  private hasInitialized: boolean = false;

  private constructor() {
    this.init();
  }

  public static getInstance(): RedisCacheService {
    if (!RedisCacheService.instance) {
      RedisCacheService.instance = new RedisCacheService();
    }
    return RedisCacheService.instance;
  }

  private init() {
    if (this.hasInitialized) return;
    this.hasInitialized = true;

    let redisUrl = process.env.REDIS_URL;
    const redisHost = process.env.REDIS_HOST || "127.0.0.1";
    const redisPort = parseInt(process.env.REDIS_PORT || "6379", 10);
    const redisPassword = process.env.REDIS_PASSWORD;

    // Sanitize REDIS_URL if it is malformed or has missing protocols (e.g., //stunning-wren-130543.upstash.io)
    if (redisUrl) {
      redisUrl = redisUrl.trim();
      if (redisUrl.startsWith("https://")) {
        redisUrl = redisUrl.replace("https://", "rediss://");
      } else if (redisUrl.startsWith("http://")) {
        redisUrl = redisUrl.replace("http://", "redis://");
      } else if (redisUrl.startsWith("//")) {
        if (redisUrl.includes("upstash.io")) {
          redisUrl = "rediss:" + redisUrl;
        } else {
          redisUrl = "redis:" + redisUrl;
        }
      } else if (!redisUrl.includes("://")) {
        if (redisUrl.includes("upstash.io")) {
          redisUrl = "rediss://" + redisUrl;
        } else {
          redisUrl = "redis://" + redisUrl;
        }
      }
    }

    // Determine if Redis connection parameters are specified
    if (!redisUrl && !process.env.REDIS_HOST) {
      this.isEnabled = false;
      return;
    }

    try {
      if (redisUrl) {
        console.log(`[RedisCacheService] Connecting to Redis via URL: ${redisUrl.replace(/:[^:@]+@/, ":****@")}`);
        this.client = new Redis(redisUrl, {
          password: redisPassword,
          maxRetriesPerRequest: 1,
          connectTimeout: 3000,
          retryStrategy(times) {
            if (times > 2) {
              console.warn("[RedisCacheService] Redis connection attempts failed. Disabling Redis caching.");
              return null; // Stop retrying
            }
            return Math.min(times * 500, 2000);
          }
        });
      } else {
        console.log(`[RedisCacheService] Attempting connection to Redis at ${redisHost}:${redisPort}`);
        this.client = new Redis({
          host: redisHost,
          port: redisPort,
          password: redisPassword,
          maxRetriesPerRequest: 1,
          connectTimeout: 3000,
          retryStrategy(times) {
            if (times > 2) {
              console.warn("[RedisCacheService] Redis connection attempts failed. Disabling Redis caching.");
              return null; // Stop retrying
            }
            return Math.min(times * 500, 2000);
          }
        });
      }

      this.client.on("connect", () => {
        console.log("[RedisCacheService] Redis connection established successfully.");
        this.isEnabled = true;
      });

      this.client.on("error", (err) => {
        console.warn(`[RedisCacheService] Redis encountered an error: ${err.message}`);
        // If not yet connected, disable caching gracefully to prevent request blockage
        if (!this.isEnabled) {
          console.warn("[RedisCacheService] Redis caching is now DISABLED. All operations will fall back to direct database reads.");
        }
      });

      this.client.on("end", () => {
        console.warn("[RedisCacheService] Redis connection closed. Disabling Redis caching.");
        this.isEnabled = false;
      });

    } catch (err: any) {
      console.error("[RedisCacheService] Critical error initializing Redis client:", err.message);
      this.isEnabled = false;
    }
  }

  /**
   * Helper to check if Redis is active and usable.
   */
  public isActive(): boolean {
    return this.isEnabled && this.client !== null;
  }

  /**
   * Fetches data from cache.
   */
  public async get<T>(key: string): Promise<T | null> {
    if (!this.isActive() || !this.client) return null;
    try {
      const cached = await this.client.get(key);
      if (!cached) return null;
      return JSON.parse(cached) as T;
    } catch (err: any) {
      console.warn(`[RedisCacheService] Failed to GET key "${key}":`, err.message);
      return null;
    }
  }

  /**
   * Saves data into cache.
   */
  public async set<T>(key: string, value: T, ttlSeconds: number = 3600): Promise<void> {
    if (!this.isActive() || !this.client) return;
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds > 0) {
        await this.client.set(key, serialized, "EX", ttlSeconds);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (err: any) {
      console.warn(`[RedisCacheService] Failed to SET key "${key}":`, err.message);
    }
  }

  /**
   * Evicts a single key from cache.
   */
  public async delete(key: string): Promise<void> {
    if (!this.isActive() || !this.client) return;
    try {
      await this.client.del(key);
    } catch (err: any) {
      console.warn(`[RedisCacheService] Failed to DELETE key "${key}":`, err.message);
    }
  }

  /**
   * Evicts keys matching a wildcard pattern (e.g. "veggiepos:tenant:t1:*").
   * Uses scanStream to protect Redis from blocking on KEYS operations.
   */
  public async deletePattern(pattern: string): Promise<void> {
    if (!this.isActive() || !this.client) return;
    try {
      const stream = this.client.scanStream({
        match: pattern,
        count: 100
      });

      for await (const keys of stream) {
        if (keys && keys.length > 0) {
          await this.client.del(...keys);
          console.log(`[RedisCacheService] Evicted ${keys.length} keys matching pattern: ${pattern}`);
        }
      }
    } catch (err: any) {
      console.warn(`[RedisCacheService] Failed to DELETE pattern "${pattern}":`, err.message);
    }
  }

  /**
   * Clears all cache entries.
   */
  public async clearAll(): Promise<void> {
    if (!this.isActive() || !this.client) return;
    try {
      await this.client.flushdb();
      console.log("[RedisCacheService] Database cache flushed completely.");
    } catch (err: any) {
      console.error("[RedisCacheService] Failed to flush cache database:", err.message);
    }
  }
}

export const redisCacheService = RedisCacheService.getInstance();
