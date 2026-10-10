/**
 * Server Startup Validation Module
 * Validates all critical environment variables and dependencies before starting the server
 * Ensures database, Redis, Stripe, and other services are properly configured
 */

import { MonitoringService } from "./server/features/shared/MonitoringService";

interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

function isProductionEnvironment(): boolean {
  const env = (process.env.NODE_ENV || "").trim().toLowerCase();
  const appEnv = (process.env.APP_ENV || "").trim().toLowerCase();
  return env === "production" || appEnv === "production";
}

/**
 * Validates critical Supabase configuration
 */
function validateSupabaseConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || supabaseUrl === "YOUR_SUPABASE_URL" || supabaseUrl.trim() === "") {
    errors.push("❌ SUPABASE_URL is not configured. Get it from https://supabase.com/dashboard");
  }

  if (!serviceRoleKey || serviceRoleKey === "YOUR_SUPABASE_SERVICE_ROLE_KEY" || serviceRoleKey.trim() === "") {
    errors.push("❌ SUPABASE_SERVICE_ROLE_KEY is not configured. Required for server-side database operations.");
  }

  if (!anonKey || anonKey === "YOUR_SUPABASE_ANON_KEY" || anonKey.trim() === "") {
    errors.push("❌ SUPABASE_ANON_KEY is not configured. Required for client-side Supabase access.");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates Redis cache configuration
 */
function validateRedisConfig(): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const redisUrl = process.env.REDIS_URL;
  const redisHost = process.env.REDIS_HOST;
  const redisPort = process.env.REDIS_PORT;

  if (!redisUrl && (!redisHost || !redisPort)) {
    warnings.push("⚠️  Redis is not configured. Cache and real-time sync will be unavailable.");
    warnings.push("   Set REDIS_URL or (REDIS_HOST + REDIS_PORT) for optimal performance.");
  }

  if (redisUrl && redisUrl === "redis://localhost:6379") {
    warnings.push("⚠️  Redis is pointing to localhost - this will fail in production containers.");
  }

  return {
    valid: true, // Non-critical, app continues with degraded features
    warnings
  };
}

/**
 * Validates Stripe payment gateway configuration
 */
function validateStripeConfig(isProd: boolean): { valid: boolean; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || stripeSecretKey === "YOUR_STRIPE_SECRET_KEY") {
    if (isProd) {
      errors.push("❌ STRIPE_SECRET_KEY is not configured in production. Billing will be unavailable.");
    } else {
      warnings.push("⚠️  STRIPE_SECRET_KEY is not configured. Using mock payment gateway for development.");
    }
  }

  if (!stripeWebhookSecret || stripeWebhookSecret === "YOUR_STRIPE_WEBHOOK_SECRET") {
    if (isProd) {
      warnings.push("⚠️  STRIPE_WEBHOOK_SECRET is not configured. Webhook signature verification disabled.");
    } else {
      warnings.push("⚠️  STRIPE_WEBHOOK_SECRET is not configured. Using fallback for webhook testing.");
    }
  }

  return {
    valid: !isProd || errors.length === 0,
    warnings,
    errors
  };
}

/**
 * Validates CORS origin configuration
 */
function validateCorsConfig(isProd: boolean): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").trim();

  if (!allowedOrigins) {
    if (isProd) {
      warnings.push("❌ ALLOWED_ORIGINS is not configured in production. CORS requests will be rejected.");
      warnings.push("   Set ALLOWED_ORIGINS to your frontend domain(s), e.g., 'https://app.example.com,https://www.example.com'");
    } else {
      warnings.push("ℹ️  ALLOWED_ORIGINS not set. Development mode allows localhost and *.run.app domains.");
    }
  }

  return {
    valid: true,
    warnings
  };
}

/**
 * Validates port configuration
 */
function validatePortConfig(): { valid: boolean; warnings: string[]; port: number } {
  const warnings: string[] = [];
  const portEnv = process.env.PORT || "3000";
  const port = Number(portEnv);

  if (isNaN(port) || port < 1 || port > 65535) {
    warnings.push(`⚠️  Invalid PORT: ${portEnv}. Defaulting to 3000.`);
    return { valid: true, warnings, port: 3000 };
  }

  return { valid: true, warnings, port };
}

/**
 * Validates Node.js environment configuration
 */
function validateNodeEnv(): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const nodeEnv = (process.env.NODE_ENV || "").trim().toLowerCase();
  const appEnv = (process.env.APP_ENV || "").trim().toLowerCase();

  if (!nodeEnv) {
    warnings.push("⚠️  NODE_ENV is not set. Defaulting to 'development'. For production, set NODE_ENV=production");
  }

  if (!appEnv) {
    warnings.push("⚠️  APP_ENV is not set. Recommended for consistency: set APP_ENV=production in production deployments.");
  }

  return {
    valid: true,
    warnings
  };
}

