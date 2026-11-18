import { Database } from '../shared/database';
import { orderBusinessDate } from '../../../shared/orderNumber';

/** Called inside order placement's existing tenant transaction. Its revision
 * check serializes allocation across servers as well as across terminals. */
export async function allocateOrderNumber(tenantId: string, instant: string): Promise<string> {
  const db = Database.getInstance();
  return db.runTransaction(tenantId, async () => {
    const day = orderBusinessDate(instant);
    const key = `daily_order_number_v1:${day}`;
    const counter = await db.getObject<{ last: number }>(tenantId, key);
    const orders = await db.getSlice<{ orderNumber: string }>(tenantId, 'orders') || [];
    const prefix = `${day}/`;
    const largest = orders.reduce((max, order) => {
      const suffix = order.orderNumber?.startsWith(prefix) ? order.orderNumber.slice(prefix.length) : '';
      return /^\d+$/.test(suffix) ? Math.max(max, Number(suffix)) : max;
    }, counter?.last || 0);
    const next = largest + 1;
    await db.saveObject(tenantId, key, { last: next });
    return `${prefix}${String(next).padStart(3, '0')}`;
  });
}
