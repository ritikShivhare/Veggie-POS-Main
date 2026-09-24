import Redis from "ioredis";
import { lookup } from "dns/promises";

export class RedisCacheService {
  private static instance: RedisCacheService;
  private client: Redis | null = null;
  private isEnabled: boolean = false;
  private hasInitialized: boolean = false;

  private constructor() {
    this.init().catch(() => {
      this.isEnabled = false;
      this.client = null;
    });
  }

  public static getInstance(): RedisCacheService {
    if (!RedisCacheService.instance) {
      RedisCacheService.instance = new RedisCacheService();
    }
    return RedisCacheService.instance;
  }

  private async init() {
    if (this.hasInitialized) return;
    this.hasInitialized = true;

    let redisUrl = process.env.REDIS_URL;
    const redisHost = process.env.REDIS_HOST;
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
    if (!redisUrl && !redisHost) {
      this.isEnabled = false;
      return;
    }

    // Pre-flight host check to avoid unhandled DNS/socket connection errors
    let targetHost: string | null = null;
    if (redisUrl) {
      try {
        let clean = redisUrl;
        if (!clean.includes("://")) clean = "redis://" + clean;
        clean = clean.replace(/^https?:\/\//, "redis://").replace(/^rediss?:\/\//, "redis://");
        const parsed = new URL(clean);
        targetHost = parsed.hostname;
      } catch {
        targetHost = null;
      }
    } else if (redisHost) {
      targetHost = redisHost;
    }

    if (targetHost && targetHost !== "localhost" && targetHost !== "127.0.0.1") {
      try {
        await Promise.race([
          lookup(targetHost),
          new Promise((_, reject) => setTimeout(() => reject(new Error("DNS timeout")), 1500))
        ]);
      } catch (err: any) {
        console.log(`[RedisCacheService] Host "${targetHost}" is unreachable (${err?.code || err?.message || "DNS error"}). Operating with resilient in-memory cache fallback.`);
        this.isEnabled = false;
        this.client = null;
        return;
      }
    }

    try {
      const commonOptions = {
        password: redisPassword,
        maxRetriesPerRequest: 1,
        connectTimeout: 2500,
        lazyConnect: true,
        enableOfflineQueue: false,
        retryStrategy: () => null // Do not retry on initial failure
      };

      if (redisUrl) {
        this.client = new Redis(redisUrl, commonOptions);
      } else {
        this.client = new Redis({
          host: redisHost || "127.0.0.1",
          port: redisPort,
          ...commonOptions
        });
      }

      this.client.on("connect", () => {
        this.isEnabled = true;
      });

      this.client.on("ready", () => {
        this.isEnabled = true;
        console.log("[RedisCacheService] Redis connection established successfully.");
      });

      this.client.on("error", (err) => {
        if (this.isEnabled) {
          console.log(`[RedisCacheService] Redis connection interrupted: ${err.message}. Falling back to in-memory cache.`);
          this.isEnabled = false;
        }
      });

      this.client.on("close", () => {
        this.isEnabled = false;
      });

      this.client.on("end", () => {
        this.isEnabled = false;
      });

      await this.client.connect();
    } catch (err: any) {
      this.isEnabled = false;
      if (this.client) {
        try {
          this.client.disconnect(false);
        } catch {}
        this.client = null;
      }
      console.log(`[RedisCacheService] Redis unavailable (${err?.message || "connection error"}). Operating with resilient in-memory cache fallback.`);
    }
  }

  /**
   * Helper to check if Redis is active and usable.
   */
  public isActive(): boolean {
    return this.isEnabled && this.client !== null && this.client.status === "ready";
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
