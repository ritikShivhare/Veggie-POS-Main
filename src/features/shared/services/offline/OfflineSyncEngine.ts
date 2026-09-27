/**
 * Veggie POS - Offline Sync Engine
 * 
 * Orchestrates reliable synchronization when network connectivity returns:
 * 1. Loads pending outbox operations (FIFO ordered, respecting backoff).
 * 2. Processes each operation safely without blocking the UI.
 * 3. Sends idempotency key ('Idempotency-Key'), tenant header ('x-tenant-id'),
 *    branch header ('x-branch-id'), device header ('x-device-id'), and session token.
 * 4. Server validates tenant and branch (strict anti-spoofing and authorization).
 * 5. Server performs transactional write (atomic commit).
 * 6. Server returns canonical entity and optimistic version.
 * 7. Marks outbox operation 'SYNCED' (in IndexedDB).
 * 8. Updates local IndexedDB entities with the canonical data and version.
 * 9. Broadcasts realtime sync events to local window / WebSocket listeners.
 * 10. Continues processing the remaining queue.
 * 
 * Critical Safety Invariant:
 * NEVER deletes an outbox operation before confirmed server success.
 * 
 * Retry & Error Policies:
 * - 409 Conflict: Marks operation 'conflict', pulls latest state, updates version, and pauses that conflict entity.
 * - 401 Auth Failure: Pauses queue, marks 'auth_error', waits for session renewal/re-login.
 * - 403 Forbidden / Plan Exceeded: Marks 'validation_error', prevents infinite loop, continues queue.
 * - 422 Unprocessable / Validation Failure: Marks 'validation_error', records server validation error, skips further retries.
 * - 429 Rate Limit: Backs off respecting 'Retry-After' header (or 30s default) and pauses queue.
 * - 500 / 502 / 503 / 504 Server Failure: Applies exponential backoff (1s, 2s, 4s... max 60s + jitter), preserves in queue.
 * - Network Timeout / Disconnect: Pauses queue, sets backoff, waits for next online/reconnect event.
 */

import { offlineRepository, OfflineRepository } from "./OfflineRepository";
import { OfflineOutboxItem } from "./types";
import { ApiClient } from "../api";

export interface SyncEngineResult {
  processed: number;
  synced: number;
  failed: number;
  conflicts: number;
  authErrors: number;
  validationErrors: number;
  rateLimited: number;
}

export type ProcessOperationResult =
  | "SYNCED"
  | "CONFLICT"
  | "FAILED"
  | "AUTH_BLOCKED"
  | "FORBIDDEN"
  | "VALIDATION_FAILED"
  | "RATE_LIMITED"
  | "NETWORK_ERROR";

export interface SyncEngineOptions {
  deleteAfterSync?: boolean;
  fetchFn?: typeof fetch;
  baseUrl?: string;
  repository?: OfflineRepository;
}

export class OfflineSyncEngine {
  private static isRunning: boolean = false;
  private static syncInterval: any = null;
  private static activeTenantId: string = "veg-main-001";
  private static repository: OfflineRepository = offlineRepository;

  /**
   * Initializes network and WebSocket listeners to trigger the engine when online.
   */
  public static init(): void {
    if (typeof window === "undefined") return;

    window.addEventListener("online", () => {
      console.log("[OfflineSyncEngine] Connectivity restored: Starting sync engine run.");
      this.syncNow();
    });

    window.addEventListener("veggiepos_ws_reconnected", () => {
      console.log("[OfflineSyncEngine] WebSocket reconnected: Starting sync engine run.");
      this.syncNow();
    });

    // Periodic sweep every 10 seconds when browser is online
    if (!this.syncInterval) {
      this.syncInterval = setInterval(() => {
        const isOnline = typeof navigator === "undefined" || typeof navigator.onLine !== "boolean" || navigator.onLine;
        if (isOnline && !this.isRunning) {
          this.syncNow();
        }
      }, 10000);
    }
  }

  public static setActiveTenant(tenantId: string): void {
    this.activeTenantId = tenantId;
  }

  public static setRepository(repo: OfflineRepository): void {
    this.repository = repo;
  }

