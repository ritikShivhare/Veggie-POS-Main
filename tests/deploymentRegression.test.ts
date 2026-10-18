import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import http from 'node:http';
import WebSocket from 'ws';
import bcrypt from 'bcryptjs';
import { app } from '../server';
import { Database } from '../server/features/shared/database';
import { staffRepo, menuRepo, ingredientRepo, recipeRepo, orderRepo, shiftRepo, settingsRepo, sessionService, notificationService, realtimeService, financialTransactionService, getGlobalTenantsList, saveGlobalTenantsList } from '../server/context';
import { verifyMasterVerificationCode } from '../server/features/auth/PinSecurityService';
import {digest} from '../server/features/shared/security';

// Audit-only regression probes. All requests use localhost, all mail is mocked,
// and all records live in the test database; no production endpoint is called.
const tid = 'test-audit-deployment';
const menu = { id: 'audit-menu', name: 'Audit meal', price: 100, category: 'Main', imageUrl: '', isVegetarian: true, isAvailable: true, version: 1 };
const order = (id: string, extra: any = {}) => ({ id, orderNumber: id, date: new Date().toISOString(), type: 'Dine-In', items: [{ menuItem: menu, menuItemId: menu.id, quantity: 1 }], subtotal: 100, tax: 0, discount: 0, total: 100, status: 'Pending', cashierId: 'audit-cashier', cashierName: 'Audit cashier', version: 1, ...extra });
let base: string, server: http.Server, cashier: any, owner: any;
const request = async (path: string, body?: any, token?: string, method?: string) => {
  const response = await fetch(base + '/api' + path, { method: method || (body === undefined ? 'GET' : 'POST'), headers: { 'Content-Type': 'application/json', ...(token ? { 'x-session-id': token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, data: await response.json() };
};
describe('Deployment audit: expected secure and consistent behavior', () => {
  beforeAll(async () => {
    vi.spyOn(notificationService, 'send').mockResolvedValue({ success: false, dispatchedChannels: [{ channel: 'email', status: 'failed', detail: 'Audit mail disabled' }] });
    server = http.createServer(app);
    realtimeService.attach(server);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as any).port}`;
    const tenants = await getGlobalTenantsList();
    tenants.push({ id: tid, tenantId: tid, name: 'Audit', email: 'audit@example.invalid', status: 'active' });
    await saveGlobalTenantsList(tenants);
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    realtimeService.close();
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });
  beforeEach(async () => {
    const db: any = Database.getInstance();
    db.tablesByTenant[tid] = {};
    db.objectsByTenant[tid] = {};
    await staffRepo.saveAll(tid, [
      { id: 'audit-owner', name: 'Audit owner', role: 'Owner', pin: '84519', permissions: ['billing', 'inventory', 'reports', 'settings', 'staff'] },
      { id: 'audit-cashier', name: 'Audit cashier', role: 'Cashier' as any, pin: '75418', permissions: ['billing'] }
    ]);
    await menuRepo.saveAll(tid, [menu]);
    await ingredientRepo.saveAll(tid, [{ id: 'audit-ing', name: 'Audit ingredient', unit: 'g', currentStock: 10, minStock: 0, costPerUnit: 1, version: 1 }]);
    await recipeRepo.saveAll(tid, [{ menuItemId: menu.id, ingredients: [{ ingredientId: 'audit-ing', quantity: 1, unit: 'g' }] }]);
    await settingsRepo.save(tid, { autoDeductStock: true, blockOrdersIfInsufficient: true, managerCanAddPurchases: true, managerCanEditRecipes: true, kdsSoundAlerts: false, quickPinRequired: false, gstPercentage: 0 } as any);
    cashier = await sessionService.createSession(tid, 'audit-cashier', 'Audit cashier', 'Cashier', '127.0.0.1', 'Audit', ['billing']);
    owner = await sessionService.createSession(tid, 'audit-owner', 'Audit owner', 'Owner', '127.0.0.1', 'Audit', ['billing', 'settings']);
  });
  it('rejects anonymous Google admin login', async () => {
    const r = await request('/saas-admin/google-login', {});
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
  it('rejects shared fallback admin passwords when email delivery fails', async () => {
    const r = await request('/saas-admin/login', { password: 'admin123' });
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
  it('rejects the hardcoded master verification code', () => {
    expect(verifyMasterVerificationCode('123456')).toBe(false);
  });
  it('rejects anonymous lead retrieval', async () => {
    const r = await request('/leads/walkthrough');
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
  it('rejects anonymous lead modification', async () => {
    await Database.getInstance().saveObject('system-tenant', 'walkthrough_leads', [{ id: 'audit-lead', fullName: 'Test', phone: '0000000000', restaurantName: 'Test' }]);
    const r = await request('/leads/walkthrough/audit-lead', { status: 'converted' }, undefined, 'PATCH');
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
  it('rejects anonymous lead deletion', async () => {
    const r = await request('/leads/walkthrough/audit-lead', {}, undefined, 'DELETE');
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
  it('does not disclose other active bearer session tokens to cashier', async () => {
    const r = await request('/auth/sessions-data', undefined, cashier.sessionId);
    expect(Boolean(r.data.activeSessions?.some((s: any) => s.sessionId === owner.sessionId))).toBe(false);
  });
  it('does not disclose staff PIN hashes in cashier full-state response', async () => {
    const r = await request('/sync', undefined, cashier.sessionId);
    expect(r.data.data?.staffList?.some((s: any) => Boolean(s.pin))).toBe(false);
  });
  it('prevents cashier from creating an owner via full-state sync', async () => {
    const r = await request('/sync', { staffList: [{ id: 'audit-injected-owner', name: 'Audit injected', role: 'Owner', pin: '95147', permissions: ['settings'] }] }, cashier.sessionId);
    expect(r.status).toBe(403);
  });
  it('prevents cashier from cancelling orders through generic outbox', async () => {
    await orderRepo.saveAll(tid, [order('audit-cancel') as any]);
    const r = await request('/sync/outbox', { operationId: 'audit-cancel-operation', entityId: 'audit-cancel', entityType: 'order', operationType: 'UPDATE', payload: { status: 'Cancelled', version: 1 } }, cashier.sessionId);
    expect(r.status).toBe(403);
  });
  it('prevents cashier from replacing complete order history', async () => {
    const r = await request('/orders/bulk', [order('audit-arbitrary', { total: 1 })], cashier.sessionId);
    expect(r.status).toBe(403);
  });
  it('rejects changing a sealed order total while retaining Completed status', async () => {
    await orderRepo.saveAll(tid, [order('audit-paid', { status: 'Completed', paidAt: new Date().toISOString() }) as any]);
    const r = await request('/orders/audit-paid', order('audit-paid', { status: 'Completed', paidAt: new Date().toISOString(), total: 1 }), cashier.sessionId, 'PUT');
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
  it('keeps order fields and records payment ledger through the UI payment command', async () => {
    await orderRepo.saveAll(tid, [order('audit-payment') as any]);
    await request('/orders/audit-payment/pay', { amount:100, paymentMethod:'Cash' },cashier.sessionId);
    const o = await orderRepo.getById(tid, 'audit-payment');
    const payments = await financialTransactionService.getPaymentRepo().getAll(tid);
    expect({ total: o?.total, payments: payments?.length }).toEqual({ total: 100, payments: 1 });
  });
  it('does not silently accept invalid pricing in full-state sync', async () => {
    const r = await request('/sync', { orders: [order('audit-invalid', { items: [{ menuItemId: 'missing-item', quantity: 1 }], total: 1 })] }, cashier.sessionId);
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
  it('deducts stock for both simultaneous order placements', async () => {
    await Promise.all(['audit-concurrent-a', 'audit-concurrent-b'].map(id => financialTransactionService.executeOrderPlacement(tid, order(id) as any, { role: 'Owner', staffId: 'audit-owner' })));
    expect((await ingredientRepo.getById(tid, 'audit-ing'))?.currentStock).toBe(8);
  });
  it('does not add stock on cancellation when auto deduction was disabled', async () => {
    const settings = await settingsRepo.get(tid);
    await settingsRepo.save(tid, { ...settings, autoDeductStock: false } as any);
    await financialTransactionService.executeOrderPlacement(tid, order('audit-no-deduct') as any, { role: 'Owner', staffId: 'audit-owner' });
    await financialTransactionService.executeOrderCancellation(tid, 'audit-no-deduct', { cancelledBy: 'Owner', reason: 'Audit' });
    expect((await ingredientRepo.getById(tid, 'audit-ing'))?.currentStock).toBe(10);
  });
  it.each([false,true])('blocks legacy paid-bill cancellation without its original payment record',async(refundConfirmed)=>{
    await orderRepo.saveAll(tid,[order('legacy-paid',{status:'Completed',paymentMethod:'Cash',paidAt:new Date().toISOString()}) as any]);
    await expect(financialTransactionService.executeOrderCancellation(tid,'legacy-paid',{cancelledBy:'Owner',reason:'Audit',refundConfirmed})).rejects.toMatchObject({code:'LEGACY_SETTLEMENT_REQUIRES_RECONCILIATION'});
    expect(await orderRepo.getById(tid,'legacy-paid')).toMatchObject({status:'Completed',version:1});
    expect((await ingredientRepo.getById(tid,'audit-ing'))?.currentStock).toBe(10);
    expect(await financialTransactionService.getPaymentRepo().getAll(tid)).toEqual([]);
  });
  it('can cancel a completed kitchen bill that was never paid',async()=>{
    await financialTransactionService.executeOrderPlacement(tid,order('kitchen-completed',{status:'Completed'}) as any,{role:'Owner',staffId:'audit-owner'});
    const cancelled=await financialTransactionService.executeOrderCancellation(tid,'kitchen-completed',{cancelledBy:'Owner',reason:'Audit'});
    expect(cancelled.status).toBe('Cancelled');expect((await ingredientRepo.getById(tid,'audit-ing'))?.currentStock).toBe(10);
  });
  it('rejects unknown tenant login instead of seeding default owner account', async () => {
    const r = await request('/auth/login', { tenantId: 'audit-unregistered-tenant', pin: '12345' });
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
  it('invalidates owner privilege after owner is changed to staff', async () => {
    const list = await staffRepo.getAll(tid);
    const member = list!.find(s => s.id === 'audit-owner')!;
    await staffRepo.update(tid, { ...member, role: 'Staff', permissions: ['billing'] }, member.version);
    const r = await request('/settings', { quickPinRequired: false }, owner.sessionId);
    expect([401,403]).toContain(r.status);
  });
  it('disconnects revoked WebSocket session before sending next event', async () => {
    const ws = new WebSocket(base.replace('http:', 'ws:') + '/ws', { headers: { 'x-unused': 'audit', authorization: 'Bearer ' + owner.sessionId } });
    await new Promise<void>((resolve, reject) => { ws.once('message', () => resolve()); ws.once('error', reject); });
    await sessionService.revokeSession(tid, owner.sessionId);
    const event = new Promise<string>(resolve => { ws.once('message', data => resolve(JSON.parse(data.toString()).type)); ws.once('close', () => resolve('closed')); });
    realtimeService.broadcastToTenant(tid, 'audit:post-revoke', { slice: 'orders' });
    const received = await event;
    ws.terminate();
    expect(received).toBe('closed');
  });
  it('does not replay a cached transient 503 after database recovery', async () => {
    const db = Database.getInstance();
    db.stopDatabase();
    const headers = { 'Content-Type': 'application/json', 'x-session-id': cashier.sessionId, 'Idempotency-Key': 'audit-transient-503' };
    const payload = JSON.stringify(order('audit-recover'));
    try { await fetch(base + '/api/orders', { method: 'POST', headers, body: payload }); }
    finally { db.resumeDatabase(); }
    const r = await fetch(base + '/api/orders', { method: 'POST', headers, body: payload });
    expect(r.status).toBe(200);
  });
  it('makes an explicit staff deletion persistent while preserving the owner', async () => {
    const r = await request('/sync', { deletions:{staffList:[{id:'audit-cashier',version:1}]} }, owner.sessionId);
    expect(r.data.data.staffList.map((s:any)=>s.id)).toEqual(["audit-owner"]);
  });
  it('serves actual staff endpoint used by the UI', async () => {
    const r = await request('/staff', { id: 'ui-staff', name: 'UI member', role: 'Staff', pin: '92178', permissions: ['billing'] }, owner.sessionId);
    expect(r.status).not.toBe(404);
  });
  it('avoids double stock deduction across snapshot and order command paths', async () => {
    await request('/sync', { ingredients: [{ id: 'audit-ing', name: 'Audit ingredient', unit: 'g', currentStock: 9, minStock: 0, costPerUnit: 1, version: 1 }], orders: [order('audit-dual-path')] }, owner.sessionId);
    await financialTransactionService.executeOrderPlacement(tid, order('audit-dual-path') as any, { role: 'Owner', staffId: 'audit-owner' });
    expect((await ingredientRepo.getById(tid, 'audit-ing'))?.currentStock).toBe(9);
  });
  it('does not commit or refresh cache if the atomic SQL RPC fails',async()=>{
    const db=Database.getInstance(),calls:string[]=[];
    const client={rpc:async(name:string)=>{calls.push(name);return name==='get_tenant_revision'?{data:1,error:null}:{data:null,error:{code:'08006',message:'Injected transaction failure'}};}};
    const spy=vi.spyOn(db,'getSupabaseClient').mockReturnValue(client);
    try {await expect(db.runTransaction(tid,async trx=>{await trx.saveSlice('menuItems',[{id:'new',name:'new'}]);})).rejects.toMatchObject({status:503});}
    finally{spy.mockRestore();}
    expect(calls).toEqual(['get_tenant_revision','commit_tenant_transaction']);expect((await menuRepo.getAll(tid))?.map(m=>m.id)).toEqual([menu.id]);
  });
  it('rejects signup without claiming an email was sent when the provider fails',async()=>{
    const result=await request('/auth/signup',{businessName:'Mail failure cafe',ownerName:'Owner',ownerPhone:'9000000000',email:'qa@example.test',pin:'85246',password:'test-password-strong'});
    expect(result.status).toBe(500);expect(result.data).toMatchObject({success:false,error:'EMAIL_SEND_FAILED'});
    expect(result.data.pendingToken).toBeUndefined();
  });
  it.each(['x'.repeat(73),'अ'.repeat(25)])('rejects signup passwords that bcrypt would truncate',async(password)=>{
    const result=await request('/auth/signup',{businessName:'Password length cafe',ownerName:'Owner',ownerPhone:'9000000000',email:'qa@example.test',pin:'85246',password});
    expect(result.status).toBe(422);expect(result.data.pendingToken).toBeUndefined();
  });
  it('rejects a different owner password with the same first 72 bytes',async()=>{
    const password='x'.repeat(72);
    await staffRepo.update(tid,{id:'audit-owner',passwordHash:await bcrypt.hash(password,4)} as any);
    expect((await request('/auth/login',{tenantId:tid,password:password+'different-suffix'})).status).toBe(401);
    expect((await request('/auth/login',{tenantId:tid,password})).data.success).toBe(true);
  });
  it('rejects a truncated admin password before issuing an OTP',async()=>{
    vi.stubEnv('SAAS_OWNER_EMAIL','owner@example.test');
    vi.stubEnv('SAAS_OWNER_PASSWORD_HASH',await bcrypt.hash('x'.repeat(72),4));
    try {
      const result=await request('/saas-admin/login',{password:'x'.repeat(72)+'different-suffix'});
      expect(result.status).toBe(410);expect(result.data.challengeToken).toBeUndefined();
    }finally{vi.unstubAllEnvs();}
  });
  it('completes signup, successful resend, PIN login and owner password login',async()=>{
    const sent:any[]=[];
    vi.mocked(notificationService.send).mockImplementationOnce(async(_t,p)=>{sent.push(p);return {success:true,dispatchedChannels:[{channel:'email',status:'success',detail:'mock accepted'}]};});
    const result=await request('/auth/signup',{businessName:'Cafe <script>alert(1)</script>',ownerName:'New owner <img src=x>',region:'<a href="https://example.test">Region</a>',ownerPhone:'9000000001',email:'qa&tag@example.test',pin:'85246',password:'test-password-strong'});
    expect(sent[0].htmlBody).not.toContain('<script>alert(1)</script>');
    expect(sent[0].htmlBody).not.toContain('<img src=x>');
    expect(sent[0].htmlBody).toContain('qa&amp;tag@example.test');
    expect(sent[0].recipientEmail).toBe('qa&tag@example.test');
    expect(result.status).toBe(200);const token=result.data.pendingToken;
    const records:any[]=await Database.getInstance().getObject('saas-admin','signup_challenges_v2');
    const challenge=records.find(s=>s.pendingToken===token);
    const firstCode=sent[0].htmlBody.match(/>(\d{6})<\/span>/)?.[1];expect(firstCode).toMatch(/^\d{6}$/);
    expect(challenge.codeHash).toBe(digest(firstCode));expect(challenge.pin).not.toBe('85246');expect(challenge.passwordHash).not.toBe('test-password-strong');
    expect((await request('/auth/resend-otp',{pendingToken:token})).status).toBe(429);
    challenge.lastSentAt=Date.now()-30000;await Database.getInstance().saveObject('saas-admin','signup_challenges_v2',records);
    vi.mocked(notificationService.send).mockImplementationOnce(async(_t,p)=>{sent.push(p);return {success:true,dispatchedChannels:[{channel:'email',status:'success',detail:'mock accepted'}]};});
    expect((await request('/auth/resend-otp',{pendingToken:token,email:'attacker@example.test'})).data.success).toBe(true);
    expect(sent[1].recipientEmail).toBe('qa&tag@example.test');
    expect(sent[1].htmlBody).toContain('qa&amp;tag@example.test');
    const secondCode=sent[1].htmlBody.match(/>(\d{6})<\/span>/)?.[1];
    const verified=await request('/auth/verify',{pendingToken:token,verificationCode:secondCode});
    expect(verified.data.success).toBe(true);expect(verified.data.user.pin).toBeUndefined();
    const tenantId=verified.data.tenant.tenantId;
    expect((await request('/auth/login',{tenantId,pin:'85246'})).data.success).toBe(true);
    expect((await request('/auth/login',{tenantId,password:'test-password-strong'})).data.success).toBe(true);
  });
  it('retains the previous OTP when a resend provider fails',async()=>{
    const token='failed-resend-'+crypto.randomUUID();
    await Database.getInstance().saveObject('saas-admin','signup_challenges_v2',[{pendingToken:token,email:'qa@example.test',codeHash:digest('123456'),attempts:2,lastSentAt:Date.now()-30000,expiresAt:Date.now()+60000}]);
    expect((await request('/auth/resend-otp',{pendingToken:token})).data.success).toBe(false);
    const stored:any[]=await Database.getInstance().getObject('saas-admin','signup_challenges_v2');
    expect(stored[0]).toMatchObject({codeHash:digest('123456'),attempts:2});
  });
  it('returns a handled 503 when resend cannot read its database',async()=>{
    const db=Database.getInstance();db.stopDatabase();
    try {expect((await request('/auth/resend-otp',{pendingToken:'unavailable'})).status).toBe(503);}
    finally{db.resumeDatabase();}
  });
  it('edits a hashed owner profile without exposing or replacing credentials',async()=>{
    const previous=await staffRepo.getById(tid,'audit-owner');
    const result=await request('/staff/audit-owner',{name:'Renamed owner',version:previous.version},owner.sessionId,'PUT');
    expect(result.status).toBe(200);expect(result.data.data.pin).toBeUndefined();
    expect((await staffRepo.getById(tid,'audit-owner')).pin).toBe(previous.pin);
  });
  it('removes legacy credentials from settings and rejects new credential snapshots',async()=>{
    await settingsRepo.save(tid,{...(await settingsRepo.get(tid)),managerPin:'123456',slackWebhookUrl:'https://private.example.test'} as any);
    const result=await request('/settings',undefined,cashier.sessionId);
    expect(result.data.data.managerPin).toBeUndefined();expect(result.data.data.slackWebhookUrl).toBeUndefined();
    expect((await request('/settings',{managerPin:'new-pin'},owner.sessionId)).status).toBe(400);
  });
  it('includes cash paid during a shift for an order originally placed before it',async()=>{
    await orderRepo.saveAll(tid,[order('old-order',{date:new Date(Date.now()-86400000).toISOString()})]);
    await shiftRepo.add(tid,{id:'cash-shift',staffId:'audit-cashier',staffName:'Cashier',role:'Cashier',status:'Active',startTime:new Date(Date.now()-60000).toISOString(),openingCash:0} as any);
    await request('/orders/old-order/pay',{amount:100,paymentMethod:'Cash'},cashier.sessionId);
    const closed=await request('/shifts/cash-shift/close-blind',{physicalCashCount:100},cashier.sessionId);
    expect(closed.data).toMatchObject({success:true,expectedCash:100,variance:0});
    expect((await request('/shifts/cash-shift/close-blind',{physicalCashCount:100},cashier.sessionId)).status).toBe(400);
  });
  it('rolls back shift close if its audit log fails',async()=>{
    await shiftRepo.add(tid,{id:'rollback-shift',staffId:'audit-cashier',staffName:'Cashier',role:'Cashier',status:'Active',startTime:new Date().toISOString(),openingCash:0} as any);
    const context=await import('../server/context');
    const spy=vi.spyOn(context.auditLogService,'log').mockRejectedValueOnce(new Error('audit unavailable'));
    try{expect((await request('/shifts/rollback-shift/close-blind',{physicalCashCount:0},cashier.sessionId)).data.success).toBe(false);}
    finally{spy.mockRestore();}
    expect((await shiftRepo.getById(tid,'rollback-shift')).status).toBe('Active');
  });
});
