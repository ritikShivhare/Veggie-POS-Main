import { Request, Response, NextFunction } from "express";
import { IdempotencyService } from "../features/shared/IdempotencyService";

const idempotencyService = IdempotencyService.getInstance();

/**
 * Idempotency Middleware for Payments, Orders & Critical Mutation Endpoints.
 * 
 * - Accepts 'Idempotency-Key' header (or 'x-idempotency-key').
 * - Validates unique constraint on (tenant_id, idempotency_key).
 * - If duplicate request arrives with existing key, returns the cached previous response immediately
 *   with an 'Idempotent-Replayed: true' header without re-executing logic.
 * - Deduplicates concurrent twin requests in-flight.
 */
export async function idempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
  const rawKey = req.headers["idempotency-key"] || req.headers["x-idempotency-key"];

  // If no idempotency key was supplied by the client, proceed normally
  if (!rawKey) {
    return next();
  }

  const idempotencyKey = String(rawKey).trim();

  // Validate format and reasonable length
  if (!idempotencyKey || idempotencyKey.length > 255) {
    return res.status(400).json({
      success: false,
      error: "INVALID_IDEMPOTENCY_KEY",
      message: "The Idempotency-Key header is invalid or exceeds 255 characters."
    });
  }

  // Determine tenantId scope
  const tenantId = 
    (req as any).tenantId ||
    (req.headers["x-tenant-id"] as string) ||
    req.body?.tenantId ||
    (req.query?.tenantId as string) ||
    "default";

  try {
    // 1. Check if a previously completed request exists for (tenant_id, idempotency_key)
    let record = await idempotencyService.getRecord(tenantId, idempotencyKey);

    // 2. Check if a concurrent request with the same key is currently in-flight
    if (!record && idempotencyService.isInFlight(tenantId, idempotencyKey)) {
      record = await idempotencyService.waitForInFlight(tenantId, idempotencyKey);
    }

    // 3. Final fallback check if record was written while waiting
    if (!record) {
      record = await idempotencyService.getRecord(tenantId, idempotencyKey);
    }

    if (record) {
      res.setHeader("Idempotent-Replayed", "true");
      res.setHeader("Idempotency-Key", idempotencyKey);
      return res.status(record.status_code).json(record.response_body);
    }

    // 4. Mark key as in-flight on this instance to serialize twin requests
    idempotencyService.startInFlight(tenantId, idempotencyKey);

    // Clean up if connection closes prematurely
    res.on("close", () => {
      if (!res.writableEnded) {
        idempotencyService.abortInFlight(tenantId, idempotencyKey, new Error("Client connection closed prematurely"));
      }
    });

    // 4. Intercept res.json to capture and store the response upon completion
    const originalJson = res.json.bind(res);

    res.json = function (body: any) {
      const statusCode = res.statusCode || 200;

      // Always echo back the confirmed Idempotency-Key
      res.setHeader("Idempotency-Key", idempotencyKey);

      // Save to idempotency storage under UNIQUE(tenant_id, idempotency_key)
      idempotencyService
        .saveRecord({
          tenant_id: tenantId,
          idempotency_key: idempotencyKey,
          status_code: statusCode,
          response_body: body,
          request_path: req.originalUrl || req.path,
          request_method: req.method
        })
        .catch((err) => {
          console.warn(`[Idempotency] Failed to save idempotency response for ${idempotencyKey}:`, err);
        });

      return originalJson(body);
    };

    next();
  } catch (error: any) {
    idempotencyService.abortInFlight(tenantId, idempotencyKey, error);
    next(error);
  }
}
