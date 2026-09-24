import express from "express";
import {
  ingredientRepo,
  menuRepo,
  purchaseRepo,
  recipeRepo,
  authMiddleware,
  requirePermission
} from "../server/context";
import { handleApiError } from "../server/features/shared/database";

const router = express.Router();

// ============================================================================
// REST ENDPOINTS: INGREDIENTS
// ============================================================================
router.get("/ingredients", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    const data = await ingredientRepo.getAll(tenantId);
    res.json({ success: true, data });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.post("/ingredients", authMiddleware, requirePermission("inventory"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await ingredientRepo.add(tenantId, req.body);
    res.json({ success: true, message: "Ingredient logged successfully." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.post("/ingredients/bulk", authMiddleware, requirePermission("inventory"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await ingredientRepo.saveAll(tenantId, req.body);
    res.json({ success: true, message: "Ingredients synchronized successfully." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.put("/ingredients/:id", authMiddleware, requirePermission("inventory"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await ingredientRepo.update(tenantId, req.body);
    res.json({ success: true, message: "Ingredient updated successfully." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.delete("/ingredients/:id", authMiddleware, requirePermission("inventory"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await ingredientRepo.delete(tenantId, req.params.id);
    res.json({ success: true, message: "Ingredient deleted successfully." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

// ============================================================================
// REST ENDPOINTS: MENU ITEMS
// ============================================================================
router.get("/menu-items", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    const data = await menuRepo.getAll(tenantId);
    res.json({ success: true, data });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.post("/menu-items", authMiddleware, requirePermission("inventory", "settings"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await menuRepo.add(tenantId, req.body);
    res.json({ success: true, message: "Menu item added successfully." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.post("/menu-items/bulk", authMiddleware, requirePermission("inventory", "settings"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await menuRepo.saveAll(tenantId, req.body);
    res.json({ success: true, message: "Menu items synchronized successfully." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.put("/menu-items/:id", authMiddleware, requirePermission("inventory", "settings"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await menuRepo.update(tenantId, req.body);
    res.json({ success: true, message: "Menu item updated successfully." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.delete("/menu-items/:id", authMiddleware, requirePermission("inventory", "settings"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await menuRepo.delete(tenantId, req.params.id);
    res.json({ success: true, message: "Menu item deleted successfully." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

// ============================================================================
// REST ENDPOINTS: VENDOR PURCHASES
// ============================================================================
router.get("/purchases", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    const data = await purchaseRepo.getAll(tenantId);
    res.json({ success: true, data });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.post("/purchases", authMiddleware, requirePermission("inventory"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await purchaseRepo.add(tenantId, req.body);
    res.json({ success: true, message: "Purchase invoice registered." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.post("/purchases/bulk", authMiddleware, requirePermission("inventory"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await purchaseRepo.saveAll(tenantId, req.body);
    res.json({ success: true, message: "Purchases synchronized successfully." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.put("/purchases/:id", authMiddleware, requirePermission("inventory"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await purchaseRepo.update(tenantId, req.body);
    res.json({ success: true, message: "Purchase updated successfully." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.delete("/purchases/:id", authMiddleware, requirePermission("inventory"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await purchaseRepo.delete(tenantId, req.params.id);
    res.json({ success: true, message: "Purchase deleted successfully." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

// ============================================================================
// REST ENDPOINTS: RECIPES
// ============================================================================
router.get("/recipes", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    const data = await recipeRepo.getAll(tenantId);
    res.json({ success: true, data });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.post("/recipes", authMiddleware, requirePermission("inventory"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await recipeRepo.addOrUpdate(tenantId, req.body);
    res.json({ success: true, message: "Recipe saved successfully." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.post("/recipes/bulk", authMiddleware, requirePermission("inventory"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await recipeRepo.saveAll(tenantId, req.body);
    res.json({ success: true, message: "Recipes synchronized successfully." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.delete("/recipes/:menuItemId", authMiddleware, requirePermission("inventory"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await recipeRepo.delete(tenantId, req.params.menuItemId);
    res.json({ success: true, message: "Recipe deleted successfully." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

export default router;