  /**
   * Dispatches custom events safely across browser and Node test environments.
   */
  public static dispatchCustomEvent(name: string, detail: any): void {
    try {
      if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
        window.dispatchEvent(new CustomEvent(name, { detail }));
      } else if (typeof globalThis !== "undefined" && typeof (globalThis as any).dispatchEvent === "function") {
        (globalThis as any).dispatchEvent(new CustomEvent(name, { detail }));
      }
    } catch {
      // Ignore if event dispatching is not supported in current context
    }
  }

  /**
   * Main entry point to run synchronization for the tenant.
   * Executes the 10-step offline sync lifecycle safely.
   */
  public static async syncNow(tenantId?: string, options?: SyncEngineOptions): Promise<SyncEngineResult> {
    if (this.isRunning) {
      return { processed: 0, synced: 0, failed: 0, conflicts: 0, authErrors: 0, validationErrors: 0, rateLimited: 0 };
    }

    const effectiveTenantId =
      tenantId ||
      this.activeTenantId ||
      (typeof localStorage !== "undefined" ? localStorage.getItem("veggiepos_active_tenant_id") : null) ||
      "veg-main-001";

    const repo = options?.repository || this.repository || offlineRepository;

    this.isRunning = true;
    const result: SyncEngineResult = {
      processed: 0,
      synced: 0,
      failed: 0,
      conflicts: 0,
      authErrors: 0,
      validationErrors: 0,
      rateLimited: 0
    };

    try {
      // 1. Load pending outbox operations for the tenant (FIFO ordered, respecting backoff delays)
      const pendingItems = await repo.getPendingOutbox(effectiveTenantId);
      if (pendingItems.length === 0) {
        return result;
      }

      console.log(`[OfflineSyncEngine] Found ${pendingItems.length} pending outbox operations for tenant [${effectiveTenantId}].`);

      // 2. Process operations safely in FIFO order without blocking the UI
      for (const item of pendingItems) {
        // Pause if connection dropped mid-run
        if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean" && navigator.onLine === false) {
          console.warn("[OfflineSyncEngine] Connectivity lost during sync run. Pausing engine.");
          break;
        }

        result.processed++;
        const itemResult = await this.processOperation(item, options);

        let shouldStopQueue = false;

        switch (itemResult) {
          case "SYNCED":
            result.synced++;
            break;
          case "CONFLICT":
            result.conflicts++;
            // 409 conflict on this entity does NOT block other independent operations
            break;
          case "AUTH_BLOCKED":
            result.authErrors++;
            result.failed++;
            console.warn(`[OfflineSyncEngine] 401 Auth Failure. Pausing queue processing until re-authentication.`);
            shouldStopQueue = true;
            break;
          case "RATE_LIMITED":
            result.rateLimited++;
            result.failed++;
            console.warn(`[OfflineSyncEngine] 429 Rate Limited. Pausing queue processing.`);
            shouldStopQueue = true;
            break;
          case "NETWORK_ERROR":
            result.failed++;
            console.warn(`[OfflineSyncEngine] Network connectivity error. Pausing queue processing.`);
            shouldStopQueue = true;
            break;
          case "FORBIDDEN":
          case "VALIDATION_FAILED":
            result.validationErrors++;
            result.failed++;
            // Policy error on single entity: preserve in outbox, continue remaining queue!
            break;
          default:
            result.failed++;
            break;
        }

        if (shouldStopQueue) {
          break;
        }

        // 10. Continue remaining queue
      }

      // Notify the application of sync completion
      this.dispatchCustomEvent("veggiepos_sync_engine_completed", {
        tenantId: effectiveTenantId,
        ...result
      });
    } catch (err) {
      console.error("[OfflineSyncEngine] Unexpected error during sync cycle:", err);
    } finally {
      this.isRunning = false;
    }

    return result;
  }

  /**
   * Safely processes an individual outbox operation according to the 10-step sync lifecycle.
   * Never deletes an outbox operation before confirmed server success.
   */
  public static async processOperation(
    item: OfflineOutboxItem,
    options?: SyncEngineOptions
  ): Promise<ProcessOperationResult> {
    const fetchFunc = options?.fetchFn || (typeof fetch !== "undefined" ? fetch : null);
    if (!fetchFunc) {
      console.warn("[OfflineSyncEngine] No fetch function available in environment.");
      return "NETWORK_ERROR";
    }

    const repo = options?.repository || this.repository || offlineRepository;

    // Mark operation syncing in local IndexedDB
    await repo.updateOutboxStatus(item.id, "syncing");

    try {
      const sessionId = ApiClient.getSessionId();
      
      // 3. Send idempotency key, tenant header, branch header, device header, and session token
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-tenant-id": item.tenantId,
        "x-branch-id": item.branchId || "main",
        "x-device-id": item.deviceId || "dev_terminal",
        "Idempotency-Key": item.idempotencyKey
      };

      if (sessionId) {
        headers["x-session-id"] = sessionId;
      }

      // Resolve endpoint URL
      let targetUrl = item.endpoint;
      if (options?.baseUrl && !targetUrl.startsWith("http")) {
        const cleanBase = options.baseUrl.endsWith("/") ? options.baseUrl.slice(0, -1) : options.baseUrl;
        const cleanPath = targetUrl.startsWith("/") ? targetUrl : `/${targetUrl}`;
        targetUrl = `${cleanBase}${cleanPath}`;
      }

      // Execute request with network timeout guard (15s abort controller)
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 15000) : null;

      let res: Response;
      try {
        res = await fetchFunc(targetUrl, {
          method: item.method,
          headers,
          credentials: "include",
          body: item.payload ? JSON.stringify(item.payload) : undefined,
          signal: controller?.signal
        });
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }

      // Parse response body
      const resText = await res.text();
      let resJson: any = null;
      try {
        resJson = JSON.parse(resText);
      } catch {}

      // =======================================================================
      // HTTP 2xx: Server validated tenant/branch and committed transactional write
      // =======================================================================
      if (res.ok) {
        // 6. Server returns canonical entity / version
        const canonicalData =
          resJson?.canonicalData ||
          resJson?.data ||
          resJson?.order ||
          resJson?.customer ||
          resJson?.shift ||
          item.payload;

        // 7. Mark operation SYNCED in IndexedDB
        await repo.updateOutboxStatus(item.id, "SYNCED");

        // 8. Update local IndexedDB with canonical entity and version
        await repo.updateEntityWithCanonical(
          item.tenantId,
          item.entityType,
          item.entityId,
          canonicalData
        );

        // 9. Broadcast realtime event (locally to window CustomEvent and WebSocket listeners)
        this.dispatchCustomEvent("veggiepos_realtime_event", {
          type: `${item.entityType}:synced`,
          entityType: item.entityType,
          entityId: item.entityId,
          tenantId: item.tenantId,
          canonicalData,
          timestamp: Date.now()
        });

        // Clean up only if explicitly requested; otherwise operation is preserved with status 'SYNCED'
        if (options?.deleteAfterSync) {
          await repo.removeOutboxItem(item.id);
        }

        return "SYNCED";
      }

      // =======================================================================
      // Specific Error Handling & Differentiated Retry Policies
      // NEVER delete outbox operation before confirmed server success!
      // =======================================================================
      const errorMsg =
        resJson?.error && resJson?.message
          ? `${resJson.error}: ${resJson.message}`
          : resJson?.message || resJson?.error || `HTTP ${res.status}`;

      // --- 409 Conflict ---
      if (res.status === 409 || resJson?.error === "OPTIMISTIC_LOCK_CONFLICT") {
        console.warn(`[OfflineSyncEngine] 409 Conflict on operation [${item.id}]: ${errorMsg}`);
        // Mark as conflict, NEVER delete, pause automatic replay for this entity
        await repo.recordOutboxFailure(item.id, errorMsg, "conflict", 60000);
        
        // Trigger background conflict reconciliation event
        this.dispatchCustomEvent("veggiepos_reconcile_conflict", { item, errorMsg });

        return "CONFLICT";
      }

      // --- 401 Authentication Failure ---
      if (res.status === 401) {
        console.warn(`[OfflineSyncEngine] 401 Authentication Failure on [${item.id}]: ${errorMsg}. Pausing sync until re-login.`);
        // Mark as auth_error; NEVER delete; pause until session is renewed
        await repo.recordOutboxFailure(item.id, errorMsg, "auth_error", 120000);
        this.dispatchCustomEvent("veggiepos_auth_required", { tenantId: item.tenantId, errorMsg });
        return "AUTH_BLOCKED";
      }

      // --- 403 Authorization Failure / Plan Exceeded ---
      if (res.status === 403) {
        console.warn(`[OfflineSyncEngine] 403 Forbidden / Plan Exceeded on [${item.id}]: ${errorMsg}`);
        // NEVER delete; mark validation_error to prevent high-frequency retry loops
        await repo.recordOutboxFailure(item.id, errorMsg, "validation_error", 300000);
        this.dispatchCustomEvent("veggiepos_forbidden_error", { item, errorMsg });
        return "FORBIDDEN";
      }

      // --- 422 Validation Failure (and 400 Bad Request) ---
      if (res.status === 422 || res.status === 400) {
        console.warn(`[OfflineSyncEngine] 422/400 Validation Failure on [${item.id}]: ${errorMsg}`);
        // Permanent payload error: NEVER delete, mark as validation_error
        await repo.recordOutboxFailure(item.id, errorMsg, "validation_error", 600000);
        this.dispatchCustomEvent("veggiepos_validation_failed", { item, errorMsg });
        return "VALIDATION_FAILED";
      }

      // --- 429 Rate Limit ---
      if (res.status === 429) {
        const retryAfterHeader = res.headers?.get ? res.headers.get("Retry-After") : null;
        const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 30;
        const delayMs = (isNaN(retryAfterSec) ? 30 : retryAfterSec) * 1000;
        console.warn(`[OfflineSyncEngine] 429 Rate limited on [${item.id}]. Backing off for ${delayMs / 1000}s.`);
        await repo.recordOutboxFailure(item.id, `Rate limit reached. Retry after ${delayMs / 1000}s`, "failed", delayMs);
        return "RATE_LIMITED";
      }

      // --- 500 / 502 / 503 / 504 Server Failure ---
      console.warn(`[OfflineSyncEngine] Server failure HTTP ${res.status} on [${item.id}]. Applying exponential backoff.`);
      // NEVER delete; apply exponential backoff with jitter
      await repo.recordOutboxFailure(item.id, errorMsg, "failed");
      return "FAILED";
    } catch (netErr: any) {
      // Network timeout / DNS drop / offline exception
      const isTimeout = netErr.name === "AbortError";
      const errMsg = isTimeout ? "Network timeout (15s exceeded)" : (netErr.message || "Network unreachable");
      console.warn(`[OfflineSyncEngine] Network exception on [${item.id}]: ${errMsg}. Applying exponential backoff.`);
      // NEVER delete operation; keep safe in outbox with backoff
      await repo.recordOutboxFailure(item.id, errMsg, "failed");
      return "NETWORK_ERROR";
    }
  }
}

// Auto-initialize listeners
OfflineSyncEngine.init();
