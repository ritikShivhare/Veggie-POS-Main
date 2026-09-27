/**
 * Veggie POS - Offline Outbox Processor
 * 
 * Re-exports and delegates to OfflineSyncEngine for processing queued offline
 * operations when network connectivity is restored.
 */

import { OfflineSyncEngine, SyncEngineResult } from "./OfflineSyncEngine";

export class OutboxProcessor {
  public static init(): void {
    OfflineSyncEngine.init();
  }

  public static async triggerDrain(activeTenantId?: string): Promise<{ processed: number; failed: number }> {
    const res: SyncEngineResult = await OfflineSyncEngine.syncNow(activeTenantId);
    return {
      processed: res.synced,
      failed: res.failed + res.conflicts
    };
  }
}

// Auto-initialize when loaded in browser
OutboxProcessor.init();

