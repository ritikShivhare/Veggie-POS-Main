import express from "express";
import http from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

// Import Setup & Context
import { initializeEventSubscribers } from "./server/features/shared/EventBusSetup";
import {
  monitoringService,
  jobsService,
  realtimeService
} from "./server/context";

// Import Route Groups
import authRouter from "./routes/auth.routes";
import inventoryRouter from "./routes/inventory.routes";
import billingRouter from "./routes/billing.routes";
import adminRouter from "./routes/admin.routes";
import posRouter from "./routes/pos.routes";
import sharedRouter from "./routes/shared.routes";

dotenv.config();

const app = express();
app.set("trust proxy", 1);
const PORT = Number(process.env.PORT) || 3000;

// Enable Helmet middleware with iframe-friendly parameters
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
    frameguard: false,
  })
);

// Enable CORS with secure dynamic allowlist and normalization
const normalizeOrigin = (o: string) => o.trim().replace(/\/+$/, "").toLowerCase();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(normalizeOrigin).filter(Boolean)
  : [];

const isProductionEnv =
  (process.env.NODE_ENV || "").trim().toLowerCase() === "production" ||
  (process.env.APP_ENV || "").trim().toLowerCase() === "production";

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, server-to-server, curl)
      if (!origin) return callback(null, true);

      const normalizedRequestOrigin = normalizeOrigin(origin);

      // In production, only allow strictly configured frontend origins
      if (isProductionEnv) {
        if (allowedOrigins.length > 0 && allowedOrigins.includes(normalizedRequestOrigin)) {
          return callback(null, true);
        }
        return callback(null, false);
      }

      // In non-production/development, support local testing and preview environments
      try {
        const parsed = new URL(origin);
        const host = parsed.hostname.toLowerCase();
        const isLocal = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
        const isAISDev = host.endsWith(".run.app") || host.endsWith(".google.com");
        const isConfigured = allowedOrigins.includes(normalizedRequestOrigin);

        if (isLocal || isAISDev || isConfigured) {
          return callback(null, true);
        }
      } catch {}

      return callback(null, false);
    },
    credentials: true,
  })
);

// Define Rate Limiters
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 login requests per window
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: {
    success: false,
    error: "TOO_MANY_REQUESTS",
    message: "Too many login attempts from this IP, please try again after 15 minutes."
  }
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300, // Limit each IP to 300 API requests per window
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: {
    success: false,
    error: "TOO_MANY_REQUESTS",
    message: "Too many requests from this IP, please try again later."
  }
});

// Apply rate limiting to API endpoints
app.use("/api/auth/login", loginLimiter);
app.use("/api", apiLimiter);

// Setup Request Parsing Middleware with safe limits (2MB global, isolated 10MB for bulk sync)
app.use(cookieParser());
app.use("/api/sync", express.json({ limit: "10mb" }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ limit: "2mb", extended: true }));

// Request performance & event telemetry middleware
app.use((req, res, next) => {
  if (req.path.startsWith("/api/monitoring") || req.path.startsWith("/@vite") || req.path.startsWith("/src")) {
    return next();
  }

  const start = Date.now();
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const level = status >= 500 ? "ERROR" : status >= 400 ? "WARN" : "INFO";
    
    monitoringService.log(
      level,
      "API_GATEWAY",
      `${req.method} ${req.path} - HTTP ${status}`,
      {
        method: req.method,
        path: req.path,
        status,
        ip: req.ip || req.headers["x-forwarded-for"] || "127.0.0.1",
        query: req.query
      },
      duration
    );
  });

  next();
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Mount Route Groups under /api
app.use("/api", authRouter);
app.use("/api", inventoryRouter);
app.use("/api", billingRouter);
app.use("/api", adminRouter);
app.use("/api", posRouter);
app.use("/api", sharedRouter);

// Global Error Handler (catches 503 DATABASE_UNAVAILABLE and other unhandled route errors)
import { handleApiError } from "./server/features/shared/database";
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  handleApiError(res, err);
});

// Ensure unhandled /api/* requests return JSON 404, never SPA HTML
app.all("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "NOT_FOUND",
    message: `API route ${req.method} ${req.originalUrl || req.path} not found.`
  });
});

// Capture process-level crashes and unhandled promise rejections (Backend Sentry equivalent)
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception on Node Server (Sentry Alert Captured):", error);
  monitoringService.error("BACKEND_PROCESS_CRASH", error.message || String(error), {
    stack: error.stack,
    name: error.name,
    timestamp: new Date().toISOString()
  }).catch(err => console.error("Failed to log process exception:", err));
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at Promise (Sentry Alert Captured):", reason);
  monitoringService.error("BACKEND_PROMISE_REJECTION", String(reason), {
    stack: (reason as any)?.stack || "No stack trace available",
    timestamp: new Date().toISOString()
  }).catch(err => console.error("Failed to log promise rejection:", err));
});

async function startServer() {
  // Initialize and register all EventBus subscribers (loose coupling)
  initializeEventSubscribers();

  // Start the background jobs scheduler
  await jobsService.startScheduler();

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const httpServer = http.createServer(app);

  // Attach server-mediated real-time WebSocket server
  realtimeService.attach(httpServer);

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

if (!process.env.VITEST) {
  startServer();
}

export { app };

