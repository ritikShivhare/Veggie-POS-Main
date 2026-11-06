export const alertRoles=['Chef','Cashier','Manager','Owner','Waiter','Staff'] as const;
export type AlertRole=typeof alertRoles[number];
export type OperationalAlert='newOrder'|'orderServed'|'lowStock';
export interface AlertRule {enabled:boolean;role:AlertRole;fallbackRole:AlertRole;}
export interface NotificationRules {version:number;newOrder:AlertRule;orderServed:AlertRule;lowStock:AlertRule;}
export const defaultNotificationRules:NotificationRules={version:1,newOrder:{enabled:true,role:'Chef',fallbackRole:'Owner'},orderServed:{enabled:true,role:'Cashier',fallbackRole:'Owner'},lowStock:{enabled:true,role:'Manager',fallbackRole:'Owner'}};
export const alertLabels:Record<OperationalAlert,string>={newOrder:'New order → Kitchen',orderServed:'Served to customer → Cashier',lowStock:'Low stock → Reorder'};
