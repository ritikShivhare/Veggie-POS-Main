export type MarketingRoute =
  | "/"
  | "/product"
  | "/solutions"
  | "/roi"
  | "/pricing"
  | "/about"
  | "/resources"
  | "/contact";

export interface DemoRequest {
  fullName: string;
  email: string;
  phone: string;
  restaurantName: string;
  format: "casual-dine" | "qsr" | "cafe-bakery" | "cloud-kitchen" | "multi-outlet" | "other";
  outletCount: string;
  primaryGoal: string;
  preferredDate?: string;
  preferredTime?: string;
  notes?: string;
}

export interface ResourceArticle {
  id: string;
  title: string;
  summary: string;
  category: "inventory" | "operations" | "technology" | "growth";
  readTime: string;
  publishDate: string;
  keyTakeaway: string;
}