/**
 * Comprehensive validation of all server configuration
 */
export async function validateServerConfiguration(): Promise<ValidationResult> {
  const isProd = isProductionEnvironment();
  const result: ValidationResult = {
    success: true,
    errors: [],
    warnings: []
  };

  console.log("\n" + "=".repeat(70));
  console.log("🔍 VeggiePOS Server Configuration Validation");
  console.log("=".repeat(70) + "\n");

  // 1. Validate Supabase (CRITICAL)
  const supabaseValidation = validateSupabaseConfig();
  if (!supabaseValidation.valid) {
    result.errors.push(...supabaseValidation.errors);
    result.success = false;
  } else {
    console.log("✅ Supabase configuration: OK");
  }

  // 2. Validate Redis
  const redisValidation = validateRedisConfig();
  result.warnings.push(...redisValidation.warnings);
  if (redisValidation.warnings.length > 0) {
    console.log("⚠️  Redis configuration: WARNINGS");
  } else {
    console.log("✅ Redis configuration: OK");
  }

  // 3. Validate Stripe
  const stripeValidation = validateStripeConfig(isProd);
  result.errors.push(...stripeValidation.errors);
  result.warnings.push(...stripeValidation.warnings);
  if (!stripeValidation.valid) {
    result.success = false;
    console.log("❌ Stripe configuration: ERRORS");
  } else if (stripeValidation.warnings.length > 0) {
    console.log("⚠️  Stripe configuration: WARNINGS");
  } else {
    console.log("✅ Stripe configuration: OK");
  }

  // 4. Validate CORS
  const corsValidation = validateCorsConfig(isProd);
  result.warnings.push(...corsValidation.warnings);
  if (corsValidation.warnings.length > 0) {
    console.log("⚠️  CORS configuration: WARNINGS");
  } else {
    console.log("✅ CORS configuration: OK");
  }

  // 5. Validate Port
  const portValidation = validatePortConfig();
  result.warnings.push(...portValidation.warnings);
  if (portValidation.warnings.length > 0) {
    console.log("⚠️  Port configuration: WARNINGS");
  } else {
    console.log("✅ Port configuration: OK");
  }

  // 6. Validate Node Env
  const nodeEnvValidation = validateNodeEnv();
  result.warnings.push(...nodeEnvValidation.warnings);
  if (nodeEnvValidation.warnings.length > 0) {
    console.log("⚠️  Node environment: WARNINGS");
  } else {
    console.log("✅ Node environment: OK");
  }

  console.log("\n" + "-".repeat(70));

  // Print all warnings
  if (result.warnings.length > 0) {
    console.log("\n⚠️  WARNINGS:");
    result.warnings.forEach((warning, index) => {
      console.log(`${index + 1}. ${warning}`);
    });
  }

  // Print all errors
  if (result.errors.length > 0) {
    console.log("\n❌ ERRORS:");
    result.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error}`);
    });
  }

  console.log("\n" + "=".repeat(70));

  if (result.success) {
    console.log("✅ All critical configurations validated successfully!");
    console.log(isProd ? "🚀 Ready for production deployment.\n" : "✓ Ready to start development server.\n");
  } else {
    console.log("❌ Server configuration validation FAILED!");
    console.log("🛑 Fix the errors above and restart the server.\n");
  }

  console.log("=".repeat(70) + "\n");

  return result;
}

/**
 * Validates Supabase connection (async)
 */
export async function validateSupabaseConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    const { createClient } = require("@supabase/supabase-js");
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return { connected: false, error: "Supabase credentials not configured" };
    }

    const client = createClient(supabaseUrl, supabaseKey);
    const { error } = await client.from("tenant_objects").select("count").limit(1);

    if (error) {
      return { connected: false, error: error.message };
    }

    console.log("✅ Supabase database connection: OK");
    return { connected: true };
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    console.error("❌ Supabase connection failed:", errorMsg);
    return { connected: false, error: errorMsg };
  }
}

/**
 * Validates Redis connection (async)
 */
export async function validateRedisConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    const Redis = require("ioredis");
    const redisUrl = process.env.REDIS_URL;
    const redisConfig = redisUrl
      ? redisUrl
      : {
          host: process.env.REDIS_HOST || "localhost",
          port: Number(process.env.REDIS_PORT) || 6379,
          password: process.env.REDIS_PASSWORD
        };

    const redis = new Redis(redisConfig);

    const pong = await redis.ping();
    redis.disconnect();

    if (pong === "PONG") {
      console.log("✅ Redis cache connection: OK");
      return { connected: true };
    }

    return { connected: false, error: "Unexpected Redis response" };
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    console.warn("⚠️  Redis connection failed:", errorMsg);
    console.warn("   Continuing with in-memory cache - performance may be degraded");
    return { connected: false, error: errorMsg };
  }
}

export default validateServerConfiguration;
