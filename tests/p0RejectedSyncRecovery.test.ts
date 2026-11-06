import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { VeggiePOSLocalDatabase } from "../src/features/shared/services/offline/database";
import { OfflineRepository } from "../src/features/shared/services/offline/OfflineRepository";
import { OfflineSyncEngine } from "../src/features/shared/services/offline/OfflineSyncEngine";
import { ApiClient } from "../src/features/shared/services/api";

describe("P0 rejected-operation recovery safety", () => {
  let db: VeggiePOSLocalDatabase;
  let repo: OfflineRepository;
  const tenant = "isolated-sync-recovery-test";
  beforeEach(async () => {
    db = new VeggiePOSLocalDatabase("p0-sync-recovery-db");
    await db.open();
    repo = new OfflineRepository(db);
    OfflineSyncEngine.setRepository(repo);
    ApiClient.setSessionId("isolated-test-session");
  });
  afterEach(async () => { await db.delete(); vi.restoreAllMocks(); });

  it("blocks later payment for a rejected same-order command but syncs independent orders", async () => {
    const first = await repo.enqueueOutbox(tenant, {entityType:"order",entityId:"same-order",operationType:"UPDATE",payload:{status:"Preparing"},endpoint:"/api/orders/same-order",method:"PUT"});
    await repo.recordOutboxFailure(first.id,"Rejected Kitchen command","validation_error",600000);
    const payment = await repo.enqueueOutbox(tenant,{entityType:"payment",entityId:"same-order",operationType:"UPDATE",payload:{amount:100,paymentMethod:"Cash"},endpoint:"/api/orders/same-order/pay",method:"POST"});
    const other = await repo.enqueueOutbox(tenant,{entityType:"order",entityId:"other-order",operationType:"CREATE",payload:{id:"other-order",total:200},endpoint:"/api/orders",method:"POST"});
    const fetchFn=vi.fn().mockResolvedValue(new Response(JSON.stringify({success:true,order:{id:"other-order",status:"Pending",total:200,version:1}}),{status:200,headers:{"Content-Type":"application/json"}}));
    const result=await OfflineSyncEngine.syncNow(tenant,{repository:repo,fetchFn});
    expect(result.synced).toBe(1);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect((await repo.getOutboxItem(payment.id))?.status).toBe("pending");
    expect((await repo.getOutboxItem(other.id))?.status).toBe("SYNCED");
  });

  it("retry retains operation identity and idempotency; edited payload cannot bypass reconciliation", async () => {
    const item=await repo.enqueueOutbox(tenant,{entityType:"order",entityId:"r1",operationType:"UPDATE",payload:{status:"Ready"},endpoint:"/api/orders/r1",method:"PUT"});
    await repo.recordOutboxFailure(item.id,"Conflict","conflict",60000);
    await expect(repo.retryOperation(tenant,item.id,{status:"Completed"})).rejects.toThrow("reconciliation");
    await repo.retryOperation(tenant,item.id);
    const retried=await repo.getOutboxItem(item.id);
    expect(retried?.status).toBe("pending");
    expect(retried?.idempotencyKey).toBe(item.idempotencyKey);
    expect(retried?.operationId).toBe(item.operationId);
  });

  it("uses distinct keys for independent Kitchen transitions and prevents retry of SYNCED operations", async () => {
    await repo.putOrder(tenant,{id:"k1",status:"Pending",total:100,orderNumber:"1",date:new Date().toISOString(),type:"Dine-In",items:[]});
    const a=await repo.recordPaymentOffline(tenant,"k1",{status:"Preparing"});
    const b=await repo.recordPaymentOffline(tenant,"k1",{status:"Preparing"});
    expect(a.idempotencyKey).not.toBe(b.idempotencyKey);
    await repo.updateOutboxStatus(a.id,"SYNCED");
    await expect(repo.retryOperation(tenant,a.id)).rejects.toThrow("Already synchronized");
  });
});
