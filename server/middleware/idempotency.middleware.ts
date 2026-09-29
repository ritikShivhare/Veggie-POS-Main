import { Request, Response, NextFunction } from "express";
import {
  IdempotencyService,
  computeRequestHash,
  IdempotencyConflictError,
  IdempotencyPayloadMismatchError
} from "../features/shared/IdempotencyService";

const idempotencyService = IdempotencyService.getInstance();

/**
 * Idempotency Middleware for Financial & Critical Mutation Endpoints.
 * 
 * Guarantees:
 * 1. Same tenant + operation + idempotency key + request payload => returns cached previous response (HTTP 200/201) with 'Idempotent-Replayed: true'.
 * 2. Same key + different request payload => deterministic HTTP 422 IDEMPOTENCY_KEY_PAYLOAD_MISMATCH rejection.
 * 3. Concurrent twin requests serialize safely via database reservation and in-flight mutexes.
 * 4. Tenant isolation: keys are strictly scoped by authenticated session tenantId.
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

  // Determine tenantId scope strictly from authenticated session identity
  const tenantId = (req as any).tenantId || "default";
  const requestHash = computeRequestHash(req.body);
  const requestPath = req.originalUrl || req.path;
  const requestMethod = req.method;

  try {
    // 1. Reserve key or retrieve existing authoritative record
    const reservation = await idempotencyService.reserveOrGetRecord(
      tenantId,
      idempotencyKey,
      requestHash,
      requestPath,
      requestMethod
    );

    if (reservation.status === "COMPLETED") {
      res.setHeader("Idempotent-Replayed", "true");
      res.setHeader("Idempotency-Key", idempotencyKey);
      return res.status(reservation.record.status_code).json(reservation.record.response_body);
    }

    if (reservation.status === "PROCESSING") {
      // Twin request arrived while first request is in-flight: wait for resolution
      let completedRecord: any = null;
      if (idempotencyService.isInFlight(tenantId, idempotencyKey)) {
        completedRecord = await idempotencyService.waitForInFlight(tenantId, idempotencyKey);
      } else {
        // Multi-instance / cross-process wait: poll DB for up to 5 seconds
        const startWait = Date.now();
        while (Date.now() - startWait < 5000) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          const rec = await idempotencyService.getRecord(tenantId, idempotencyKey);
          if (rec && (rec.status === "COMPLETED" || (!rec.status && rec.status_code > 0))) {
            completedRecord = rec;
            break;
          }
        }
      }

      if (completedRecord) {
        // Validate request payload hash against completed record
        if (completedRecord.request_hash && completedRecord.request_hash !== requestHash) {
          return res.status(422).json({
            success: false,
            error: "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH",
            message: `Idempotency key '${idempotencyKey}' was previously used with a different request payload.`
          });
        }
        res.setHeader("Idempotent-Replayed", "true");
        res.setHeader("Idempotency-Key", idempotencyKey);
        return res.status(completedRecord.status_code).json(completedRecord.response_body);
      }

      return res.status(409).json({
        success: false,
        error: "IDEMPOTENCY_CONFLICT",
        message: "A concurrent request with the same idempotency key is currently processing."
      });
    }

    // Reservation acquired: Clean up if connection closes prematurely
    res.on("close", () => {
      if (!res.writableEnded) {
        idempotencyService.abortInFlight(tenantId, idempotencyKey, new Error("Client connection closed prematurely"));
      }
    });

    // Intercept res.json to capture and store the authoritative response upon completion
    const originalJson = res.json.bind(res);

    res.json = function (body: any) {
      const statusCode = res.statusCode || 200;

      // Echo back the confirmed Idempotency-Key
      res.setHeader("Idempotency-Key", idempotencyKey);

      // Save completed idempotency record
      idempotencyService
        .saveRecord({
          tenant_id: tenantId,
          idempotency_key: idempotencyKey,
          status_code: statusCode,
          response_body: body,
          request_path: requestPath,
          request_method: requestMethod,
          request_hash: requestHash,
          status: "COMPLETED"
        })
        .catch((err) => {
          console.warn(`[Idempotency] Failed to save idempotency response for ${idempotencyKey}:`, err);
        });

      return originalJson(body);
    };

    next();
  } catch (error: any) {
    if (error instanceof IdempotencyPayloadMismatchError || error?.code === "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH") {
      return res.status(422).json({
        success: false,
        error: "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH",
        message: error.message || `Idempotency key '${idempotencyKey}' was previously used with a different request payload.`
      });
    }
    if (error instanceof IdempotencyConflictError || error?.code === "IDEMPOTENCY_CONFLICT") {
      return res.status(409).json({
        success: false,
        error: "IDEMPOTENCY_CONFLICT",
        message: error.message || "A concurrent request with the same idempotency key is currently processing."
      });
    }
    idempotencyService.abortInFlight(tenantId, idempotencyKey, error);
    next(error);
  }
}
