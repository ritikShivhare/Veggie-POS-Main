import express from "express";
import { handleApiError } from "../server/features/shared/database";
import {
  staffRepo,
  orderRepo,
  customerRepo,
  shiftRepo,
  auditLogService,
  authMiddleware,
  idempotencyMiddleware,
  requireRole,
  requirePermission,
  PLAN_LIMITS
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
    res.json({ success: true, data });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.post("/staff", authMiddleware, requireRole("Owner", "Manager"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  const sub = (req as any).subscription;
  try {
    const staffList = await staffRepo.getAll(tenantId);
    const limit = PLAN_LIMITS[sub.plan]?.staffCount ?? 3;
    if (staffList.length >= limit) {
      return res.status(403).json({
        success: false,
        error: "PLAN_LIMIT_EXCEEDED",
        message: `Your current subscription plan (${sub.plan.toUpperCase()}) only supports up to ${limit} staff members. Please upgrade your plan in settings to add more team members.`
      });
    }
    await staffRepo.add(tenantId, req.body);
    res.json({ success: true, message: "Staff member added successfully." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.post("/staff/bulk", authMiddleware, requireRole("Owner", "Manager"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await staffRepo.saveAll(tenantId, req.body);
    res.json({ success: true, message: "Staff list synchronized." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.put("/staff/:id", authMiddleware, requireRole("Owner", "Manager"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await staffRepo.update(tenantId, req.body);
    res.json({ success: true, message: "Staff updated successfully." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.delete("/staff/:id", authMiddleware, requireRole("Owner", "Manager"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await staffRepo.delete(tenantId, req.params.id);
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
    res.json({ success: true, data });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.post("/orders", authMiddleware, idempotencyMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  const sub = (req as any).subscription;
  try {
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const orders = await orderRepo.getAll(tenantId);
    const monthlyCount = orders.filter(o => o.date && o.date.startsWith(currentYearMonth)).length;

    const limit = PLAN_LIMITS[sub.plan]?.monthlyOrders ?? 30;
    if (monthlyCount >= limit) {
      return res.status(403).json({
        success: false,
        error: "PLAN_LIMIT_EXCEEDED",
        message: `Your current subscription plan (${sub.plan.toUpperCase()}) only supports up to ${limit} orders per month. You have placed ${monthlyCount} orders this month. Please upgrade your plan in settings to continue placing orders.`
      });
    }
    await orderRepo.add(tenantId, req.body);
    res.json({ success: true, message: "Order placed successfully." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.post("/orders/bulk", authMiddleware, idempotencyMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await orderRepo.saveAll(tenantId, req.body);
    res.json({ success: true, message: "Orders synchronized successfully." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.put("/orders/:id", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    // Order cancellation protection: Only Owner or Manager can transition order status to 'Cancelled'
    if (req.body && req.body.status === "Cancelled") {
      const session = (req as any).session;
      const role = session?.role;
      const isOwnerOrManager = role === "Owner" || role === "Manager" || role === "SaaS Owner";
      if (!isOwnerOrManager) {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Cancelling an order requires Owner or Manager role authorization."
        });
      }
    }
    await orderRepo.update(tenantId, req.body);
    res.json({ success: true, message: "Order updated successfully." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.delete("/orders/:id", authMiddleware, requireRole("Owner", "Manager"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await orderRepo.delete(tenantId, req.params.id);
    res.json({ success: true, message: "Order cancelled/deleted." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

// ============================================================================
// REST ENDPOINTS: CUSTOMERS
// ============================================================================
router.get("/customers", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    const data = await customerRepo.getAll(tenantId);
    res.json({ success: true, data });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.post("/customers", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await customerRepo.add(tenantId, req.body);
    res.json({ success: true, message: "Customer profile added." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.post("/customers/bulk", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await customerRepo.saveAll(tenantId, req.body);
    res.json({ success: true, message: "Customers synchronized successfully." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.put("/customers/:id", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await customerRepo.update(tenantId, req.body);
    res.json({ success: true, message: "Customer profile updated." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.delete("/customers/:id", authMiddleware, async (req, res) => {
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

router.post("/shifts", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await shiftRepo.add(tenantId, req.body);
    res.json({ success: true, message: "Shift details saved." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.post("/shifts/bulk", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await shiftRepo.saveAll(tenantId, req.body);
    res.json({ success: true, message: "Shifts synchronized successfully." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.put("/shifts/:id", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await shiftRepo.update(tenantId, req.body);
    res.json({ success: true, message: "Shift updated." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.delete("/shifts/:id", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await shiftRepo.delete(tenantId, req.params.id);
    res.json({ success: true, message: "Shift log deleted." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

// ============================================================================
// SECURITY, FRAUD PREVENTION & AUDIT CONTROL ENDPOINTS
// ============================================================================

// Verify Manager/Owner PIN for Privileged Operations
router.post("/pos/verify-pin", authMiddleware, async (req, res) => {
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

    const orders = (await orderRepo.getAll(tenantId)) || [];
    const targetOrder = orders.find((o) => o.id === orderId);

    if (!targetOrder) {
      return res.status(404).json({ success: false, error: "NOT_FOUND", message: "Order not found." });
    }

    targetOrder.status = "Cancelled";
    (targetOrder as any).cancellationReason = reason.trim();
    (targetOrder as any).cancelledBy = manager.name;
    (targetOrder as any).cancelledAt = new Date().toISOString();

    await orderRepo.update(tenantId, targetOrder);

    // Append cryptographic immutable audit log entry
    await auditLogService.log(
      tenantId,
      "ORDER_CANCELLED",
      manager.name,
      `Order #${targetOrder.orderNumber} (Value: INR ${targetOrder.total}) cancelled by Manager ${manager.name}. Reason: "${reason.trim()}"`,
      {
        orderId: targetOrder.id,
        orderNumber: targetOrder.orderNumber,
        totalAmount: targetOrder.total,
        reason: reason.trim(),
        authorizerId: manager.id,
        authorizerName: manager.name,
        initiatedBy: staffName
      }
    );

    res.json({
      success: true,
      message: `Order #${targetOrder.orderNumber} successfully cancelled. Audit entry recorded.`,
      order: targetOrder
    });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

// Problem 2: Audit Discount Application & Custom Price Edits
router.post("/orders/audit-discount", authMiddleware, idempotencyMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  const { orderId, originalAmount, discountAmount, finalAmount, managerPin, reason = "Custom Discount" } = req.body;

  if (!managerPin) {
    return res.status(401).json({ success: false, error: "PIN_REQUIRED", message: "Owner/Manager PIN is required to authorize discounts." });
  }

  try {
    const staffList = (await staffRepo.getAll(tenantId)) || [];
    const authorizedStaff = staffList.filter((s) => s.role === "Owner" || s.role === "Manager" || s.permissions?.includes("apply_discount" as any));
    const manager = await findStaffByPinConstantTime(authorizedStaff, managerPin);

    if (!manager) {
      return res.status(403).json({ success: false, error: "UNAUTHORIZED_PIN", message: "Invalid Owner/Manager PIN or insufficient privilege to apply discounts." });
    }

    await auditLogService.log(
      tenantId,
      "DISCOUNT_APPLIED",
      manager.name,
      `Discount of INR ${discountAmount} applied by ${manager.name} (Original: INR ${originalAmount} -> Final: INR ${finalAmount}). Reason: "${reason}"`,
      {
        orderId,
        originalAmount,
        discountAmount,
        finalAmount,
        reason,
        authorizer: manager.name
      }
    );

    res.json({ success: true, message: "Discount authorization audit recorded successfully.", authorizer: manager.name });
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
router.post("/pos/open-cash-drawer", authMiddleware, idempotencyMiddleware, async (req, res) => {
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

    res.json({ success: true, message: "Cash drawer pop audit logged and alert dispatched." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

// Problem 3 Solution 1 & 3: Blind Cash Drop & Manager Override for Cash Variance
router.post("/shifts/:id/close-blind", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  const shiftId = req.params.id;
  const { physicalCashCount, managerPin, closingNotes = "" } = req.body;

  if (physicalCashCount === undefined || physicalCashCount === null || isNaN(Number(physicalCashCount))) {
    return res.status(400).json({ success: false, error: "INVALID_CASH_COUNT", message: "Physical cash count is required for blind shift close." });
  }

  try {
    const shifts = (await shiftRepo.getAll(tenantId)) || [];
    const activeShift = shifts.find((s) => s.id === shiftId || (s.staffId === req.body.staffId && s.status === "Active"));

    if (!activeShift) {
      return res.status(404).json({ success: false, error: "SHIFT_NOT_FOUND", message: "No active shift found to close." });
    }

    // Compute expected cash during this shift from orders
    const orders = (await orderRepo.getAll(tenantId)) || [];
    const shiftStartTime = new Date(activeShift.startTime).getTime();
    const shiftCashOrders = orders.filter((o) => {
      const orderTime = new Date(o.date).getTime();
      return orderTime >= shiftStartTime && o.paymentMethod === "Cash" && o.status === "Completed";
    });

    const totalCashCollected = shiftCashOrders.reduce((sum, o) => sum + o.total, 0);
    const openingCash = (activeShift as any).openingCash || 500; // default initial drawer float
    const expectedCash = openingCash + totalCashCollected;
    const physicalCount = Number(physicalCashCount);
    const variance = Number((physicalCount - expectedCash).toFixed(2));

    // If variance exists (> ±0), require Manager PIN override
    let managerName = "";
    if (Math.abs(variance) > 0) {
      if (!managerPin) {
        return res.json({
          success: false,
          requireManagerOverride: true,
          variance,
          expectedCash,
          physicalCashCount: physicalCount,
          message: `Discrepancy detected! Blind Cash Count (INR ${physicalCount}) differs from Expected Cash (INR ${expectedCash}) by INR ${variance > 0 ? "+" : ""}${variance}. Manager PIN override required.`
        });
      }

      const staffList = (await staffRepo.getAll(tenantId)) || [];
      const authorizedStaff = staffList.filter((s) => s.role === "Owner" || s.role === "Manager" || s.permissions?.includes("close_shift" as any));
      const manager = await findStaffByPinConstantTime(authorizedStaff, managerPin);

      if (!manager) {
        return res.status(403).json({
          success: false,
          error: "UNAUTHORIZED_PIN",
          message: "Invalid Manager PIN code. Override failed."
        });
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

    res.json({
      success: true,
      message: `Shift closed successfully! ${variance !== 0 ? `Cash Variance (INR ${variance}) override recorded.` : "Drawer cash balanced perfectly."}`,
      shift: activeShift,
      expectedCash,
      physicalCashCount: physicalCount,
      variance
    });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

export default router;
