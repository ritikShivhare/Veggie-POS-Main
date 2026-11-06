/** Explicit application ↔ SQL mapping. Client-only offline metadata never reaches SQL. */
export const TABLE_MAP: Record<string, string> = {
  ingredients: 'ingredients', menuItems: 'menu_items', menu_items: 'menu_items', purchases: 'purchases',
  recipes: 'recipes', staffList: 'staff', staff: 'staff', orders: 'orders', customers: 'customers', shifts: 'shifts',
  idempotency_keys: 'idempotency_keys', orderItems: 'order_items', order_items: 'order_items',
  payments: 'payments', inventoryMovements: 'inventory_movements', inventory_movements: 'inventory_movements'
};
const fields: Record<string, string[]> = {
  ingredients: ['id','name','unit','currentStock','minStock','costPerUnit'],
  menu_items: ['id','name','nameHindi','price','category','imageUrl','isVegetarian','isAvailable'],
  purchases: ['id','date','ingredientId','ingredientName','quantity','cost','supplier','invoiceNumber'],
  recipes: ['menuItemId','ingredients'],
  staff: ['id','name','role','pin','passwordHash','permissions','avatar','phone','status'],
  orders: ['id','orderNumber','date','type','tableNo','customerId','customerName','items','subtotal','tax','discount','total','status','paymentMethod','paidAt','cashierId','cashierName','discountReason','authorizerName','cancellationReason','cancelledBy','cancelledAt','redeemedPoints','earnedPoints'],
  order_items: ['id','orderId','menuItemId','name','quantity','unitPrice','subtotal','tax','notes'],
  payments: ['id','orderId','amount','paymentMethod','status','transactionReference','cashierId'],
  inventory_movements: ['id','ingredientId','movementType','quantityDelta','previousStock','newStock','referenceId','reason','performedBy'],
  customers: ['id','name','phone','email','dob','anniversary','gstin','loyaltyPoints','comingSince','lastVisited','totalVisits','totalSpend','maxBillAmount','minBillAmount'],
  shifts: ['id','staffId','staffName','role','startTime','endTime','status','openingCash','expectedCash','physicalCashCount','variance','closingNotes','managerOverrideBy'],
  idempotency_keys: ['id','idempotency_key','status_code','response_body','request_path','request_method','request_hash','status','expires_at']
};
const names: Record<string, Record<string,string>> = {
  order_items: {orderId:'order_id',menuItemId:'menu_item_id',unitPrice:'unit_price'},
  payments: {orderId:'order_id',paymentMethod:'payment_method',transactionReference:'transaction_reference',cashierId:'cashier_id'},
  inventory_movements: {ingredientId:'ingredient_id',movementType:'movement_type',quantityDelta:'quantity_delta',previousStock:'previous_stock',newStock:'new_stock',referenceId:'reference_id',performedBy:'performed_by'}
};
export function tableFor(key: string): string {
  const table = TABLE_MAP[key];
  if (!table) throw Object.assign(new Error('Unsupported data table.'), {code:'INVALID_TABLE', status:400});
  return table;
}
export function idFor(table: string): string { return table === 'recipes' ? 'menuItemId' : 'id'; }
export function toDatabaseRow(table: string, tenantId: string, item: any): any {
  const row: any = {tenant_id:tenantId};
  for (const field of [...fields[table], 'version','created_at','updated_at']) {
    let value = item[field];
    if (field === 'updated_at') value ??= item.updatedAt;
    if (field === 'created_at') value ??= item.createdAt;
    if (value !== undefined) row[names[table]?.[field] || field] = value;
  }
  return row;
}
export function fromDatabaseRow(table: string, row: any): any {
  const result: any = {};
  for (const field of [...fields[table], 'version','created_at','updated_at']) {
    const value = row[names[table]?.[field] || field];
    if (value !== undefined && value !== null) {
      const numeric=['price','quantity','unitPrice','subtotal','tax','total','discount','amount','currentStock','minStock','costPerUnit','quantityDelta','previousStock','newStock','loyaltyPoints','totalSpend','totalVisits','maxBillAmount','minBillAmount','openingCash','expectedCash','physicalCashCount','variance','redeemedPoints','earnedPoints','version'];
      result[field] = numeric.includes(field) ? Number(value) : value;
    }
  }
  return result;
}
