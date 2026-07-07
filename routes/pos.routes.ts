import express from "express";
import {
  staffRepo,
  orderRepo,
  customerRepo,
  shiftRepo,
  authMiddleware,
  PLAN_LIMITS
} from "../server/context";

const router = express.Router();

// ============================================================================
// REST ENDPOINTS: STAFF
// ============================================================================
router.get("/staff", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    const data = await staffRepo.getAll(tenantId);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/staff", authMiddleware, async (req, res) => {
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
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/staff/bulk", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await staffRepo.saveAll(tenantId, req.body);
    res.json({ success: true, message: "Staff list synchronized." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/staff/:id", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await staffRepo.update(tenantId, req.body);
    res.json({ success: true, message: "Staff updated successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/staff/:id", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await staffRepo.delete(tenantId, req.params.id);
    res.json({ success: true, message: "Staff deleted successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/orders", authMiddleware, async (req, res) => {
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
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/orders/bulk", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await orderRepo.saveAll(tenantId, req.body);
    res.json({ success: true, message: "Orders synchronized successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/orders/:id", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await orderRepo.update(tenantId, req.body);
    res.json({ success: true, message: "Order updated successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/orders/:id", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await orderRepo.delete(tenantId, req.params.id);
    res.json({ success: true, message: "Order cancelled/deleted." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/customers", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await customerRepo.add(tenantId, req.body);
    res.json({ success: true, message: "Customer profile added." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/customers/bulk", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await customerRepo.saveAll(tenantId, req.body);
    res.json({ success: true, message: "Customers synchronized successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/customers/:id", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await customerRepo.update(tenantId, req.body);
    res.json({ success: true, message: "Customer profile updated." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/customers/:id", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await customerRepo.delete(tenantId, req.params.id);
    res.json({ success: true, message: "Customer profile deleted." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/shifts", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await shiftRepo.add(tenantId, req.body);
    res.json({ success: true, message: "Shift details saved." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/shifts/bulk", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await shiftRepo.saveAll(tenantId, req.body);
    res.json({ success: true, message: "Shifts synchronized successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/shifts/:id", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await shiftRepo.update(tenantId, req.body);
    res.json({ success: true, message: "Shift updated." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/shifts/:id", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await shiftRepo.delete(tenantId, req.params.id);
    res.json({ success: true, message: "Shift log deleted." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
