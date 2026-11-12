import { GUIDE_PATHS } from "../../../shared/marketing-guides";

export const MARKETING_ROUTES = [
  "/", "/product", "/solutions", "/solutions/cafes", "/roi", "/pricing",
  "/about", "/resources", "/contact", ...GUIDE_PATHS,
] as const;
export type MarketingRoute = typeof MARKETING_ROUTES[number];
export function isMarketingRoute(path: string): path is MarketingRoute {
  return MARKETING_ROUTES.some(route => route === path);
}

export interface DemoRequest {
  fullName: string;
  email: string;
  phone: string;
  restaurantName: string;
  format: "casual-dine" | "qsr" | "cafe-bakery" | "cloud-kitchen" | "multi-outlet" | "other";
  outletCount: string;
  primaryGoal: string;
  address: string;
  preferredDate?: string;
  preferredTime?: string;
  notes?: string;
}

export interface WalkthroughLead extends DemoRequest {
  id: string;
  createdAt: string;
  status: "new" | "contacted" | "scheduled" | "completed" | "converted" | "cancelled";
  internalNotes?: string;
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
