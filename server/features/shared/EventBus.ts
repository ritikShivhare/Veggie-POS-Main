export type AppEventType = "INVENTORY_UPDATE" | "ORDER_COMPLETE" | "PAYMENT_SUCCESS";

export interface AppEvent<T = any> {
  id: string;
  type: AppEventType;
  timestamp: string;
  tenantId: string;
  payload: T;
}

export type EventListener<T = any> = (event: AppEvent<T>) => Promise<void> | void;

export class EventBus {
  private static instance: EventBus;
  private listeners: Record<string, EventListener[]> = {};
  private eventHistory: AppEvent[] = [];

  private constructor() {}

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Subscribe a loosely-coupled listener to an event type
   */
  public subscribe<T = any>(type: AppEventType, listener: EventListener<T>): void {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(listener);
    console.log(`[EventBus] Subscriber registered for event: ${type}`);
  }

  /**
   * Unsubscribe a listener from an event type
   */
  public unsubscribe<T = any>(type: AppEventType, listener: EventListener<T>): void {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
    console.log(`[EventBus] Subscriber removed from event: ${type}`);
  }

  /**
   * Publish an event to all subscribers asynchronously to maintain low latency and loose coupling
   */
  public publish<T = any>(tenantId: string, type: AppEventType, payload: T): void {
    const event: AppEvent<T> = {
      id: `evt-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      type,
      timestamp: new Date().toISOString(),
      tenantId,
      payload
    };

    // Keep history of last 100 events
    this.eventHistory.unshift(event);
    if (this.eventHistory.length > 100) {
      this.eventHistory = this.eventHistory.slice(0, 100);
    }

    console.log(`[EventBus] Publishing event: ${type} (ID: ${event.id})`);

    // Asynchronously dispatch to listeners to ensure loose coupling & non-blocking execution
    const subscribers = this.listeners[type] || [];
    subscribers.forEach((listener) => {
      try {
        Promise.resolve(listener(event)).catch((err) => {
          console.error(`[EventBus] Error in listener execution for ${type}:`, err);
        });
      } catch (err) {
        console.error(`[EventBus] Synchronous throw in listener for ${type}:`, err);
      }
    });
  }

  /**
   * Fetch all recorded events in memory
   */
  public getHistory(): AppEvent[] {
    return this.eventHistory;
  }

  /**
   * Clear all event logs
   */
  public clearHistory(): void {
    this.eventHistory = [];
  }
}
