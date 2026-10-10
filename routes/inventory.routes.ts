import express from "express";
import {
  ingredientRepo,
  menuRepo,
  purchaseRepo,
  recipeRepo,
  inventoryMovementRepo,
  authMiddleware,
  requirePermission,
  idempotencyMiddleware,
  realtimeService
} from "../server/context";
import { Database, handleApiError } from "../server/features/shared/database";

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

router.get("/ingredients/:id", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    const item = await ingredientRepo.getById(tenantId, req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: "NOT_FOUND", message: "Ingredient not found." });
    }
    res.json({ success: true, data: item });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.post("/ingredients", authMiddleware, idempotencyMiddleware, requirePermission("inventory"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await ingredientRepo.add(tenantId, req.body);
    const saved = await ingredientRepo.getById(tenantId, req.body.id);
    try {
      realtimeService.broadcastToTenant(tenantId, "inventory:updated", { entityId: req.body.id, slice: "ingredients" });
    } catch {}
    res.json({ success: true, message: "Ingredient logged successfully.", data: saved || req.body });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.post("/ingredients/bulk", authMiddleware, idempotencyMiddleware, requirePermission("inventory"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await ingredientRepo.saveAll(tenantId, req.body);
    try {
      realtimeService.broadcastSyncUpdate(tenantId, "ingredients");
    } catch {}
    res.json({ success: true, message: "Ingredients synchronized successfully.", data: req.body });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.put("/ingredients/:id", authMiddleware, requirePermission("inventory"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    const updated = await ingredientRepo.update(tenantId, { ...req.body, id: req.params.id }, req.body.version);
    try {
      realtimeService.broadcastToTenant(tenantId, "inventory:updated", { entityId: req.params.id, slice: "ingredients" });
    } catch {}
    res.json({ success: true, message: "Ingredient updated successfully.", data: updated || req.body });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.delete("/ingredients/:id", authMiddleware, requirePermission("inventory"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  const ingredientId = req.params.id;
  try {
    // 1. Cascade unlink ingredient from all mapped recipes to prevent orphan references
    const unlinkedCount = await recipeRepo.unlinkIngredient(tenantId, ingredientId);

    // 2. Delete the ingredient record
    await ingredientRepo.delete(tenantId, ingredientId);

    // 3. Broadcast realtime updates for both ingredients and recipes
    try {
      realtimeService.broadcastToTenant(tenantId, "inventory:updated", { entityId: ingredientId, slice: "ingredients" });
      if (unlinkedCount > 0) {
        realtimeService.broadcastToTenant(tenantId, "inventory:updated", { slice: "recipes" });
      }
    } catch {}

    res.json({
      success: true,
      message: unlinkedCount > 0
        ? `Ingredient deleted successfully and unlinked from ${unlinkedCount} recipe(s).`
        : "Ingredient deleted successfully.",
      unlinkedRecipesCount: unlinkedCount
    });
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

router.get("/menu-items/:id", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    const item = await menuRepo.getById(tenantId, req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: "NOT_FOUND", message: "Menu item not found." });
    }
    res.json({ success: true, data: item });
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
    const updated = await menuRepo.update(tenantId, { ...req.body, id: req.params.id }, req.body.version);
    res.json({ success: true, message: "Menu item updated successfully.", data: updated });
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

router.get("/purchases/:id", authMiddleware, async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    const item = await purchaseRepo.getById(tenantId, req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: "NOT_FOUND", message: "Purchase invoice not found." });
    }
    res.json({ success: true, data: item });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.post("/purchases", authMiddleware, idempotencyMiddleware, requirePermission("inventory"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  const user = (req as any).user;
  const session = (req as any).session;

  try {
    const purchase = req.body;
    const ingredientId = purchase.ingredientId;
    const quantity = Number(purchase.quantity);
    const cost = Number(purchase.cost);

    if (!ingredientId || isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: "INVALID_PURCHASE",
        message: "Valid ingredientId and positive quantity are required."
      });
    }

    const ingredient = await ingredientRepo.getById(tenantId, ingredientId);
    if (!ingredient) {
      return res.status(404).json({
        success: false,
        error: "NOT_FOUND",
        message: `Ingredient '${ingredientId}' not found.`
      });
    }

    const purchaseId = purchase.id || `pur-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();
    const purchaseRecord = {
      ...purchase,
      id: purchaseId,
      date: purchase.date || nowIso,
      ingredientName: ingredient.name,
      quantity,
      cost: isNaN(cost) || cost < 0 ? 0 : cost,
      created_at: nowIso,
      updated_at: nowIso,
      version: 1
    };

    const previousStock = ingredient.currentStock;
    const currentStockValid = Math.max(0, previousStock);
    const newStock = Number((previousStock + quantity).toFixed(3));

    // Weighted Average Cost (WAC) formula:
    // (Existing Stock * Existing Cost + Purchased Quantity * Purchase Cost) / (Existing Stock + Purchased Quantity)
    let newCostPerUnit = ingredient.costPerUnit;
    if (quantity > 0 && cost > 0) {
      if (currentStockValid > 0 && ingredient.costPerUnit > 0) {
        const currentValue = currentStockValid * ingredient.costPerUnit;
        newCostPerUnit = Number(((currentValue + cost) / (currentStockValid + quantity)).toFixed(2));
      } else {
        newCostPerUnit = Number((cost / quantity).toFixed(2));
      }
    }

    const updatedIngredient = {
      ...ingredient,
      currentStock: newStock,
      costPerUnit: newCostPerUnit,
      updated_at: nowIso,
      version: (ingredient.version || 1) + 1
    };

    const movementRecord = {
      id: `mov-pur-${purchaseId}`,
      ingredientId,
      movementType: "PURCHASE" as const,
      quantityDelta: quantity,
      previousStock,
      newStock,
      referenceId: purchaseId,
      reason: `Vendor purchase invoice #${purchase.invoiceNumber || purchaseId}`,
      performedBy: user?.name || session?.name || "Inventory Manager",
      created_at: nowIso,
      updated_at: nowIso,
      version: 1
    };

    const db = Database.getInstance();
    await db.runTransaction(tenantId, async (trx) => {
      await purchaseRepo.add(tenantId, purchaseRecord, trx);
      await ingredientRepo.update(tenantId, updatedIngredient, ingredient.version, trx);
      const existingMovements = (await inventoryMovementRepo.getAll(tenantId)) || [];
      await inventoryMovementRepo.saveAll(tenantId, [...existingMovements, movementRecord], trx);
    });

    try {
      realtimeService.broadcastToTenant(tenantId, "purchase:created", { entityId: purchaseId, slice: "purchases" });
      realtimeService.broadcastToTenant(tenantId, "inventory:updated", { entityId: ingredientId, slice: "ingredients" });
    } catch {}

    res.json({ success: true, message: "Purchase invoice registered and stock updated.", data: purchaseRecord });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.post("/purchases/bulk", authMiddleware, idempotencyMiddleware, requirePermission("inventory"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await purchaseRepo.saveAll(tenantId, req.body);
    try {
      realtimeService.broadcastSyncUpdate(tenantId, "purchases");
    } catch {}
    res.json({ success: true, message: "Purchases synchronized successfully.", data: req.body });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.put("/purchases/:id", authMiddleware, requirePermission("inventory"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    const updated = await purchaseRepo.update(tenantId, { ...req.body, id: req.params.id }, req.body.version);
    try {
      realtimeService.broadcastToTenant(tenantId, "purchase:updated", { entityId: req.params.id, slice: "purchases" });
    } catch {}
    res.json({ success: true, message: "Purchase updated successfully.", data: updated || req.body });
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

router.post("/recipes/clean-orphans", authMiddleware, requirePermission("inventory"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    const ingredients = (await ingredientRepo.getAll(tenantId)) || [];
    const validIngredientIds = new Set(ingredients.map(i => i.id));
    const result = await recipeRepo.cleanOrphanIngredients(tenantId, validIngredientIds);

    if (result.modifiedRecipesCount > 0) {
      try {
        realtimeService.broadcastToTenant(tenantId, "inventory:updated", { slice: "recipes" });
      } catch {}
    }

    const updatedRecipes = await recipeRepo.getAll(tenantId);
    res.json({
      success: true,
      message: `Cleaned ${result.orphansRemovedCount} orphan ingredient link(s) across ${result.modifiedRecipesCount} recipe(s).`,
      orphansRemovedCount: result.orphansRemovedCount,
      modifiedRecipesCount: result.modifiedRecipesCount,
      data: updatedRecipes
    });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

export default router;
