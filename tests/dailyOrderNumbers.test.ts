import { beforeEach, describe, expect, it } from 'vitest';
import { Database } from '../server/features/shared/database';
import { allocateOrderNumber } from '../server/features/pos/OrderNumberService';
import { FinancialTransactionService } from '../server/features/pos/FinancialTransactionService';
import { displayOrderNumber, orderBusinessDate } from '../shared/orderNumber';
const db = Database.getInstance();
const day = '2026-11-14T10:00:00.000Z';
let tenant: string;
beforeEach(() => { tenant = `number-test-${crypto.randomUUID()}`; });
describe('daily restaurant bill numbers', () => {
  it('allocates distinct persistent numbers for concurrent terminals', async () => {
    const numbers = await Promise.all(Array.from({length: 15}, () => allocateOrderNumber(tenant, day)));
    expect(new Set(numbers).size).toBe(15);
    expect(numbers[0]).toBe('2026-11-14/001');
    expect(numbers[14]).toBe('2026-11-14/015');
    expect(await db.getObject(tenant, 'daily_order_number_v1:2026-11-14')).toEqual({last: 15});
  });
  it('starts at 001 for each restaurant and at midnight in India', async () => {
    expect(await allocateOrderNumber(tenant, '2026-11-14T18:29:59Z')).toBe('2026-11-14/001');
    expect(await allocateOrderNumber(tenant, '2026-11-14T18:30:00Z')).toBe('2026-11-15/001');
    expect(await allocateOrderNumber(tenant + '-other', day)).toBe('2026-11-14/001');
    expect(orderBusinessDate('2026-11-14T18:30:00Z')).toBe('2026-11-15');
  });
  it('keeps cancelled numbers, seeds restored orders, and grows past 999', async () => {
    await db.saveSlice(tenant, 'orders', [{id: 'cancelled', orderNumber: '2026-11-14/999', status:'Cancelled'}]);
    expect(await allocateOrderNumber(tenant, day)).toBe('2026-11-14/1000');
    await db.saveSlice(tenant, 'orders', []);
    expect(await allocateOrderNumber(tenant, day)).toBe('2026-11-14/1001');
  });
  it('rolls the counter back with a failed order transaction', async () => {
    await expect(db.runTransaction(tenant, async () => {
      await allocateOrderNumber(tenant, day); throw new Error('Rejected order');
    })).rejects.toThrow('Rejected order');
    expect(await allocateOrderNumber(tenant, day)).toBe('2026-11-14/001');
  });
  it('assigns numbers in real order placement and reuses the existing number on retry', async () => {
    await db.saveObject(tenant, 'subscription_v1', {plan:'pro',status:'active',isReadOnly:false,inventoryFrozen:false});
    const menu = {id:'dish', name:'Dish', price:100, category:'Main', available:true};
    await db.saveSlice(tenant, 'menuItems', [menu]);
    await db.saveObject(tenant, 'settings', {gstPercentage:0,autoDeductStock:false});
    const service = FinancialTransactionService.getInstance();
    const raw = {id:'order-a',date:day,orderNumber:'client-value',type:'Dine-In',items:[{menuItem:menu,quantity:1}],cashierId:'owner',cashierName:'Owner'} as any;
    const first = await service.executeOrderPlacement(tenant, raw);
    const replay = await service.executeOrderPlacement(tenant, raw);
    const next = await service.executeOrderPlacement(tenant, {...raw,id:'order-b'});
    expect(first.order.orderNumber).toBe('2026-11-14/001');
    expect(replay.order.orderNumber).toBe(first.order.orderNumber);
    expect(next.order.orderNumber).toBe('2026-11-14/002');
    expect(first.order.id).toBe('order-a');
  });
  it('displays the daily part and preserves old references', () => {
    expect(displayOrderNumber('2026-11-14/001')).toBe('001');
    expect(displayOrderNumber('#1042')).toBe('1042');
    expect(displayOrderNumber('legacy-abc')).toBe('legacy-abc');
  });
});
