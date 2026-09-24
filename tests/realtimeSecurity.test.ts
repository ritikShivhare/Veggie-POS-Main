import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RealtimeService, AuthenticatedSocket } from "../server/features/shared/RealtimeService";
import { sessionService } from "../server/context";
import EventEmitter from "events";
import { WebSocket } from "ws";

// Mock WebSocket implementation for unit testing socket behavior
class MockWebSocket extends EventEmitter {
  public readyState: number = WebSocket.OPEN;
  public sentMessages: string[] = [];
  public closedCode: number | null = null;
  public closedReason: string | null = null;

  send(data: string) {
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string) {
    this.closedCode = code || 1000;
    this.closedReason = reason || "";
    this.readyState = WebSocket.CLOSED;
    this.emit("close");
  }

  terminate() {
    this.readyState = WebSocket.CLOSED;
    this.emit("close");
  }

  ping() {
    this.emit("ping");
  }
}

type TestSocket = MockWebSocket & AuthenticatedSocket;

describe("Realtime Security & Server-Mediated WebSockets", () => {
  let realtimeService: RealtimeService;

  beforeEach(() => {
    vi.restoreAllMocks();
    realtimeService = RealtimeService.getInstance();
    realtimeService.close(); // Reset any existing state
  });

  afterEach(() => {
    realtimeService.close();
  });

  it("should bind socket strictly to the authenticated tenant and send connection:ready", () => {
    const mockSocket = new MockWebSocket() as unknown as TestSocket;

    realtimeService.bindSocketToTenant(mockSocket, "tenant-alpha", "usr-1", "Chef Suresh", "Staff");

    expect(mockSocket.tenantId).toBe("tenant-alpha");
    expect(mockSocket.userId).toBe("usr-1");
    expect(mockSocket.role).toBe("Staff");
    expect(mockSocket.sentMessages.length).toBe(1);

    const initMsg = JSON.parse(mockSocket.sentMessages[0]);
    expect(initMsg.type).toBe("connection:ready");
    expect(initMsg.tenantId).toBe("tenant-alpha");
    expect(initMsg.timestamp).toBeTypeOf("number");
  });

  it("should strictly isolate real-time broadcasts between different tenants", () => {
    const socketAlpha1 = new MockWebSocket() as unknown as TestSocket;
    const socketAlpha2 = new MockWebSocket() as unknown as TestSocket;
    const socketBeta = new MockWebSocket() as unknown as TestSocket;

    realtimeService.bindSocketToTenant(socketAlpha1, "tenant-alpha");
    realtimeService.bindSocketToTenant(socketAlpha2, "tenant-alpha");
    realtimeService.bindSocketToTenant(socketBeta, "tenant-beta");

    // Clear initial handshake messages
    socketAlpha1.sentMessages = [];
    socketAlpha2.sentMessages = [];
    socketBeta.sentMessages = [];

    // Broadcast to tenant-alpha
    const count = realtimeService.broadcastToTenant("tenant-alpha", "order:completed", {
      slice: "orders",
      entityId: "ord-100"
    });

    expect(count).toBe(2);
    expect(socketAlpha1.sentMessages.length).toBe(1);
    expect(socketAlpha2.sentMessages.length).toBe(1);
    expect(socketBeta.sentMessages.length).toBe(0); // MUST NEVER receive tenant-alpha messages

    const receivedAlpha1 = JSON.parse(socketAlpha1.sentMessages[0]);
    expect(receivedAlpha1.type).toBe("order:completed");
    expect(receivedAlpha1.tenantId).toBe("tenant-alpha");
    expect(receivedAlpha1.entityId).toBe("ord-100");
  });

  it("should minimize event payload and avoid leaking database dumps or passwords", () => {
    const socket = new MockWebSocket() as unknown as TestSocket;
    realtimeService.bindSocketToTenant(socket, "tenant-main");
    socket.sentMessages = [];

    realtimeService.broadcastSyncUpdate("tenant-main", "all");

    expect(socket.sentMessages.length).toBe(1);
    const event = JSON.parse(socket.sentMessages[0]);

    // Validate minimal schema
    expect(event).toEqual({
      type: "sync:updated",
      tenantId: "tenant-main",
      slice: "all",
      timestamp: expect.any(Number)
    });

    // Verify no sensitive fields exist in payload
    expect(event.pin).toBeUndefined();
    expect(event.password).toBeUndefined();
    expect(event.fullState).toBeUndefined();
    expect(event.customers).toBeUndefined();
  });

  it("should exclude socket by excludeSocketId when specified", () => {
    const sender = new MockWebSocket() as unknown as TestSocket;
    sender.socketId = "sock-sender-1";
    const receiver = new MockWebSocket() as unknown as TestSocket;
    receiver.socketId = "sock-receiver-2";

    realtimeService.bindSocketToTenant(sender, "tenant-delta");
    realtimeService.bindSocketToTenant(receiver, "tenant-delta");

    sender.sentMessages = [];
    receiver.sentMessages = [];

    realtimeService.broadcastToTenant("tenant-delta", "inventory:updated", {
      slice: "ingredients",
      excludeSocketId: "sock-sender-1"
    });

    expect(sender.sentMessages.length).toBe(0);
    expect(receiver.sentMessages.length).toBe(1);
  });

  it("should reject in-band auth with invalid session token and close with 4401", async () => {
    vi.spyOn(sessionService, "getSession").mockResolvedValue(null);

    const socket = new MockWebSocket() as unknown as TestSocket;
    // Simulate setup handlers
    (realtimeService as any).setupSocketHandlers(socket);

    // Simulate client sending auth message with invalid token
    socket.emit("message", JSON.stringify({ type: "auth", token: "invalid-token" }));

    // Wait microtask queue
    await new Promise((r) => setTimeout(r, 10));

    expect(socket.closedCode).toBe(4401);
    expect(socket.closedReason).toBe("Invalid session token");
  });

  it("should accept in-band auth with valid session token and bind to session tenant", async () => {
    vi.spyOn(sessionService, "getSession").mockResolvedValue({
      sessionId: "valid-session-123",
      userId: "user-456",
      userName: "Pooja",
      role: "Manager",
      tenantId: "tenant-verified",
      ipAddress: "127.0.0.1",
      device: { os: "Linux", browser: "Chrome", deviceType: "desktop", userAgent: "test" },
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString()
    });

    const socket = new MockWebSocket() as unknown as TestSocket;
    (realtimeService as any).setupSocketHandlers(socket);

    socket.emit("message", JSON.stringify({ type: "auth", token: "valid-session-123" }));

    await new Promise((r) => setTimeout(r, 10));

    expect(socket.tenantId).toBe("tenant-verified");
    expect(socket.userId).toBe("user-456");
    expect(socket.role).toBe("Manager");
  });

  it("should ignore and not trust client-declared channel or room names", async () => {
    const socket = new MockWebSocket() as unknown as TestSocket;
    realtimeService.bindSocketToTenant(socket, "tenant-legit");
    (realtimeService as any).setupSocketHandlers(socket);

    // Attacker client attempts to declare channel or switch tenant
    socket.emit("message", JSON.stringify({ channel: "public:tenant-victim", tenantId: "tenant-victim" }));

    await new Promise((r) => setTimeout(r, 10));

    // The server must retain tenant-legit and never switch to tenant-victim
    expect(socket.tenantId).toBe("tenant-legit");

    const stats = realtimeService.getStats();
    expect(stats.tenants["tenant-legit"]).toBe(1);
    expect(stats.tenants["tenant-victim"]).toBeUndefined();
  });

  it("should cleanly track and untrack connections across lifecycle", () => {
    const socket1 = new MockWebSocket() as unknown as TestSocket;
    const socket2 = new MockWebSocket() as unknown as TestSocket;

    realtimeService.bindSocketToTenant(socket1, "tenant-track");
    realtimeService.bindSocketToTenant(socket2, "tenant-track");

    let stats = realtimeService.getStats();
    expect(stats.totalConnections).toBe(2);
    expect(stats.tenantCount).toBe(1);

    // Socket 1 disconnects
    socket1.emit("close");

    stats = realtimeService.getStats();
    expect(stats.totalConnections).toBe(1);
    expect(stats.tenantCount).toBe(1);

    // Socket 2 disconnects
    socket2.emit("close");

    stats = realtimeService.getStats();
    expect(stats.totalConnections).toBe(0);
    expect(stats.tenantCount).toBe(0);
  });
});
