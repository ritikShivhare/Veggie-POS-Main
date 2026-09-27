/**
 * Veggie POS - Offline Storage Layer Record Types
 * Every record in the local database contains:
 * - tenantId (mandatory tenant partition)
 * - branchId (store/branch partition)
 * - deviceId (register/terminal identification)
 * - updatedAt (ISO timestamp)
 * - version (optimistic lock sequence number)
 */

export interface BaseOfflineRecord {
  id: string;
  tenantId: string;
  branchId?: string;
  deviceId?: string;
  updatedAt: string;
  version?: number;
}

export interface OfflineMenuItem extends BaseOfflineRecord {
  name: string;
  nameHindi?: string;
  price: number;
  category: string;
  imageUrl?: string;
  isVegetarian: boolean;
  isAvailable: boolean;
  created_at?: string;
}

export interface OfflineIngredient extends BaseOfflineRecord {
  name: string;
  unit: string;
  currentStock: number;
  minStock: number;
  costPerUnit: number;
  created_at?: string;
}

export interface OfflineRecipe extends BaseOfflineRecord {
  menuItemId: string;
  ingredients: {
    ingredientId: string;
    quantity: number;
  }[];
  created_at?: string;
}

export interface OfflineStaff extends BaseOfflineRecord {
  name: string;
  role: string;
  pin: string;
  permissions: string[];
  created_at?: string;
}

export interface OfflineOrder extends BaseOfflineRecord {
  orderNumber: string;
  date: string;
  type: 'Dine-In' | 'Takeaway';
  tableNo?: string;
  customerName?: string;
  items: any[];
  subtotal: number;
  tax: number;
  discount?: number;
  total: number;
  status: 'Pending' | 'Preparing' | 'Ready' | 'Completed' | 'Cancelled' | string;
  paymentMethod?: 'Cash' | 'UPI' | string;
  paidAt?: string;
  cashierId: string;
  cashierName: string;
  created_at?: string;
}

export interface OfflineOrderItem extends BaseOfflineRecord {
  orderId: string;
  menuItemId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  tax?: number;
  notes?: string;
  created_at?: string;
}

export interface OfflineCustomer extends BaseOfflineRecord {
  name: string;
  phone: string;
  email?: string;
  dob?: string;
  anniversary?: string;
  gstin?: string;
  loyaltyPoints: number;
  comingSince: string;
  lastVisited: string;
  totalVisits: number;
  totalSpend: number;
  maxBillAmount: number;
  minBillAmount: number;
  created_at?: string;
}

export interface OfflineShift extends BaseOfflineRecord {
  staffId: string;
  staffName: string;
  role: string;
  startTime: string;
  endTime?: string;
  status: 'Active' | 'Completed';
  created_at?: string;
}

export interface OfflineSetting extends BaseOfflineRecord {
  key: string;
  value: any;
}

export type OutboxActionType =
  | 'CREATE_ORDER'
  | 'UPDATE_ORDER_STATUS'
  | 'CANCEL_ORDER'
  | 'SAVE_PURCHASE'
  | 'UPDATE_INVENTORY'
  | 'CREATE_CUSTOMER'
  | 'UPDATE_CUSTOMER'
  | 'CLOCK_IN_SHIFT'
  | 'CLOSE_SHIFT'
  | 'SYNC_FULL_STATE';

export type OutboxStatus =
  | 'pending'
  | 'syncing'
  | 'SYNCED'
  | 'completed'
  | 'conflict'
  | 'auth_error'
  | 'validation_error'
  | 'failed';

export type OutboxEntityType =
  | 'order'
  | 'payment'
  | 'inventory'
  | 'customer'
  | 'shift'
  | 'purchase'
  | 'settings'
  | 'menu'
  | string;

export type OutboxOperationType = 'CREATE' | 'UPDATE' | 'DELETE' | string;

export interface OfflineOutboxItem extends BaseOfflineRecord {
  /** Client-generated UUID representing the unique outbox operation */
  operationId: string;
  /** Mandatory tenant isolation ID */
  tenantId: string;
  /** Store or branch identifier */
  branchId: string;
  /** Unique terminal/register identifier */
  deviceId: string;
  /** Entity domain type ('order', 'payment', 'inventory', 'customer', etc.) */
  entityType: OutboxEntityType;
  /** Target entity UUID */
  entityId: string;
  /** Operation mutation verb ('CREATE', 'UPDATE', 'DELETE') */
  operationType: OutboxOperationType;
  /** Mutation payload */
  payload: any;
  /** ISO 8601 creation timestamp */
  createdAt: string;
  /** Number of times replay was attempted */
  retryCount: number;
  /** Current outbox state */
  status: OutboxStatus;

  /** Target HTTP endpoint */
  endpoint: string;
  /** HTTP method */
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Existing server idempotency key */
  idempotencyKey: string;
  /** Millisecond timestamp before which this mutation must not be retried (exponential backoff) */
  nextRetryAt?: number;
  /** Epoch milliseconds when item was created */
  clientTimestamp: number;
  /** Last error message recorded during sync attempt */
  lastError?: string;
  /** Legacy action alias */
  action?: OutboxActionType | string;
  created_at?: string;
}

export interface OfflineSyncMetadata extends BaseOfflineRecord {
  sliceName: string;
  lastSyncedAt: string;
  serverVersion: number;
  clientVersion: number;
  status: 'synced' | 'pending' | 'conflict';
}
