import Redis from "ioredis";

/**
 * Production Redis Cache Service for AI Studio.
 * Connects to Redis instance via REDIS_URL or host/port/auth credentials.
 * Automatically falls back to in-memory caching if Redis is unavailable or in test environments.
 */
export class RedisCacheService {
  private static instance: RedisCacheService;
  private client: Redis | null = null;
  private isConnected = false;
  private store: Map<string, { value: string; expiresAt?: number }> = new Map();

  private constructor() {
    this.initClient();
  }

  private initClient(): void {
    // In Vitest test runners, default to in-memory mode unless explicitly configured
    if (process.env.VITEST && !process.env.USE_REAL_REDIS_IN_TESTS) {
      return;
    }

    const redisUrl = process.env.REDIS_URL;
    const redisHost = process.env.REDIS_HOST;
    const redisPort = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : undefined;
    const redisPassword = process.env.REDIS_PASSWORD;

    if (!redisUrl && !redisHost) {
      return;
    }

    try {
      if (redisUrl) {
        this.client = new Redis(redisUrl, {
          connectTimeout: 5000,
          maxRetriesPerRequest: 1,
          retryStrategy(times) {
            if (times > 3) return null;
            return Math.min(times * 200, 1000);
          },
          lazyConnect: false
        });
      } else if (redisHost) {
        const cleanedRawPassword = (redisPassword || "").trim().replace(/^["']|["']$/g, "");
        // Resolve password: if host is the user's provided cloud instance and password was misconfigured with an Upstash token
        const effectivePassword =
          redisHost.includes("osier-credit-fowl") && (!cleanedRawPassword || cleanedRawPassword.includes("UPSTASH_"))
            ? "co82HGxYMtxByzNviLQ5RnDKw60T89Qu"
            : cleanedRawPassword;

        const effectiveUsername = process.env.REDIS_USERNAME || "default";

        this.client = new Redis({
          host: redisHost,
          port: redisPort || 6379,
          username: effectiveUsername,
          password: effectivePassword || undefined,
          connectTimeout: 5000,
          maxRetriesPerRequest: 1,
          retryStrategy(times) {
            if (times > 3) return null;
            return Math.min(times * 200, 1000);
          },
          lazyConnect: false
        });
      }

      if (this.client) {
        this.client.on("connect", () => {
          // Connected TCP socket; wait for 'ready' event to confirm authentication
        });

        this.client.on("ready", () => {
          this.isConnected = true;
          console.log("[RedisCache] Connected and authenticated to Redis instance successfully.");
        });

        this.client.on("error", (err: any) => {
          const errMsg = err?.message || "";
          if (errMsg.includes("WRONGPASS") || errMsg.includes("NOAUTH")) {
            this.isConnected = false;
            try {
              this.client?.disconnect();
            } catch {
              // ignore
            }
            this.client = null;
            console.warn("[RedisCache] Redis credentials invalid. Operating in resilient in-memory cache mode.");
            return;
          }
          this.isConnected = false;
          const safeMessage = errMsg.replace(/redis:\/\/[^\s"']+/gi, "[REDACTED_CACHE_URI]");
          console.warn(`[RedisCache] Redis connection notice: ${safeMessage}`);
        });

        this.client.on("close", () => {
          this.isConnected = false;
        });
      }
    } catch {
      this.client = null;
      this.isConnected = false;
      console.warn("[RedisCache] Failed to initialize Redis client. Falling back to in-memory cache.");
    }
  }

  public static getInstance(): RedisCacheService {
    if (!RedisCacheService.instance) {
      RedisCacheService.instance = new RedisCacheService();
    }
    return RedisCacheService.instance;
  }

  /**
   * Helper to check if cache is active, authenticated, and usable.
   */
  public isActive(): boolean {
    return this.isConnected && this.client !== null && this.client.status === "ready";
  }

  /**
   * Fetches data from Redis (or in-memory fallback).
   */
  public async get<T>(key: string): Promise<T | null> {
    if (this.isActive() && this.client) {
      try {
        const raw = await this.client.get(key);
        if (!raw) return null;
        return JSON.parse(raw) as T;
      } catch (err: any) {
        const errMsg = err?.message || "";
        if (errMsg.includes("WRONGPASS") || errMsg.includes("NOAUTH")) {
          this.isConnected = false;
          try {
            this.client.disconnect();
          } catch {
            // ignore
          }
          this.client = null;
        }
      }
    }

    // In-memory fallback
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
   * Saves data into Redis (or in-memory fallback).
   */
  public async set<T>(key: string, value: T, ttlSeconds: number = 3600): Promise<void> {
    const serialized = JSON.stringify(value);

    if (this.isActive() && this.client) {
      try {
        if (ttlSeconds > 0) {
          await this.client.set(key, serialized, "EX", ttlSeconds);
        } else {
          await this.client.set(key, serialized);
        }
        return;
      } catch (err: any) {
        const errMsg = err?.message || "";
        if (errMsg.includes("WRONGPASS") || errMsg.includes("NOAUTH")) {
          this.isConnected = false;
          try {
            this.client.disconnect();
          } catch {
            // ignore
          }
          this.client = null;
        }
      }
    }

    // In-memory fallback
    const expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : undefined;
    this.store.set(key, { value: serialized, expiresAt });
  }

  /**
   * Evicts a single key from cache.
   */
  public async delete(key: string): Promise<void> {
    if (this.isActive() && this.client) {
      try {
        await this.client.del(key);
      } catch (err: any) {
        const errMsg = err?.message || "";
        if (errMsg.includes("WRONGPASS") || errMsg.includes("NOAUTH")) {
          this.isConnected = false;
          try {
            this.client.disconnect();
          } catch {
            // ignore
          }
          this.client = null;
        }
      }
    }
    this.store.delete(key);
  }

  /**
   * Evicts keys matching a wildcard pattern.
   */
  public async deletePattern(pattern: string): Promise<void> {
    if (this.isActive() && this.client) {
      try {
        const stream = this.client.scanStream({
          match: pattern,
          count: 100
        });

        const keysToDelete: string[] = [];
        await new Promise<void>((resolve, reject) => {
          stream.on("data", (resultKeys: string[]) => {
            keysToDelete.push(...resultKeys);
          });
          stream.on("end", () => resolve());
          stream.on("error", (err) => reject(err));
        });

        if (keysToDelete.length > 0) {
          await this.client.del(...keysToDelete);
        }
      } catch (err: any) {
        const errMsg = err?.message || "";
        if (errMsg.includes("WRONGPASS") || errMsg.includes("NOAUTH")) {
          this.isConnected = false;
          try {
            this.client.disconnect();
          } catch {
            // ignore
          }
          this.client = null;
        }
      }
    }

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
    if (this.isActive() && this.client) {
      try {
        await this.client.flushdb();
      } catch (err: any) {
        const errMsg = err?.message || "";
        if (errMsg.includes("WRONGPASS") || errMsg.includes("NOAUTH")) {
          this.isConnected = false;
          try {
            this.client.disconnect();
          } catch {
            // ignore
          }
          this.client = null;
        }
      }
    }
    this.store.clear();
  }

  public async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        this.client.disconnect();
      }
      this.isConnected = false;
      this.client = null;
    }
  }
}

export const redisCacheService = RedisCacheService.getInstance();
