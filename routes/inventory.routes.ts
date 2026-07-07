import express from "express";
import {
  ingredientRepo,
  menuRepo,
  purchaseRepo,
  recipeRepo,
  authMiddleware
} from "../server/context";

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
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/ingredients", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await ingredientRepo.add(tenantId, req.body);
    res.json({ success: true, message: "Ingredient logged successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/ingredients/bulk", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await ingredientRepo.saveAll(tenantId, req.body);
    res.json({ success: true, message: "Ingredients synchronized successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/ingredients/:id", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await ingredientRepo.update(tenantId, req.body);
    res.json({ success: true, message: "Ingredient updated successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/ingredients/:id", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await ingredientRepo.delete(tenantId, req.params.id);
    res.json({ success: true, message: "Ingredient deleted successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/menu-items", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await menuRepo.add(tenantId, req.body);
    res.json({ success: true, message: "Menu item added successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/menu-items/bulk", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await menuRepo.saveAll(tenantId, req.body);
    res.json({ success: true, message: "Menu items synchronized successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/menu-items/:id", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await menuRepo.update(tenantId, req.body);
    res.json({ success: true, message: "Menu item updated successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/menu-items/:id", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await menuRepo.delete(tenantId, req.params.id);
    res.json({ success: true, message: "Menu item deleted successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/purchases", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await purchaseRepo.add(tenantId, req.body);
    res.json({ success: true, message: "Purchase invoice registered." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/purchases/bulk", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await purchaseRepo.saveAll(tenantId, req.body);
    res.json({ success: true, message: "Purchases synchronized successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/purchases/:id", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await purchaseRepo.update(tenantId, req.body);
    res.json({ success: true, message: "Purchase updated successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/purchases/:id", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await purchaseRepo.delete(tenantId, req.params.id);
    res.json({ success: true, message: "Purchase deleted successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/recipes", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await recipeRepo.addOrUpdate(tenantId, req.body);
    res.json({ success: true, message: "Recipe saved successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/recipes/bulk", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await recipeRepo.saveAll(tenantId, req.body);
    res.json({ success: true, message: "Recipes synchronized successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/recipes/:menuItemId", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await recipeRepo.delete(tenantId, req.params.menuItemId);
    res.json({ success: true, message: "Recipe deleted successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
