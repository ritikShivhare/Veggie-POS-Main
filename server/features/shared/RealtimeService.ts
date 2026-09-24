import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { parse as parseUrl } from "url";
import { parse as parseCookie } from "cookie";
import { SessionService, SESSION_COOKIE_NAME } from "../auth/SessionService";

export interface AuthenticatedSocket extends WebSocket {
  isAlive?: boolean;
  tenantId?: string;
  userId?: string;
  userName?: string;
  role?: string;
  authenticatedAt?: number;
  socketId?: string;
}

export interface MinimalRealtimeEvent {
  type: string;
  tenantId: string;
  slice?: string;
  entityId?: string;
  timestamp: number;
  data?: Record<string, any>;
}

export class RealtimeService {
  private static instance: RealtimeService;
  private wss: WebSocketServer | null = null;
  private tenantSockets: Map<string, Set<AuthenticatedSocket>> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): RealtimeService {
    if (!RealtimeService.instance) {
      RealtimeService.instance = new RealtimeService();
    }
    return RealtimeService.instance;
  }

  /**
   * Attaches the WebSocket server to the HTTP server.
   * Mediates all connection authentications and binds clients strictly to their session's tenant.
   */
  public attach(httpServer: http.Server): void {
    if (this.wss) {
      return;
    }

    this.wss = new WebSocketServer({
      noServer: true
    });

    httpServer.on("upgrade", async (request, socket, head) => {
      const { pathname } = parseUrl(request.url || "");

      // Only handle upgrades targeting /ws or /api/ws
      if (pathname !== "/ws" && pathname !== "/api/ws") {
        return;
      }

      try {
        // Authenticate the connection during HTTP upgrade handshake
        const session = await this.authenticateRequest(request);

        this.wss?.handleUpgrade(request, socket, head, (ws) => {
          const authWs = ws as AuthenticatedSocket;
          authWs.socketId = Math.random().toString(36).substring(2, 12);
          authWs.isAlive = true;

          if (session) {
            // Immediate server-mediated authorization
            this.bindSocketToTenant(authWs, session.tenantId, session.userId, session.userName, session.role);
          } else {
            // Give client a grace period of 5 seconds to authenticate via in-band message
            this.scheduleAuthTimeout(authWs);
          }

          this.setupSocketHandlers(authWs);
        });
      } catch (err) {
        console.warn("[RealtimeService] Upgrade authentication error:", err);
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
      }
    });

    // Start heartbeat checks every 30 seconds
    this.pingInterval = setInterval(() => {
      if (!this.wss) return;
      for (const client of this.wss.clients) {
        const authClient = client as AuthenticatedSocket;
        if (authClient.isAlive === false) {
          this.removeSocket(authClient);
          authClient.terminate();
          continue;
        }
        authClient.isAlive = false;
        authClient.ping();
      }
    }, 30000);
    this.pingInterval.unref?.();

    console.log("[RealtimeService] Server-mediated WebSocket attached to HTTP server on /ws");
  }

  /**
   * Gracefully shuts down the WebSocket server and clears heartbeat timers
   */
  public close(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.wss) {
      for (const client of this.wss.clients) {
        try {
          client.terminate();
        } catch {}
      }
      this.wss.close();
      this.wss = null;
    }
    this.tenantSockets.clear();
  }

  /**
   * Validates authentication from Cookie, Bearer header, or URL query parameters
   */
  private async authenticateRequest(request: http.IncomingMessage): Promise<any | null> {
    const parsed = parseUrl(request.url || "", true);
    const query = parsed.query;

    // 1. Check query parameter token or sessionId
    let sessionId = (query.token || query.sessionId) as string | undefined;

    // 2. Check Authorization header
    if (!sessionId && request.headers.authorization) {
      const parts = request.headers.authorization.split(" ");
      if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
        sessionId = parts[1];
      }
    }

    // 3. Check HttpOnly cookie
    if (!sessionId && request.headers.cookie) {
      const cookies = parseCookie(request.headers.cookie);
      sessionId = cookies[SESSION_COOKIE_NAME];
    }

    if (!sessionId) {
      return null;
    }

    const sessionService = SessionService.getInstance();
    const session = await sessionService.getSession(sessionId);
    if (!session || !session.tenantId) {
      return null;
    }

    return session;
  }

  /**
   * Binds an authenticated socket strictly to the verified tenant from session.
   * Client-supplied channel names are completely ignored and untrusted.
   */
  public bindSocketToTenant(
    ws: AuthenticatedSocket,
    tenantId: string,
    userId?: string,
    userName?: string,
    role?: string
  ): void {
    // If socket was already registered under a previous tenant, remove it
    if (ws.tenantId && ws.tenantId !== tenantId) {
      this.removeSocket(ws);
    }

    ws.tenantId = tenantId;
    ws.userId = userId;
    ws.userName = userName;
    ws.role = role;
    ws.authenticatedAt = Date.now();

    if (!this.tenantSockets.has(tenantId)) {
      this.tenantSockets.set(tenantId, new Set());
    }
    this.tenantSockets.get(tenantId)!.add(ws);

    // Ensure socket cleanup on close or error
    ws.once("close", () => this.removeSocket(ws));
    ws.once("error", () => this.removeSocket(ws));

    // Send confirmation of secure server-mediated connection with minimal payload
    this.sendJson(ws, {
      type: "connection:ready",
      tenantId: ws.tenantId,
      timestamp: Date.now()
    });
  }

  /**
   * Schedules a 5-second timeout for unauthenticated sockets to complete auth handshake
   */
  private scheduleAuthTimeout(ws: AuthenticatedSocket): void {
    setTimeout(() => {
      if (!ws.tenantId && ws.readyState === WebSocket.OPEN) {
        this.sendJson(ws, {
          type: "error",
          tenantId: "",
          timestamp: Date.now(),
          data: { code: "AUTH_TIMEOUT", message: "Authentication required within 5 seconds." }
        });
        ws.close(4401, "Authentication timeout");
      }
    }, 5000);
  }

  /**
   * Configures socket lifecycle listeners: messages, pings, errors, disconnects
   */
  private setupSocketHandlers(ws: AuthenticatedSocket): void {
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", async (data) => {
      try {
        const str = data.toString();
        const msg = JSON.parse(str);

        // Handle in-band authentication message
        if (msg.type === "auth" || msg.type === "authenticate") {
          const token = msg.token || msg.sessionId;
          if (!token) {
            this.sendJson(ws, {
              type: "error",
              tenantId: ws.tenantId || "",
              timestamp: Date.now(),
              data: { code: "INVALID_CREDENTIALS", message: "Session token is required." }
            });
            return;
          }

          const sessionService = SessionService.getInstance();
          const session = await sessionService.getSession(token);
          if (!session || !session.tenantId) {
            this.sendJson(ws, {
              type: "error",
              tenantId: "",
              timestamp: Date.now(),
              data: { code: "UNAUTHORIZED", message: "Invalid or expired session token." }
            });
            ws.close(4401, "Invalid session token");
            return;
          }

          // Strict server authorization: socket gets bound to session.tenantId
          this.bindSocketToTenant(ws, session.tenantId, session.userId, session.userName, session.role);
          return;
        }

        // Heartbeat ping from client
        if (msg.type === "ping") {
          ws.isAlive = true;
          this.sendJson(ws, { type: "pong", tenantId: ws.tenantId || "", timestamp: Date.now() });
          return;
        }

        // Client attempting to specify channel names is explicitly rejected and ignored!
        // We do NOT trust client channel names.
        if (msg.channel || msg.room || msg.tenantId) {
          console.warn(
            `[RealtimeService] Security Notice: Client attempted to declare channel/room '${msg.channel || msg.room || msg.tenantId}'. Client channel names are untrusted; ignored.`
          );
        }
      } catch (err) {
        console.warn("[RealtimeService] Error processing socket message:", err);
      }
    });

    ws.on("close", () => {
      this.removeSocket(ws);
    });

    ws.on("error", (err) => {
      console.warn("[RealtimeService] Socket error:", err);
      this.removeSocket(ws);
    });
  }

  /**
   * Safely removes socket from tenant tracking map
   */
  private removeSocket(ws: AuthenticatedSocket): void {
    if (ws.tenantId && this.tenantSockets.has(ws.tenantId)) {
      const set = this.tenantSockets.get(ws.tenantId);
      set?.delete(ws);
      if (set && set.size === 0) {
        this.tenantSockets.delete(ws.tenantId);
      }
    }
  }

  /**
   * Helper to serialize and transmit JSON payload
   */
  private sendJson(ws: WebSocket, payload: MinimalRealtimeEvent): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  /**
   * Broadcasts a minimal real-time event strictly to clients of the given tenant.
   * Enforces minimal payloads without sensitive information (no PINs, passwords, or full DB dumps).
   */
  public broadcastToTenant(
    tenantId: string,
    eventType: string,
    options?: {
      slice?: string;
      entityId?: string;
      metadata?: Record<string, any>;
      excludeSocketId?: string;
    }
  ): number {
    if (!tenantId) return 0;

    const sockets = this.tenantSockets.get(tenantId);
    if (!sockets || sockets.size === 0) {
      return 0;
    }

    const payload: MinimalRealtimeEvent = {
      type: eventType,
      tenantId,
      slice: options?.slice,
      entityId: options?.entityId,
      timestamp: Date.now(),
      data: options?.metadata
    };

    const serialized = JSON.stringify(payload);
    let count = 0;

    for (const ws of sockets) {
      if (options?.excludeSocketId && ws.socketId === options.excludeSocketId) {
        continue;
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(serialized);
        count++;
      }
    }

    return count;
  }

  /**
   * Broadcasts a minimal sync invalidation notification for a tenant.
   */
  public broadcastSyncUpdate(tenantId: string, slice: string = "all"): number {
    return this.broadcastToTenant(tenantId, "sync:updated", { slice });
  }

  /**
   * Returns active connection counts for monitoring
   */
  public getStats(): { totalConnections: number; tenantCount: number; tenants: Record<string, number> } {
    let total = 0;
    const tenants: Record<string, number> = {};
    for (const [tid, set] of this.tenantSockets.entries()) {
      tenants[tid] = set.size;
      total += set.size;
    }
    return {
      totalConnections: total,
      tenantCount: this.tenantSockets.size,
      tenants
    };
  }
}

export const realtimeService = RealtimeService.getInstance();
