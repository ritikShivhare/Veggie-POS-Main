import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import crypto from 'node:crypto';
import {Database} from '../server/features/shared/database';
import {getSubscription} from '../server/features/shared/subscription';
import * as billing from '../server/features/billing/CashfreeBilling';
import {CashfreeClient,verifyCashfreeSignature} from '../server/features/billing/CashfreeClient';
const tenant='test-cashfree',db=Database.getInstance();
let gateway: any;
const customer={name:'Test owner',email:'owner@example.com',phone:'9876543210'};
beforeEach(()=>{(db as any).tablesByTenant[tenant]={};(db as any).objectsByTenant[tenant]={};(db as any).objectsByTenant['saas-admin']={};
 gateway={payments:vi.fn(async()=>[{payment_status:'SUCCESS',payment_amount:999,payment_currency:'INR',payment_time:new Date().toISOString()}]),refunds:vi.fn(async()=>[]),create:vi.fn(async (p:any)=>({...p,link_status:'ACTIVE',link_url:'https://payments-test.cashfree.com/links/test',link_amount_paid:0})),get:vi.fn(),cancel:vi.fn(async(id:string)=>({link_id:id,link_status:'CANCELLED'})),orders:vi.fn(async()=>({orders:[{order_id:'cashfree-order',order_status:'PAID',order_amount:999,order_currency:'INR'}]}))};});
afterEach(()=>vi.unstubAllEnvs());
const create=(key='request-1',plan:'pro'|'enterprise'='pro')=>billing.createPaymentLink(tenant,plan,key,customer,gateway);
function paid(link:any,extra={}){gateway.get.mockResolvedValue({link_id:link.id,link_status:'PAID',link_currency:'INR',link_amount:999,link_amount_paid:999,...extra});}
describe('Cashfree billing boundary',()=>{
 it('verifies exact raw bytes with constant-time HMAC comparison',()=>{
  const raw=Buffer.from('{"price":999.00}'),ts=String(Date.now()),sig=crypto.createHmac('sha256','secret').update(ts).update(raw).digest('base64');
  expect(verifyCashfreeSignature(raw,sig,ts,'secret')).toBe(true);expect(verifyCashfreeSignature(Buffer.from('{"price":999}'),sig,ts,'secret')).toBe(false);expect(verifyCashfreeSignature(raw,'bad',ts,'secret')).toBe(false);
 });
 it('does not make any network request without configured Cashfree mode and credentials',async()=>{
  vi.stubEnv('CASHFREE_APP_ID','');await expect(new CashfreeClient().get('anything')).rejects.toMatchObject({status:503});
 });
 it('creates a server-priced 60 minute link, with no partial payment or outbound notifications',async()=>{
  const before=Date.now(),link=await create();const input=gateway.create.mock.calls[0][0];
  expect(input.link_amount).toBe(999);expect(input.link_partial_payments).toBe(false);expect(input.link_notify).toEqual({send_email:false,send_sms:false});expect(Date.parse(input.link_expiry_time)-before).toBeGreaterThanOrEqual(3599000);expect(link.status).toBe('ACTIVE');
 });
 it('retries the same intent after provider timeout and cancels a prior link before replacement',async()=>{
  gateway.create.mockRejectedValueOnce(new Error('timeout'));await expect(create()).rejects.toThrow('timeout');
  const recovered=await create();expect(gateway.create.mock.calls[0][0].link_id).toBe(gateway.create.mock.calls[1][0].link_id);
  gateway.get.mockResolvedValue({link_id:recovered.id,link_status:'ACTIVE',link_currency:'INR',link_amount:999,link_amount_paid:0});
  await create('request-2');expect(gateway.cancel).toHaveBeenCalledWith(recovered.id);
 });
 it('uses backend status verification and activates once across repeated reconciliation',async()=>{
  const link=await create();paid(link);await billing.reconcilePayment(tenant,link.id,gateway);const first=await getSubscription(tenant);expect(first.plan).toBe('pro');
  await billing.reconcilePayment(tenant,link.id,gateway);expect((await getSubscription(tenant)).paidUntil).toBe(first.paidUntil);
 });
 it.each([{link_amount_paid:1},{link_currency:'USD'},{link_amount:1999}])('rejects short or mismatched payment %j',async extra=>{
  const link=await create();paid(link,extra);await expect(billing.reconcilePayment(tenant,link.id,gateway)).rejects.toMatchObject({code:'PAYMENT_MISMATCH'});expect((await getSubscription(tenant)).plan).toBe('free');
 });
 it('does not accept another tenant link or browser-supplied payment success',async()=>{
  const link=await create();await expect(billing.reconcilePayment('other-tenant',link.id,gateway)).rejects.toMatchObject({status:404});expect(gateway.get).not.toHaveBeenCalled();
 });
 it('a signed refund or dispute downgrades and payment replays cannot restore access',async()=>{
  const link=await create();paid(link);await billing.reconcilePayment(tenant,link.id,gateway);
  const event={type:'REFUND_STATUS_WEBHOOK',data:{refund:{order_id:'cashfree-order',refund_status:'SUCCESS',refund_amount:1,refund_currency:'INR'}}};
  await billing.processCashfreeEvent(event,'refund-event',gateway);expect((await getSubscription(tenant)).financialReview).toBe(true);expect((await getSubscription(tenant)).plan).toBe('free');
  await billing.reconcilePayment(tenant,link.id,gateway);expect((await getSubscription(tenant)).plan).toBe('free');
 });
 it('will not generate more payable links while financial review is unresolved',async()=>{
  await db.saveObject(tenant,'subscription_v1',{plan:'free',status:'active',isReadOnly:false,financialReview:true});await expect(create()).rejects.toMatchObject({code:'FINANCIAL_REVIEW'});expect(gateway.create).not.toHaveBeenCalled();
 });
});
it('releases an expired intent that Cashfree confirms was never created',async()=>{
 const link=await create();const all=await db.getObject<any>(tenant,'cashfree_links');all[link.id].status='CREATING';all[link.id].expiresAt=new Date(Date.now()-1000).toISOString();await db.saveObject(tenant,'cashfree_links',all);
 gateway.get.mockRejectedValueOnce(Object.assign(new Error('not found'),{code:'CASHFREE_NOT_FOUND'}));
 expect((await billing.reconcilePayment(tenant,link.id,gateway)).status).toBe('EXPIRED');
});
it('reconciles a missed refund webhook from authoritative refund status',async()=>{
 const link=await create();paid(link);await billing.reconcilePayment(tenant,link.id,gateway);
 gateway.refunds.mockResolvedValue([{refund_status:'SUCCESS',refund_amount:999}]);await billing.reconcilePayment(tenant,link.id,gateway);
 expect((await getSubscription(tenant)).financialReview).toBe(true);expect((await getSubscription(tenant)).plan).toBe('free');
});
it('routes chargebacks by server-owned Cashfree order mapping',async()=>{
 const link=await create();paid(link);await billing.reconcilePayment(tenant,link.id,gateway);
 await billing.processCashfreeEvent({type:'DISPUTE_CREATED',data:{order_details:{order_id:'cashfree-order'},dispute:{dispute_type:'CHARGEBACK'}}},'dispute-1',gateway);
 expect((await getSubscription(tenant)).financialReview).toBe(true);expect((await getSubscription(tenant)).plan).toBe('free');
});
