import {assertInventoryWritable} from '../server/features/billing/SubscriptionLifecycle';
import express from "express";
import crypto from "node:crypto";
import {validateEntity} from "../server/features/shared/validation";
import {
  ingredientRepo,
  menuRepo,
  purchaseRepo,
  recipeRepo,
  inventoryMovementRepo,
  authMiddleware,
  requirePermission,
  idempotencyMiddleware,
  realtimeService, syncService,settingsRepo
} from "../server/context";
import { Database, handleApiError } from "../server/features/shared/database";

const router = express.Router();

router.use(async(req,res,next)=>{
  if(!['POST','PUT','PATCH','DELETE'].includes(req.method) || !/^\/(ingredients|recipes|purchases|inventory-movements)(\/|$)/.test(req.path)) return next();
  // Authenticate before resolving entitlements; client tenant identifiers are not authority.
  authMiddleware(req,res,async()=>{try{await assertInventoryWritable((req as any).tenantId);next();}catch(error){handleApiError(res,error);}});
});

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
    validateEntity("ingredients",req.body,true);
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
    const state=await syncService.saveFullState(tenantId,{ingredients:req.body},(req as any).session.userId);
    req.body=state.ingredients;
    try {
      realtimeService.broadcastSyncUpdate(tenantId, "ingredients");
    } catch {}
    res.json({ success: true, message: "Ingredients synchronized successfully.", data: req.body });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.put("/ingredients/:id", authMiddleware, idempotencyMiddleware, requirePermission("inventory"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    validateEntity("ingredients",{...req.body,id:req.params.id});
    const state=await syncService.saveFullState(tenantId,{ingredients:[{...req.body,id:req.params.id}]},(req as any).session.userId);
    const updated=state.ingredients.find((i:any)=>i.id===req.params.id);
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
    const unlinkedCount=await Database.getInstance().runTransaction(tenantId,async trx=>{
      const count=await recipeRepo.unlinkIngredient(tenantId,ingredientId,trx);await ingredientRepo.delete(tenantId,ingredientId,trx);return count;
    });

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
    validateEntity("menuItems",req.body,true);
    await menuRepo.add(tenantId, req.body);
    res.json({ success: true, message: "Menu item added successfully." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.post("/menu-items/bulk", authMiddleware, requirePermission("inventory", "settings"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await syncService.saveFullState(tenantId,{menuItems:req.body});
    res.json({ success: true, message: "Menu items synchronized successfully." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.put("/menu-items/:id", authMiddleware, requirePermission("inventory", "settings"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    validateEntity("menuItems",{...req.body,id:req.params.id});
    const updated = await menuRepo.update(tenantId, { ...req.body, id: req.params.id }, req.body.version);
    res.json({ success: true, message: "Menu item updated successfully.", data: updated });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.delete("/menu-items/:id", authMiddleware, requirePermission("inventory", "settings"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await Database.getInstance().runTransaction(tenantId,async trx=>{const recipes=(await recipeRepo.getAll(tenantId)) || [];await recipeRepo.saveAll(tenantId,recipes.filter(r=>r.menuItemId!==req.params.id),trx);await menuRepo.delete(tenantId,req.params.id,trx);});
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
    const result=await Database.getInstance().runTransaction(tenantId,async trx=>{
    const purchase = req.body;
    const ingredientId = purchase.ingredientId;
    const quantity = Number(purchase.quantity);
    const cost = Number(purchase.cost);

    if (!ingredientId || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(cost) || cost<0) {
      return res.status(400).json({
        success: false,
        error: "INVALID_PURCHASE",
        message: "Valid ingredientId and positive quantity are required."
      });
    }

    const existingPurchase=purchase.id ? await purchaseRepo.getById(tenantId,purchase.id) : null;
    if(existingPurchase) return res.json({success:true,data:existingPurchase});
    const settings=await settingsRepo.get(tenantId);
    if(session.role==="Manager" && settings?.managerCanAddPurchases===false) return res.status(403).json({success:false,error:"FORBIDDEN"});
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
      performedBy: user?.id || session?.userId,
      created_at: nowIso,
      updated_at: nowIso,
      version: 1
    };

    // Staged under the calculation transaction.
      await purchaseRepo.add(tenantId, purchaseRecord, trx);
      await ingredientRepo.update(tenantId, updatedIngredient, ingredient.version, trx);
      const existingMovements = (await inventoryMovementRepo.getAll(tenantId)) || [];
      await inventoryMovementRepo.saveAll(tenantId, [...existingMovements, movementRecord], trx);
    return purchaseRecord;
    });
    if (!result || !result.id) return;
    try {
      realtimeService.broadcastToTenant(tenantId, "purchase:created", { entityId: result.id, slice: "purchases" });
      realtimeService.broadcastToTenant(tenantId, "inventory:updated", { entityId: result.ingredientId, slice: "ingredients" });
    } catch {}

    res.json({ success: true, message: "Purchase invoice registered and stock updated.", data: result });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.post("/purchases/bulk",authMiddleware,requirePermission("inventory"),(_req,res)=>res.status(400).json({success:false,error:"BUSINESS_COMMAND_REQUIRED"}));
router.put("/purchases/:id",authMiddleware,requirePermission("inventory"),(_req,res)=>res.status(400).json({success:false,error:"PURCHASE_LEDGER_IMMUTABLE"}));
router.delete("/purchases/:id",authMiddleware,requirePermission("inventory"),(_req,res)=>res.status(400).json({success:false,error:"PURCHASE_LEDGER_IMMUTABLE"}));

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
    const settings=await settingsRepo.get(tenantId);if((req as any).session.role==="Manager" && settings?.managerCanEditRecipes===false) return res.status(403).json({success:false,error:"FORBIDDEN"});
    await syncService.saveFullState(tenantId,{recipes:[req.body]});
    res.json({ success: true, message: "Recipe saved successfully." });
  } catch (error: any) {
    handleApiError(res, error);
  }
});

router.post("/recipes/bulk", authMiddleware, requirePermission("inventory"), async (req, res) => {
  const tenantId = (req as any).tenantId;
  try {
    await syncService.saveFullState(tenantId,{recipes:req.body});
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
