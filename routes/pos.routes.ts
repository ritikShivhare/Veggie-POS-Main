import {assertKotMutable} from '../server/features/billing/SubscriptionLifecycle';
import {operationalAlerts} from '../server/features/notifications/OperationalAlerts';
import express from "express";
import { isActiveStaff } from "../src/features/shared/staffStatus";
import rateLimit from "express-rate-limit";
import inventoryRouter from "./inventory.routes";
import { publicStaff,publicState } from "../server/features/shared/security";
import { validateEntity,customerProfile,finiteAmount } from "../server/features/shared/validation";
import { Database, handleApiError } from "../server/features/shared/database";
import {
  staffRepo,
  sessionService,
  orderRepo,
  customerRepo,
  shiftRepo,
  purchaseRepo,
  ingredientRepo,
  settingsRepo,
  auditLogService,
  authMiddleware,
  idempotencyMiddleware,
  requireRole,
  requirePermission,
  PLAN_LIMITS,
  realtimeService,
  financialTransactionService
} from "../server/context";
import {
  hashPin,
  verifyPin,
  findStaffByPinConstantTime
} from "../server/features/auth/PinSecurityService";

const router = express.Router();

// ============================================================================
// REST ENDPOINTS: STAFF (Protected: Staff Management requires Owner/Manager role)
// ============================================================================
router.get("/staff", authMiddleware, requirePermission("staff"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    const data = await staffRepo.getAll(tenantId);
    res.json({ success: true, data: (data || []).filter(isActiveStaff).map(publicStaff) });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.get("/staff/:id", authMiddleware, requirePermission("staff"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    const item = await staffRepo.getById(tenantId, req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: "NOT_FOUND", message: "Staff member not found." });
    }
    res.json({ success: true, data: publicStaff(item) });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.post("/staff", authMiddleware, requireRole("Owner"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    const newStaff = {...req.body, permissions: Array.isArray(req.body.permissions) && req.body.role !== "Owner" ? req.body.permissions.filter((permission: string) => permission !== "settings") : req.body.permissions};
    validateEntity("staffList",newStaff,true);
    await staffRepo.add(tenantId, newStaff);
    res.json({ success: true, message: "Staff member added successfully.", data: publicStaff(await staffRepo.getById(tenantId, req.body.id)) });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.post("/staff/bulk", authMiddleware, requireRole("Owner"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    return res.status(400).json({success:false,error:"EXPLICIT_STAFF_COMMAND_REQUIRED"});
    res.json({ success: true, message: "Staff list synchronized." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.put("/staff/:id", authMiddleware, requireRole("Owner"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    const updated = await Database.getInstance().runTransaction(tenantId,async trx=>{
      const current=await staffRepo.getById(tenantId,req.params.id);
      if(!current) throw Object.assign(new Error("Staff member not found."),{status:404});
      const patch={...req.body,id:req.params.id};
      if(current.role !== "Owner" && Array.isArray(patch.permissions)) patch.permissions=patch.permissions.filter((permission:string)=>permission!=="settings");
      if((patch.pin!==undefined || patch.permissions!==undefined) && !Number.isInteger(patch.version)) throw Object.assign(new Error("Load the latest staff record before saving access changes."),{status:400});
      if(patch.pin!==undefined && !/^\d{4,6}$/.test(patch.pin)) throw Object.assign(new Error("Enter a complete 4–6 digit PIN."),{status:400});
      validateEntity("staffList",{...publicStaff(current),...patch});
      if(current.role==="Owner" && ((patch.role && patch.role!=="Owner") || ["inactive","suspended"].includes(patch.status) || (patch.permissions && current.permissions.some(permission=>!patch.permissions.includes(permission))))) throw Object.assign(new Error("Owner access cannot be removed."),{status:400,code:"OWNER_REQUIRED"});
      if(patch.pin!==undefined && await findStaffByPinConstantTime(((await staffRepo.getAll(tenantId)) || []).filter(staff=>staff.id!==current.id),patch.pin)) throw Object.assign(new Error("Choose a unique PIN for this restaurant."),{status:400});
      const saved=await staffRepo.update(tenantId,patch,patch.version,trx);
      const sessions=await sessionService.getActiveSessions(tenantId);
      for(const session of sessions.filter(session=>session.userId===current.id)) await sessionService.revokeSession(tenantId,session.sessionId);
      Database.getInstance().afterCommit(()=>realtimeService.broadcastSyncUpdate(tenantId,"staff"));
      return saved;
    });
    res.json({ success: true, message: "Staff updated successfully.", data: publicStaff(updated) });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.delete("/staff/:id", authMiddleware, requireRole("Owner"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    const current=await staffRepo.getById(tenantId,req.params.id);
    if(!current) return res.status(404).json({success:false,error:"NOT_FOUND"});
    if(current.role==="Owner") return res.status(400).json({success:false,error:"OWNER_REQUIRED"});
    await staffRepo.update(tenantId,{id:current.id,status:"inactive"} as any, current.version);
    res.json({ success: true, message: "Staff deleted successfully." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

// ============================================================================
// REST ENDPOINTS: ORDERS
// ============================================================================
router.get("/orders", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    const data = await orderRepo.getAll(tenantId);
    const session=(req as any).session;
    res.json({ success: true, data: publicState({orders:data},session.role,session.permissions,session.userId).orders });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.get("/orders/:id", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    const item = await orderRepo.getById(tenantId, req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: "NOT_FOUND", message: "Order not found." });
    }
    const session=(req as any).session;
    if(!publicState({orders:[item]},session.role,session.permissions,session.userId).orders.length) return res.status(404).json({success:false,error:"NOT_FOUND"});
    res.json({ success: true, data: item });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.post("/orders", authMiddleware, requirePermission("billing", "orders"), idempotencyMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  const sub = (req as any).subscription;
  const user = (req as any).user;
  const session = (req as any).session;

  if (Database.getInstance().isDatabaseStopped()) {
    return res.status(503).json({
      success: false,
      error: "DATABASE_UNAVAILABLE",
      message: "Database is unavailable (database is stopped). Cannot persist order."
    });
  }

  try {
    const userContext = {
      role: session?.role || user?.role,
      permissions: user?.permissions,
      staffId: user?.id || session?.userId,
      staffName: user?.name || session?.name
    };

    const result = await financialTransactionService.executeOrderPlacement(tenantId, req.body, userContext);

    try {
      realtimeService.broadcastToTenant(tenantId, "order:created", { entityId: result.order.id, slice: "orders" });
      if (result.payment) {
        realtimeService.broadcastToTenant(tenantId, "payment:success", { entityId: result.payment.id, slice: "payments" });
      }
    } catch {}

    res.json({
      success: true,
      message: "Order placed successfully.",
      data: result.order,
      order: result.order,
      items: result.items,
      payment: result.payment
    });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

// Operational service confirmation never records a payment or changes stock.
router.post('/orders/:id/serve',authMiddleware,requirePermission('orders','billing'),idempotencyMiddleware,async(req,res)=>{
 try {const tenant=(req as any).tenantId,session=(req as any).session;
  const order=await orderRepo.getById(tenant,req.params.id);
  if(!order || !publicState({orders:[order]},session.role,session.permissions,session.userId).orders.length)return res.status(404).json({success:false,error:'NOT_FOUND'});
  const data=await operationalAlerts.serve(tenant,req.params.id,req.body.version,session.userId);res.json({success:true,data});}catch(error){handleApiError(res,error);}
});

// Dedicated Payment Endpoint: Validates and atomically commits order payment
router.post("/orders/:id/pay", authMiddleware, requirePermission("billing"), idempotencyMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  const user = (req as any).user;
  const session = (req as any).session;
  const orderId = req.params.id;

  try {
    const { amount, paymentMethod = "Cash", transactionReference } = req.body;
    const cashierId = user?.id || session?.userId || (req.body && req.body.cashierId);
    const cashierName = user?.name || session?.name || (req.body && req.body.cashierName) || "Cashier";

    const { order, payment } = await financialTransactionService.executeOrderPayment(
      tenantId,
      orderId,
      {
        amount: Number(amount),
        paymentMethod,
        transactionReference,
        cashierId,
        cashierName
      }
    );

    try {
      realtimeService.broadcastToTenant(tenantId, "order:updated", { entityId: order.id, slice: "orders" });
      realtimeService.broadcastToTenant(tenantId, "payment:success", { entityId: payment.id, slice: "payments" });
    } catch {}

    res.json({
      success: true,
      message: `Payment of ₹${payment.amount} recorded successfully.`,
      order,
      payment
    });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.post("/orders/bulk",authMiddleware,requireRole("Owner"),(_req,res)=>res.status(400).json({success:false,error:"BUSINESS_COMMAND_REQUIRED"}));

router.put("/orders/:id",authMiddleware,requirePermission("orders","billing"),idempotencyMiddleware,async(req,res)=>{
  try {
    const tenantId=(req as any).tenantId;
    if(req.body.status==="Cancelled" && !["Owner","Manager"].includes((req as any).session.role)) return res.status(403).json({success:false,error:"FORBIDDEN"});
    const existing=await orderRepo.getById(tenantId,req.params.id);
    if(!existing) return res.status(404).json({success:false,error:"NOT_FOUND"});
    if(existing.paidAt || ["Completed","Cancelled"].includes(existing.status)) return res.status(400).json({success:false,error:"ORDER_SEALED"});
    const allowed=Object.keys(req.body).every(k=>["status","version","tenantId","branchId","deviceId","updatedAt"].includes(k));
    if(!allowed || !["Preparing","Ready"].includes(req.body.status)) return res.status(400).json({success:false,error:"BUSINESS_COMMAND_REQUIRED",message:"Use the payment or cancellation command for financial changes."});
    if(existing.status==="Ready" && req.body.status==="Preparing") return res.status(400).json({success:false,error:"INVALID_STATUS_TRANSITION"});
    const data=await orderRepo.update(tenantId,{id:existing.id,status:req.body.status} as any,req.body.version);
    realtimeService.broadcastSyncUpdate(tenantId,"orders");res.json({success:true,data});
  } catch(error) {handleApiError(res,error);}
});

router.delete("/orders/:id", authMiddleware, requireRole("Owner", "Manager"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  const session = (req as any).session;
  const user = (req as any).user;
  const orderId = req.params.id;

  try {
    // 1. Verify existence of the order in the current tenant boundary
    const order = await orderRepo.getById(tenantId, orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: "NOT_FOUND",
        message: `Order '${orderId}' not found.`
      });
    }

    // 2. Prevent redundant cancellation
    if (order.status === "Cancelled") {
      return res.status(400).json({
        success: false,
        error: "ORDER_ALREADY_CANCELLED",
        message: `Order #${order.orderNumber} is already cancelled.`
      });
    }

    // 3. Extract cancellation metadata
    const reason =
      req.body?.reason ||
      req.body?.cancellationReason ||
      req.query?.reason ||
      "Order voided and cancelled via DELETE /api/orders endpoint";
    const cancelledBy =
      session?.name ||
      user?.name ||
      req.body?.cancelledBy ||
      "Manager";

    // 4. Authoritatively execute order cancellation:
    // Transitions status to 'Cancelled', restocks inventory (with unit conversion),
    // refunds payments, logs audit trail, and preserves fiscal record.
    const cancelledOrder = await financialTransactionService.executeOrderCancellation(
      tenantId,
      orderId,
      {
        cancelledBy,
        reason: String(reason).trim(),
        expectedVersion: req.body?.version,refundConfirmed:req.body?.refundConfirmed===true,staffId:(req as any).session.userId
      }
    );

    try {
      realtimeService.broadcastToTenant(tenantId, "order:updated", { entityId: orderId, slice: "orders" });
      realtimeService.broadcastToTenant(tenantId, "inventory:updated", { slice: "ingredients" });
    } catch {}

    res.json({
      success: true,
      message: `Order #${cancelledOrder.orderNumber} successfully voided and cancelled. Raw materials restocked to inventory and audit entry recorded.`,
      data: cancelledOrder
    });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

// ============================================================================
// REST ENDPOINTS: CUSTOMERS
// ============================================================================
router.get("/customers", authMiddleware, requirePermission("billing","reports"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    const data = await customerRepo.getAll(tenantId);
    res.json({ success: true, data });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.get("/customers/:id", authMiddleware, requirePermission("billing","reports"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    const item = await customerRepo.getById(tenantId, req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: "NOT_FOUND", message: "Customer not found." });
    }
    res.json({ success: true, data: item });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.post("/customers", authMiddleware, requirePermission("billing","reports"), idempotencyMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    if(req.body.tenant_id && req.body.tenant_id!==tenantId) return res.status(403).json({success:false,error:"CROSS_TENANT_VIOLATION"});
    const profile=customerProfile(req.body);
    await customerRepo.add(tenantId, profile);
    const savedCustomer = await customerRepo.getById(tenantId, req.body.id);
    try {
      realtimeService.broadcastToTenant(tenantId, "customer:updated", { entityId: req.body.id, slice: "customers" });
    } catch {}
    res.json({ success: true, message: "Customer profile added.", data: savedCustomer || req.body });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.post("/customers/bulk", authMiddleware, idempotencyMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    return res.status(400).json({success:false,error:"EXPLICIT_CUSTOMER_COMMAND_REQUIRED"});
    try {
      realtimeService.broadcastSyncUpdate(tenantId, "customers");
    } catch {}
    res.json({ success: true, message: "Customers synchronized successfully.", data: req.body });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.post("/customers/:id/points",authMiddleware,requireRole("Owner","Manager"),idempotencyMiddleware,async(req,res)=>{
  try {
    const tenantId=(req as any).tenantId;
    const customer=await customerRepo.getById(tenantId,req.params.id);if(!customer) return res.status(404).json({success:false,error:"NOT_FOUND"});
    const delta=req.body.delta;
    if(!Number.isInteger(delta) || Math.abs(delta)>10000 || !req.body.reason?.trim()) return res.status(400).json({success:false,error:"INVALID_POINTS_ADJUSTMENT"});
    if(customer.loyaltyPoints+delta<0) return res.status(400).json({success:false,error:"INSUFFICIENT_POINTS"});
    const data=await customerRepo.update(tenantId,{...customer,loyaltyPoints:customer.loyaltyPoints+delta},req.body.version);
    await auditLogService.log(tenantId,"LOYALTY_ADJUSTED",(req as any).session.userName,req.body.reason,{customerId:customer.id,delta});
    res.json({success:true,data});
  } catch(error) {handleApiError(res,error);}
});

router.put("/customers/:id", authMiddleware, requirePermission("billing","reports"), idempotencyMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    const existing=await customerRepo.getById(tenantId,req.params.id);
    if(!existing) return res.status(404).json({success:false,error:"NOT_FOUND"});
    const profile=customerProfile({...req.body,id:req.params.id},existing);
    const updatedCustomer = await customerRepo.update(tenantId, profile, req.body.version);
    try {
      realtimeService.broadcastToTenant(tenantId, "customer:updated", { entityId: req.params.id, slice: "customers" });
    } catch {}
    res.json({ success: true, message: "Customer profile updated.", data: updatedCustomer || req.body });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.delete("/customers/:id", authMiddleware, requireRole("Owner"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await customerRepo.delete(tenantId, req.params.id);
    res.json({ success: true, message: "Customer profile deleted." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

// ============================================================================
// REST ENDPOINTS: SHIFTS
// ============================================================================
router.get("/shifts", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    const data = await shiftRepo.getAll(tenantId);
    res.json({ success: true, data });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.post("/shifts", authMiddleware, idempotencyMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    const session=(req as any).session;
    if(req.body.staffId!==session.userId && !["Owner","Manager"].includes(session.role)) return res.status(403).json({success:false,error:"FORBIDDEN"});
    if(req.body.status!=="Active") return res.status(400).json({success:false,error:"INVALID_SHIFT"});
    finiteAmount(req.body.openingCash ?? 0,"Opening cash");
    const existingShifts = await shiftRepo.getAll(tenantId);
    if (existingShifts.some(s => s.staffId === req.body.staffId && s.status === "Active" && !s.endTime)) {
      return res.status(409).json({success:false,error:"ACTIVE_SHIFT_EXISTS",message:"This staff member already has an active duty shift. Close it before starting another."});
    }
    await shiftRepo.add(tenantId, {...req.body,status:"Active",startTime:new Date().toISOString(),staffName:session.userName,role:session.role});
    const savedShift = await shiftRepo.getById(tenantId, req.body.id);
    try {
      realtimeService.broadcastToTenant(tenantId, "shift:updated", { entityId: req.body.id, slice: "shifts" });
    } catch {}
    res.json({ success: true, message: "Shift details saved.", data: savedShift || req.body });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.post("/shifts/bulk",authMiddleware,(_req,res)=>res.status(400).json({success:false,error:"BUSINESS_COMMAND_REQUIRED"}));
router.put("/shifts/:id",authMiddleware,(_req,res)=>res.status(400).json({success:false,error:"USE_BLIND_SHIFT_CLOSE"}));
router.delete("/shifts/:id",authMiddleware,(_req,res)=>res.status(400).json({success:false,error:"SHIFT_LEDGER_IMMUTABLE"}));

// ============================================================================
// OFFLINE SYNC ENGINE ENDPOINT: /sync/outbox
// 1. Validates tenant and branch (authMiddleware + branch extraction)
// 2. Enforces idempotency key (idempotencyMiddleware)
// 3. Performs transactional write via Database.runTransaction
// 4. Returns canonical entity and optimistic version
// 5. Broadcasts realtime sync event
// ============================================================================
// Reuse the real command routes so an offline envelope cannot bypass their
// permissions, validation, payment ledger or manager approval.
router.post("/sync/outbox",authMiddleware,(req,res,next)=>{
  const {operationId,entityType,entityId,operationType,payload}=req.body;
  if(!operationId || typeof entityId!=="string" || !payload || typeof payload!=="object" || !["CREATE","UPDATE","DELETE"].includes(operationType)) return res.status(422).json({success:false,error:"VALIDATION_ERROR"});
  const tenantId=(req as any).tenantId;
  if((payload.tenantId && payload.tenantId!==tenantId) || (payload.tenant_id && payload.tenant_id!==tenantId)) return res.status(403).json({success:false,error:"CROSS_TENANT_VIOLATION"});
  const paths:any={order:"orders",customer:"customers",shift:"shifts",purchase:"purchases",ingredient:"ingredients"};
  let path=paths[entityType],method=operationType==="CREATE"?"POST":operationType==="DELETE"?"DELETE":"PUT";
  if(entityType==="payment") {path=`orders/${encodeURIComponent(entityId)}/pay`;method="POST";}
  else if(path && operationType!=="CREATE") path+=`/${encodeURIComponent(entityId)}`;
  if(!path || (entityType==="payment" && operationType==="DELETE")) return res.status(422).json({success:false,error:"UNSUPPORTED_OPERATION"});
  req.headers["idempotency-key"]=String(req.headers["idempotency-key"] || req.body.idempotencyKey || operationId);
  req.url=`/${path}`;req.originalUrl=`/api/${path}`;req.method=method;req.body={...payload,id:entityId};
  const originalJson=res.json;
  res.json=function(body:any) {
    if(body.success) body={...body,status:"SYNCED",operationId,tenantId,branchId:"main",deviceId:req.headers["x-device-id"],idempotencyKey:req.headers["idempotency-key"],canonicalData:body.data || body.order};
    return originalJson.call(this,body);
  };
  const target=["purchase","ingredient"].includes(entityType)?inventoryRouter:router;
  (target as any).handle(req,res,next);
});

// ============================================================================
// SECURITY, FRAUD PREVENTION & AUDIT CONTROL ENDPOINTS
// ============================================================================

// Verify Manager/Owner PIN for Privileged Operations
router.post("/pos/verify-pin", authMiddleware, rateLimit({windowMs:15*60*1000,limit:20,standardHeaders:true,legacyHeaders:false}), async (req, res) => {
  const tenantId = (req as any).tenantId;
  const { pin, requiredPermission } = req.body;
  if (!pin) {
    return res.status(400).json({ success: false, error: "PIN is required" });
  }

  try {
    const staffList = (await staffRepo.getAll(tenantId)) || [];
    const matchingStaff = await findStaffByPinConstantTime(staffList, pin);

    if (!matchingStaff) {
      return res.status(401).json({ success: false, error: "INVALID_PIN", message: "Invalid Manager/Owner PIN code entered." });
    }

    const isOwnerOrManager = matchingStaff.role === "Owner" || matchingStaff.role === "Manager";
    const hasPermission = requiredPermission ? matchingStaff.permissions?.includes(requiredPermission) : true;

    if (!isOwnerOrManager && !hasPermission) {
      return res.status(403).json({ success: false, error: "INSUFFICIENT_PERMISSIONS", message: "This PIN does not have authorization for this privilege." });
    }

    res.json({
      success: true,
      staff: {
        id: matchingStaff.id,
        name: matchingStaff.name,
        role: matchingStaff.role,
        permissions: matchingStaff.permissions
      }
    });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

// Problem 1: Order Cancellation with Manager PIN & Required Reason
router.post("/orders/:id/cancel", authMiddleware, requireRole("Owner", "Manager"), idempotencyMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  const orderId = req.params.id;
  const { managerPin, reason, staffName = "Staff" } = req.body;

  if (!reason || !reason.trim()) {
    return res.status(400).json({ success: false, error: "REASON_REQUIRED", message: "Cancellation reason is mandatory and cannot be left empty." });
  }

  if (!managerPin) {
    return res.status(401).json({ success: false, error: "PIN_REQUIRED", message: "Manager/Owner PIN code is required to authorize order cancellation." });
  }

  try {
    const staffList = (await staffRepo.getAll(tenantId)) || [];
    const authorizedStaff = staffList.filter((s) => s.role === "Owner" || s.role === "Manager" || s.permissions?.includes("cancel_order" as any));
    const manager = await findStaffByPinConstantTime(authorizedStaff, managerPin);

    if (!manager) {
      return res.status(403).json({ success: false, error: "UNAUTHORIZED_PIN", message: "Invalid Manager PIN or insufficient authorization for order cancellation." });
    }

    const targetOrder = await financialTransactionService.executeOrderCancellation(
      tenantId,
      orderId,
      {
        cancelledBy: manager.name,
        reason: reason.trim(),refundConfirmed:req.body.refundConfirmed===true,staffId:(req as any).session.userId
      }
    );

    try {
      realtimeService.broadcastToTenant(tenantId, "order:updated", { entityId: targetOrder.id, slice: "orders" });
      realtimeService.broadcastToTenant(tenantId, "inventory:updated", { slice: "ingredients" });
    } catch {}

    res.json({
      success: true,
      message: `Order #${targetOrder.orderNumber} successfully cancelled. Audit entry recorded and stock returned.`,
      order: targetOrder
    });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

// Problem 2: Audit Discount Application & Custom Price Edits with Robust Validation
router.post("/orders/audit-discount", authMiddleware, idempotencyMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  const { orderId, originalAmount, discountAmount, finalAmount, managerPin, reason = "Custom Discount" } = req.body;

  // 1. Validate Manager PIN presence
  if (!managerPin || typeof managerPin !== "string" || managerPin.trim().length === 0) {
    return res.status(401).json({ success: false, error: "PIN_REQUIRED", message: "Owner/Manager PIN is required to authorize discounts." });
  }

  // 2. Validate original amount
  const numOrig = Number(originalAmount);
  if (isNaN(numOrig) || !isFinite(numOrig) || numOrig <= 0) {
    return res.status(400).json({
      success: false,
      error: "INVALID_ORIGINAL_AMOUNT",
      message: "Original order amount must be a positive finite number."
    });
  }

  // 3. Validate discount amount
  const numDiscount = Number(discountAmount);
  if (isNaN(numDiscount) || !isFinite(numDiscount) || numDiscount <= 0) {
    return res.status(400).json({
      success: false,
      error: "INVALID_DISCOUNT_AMOUNT",
      message: "Discount amount must be a positive finite number greater than 0."
    });
  }

  // 4. Ceiling check: discount cannot exceed original order amount
  if (numDiscount > numOrig) {
    return res.status(400).json({
      success: false,
      error: "DISCOUNT_EXCEEDS_TOTAL",
      message: `Discount amount (₹${numDiscount}) cannot exceed original order amount (₹${numOrig}).`
    });
  }

  // 5. Final amount calculation check (if supplied by client)
  const expectedFinal = Number((numOrig - numDiscount).toFixed(2));
  if (finalAmount !== undefined && finalAmount !== null) {
    const numFinal = Number(finalAmount);
    if (isNaN(numFinal) || Math.abs(numFinal - expectedFinal) > 0.05) {
      return res.status(400).json({
        success: false,
        error: "INVALID_FINAL_AMOUNT",
        message: `Final amount (₹${numFinal}) does not match original minus discount (₹${expectedFinal}).`
      });
    }
  }

  // 6. Mandatory reason check
  const cleanReason = typeof reason === "string" ? reason.trim() : "";
  if (!cleanReason) {
    return res.status(400).json({
      success: false,
      error: "REASON_REQUIRED",
      message: "A valid business reason is mandatory for auditing discount approvals."
    });
  }

  try {
    // 7. Check restaurant maximum discount percentage policy
    const settings = (await settingsRepo.get(tenantId)) || ({} as any);
    if (settings.maxDiscountPercentage !== undefined && settings.maxDiscountPercentage > 0 && settings.maxDiscountPercentage < 100) {
      const maxPolicyDiscount = Number((numOrig * (settings.maxDiscountPercentage / 100)).toFixed(2));
      if (numDiscount > maxPolicyDiscount) {
        return res.status(400).json({
          success: false,
          error: "DISCOUNT_EXCEEDS_MAX_PERCENTAGE",
          message: `Discount (₹${numDiscount}) exceeds restaurant maximum discount policy of ${settings.maxDiscountPercentage}% (₹${maxPolicyDiscount}).`
        });
      }
    }

    // 8. Constant-time Manager/Owner PIN verification
    const staffList = (await staffRepo.getAll(tenantId)) || [];
    const authorizedStaff = staffList.filter((s) => s.role === "Owner" || s.role === "Manager" || s.permissions?.includes("apply_discount" as any));
    const manager = await findStaffByPinConstantTime(authorizedStaff, managerPin.trim());

    if (!manager) {
      return res.status(403).json({
        success: false,
        error: "UNAUTHORIZED_PIN",
        message: "Invalid Owner/Manager PIN or insufficient privilege to apply discounts."
      });
    }

    // 9. If orderId is provided, validate order lifecycle state and update if active
    let targetOrder: any = null;
    if (orderId && orderId !== "cart" && !String(orderId).startsWith("temp")) {
      targetOrder = await orderRepo.get(tenantId, orderId);
      if (targetOrder) {
        await assertKotMutable(tenantId,targetOrder.id);
        if (targetOrder.status === "Cancelled") {
          return res.status(400).json({
            success: false,
            error: "ORDER_CANCELLED",
            message: "Cannot apply discount to a cancelled order."
          });
        }
        if (targetOrder.status === "Completed" && targetOrder.paidAt) {
          return res.status(400).json({
            success: false,
            error: "ORDER_ALREADY_PAID",
            message: "Cannot apply discount to an already paid and completed order."
          });
        }

        // Apply discount to the existing order in storage
        targetOrder.discount = numDiscount;
        targetOrder.total = expectedFinal;
        targetOrder.updated_at = new Date().toISOString();
        await orderRepo.save(tenantId, targetOrder);
        try {
          realtimeService.broadcastToTenant(tenantId, "order:updated", { entityId: targetOrder.id, slice: "orders" });
        } catch (e) {}
      }
    }

    // 10. Audit log recording
    await auditLogService.log(
      tenantId,
      "DISCOUNT_APPLIED",
      manager.name,
      `Discount of INR ${numDiscount.toFixed(2)} applied by ${manager.name} (Original: INR ${numOrig.toFixed(2)} -> Final: INR ${expectedFinal.toFixed(2)}). Reason: "${cleanReason}"`,
      {
        orderId: targetOrder?.id || orderId || "cart",
        originalAmount: numOrig,
        discountAmount: numDiscount,
        finalAmount: expectedFinal,
        reason: cleanReason,
        authorizer: manager.name
      }
    );

    res.json({
      success: true,
      message: "Discount authorization audit recorded successfully.",
      authorizer: manager.name,
      originalAmount: numOrig,
      discountAmount: numDiscount,
      finalAmount: expectedFinal
    });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

// Problem 2: Audit Price Freeze / Menu Price Change
router.post("/menu/audit-price-change", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  const { itemId, itemName, oldPrice, newPrice, managerPin, reason = "Price Update" } = req.body;

  if (!managerPin) {
    return res.status(401).json({ success: false, error: "PIN_REQUIRED", message: "Owner PIN is required to change menu prices." });
  }

  try {
    const staffList = (await staffRepo.getAll(tenantId)) || [];
    const authorizedStaff = staffList.filter((s) => s.role === "Owner" || s.permissions?.includes("edit_prices" as any));
    const owner = await findStaffByPinConstantTime(authorizedStaff, managerPin);

    if (!owner) {
      return res.status(403).json({ success: false, error: "UNAUTHORIZED_PIN", message: "Only Restaurant Owner PIN can modify item prices." });
    }

    await auditLogService.log(
      tenantId,
      "PRICE_CHANGE",
      owner.name,
      `Item price modified for "${itemName}" (ID: ${itemId}) from INR ${oldPrice} to INR ${newPrice} by ${owner.name}. Reason: "${reason}"`,
      { itemId, itemName, oldPrice, newPrice, authorizer: owner.name }
    );

    res.json({ success: true, message: "Price change authorized and audit entry created.", authorizer: owner.name });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

// Problem 3 Solution 2: Cash Drawer Open Audit Log & Alert
router.post("/pos/open-cash-drawer", authMiddleware, requirePermission("billing"), idempotencyMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  const { staffName = "Cashier", reason } = req.body;

  if (!reason || !reason.trim()) {
    return res.status(400).json({ success: false, error: "REASON_REQUIRED", message: "Reason for opening cash drawer without sale is mandatory." });
  }

  try {
    await auditLogService.log(
      tenantId,
      "CASH_DRAWER_OPENED",
      staffName,
      `Cash drawer popped manually without sale by ${staffName}. Reason: "${reason.trim()}"`,
      { staffName, reason: reason.trim(), timestamp: new Date().toISOString() }
    );

    res.json({ success: true, message: "Cash drawer request recorded. Open the physical drawer manually; no hardware connection is configured." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

// Problem 3 Solution 1 & 3: Blind Cash Drop & Manager Override for Cash Variance
router.post("/shifts/:id/close-blind", authMiddleware, rateLimit({windowMs:15*60*1000,limit:20,standardHeaders:true,legacyHeaders:false}), idempotencyMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  const shiftId = req.params.id;
  const { physicalCashCount, managerPin, closingNotes = "" } = req.body;

  if (physicalCashCount === undefined || physicalCashCount === null || isNaN(Number(physicalCashCount))) {
    return res.status(400).json({ success: false, error: "INVALID_CASH_COUNT", message: "Physical cash count is required for blind shift close." });
  }

  try {
    const result = await Database.getInstance().runTransaction(tenantId,async () => {
    const shifts = (await shiftRepo.getAll(tenantId)) || [];
    const activeShift = shifts.find((s) => s.id === shiftId);

    if (!activeShift) {
      return {status:404,body:{ success: false, error: "SHIFT_NOT_FOUND", message: "No active shift found to close." }};
    }

    if(activeShift.staffId!==(req as any).session.userId && !["Owner","Manager"].includes((req as any).session.role)) return {status:403,body:{success:false,error:"FORBIDDEN"}};
    if(activeShift.status!=="Active") return {status:400,body:{success:false,error:"SHIFT_ALREADY_CLOSED"}};
    finiteAmount(Number(physicalCashCount),"Physical cash count");
    // Count settlements received during the shift, including older pending orders.
    const payments = await financialTransactionService.getPaymentRepo().getAll(tenantId);
    const shiftStartTime = new Date(activeShift.startTime).getTime();
    const shiftCashPayments = payments.filter((p) => {
      const settlementTime = new Date(p.created_at).getTime();
      return settlementTime >= shiftStartTime && p.cashierId===activeShift.staffId && p.paymentMethod === "Cash" && p.status === "Completed";
    });

    const totalCashCollected = shiftCashPayments.reduce((sum, p) => sum + p.amount, 0);
    const openingCash = (activeShift as any).openingCash ?? 0; // default initial drawer float
    const expectedCash = openingCash + totalCashCollected;
    const physicalCount = Number(physicalCashCount);
    const variance = Number((physicalCount - expectedCash).toFixed(2));

    // If variance exists (> ±0), require Manager PIN override
    let managerName = "";
    if (Math.abs(variance) > 0) {
      if (!managerPin) {
        return {status:200,body:{
          success: false,
          requireManagerOverride: true,
          variance,
          expectedCash,
          physicalCashCount: physicalCount,
          message: `Discrepancy detected! Blind Cash Count (INR ${physicalCount}) differs from Expected Cash (INR ${expectedCash}) by INR ${variance > 0 ? "+" : ""}${variance}. Manager PIN override required.`
        }};
      }

      const staffList = (await staffRepo.getAll(tenantId)) || [];
      const authorizedStaff = staffList.filter((s) => s.status!=="inactive" && s.status!=="suspended" && (s.role === "Owner" || s.role === "Manager" || s.permissions?.includes("close_shift" as any)));
      const manager = await findStaffByPinConstantTime(authorizedStaff, managerPin);

      if (!manager) {
        return {status:403,body:{
          success: false,
          error: "UNAUTHORIZED_PIN",
          message: "Invalid Manager PIN code. Override failed."
        }};
      }
      managerName = manager.name;
    }

    // Finalize shift closure
    activeShift.status = "Completed";
    activeShift.endTime = new Date().toISOString();
    (activeShift as any).openingCash = openingCash;
    (activeShift as any).expectedCash = expectedCash;
    (activeShift as any).physicalCashCount = physicalCount;
    (activeShift as any).variance = variance;
    (activeShift as any).closingNotes = closingNotes;
    if (managerName) {
      (activeShift as any).managerOverrideBy = managerName;
    }

    await shiftRepo.update(tenantId, activeShift);

    // Log Audit Trail Entry
    if (variance !== 0) {
      await auditLogService.log(
        tenantId,
        "SHIFT_VARIANCE_OVERRIDE",
        managerName || activeShift.staffName,
        `Shift close completed for ${activeShift.staffName} with Cash Variance of INR ${variance} (Expected: INR ${expectedCash}, Counted: INR ${physicalCount}). Override authorized by: ${managerName || "System"}`,
        {
          shiftId: activeShift.id,
          staffName: activeShift.staffName,
          openingCash,
          expectedCash,
          physicalCashCount: physicalCount,
          variance,
          managerOverrideBy: managerName,
          notes: closingNotes
        }
      );
    } else {
      await auditLogService.log(
        tenantId,
        "SHIFT_CLOSED",
        activeShift.staffName,
        `Shift close completed cleanly for ${activeShift.staffName}. Cash matched perfectly (INR ${physicalCount}).`,
        { shiftId: activeShift.id, expectedCash, physicalCashCount: physicalCount }
      );
    }

    return {status:200,body:{
      success: true,
      message: `Shift closed successfully! ${variance !== 0 ? `Cash Variance (INR ${variance}) override recorded.` : "Drawer cash balanced perfectly."}`,
      shift: activeShift,
      expectedCash,
      physicalCashCount: physicalCount,
      variance
    }};
    });
    res.status(result.status).json(result.body);
  } catch (error: any) {
    handleApiError(res, error);
  }
});

export default router;
