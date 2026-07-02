import { MenuItem, Ingredient, Recipe, StaffMember, Order, RestaurantTenant, Customer } from "./types";

export const INITIAL_MENU_ITEMS: MenuItem[] = [
  {
    id: "m-thali",
    name: "Special Thali",
    nameHindi: "स्पेशल थाली",
    price: 220,
    category: "Recommended",
    imageUrl: "🍱",
    isVegetarian: true,
    isAvailable: true
  },
  {
    id: "m-paneer-butter",
    name: "Paneer Butter Masala",
    nameHindi: "पनीर बटर मसाला",
    price: 180,
    category: "Main Course",
    imageUrl: "🥘",
    isVegetarian: true,
    isAvailable: true
  },
  {
    id: "m-paneer-tikka",
    name: "Paneer Tikka",
    nameHindi: "पनीर टिक्का",
    price: 150,
    category: "Starters",
    imageUrl: "🍢",
    isVegetarian: true,
    isAvailable: true
  },
  {
    id: "m-manchurian",
    name: "Veg Manchurian Dry",
    nameHindi: "वेज मंचूरियन",
    price: 140,
    category: "Chinese",
    imageUrl: "🧆",
    isVegetarian: true,
    isAvailable: true
  },
  {
    id: "m-crispy-corn",
    name: "Crispy Corn",
    nameHindi: "क्रिस्पी कॉर्न",
    price: 130,
    category: "Starters",
    imageUrl: "🌽",
    isVegetarian: true,
    isAvailable: true
  },
  {
    id: "m-hara-bhara",
    name: "Hara Bhara Kabab",
    nameHindi: "हरा भरा कबाब",
    price: 150,
    category: "Starters",
    imageUrl: "🥙",
    isVegetarian: true,
    isAvailable: true
  },
  {
    id: "m-dal-makhani",
    name: "Dal Makhani",
    nameHindi: "दाल मखनी",
    price: 160,
    category: "Main Course",
    imageUrl: "🍲",
    isVegetarian: true,
    isAvailable: true
  },
  {
    id: "m-dal-tadka",
    name: "Dal Tadka",
    nameHindi: "दाल तड़का",
    price: 140,
    category: "Main Course",
    imageUrl: "🥣",
    isVegetarian: true,
    isAvailable: true
  },
  {
    id: "m-kadhai-paneer",
    name: "Kadhai Paneer",
    nameHindi: "कढ़ाई पनीर",
    price: 190,
    category: "Main Course",
    imageUrl: "🥘",
    isVegetarian: true,
    isAvailable: true
  },
  {
    id: "m-veg-biryani",
    name: "Veg Biryani",
    nameHindi: "वेज बिरयानी",
    price: 250,
    category: "Rice & Biryani",
    imageUrl: "🍛",
    isVegetarian: true,
    isAvailable: true
  },
  {
    id: "m-jeera-rice",
    name: "Jeera Rice",
    nameHindi: "जीरा राइस",
    price: 180,
    category: "Rice & Biryani",
    imageUrl: "🍚",
    isVegetarian: true,
    isAvailable: true
  },
  {
    id: "m-butter-naan",
    name: "Butter Naan",
    nameHindi: "बटर नान",
    price: 50,
    category: "Breads",
    imageUrl: "🫓",
    isVegetarian: true,
    isAvailable: true
  },
  {
    id: "m-tandoori-roti",
    name: "Tandoori Roti",
    nameHindi: "तंदूरी रोटी",
    price: 20,
    category: "Breads",
    imageUrl: "🥖",
    isVegetarian: true,
    isAvailable: true
  },
  {
    id: "m-gulab-jamun",
    name: "Gulab Jamun (2pcs)",
    nameHindi: "गुलाब जामुन",
    price: 50,
    category: "Desserts",
    imageUrl: "🥯",
    isVegetarian: true,
    isAvailable: true
  },
  {
    id: "m-vanilla-ice",
    name: "Vanilla Ice Cream",
    nameHindi: "वैनिला आइसक्रीम",
    price: 40,
    category: "Desserts",
    imageUrl: "🍨",
    isVegetarian: true,
    isAvailable: true
  },
  {
    id: "m-soda",
    name: "Fresh Lime Soda",
    nameHindi: "शिकंजी",
    price: 50,
    category: "Beverages",
    imageUrl: "🥤",
    isVegetarian: true,
    isAvailable: true
  },
  {
    id: "m-water",
    name: "Mineral Water",
    nameHindi: "पानी",
    price: 20,
    category: "Beverages",
    imageUrl: "🍼",
    isVegetarian: true,
    isAvailable: true
  }
];

