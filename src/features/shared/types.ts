export interface MenuItem {
  id: string;
  name: string;
  nameHindi?: string;
  price: number;
  category: string;
  imageUrl?: string;
  isVegetarian: boolean;
  isAvailable: boolean;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: string; // e.g., 'g', 'ml', 'pcs', 'kg'
  currentStock: number;
  minStock: number;
  costPerUnit: number;
}

export interface Recipe {
  menuItemId: string;
  ingredients: {
    ingredientId: string;
    quantity: number; // deduction amount when 1 portion of menuItem is ordered
  }[];
}

export interface Purchase {
  id: string;
  date: string;
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  cost: number;
  supplier: string;
  invoiceNumber?: string;
}

export type StaffRole = 'Owner' | 'Manager' | 'Cashier' | 'Waiter' | 'Chef' | 'Staff' | string;

export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  pin: string; // 4 to 6 digit PIN
  permissions: ('billing' | 'inventory' | 'reports' | 'settings' | string)[];
}

export interface Shift {
  id: string;
  staffId: string;
  staffName: string;
  role: StaffRole;
  startTime: string;
  endTime?: string;
  status: 'Active' | 'Completed';
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  note?: string;
}

export type OrderStatus = 'Pending' | 'Preparing' | 'Ready' | 'Completed' | 'Cancelled';

export interface Order {
  id: string;
  orderNumber: string; // e.g., '#1042'
  date: string; // ISO String
  type: 'Dine-In' | 'Takeaway';
  tableNo?: string;
  customerName?: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: OrderStatus;
  paymentMethod?: 'Cash' | 'UPI';
  paidAt?: string;
  cashierId: string;
  cashierName: string;
}

export interface Customer {
  id: string;
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
}

export interface RestaurantTenant {
  id: string;
  name: string;
  tenantId: string;
  status: 'active' | 'pending' | 'suspended';
  created: string;
  initialPassword?: string;
  ownerName?: string;
  ownerPhone?: string;
  email?: string;
  region?: string;
  plan?: 'free' | 'pro' | 'enterprise';
  planStatus?: string;
  usage?: {
    staffCount: number;
    monthlyOrders: number;
  };
  ownerPin?: string;
}

export interface InventorySettings {
  autoDeductStock: boolean;
  blockOrdersIfInsufficient: boolean;
  managerCanAddPurchases: boolean;
  managerCanEditRecipes: boolean;
  kdsSoundAlerts: boolean;
  quickPinRequired: boolean;
  sentryDsn?: string;
  slackWebhookUrl?: string;
  emailAlertAddress?: string;
  enableAlerts?: boolean;
  gstPercentage?: number;
}