export const INITIAL_INGREDIENTS: Ingredient[] = [
  { id: "i-paneer", name: "Paneer", unit: "g", currentStock: 1200, minStock: 2000, costPerUnit: 0.4 }, // Low Stock
  { id: "i-butter", name: "Amul Butter", unit: "g", currentStock: 400, minStock: 1000, costPerUnit: 0.6 }, // Low Stock
  { id: "i-rice", name: "Basmati Rice", unit: "g", currentStock: 8500, minStock: 5000, costPerUnit: 0.1 }, // Healthy
  { id: "i-tomato", name: "Tomato", unit: "g", currentStock: 850, minStock: 3000, costPerUnit: 0.05 }, // Low Stock
  { id: "i-onion", name: "Onion", unit: "g", currentStock: 12000, minStock: 8000, costPerUnit: 0.04 }, // Healthy
  { id: "i-garlic", name: "Garlic", unit: "g", currentStock: 2000, minStock: 1000, costPerUnit: 0.2 }, // Healthy
  { id: "i-maida", name: "Maida Flour", unit: "g", currentStock: 6000, minStock: 4000, costPerUnit: 0.08 } // Healthy
];

export const INITIAL_RECIPES: Recipe[] = [
  {
    menuItemId: "m-thali",
    ingredients: [
      { ingredientId: "i-paneer", quantity: 100 },
      { ingredientId: "i-butter", quantity: 20 },
      { ingredientId: "i-rice", quantity: 120 },
      { ingredientId: "i-tomato", quantity: 40 },
      { ingredientId: "i-onion", quantity: 40 }
    ]
  },
  {
    menuItemId: "m-paneer-butter",
    ingredients: [
      { ingredientId: "i-paneer", quantity: 200 },
      { ingredientId: "i-butter", quantity: 50 },
      { ingredientId: "i-tomato", quantity: 80 },
      { ingredientId: "i-onion", quantity: 50 }
    ]
  },
  {
    menuItemId: "m-paneer-tikka",
    ingredients: [
      { ingredientId: "i-paneer", quantity: 180 },
      { ingredientId: "i-onion", quantity: 40 },
      { ingredientId: "i-tomato", quantity: 30 }
    ]
  },
  {
    menuItemId: "m-dal-makhani",
    ingredients: [
      { ingredientId: "i-butter", quantity: 40 },
      { ingredientId: "i-tomato", quantity: 50 },
      { ingredientId: "i-onion", quantity: 30 }
    ]
  },
  {
    menuItemId: "m-veg-biryani",
    ingredients: [
      { ingredientId: "i-rice", quantity: 180 },
      { ingredientId: "i-onion", quantity: 50 },
      { ingredientId: "i-tomato", quantity: 30 },
      { ingredientId: "i-paneer", quantity: 30 }
    ]
  },
  {
    menuItemId: "m-butter-naan",
    ingredients: [
      { ingredientId: "i-maida", quantity: 100 },
      { ingredientId: "i-butter", quantity: 15 }
    ]
  },
  {
    menuItemId: "m-tandoori-roti",
    ingredients: [
      { ingredientId: "i-maida", quantity: 80 }
    ]
  }
];

export const INITIAL_STAFF: StaffMember[] = [
  {
    id: "s-rahul",
    name: "Rahul Sharma",
    role: "Owner",
    pin: "1111",
    permissions: ["billing", "inventory", "reports", "settings"]
  },
  {
    id: "s-amit",
    name: "Amit Kumar",
    role: "Manager",
    pin: "2222",
    permissions: ["billing", "inventory", "reports"]
  },
  {
    id: "s-mohan",
    name: "Mohan Lal",
    role: "Staff",
    pin: "3333",
    permissions: ["billing"]
  }
];

export const INITIAL_ORDERS: Order[] = [
  {
    id: "o-1",
    orderNumber: "1040",
    date: new Date(Date.now() - 3600000 * 2.5).toISOString(),
    type: "Dine-In",
    tableNo: "T-02",
    customerName: "Rakesh Verma",
    items: [
      {
        menuItem: INITIAL_MENU_ITEMS[1], // Paneer Butter Masala
        quantity: 2
      },
      {
        menuItem: INITIAL_MENU_ITEMS[11], // Butter Naan
        quantity: 4
      }
    ],
    subtotal: 560,
    tax: 28,
    total: 588,
    status: "Completed",
    paymentMethod: "UPI",
    paidAt: new Date(Date.now() - 3600000 * 2.2).toISOString(),
    cashierId: "s-rahul",
    cashierName: "Rahul Sharma"
  },
  {
    id: "o-2",
    orderNumber: "1041",
    date: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    type: "Takeaway",
    customerName: "Sneha Gupta",
    items: [
      {
        menuItem: INITIAL_MENU_ITEMS[9], // Veg Biryani
        quantity: 1
      },
      {
        menuItem: INITIAL_MENU_ITEMS[13], // Gulab Jamun
        quantity: 1
      }
    ],
    subtotal: 300,
    tax: 15,
    total: 315,
    status: "Completed",
    paymentMethod: "Cash",
    paidAt: new Date(Date.now() - 3600000 * 1.3).toISOString(),
    cashierId: "s-amit",
    cashierName: "Amit Kumar"
  },
  {
    id: "o-3",
    orderNumber: "1042",
    date: new Date(Date.now() - 600000).toISOString(),
    type: "Dine-In",
    tableNo: "T-04",
    customerName: "Vijay Mathur",
    items: [
      {
        menuItem: INITIAL_MENU_ITEMS[0], // Special Thali
        quantity: 1,
        note: "Extra spicy"
      },
      {
        menuItem: INITIAL_MENU_ITEMS[7], // Dal Tadka
        quantity: 1
      },
      {
        menuItem: INITIAL_MENU_ITEMS[11], // Butter Naan
        quantity: 2
      }
    ],
    subtotal: 460,
    tax: 23,
    total: 483,
    status: "Preparing",
    cashierId: "s-mohan",
    cashierName: "Mohan Lal"
  },
  {
    id: "o-4",
    orderNumber: "1043",
    date: new Date().toISOString(),
    type: "Dine-In",
    tableNo: "T-05",
    items: [
      {
        menuItem: INITIAL_MENU_ITEMS[8], // Kadhai Paneer
        quantity: 1
      },
      {
        menuItem: INITIAL_MENU_ITEMS[12], // Tandoori Roti
        quantity: 3
      }
    ],
    subtotal: 250,
    tax: 12.5,
    total: 262.5,
    status: "Pending",
    cashierId: "s-mohan",
    cashierName: "Mohan Lal"
  }
];

export const INITIAL_TENANTS: RestaurantTenant[] = [
  {
    id: "t-1",
    name: "The Green Kitchen",
    tenantId: "veg-main-001",
    status: "active",
    created: "2026-02-10",
    initialPassword: "password123",
    ownerName: "Rahul Sharma",
    ownerPhone: "9876543210",
    email: "owner@veggie.com",
    region: "North India / Delhi"
  },
  {
    id: "t-2",
    name: "Organic Bites",
    tenantId: "org-bites-02",
    status: "pending",
    created: "2026-02-21",
    initialPassword: "password456",
    ownerName: "Priya Patel",
    ownerPhone: "9123456789",
    email: "priya@organicbites.com",
    region: "South India / Bengaluru"
  }
];

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: "c-1",
    name: "Rakesh Verma",
    phone: "9876543210",
    email: "rakesh.verma@gmail.com",
    dob: "1990-06-28",
    anniversary: "2015-11-23",
    gstin: "07AAAAA1111A1Z1",
    loyaltyPoints: 125,
    comingSince: "2024-01-15",
    lastVisited: "2026-06-25",
    totalVisits: 24,
    totalSpend: 12500,
    maxBillAmount: 1850,
    minBillAmount: 120
  },
  {
    id: "c-2",
    name: "Sneha Gupta",
    phone: "9123456789",
    email: "sneha.gupta@yahoo.com",
    dob: "1995-04-12",
    anniversary: "",
    gstin: "",
    loyaltyPoints: 45,
    comingSince: "2024-08-10",
    lastVisited: "2026-06-29",
    totalVisits: 8,
    totalSpend: 4500,
    maxBillAmount: 850,
    minBillAmount: 180
  },
  {
    id: "c-3",
    name: "Vijay Mathur",
    phone: "9345678901",
    email: "vijay.m@outlook.com",
    dob: "1982-12-05",
    anniversary: "2008-05-18",
    gstin: "08BBBBB2222B2Z2",
    loyaltyPoints: 310,
    comingSince: "2023-05-10",
    lastVisited: "2026-06-30",
    totalVisits: 45,
    totalSpend: 31000,
    maxBillAmount: 2400,
    minBillAmount: 150
  }
];

