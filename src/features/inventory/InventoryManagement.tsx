import React, { useState, useMemo } from "react";
import { Ingredient, MenuItem, Recipe, RecipeIngredient, Purchase, InventorySettings, StaffMember } from "../shared/types";
import {
  convertRecipeQuantityToIngredientStock,
  getCompatibleUnits,
  getDefaultRecipeUnit,
  calculatePortionCost
} from "../shared/utils/unitConversion";
import {
  Boxes,
  Plus,
  Edit2,
  Trash2,
  Settings2,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Bookmark,
  Sparkles,
  ShieldCheck,
  Check,
  X
} from "lucide-react";

interface InventoryManagementProps {
  ingredients: Ingredient[];
  menuItems: MenuItem[];
  recipes: Recipe[];
  purchases: Purchase[];
  settings: InventorySettings;
  currentStaff: StaffMember;
  onUpdateIngredients: (updated: Ingredient[]) => void;
  onUpdateRecipes: (updated: Recipe[]) => void;
  onUpdateMenuItems: (updated: MenuItem[]) => void;
  onAddPurchase: (purchase: Purchase) => void;
  onUpdateSettings: (updated: InventorySettings) => void;
}

export default function InventoryManagement({
  ingredients,
  menuItems,
  recipes,
  purchases,
  settings,
  currentStaff,
  onUpdateIngredients,
  onUpdateRecipes,
  onUpdateMenuItems,
  onAddPurchase,
  onUpdateSettings
}: InventoryManagementProps) {
  const [activeSubTab, setActiveSubTab] = useState<"raw" | "recipes" | "purchases" | "reports" | "settings" | "menu">("raw");

  // Form Modals
  const [showAddIngredientModal, setShowAddIngredientModal] = useState(false);
  const [showAddPurchaseModal, setShowAddPurchaseModal] = useState(false);
  const [showEditRecipeModal, setShowEditRecipeModal] = useState(false);
  const [showAddMenuItemModal, setShowAddMenuItemModal] = useState(false);

  // Raw Material Deletion & Orphan Cascade State
  const [ingredientToDelete, setIngredientToDelete] = useState<{
    ingredient: Ingredient;
    affectedRecipes: { menuItemId: string; dishName: string; quantity: number }[];
  } | null>(null);
  const [cleaningOrphans, setCleaningOrphans] = useState(false);
  const [orphanCleanSuccess, setOrphanCleanSuccess] = useState<string | null>(null);

  // Ingredient Form State
  const [newIng, setNewIng] = useState({ name: "", unit: "g", currentStock: 0, minStock: 0, costPerUnit: 0 });
  const [editingIngId, setEditingIngId] = useState<string | null>(null);

  // Purchase Form State
  const [newPur, setNewPur] = useState({ ingredientId: "", quantity: 0, cost: 0, ratePerUnit: 0, supplier: "", invoiceNumber: "" });

  // Recipe Form State
  const [selectedRecipeMenuItemId, setSelectedRecipeMenuItemId] = useState("");
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([]);

  // Menu Item Form State
  const [newMenuItem, setNewMenuItem] = useState({
    name: "",
    nameHindi: "",
    price: 0,
    category: "Main Course",
    imageUrl: "🥘",
    isVegetarian: true,
    isAvailable: true
  });
  const [editingMenuItemId, setEditingMenuItemId] = useState<string | null>(null);
  const [customCategory, setCustomCategory] = useState("");
  const [isCustomCategory, setIsCustomCategory] = useState(false);

  // Permissions checks
  const isManagerOrOwner = currentStaff.role === "Owner" || currentStaff.role === "Manager";
  const canAddPurchase = currentStaff.role === "Owner" || (currentStaff.role === "Manager" && settings.managerCanAddPurchases);
  const canEditRecipe = currentStaff.role === "Owner" || (currentStaff.role === "Manager" && settings.managerCanEditRecipes);

  // Stats
  const totalStockHoldingValue = useMemo(() => {
    return ingredients.reduce((sum, ing) => sum + ing.currentStock * ing.costPerUnit, 0);
  }, [ingredients]);

  const lowStockCount = useMemo(() => {
    return ingredients.filter((ing) => ing.currentStock <= ing.minStock).length;
  }, [ingredients]);

  const outOfStockCount = useMemo(() => {
    return ingredients.filter((ing) => ing.currentStock <= 0).length;
  }, [ingredients]);

  // Handle Add Ingredient
  const handleSaveIngredient = () => {
    if (!newIng.name.trim()) return;

    if (editingIngId) {
      // Edit mode
      const updated = ingredients.map((ing) =>
        ing.id === editingIngId ? { ...ing, ...newIng } : ing
      );
      onUpdateIngredients(updated);
      setEditingIngId(null);
    } else {
      // Add mode
      const newIngredient: Ingredient = {
        id: `ing-${Date.now()}`,
        name: newIng.name,
        unit: newIng.unit,
        currentStock: Number(newIng.currentStock),
        minStock: Number(newIng.minStock),
        costPerUnit: Number(newIng.costPerUnit)
      };
      onUpdateIngredients([...ingredients, newIngredient]);
    }

    setNewIng({ name: "", unit: "g", currentStock: 0, minStock: 0, costPerUnit: 0 });
    setShowAddIngredientModal(false);
  };

  const handleEditIngredientClick = (ing: Ingredient) => {
    setEditingIngId(ing.id);
    setNewIng({
      name: ing.name,
      unit: ing.unit,
      currentStock: ing.currentStock,
      minStock: ing.minStock,
      costPerUnit: ing.costPerUnit
    });
    setShowAddIngredientModal(true);
  };

  const handleDeleteIngredientClick = (ing: Ingredient) => {
    const affected = recipes.flatMap(r => {
      const match = (r.ingredients || []).find(ri => ri.ingredientId === ing.id);
      if (!match) return [];
      const dish = menuItems.find(m => m.id === r.menuItemId);
      return [{
        menuItemId: r.menuItemId,
        dishName: dish ? dish.name : r.menuItemId,
        quantity: match.quantity
      }];
    });

    setIngredientToDelete({
      ingredient: ing,
      affectedRecipes: affected
    });
  };

  const handleDeleteIngredient = (id: string) => {
    const ing = ingredients.find(i => i.id === id);
    if (ing) {
      handleDeleteIngredientClick(ing);
    } else {
      onUpdateIngredients(ingredients.filter(i => i.id !== id));
    }
  };

  const handleConfirmDeleteIngredient = async () => {
    if (!ingredientToDelete) return;
    const { ingredient: ing } = ingredientToDelete;

    // 1. Remove raw material from ingredients list
    onUpdateIngredients(ingredients.filter((i) => i.id !== ing.id));

    // 2. Cascade unlink raw material from all recipes to prevent orphan references
    const updatedRecipes = recipes.map(r => {
      if (r.ingredients && r.ingredients.some(ri => ri.ingredientId === ing.id)) {
        return {
          ...r,
          ingredients: r.ingredients.filter(ri => ri.ingredientId !== ing.id)
        };
      }
      return r;
    });
    onUpdateRecipes(updatedRecipes);

    // 3. Delete on backend API if available
    const token = localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token") || localStorage.getItem("token") || sessionStorage.getItem("token");
    if (token) {
      try {
        await fetch(`/api/inventory/ingredients/${ing.id}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
      } catch (err) {
        console.warn("Backend delete sync failed, changes saved locally:", err);
      }
    }

    setIngredientToDelete(null);
  };

  // Audit all recipes for orphan raw material references
  const orphanStats = useMemo(() => {
    const validIds = new Set(ingredients.map(i => i.id));
    let totalOrphans = 0;
    const affectedDishes: { menuItemId: string; dishName: string; orphanCount: number }[] = [];

    recipes.forEach(r => {
      const orphans = (r.ingredients || []).filter(ri => !validIds.has(ri.ingredientId));
      if (orphans.length > 0) {
        totalOrphans += orphans.length;
        const dish = menuItems.find(m => m.id === r.menuItemId);
        affectedDishes.push({
          menuItemId: r.menuItemId,
          dishName: dish ? dish.name : r.menuItemId,
          orphanCount: orphans.length
        });
      }
    });

    return { totalOrphans, affectedDishes };
  }, [recipes, ingredients, menuItems]);

  const handleCleanAllOrphans = async () => {
    setCleaningOrphans(true);
    const validIds = new Set(ingredients.map(i => i.id));
    let removedCount = 0;
    let modifiedRecipesCount = 0;

    const cleaned = recipes.map(r => {
      const initialLen = (r.ingredients || []).length;
      const valid = (r.ingredients || []).filter(ri => validIds.has(ri.ingredientId));
      if (valid.length < initialLen) {
        removedCount += (initialLen - valid.length);
        modifiedRecipesCount++;
        return { ...r, ingredients: valid };
      }
      return r;
    });

    onUpdateRecipes(cleaned);

    // Call backend endpoint if available
    const token = localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token") || localStorage.getItem("token") || sessionStorage.getItem("token");
    if (token) {
      try {
        await fetch("/api/inventory/recipes/clean-orphans", {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` }
        });
      } catch (e) {
        console.warn("Backend clean-orphans endpoint failed:", e);
      }
    }

    setCleaningOrphans(false);
    setOrphanCleanSuccess(`Successfully purged ${removedCount} orphan raw material link(s) across ${modifiedRecipesCount} recipe(s)!`);
    setTimeout(() => setOrphanCleanSuccess(null), 4000);
  };

  // Existing Categories computed dynamically
  const existingCategories = useMemo(() => {
    const cats = new Set(menuItems.map(item => item.category));
    return Array.from(cats);
  }, [menuItems]);

  // Handle Save Menu Item (Add or Edit)
  const handleSaveMenuItem = () => {
    if (!newMenuItem.name.trim() || newMenuItem.price <= 0) {
      alert("Please provide a valid name and price.");
      return;
    }

    const finalCategory = isCustomCategory ? customCategory.trim() : newMenuItem.category;
    if (!finalCategory) {
      alert("Please provide a valid category.");
      return;
    }

    if (editingMenuItemId) {
      // Edit mode
      const updated = menuItems.map((item) =>
        item.id === editingMenuItemId
          ? {
              ...item,
              name: newMenuItem.name,
              nameHindi: newMenuItem.nameHindi || undefined,
              price: Number(newMenuItem.price),
              category: finalCategory,
              imageUrl: newMenuItem.imageUrl || undefined,
              isVegetarian: newMenuItem.isVegetarian,
              isAvailable: newMenuItem.isAvailable
            }
          : item
      );
      onUpdateMenuItems(updated);
      setEditingMenuItemId(null);
    } else {
      // Add mode
      const newItem: MenuItem = {
        id: `m-${Date.now()}`,
        name: newMenuItem.name,
        nameHindi: newMenuItem.nameHindi || undefined,
        price: Number(newMenuItem.price),
        category: finalCategory,
        imageUrl: newMenuItem.imageUrl || undefined,
        isVegetarian: newMenuItem.isVegetarian,
        isAvailable: true,
        version: 1,
        updated_at: new Date().toISOString()
      };
      onUpdateMenuItems([...menuItems, newItem]);
    }

    // Reset Form
    setNewMenuItem({
      name: "",
      nameHindi: "",
      price: 0,
      category: "Main Course",
      imageUrl: "🥘",
      isVegetarian: true,
      isAvailable: true
    });
    setCustomCategory("");
    setIsCustomCategory(false);
    setShowAddMenuItemModal(false);
  };

  // Handle Edit Menu Item Click
  const handleEditMenuItemClick = (item: MenuItem) => {
    setEditingMenuItemId(item.id);
    setNewMenuItem({
      name: item.name,
      nameHindi: item.nameHindi || "",
      price: item.price,
      category: item.category,
      imageUrl: item.imageUrl || "🥘",
      isVegetarian: item.isVegetarian,
      isAvailable: item.isAvailable
    });
    setCustomCategory("");
    setIsCustomCategory(false);
    setShowAddMenuItemModal(true);
  };

  // Handle Delete Menu Item Click
  const handleDeleteMenuItem = (id: string) => {
    if (confirm("Are you sure you want to delete this dish? This will also remove any associated recipe mappings.")) {
      onUpdateMenuItems(menuItems.filter((i) => i.id !== id));
      onUpdateRecipes(recipes.filter((r) => r.menuItemId !== id));
    }
  };

  // Handle Add Purchase
  const handleAddPurchaseSubmit = () => {
    const selectedIng = ingredients.find((i) => i.id === newPur.ingredientId);
    if (!selectedIng || newPur.quantity <= 0) return;

    const purchaseQty = Number(newPur.quantity);
    const purchaseCost = Number(newPur.cost);
    const currentStockValid = Math.max(0, selectedIng.currentStock);
    const newStock = Number((selectedIng.currentStock + purchaseQty).toFixed(3));

    // Weighted Average Cost (WAC): (Current Value + Purchase Cost) / (Current Stock + Purchase Qty)
    let newCostPerUnit = selectedIng.costPerUnit;
    if (purchaseQty > 0 && purchaseCost > 0) {
      if (currentStockValid > 0 && selectedIng.costPerUnit > 0) {
        const currentValue = currentStockValid * selectedIng.costPerUnit;
        newCostPerUnit = Number(((currentValue + purchaseCost) / (currentStockValid + purchaseQty)).toFixed(2));
      } else {
        newCostPerUnit = Number((purchaseCost / purchaseQty).toFixed(2));
      }
    }

    const purchaseEntry: Purchase = {
      id: `pur-${Date.now()}`,
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      ingredientId: newPur.ingredientId,
      ingredientName: selectedIng.name,
      quantity: purchaseQty,
      cost: purchaseCost,
      supplier: newPur.supplier || "Direct",
      invoiceNumber: newPur.invoiceNumber || undefined
    };

    onAddPurchase(purchaseEntry);

    // Increase current stock & update costPerUnit with weighted average in inventory
    const updatedIngredients = ingredients.map((ing) =>
      ing.id === newPur.ingredientId
        ? {
            ...ing,
            currentStock: newStock,
            costPerUnit: newCostPerUnit,
            updated_at: new Date().toISOString()
          }
        : ing
    );
    onUpdateIngredients(updatedIngredients);

    setNewPur({ ingredientId: "", quantity: 0, cost: 0, ratePerUnit: 0, supplier: "", invoiceNumber: "" });
    setShowAddPurchaseModal(false);
  };

  // Recipe Management
  const handleEditRecipeClick = (menuItem: MenuItem) => {
    const existingRecipe = recipes.find((r) => r.menuItemId === menuItem.id);
    setSelectedRecipeMenuItemId(menuItem.id);
    // Sanitize any orphan ingredient entries and set appropriate unit
    const validMapped = (existingRecipe ? existingRecipe.ingredients : [])
      .filter((ri) => ingredients.some((i) => i.id === ri.ingredientId))
      .map((ri) => {
        const ing = ingredients.find((i) => i.id === ri.ingredientId);
        return {
          ...ri,
          unit: ri.unit || (ing ? getDefaultRecipeUnit(ing.unit) : "g")
        };
      });
    setRecipeIngredients(validMapped);
    setShowEditRecipeModal(true);
  };

  const handleAddIngredientRowToRecipe = () => {
    const unusedIng = ingredients.find(
      (ing) => !recipeIngredients.some((ri) => ri.ingredientId === ing.id)
    );
    if (unusedIng) {
      setRecipeIngredients([
        ...recipeIngredients,
        {
          ingredientId: unusedIng.id,
          quantity: 1,
          unit: getDefaultRecipeUnit(unusedIng.unit)
        }
      ]);
    }
  };

  const handleUpdateRecipeRow = (
    index: number,
    key: "ingredientId" | "quantity" | "unit",
    value: any
  ) => {
    const updated = [...recipeIngredients];
    if (key === "ingredientId") {
      const newIng = ingredients.find((i) => i.id === value);
      updated[index] = {
        ...updated[index],
        ingredientId: value,
        unit: newIng ? getDefaultRecipeUnit(newIng.unit) : updated[index].unit
      };
    } else {
      updated[index] = { ...updated[index], [key]: value };
    }
    setRecipeIngredients(updated);
  };

  const handleRemoveRecipeRow = (index: number) => {
    setRecipeIngredients(recipeIngredients.filter((_, i) => i !== index));
  };

  const handleSaveRecipe = () => {
    const validIds = new Set(ingredients.map((i) => i.id));
    const validIngredients = recipeIngredients.filter(
      (ri) => ri.quantity > 0 && validIds.has(ri.ingredientId)
    );
    const updatedRecipe: Recipe = {
      menuItemId: selectedRecipeMenuItemId,
      ingredients: validIngredients
    };

    const existingIndex = recipes.findIndex((r) => r.menuItemId === selectedRecipeMenuItemId);
    let newRecipes = [...recipes];
    if (existingIndex >= 0) {
      newRecipes[existingIndex] = updatedRecipe;
    } else {
      newRecipes.push(updatedRecipe);
    }
    onUpdateRecipes(newRecipes);
    setShowEditRecipeModal(false);
  };

  return (
    <div className="h-full bg-slate-950 flex flex-col p-4 sm:p-6 font-sans text-slate-200 overflow-hidden">
      {/* Title */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 shrink-0 border-b border-slate-800 pb-4 gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 shrink-0">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-display font-bold text-white leading-tight">
              Inventory & Recipe Management
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Control food-prep raw materials, ingredient portion costs, recipes, and vendor purchase logs.
            </p>
          </div>
        </div>

        {/* Tab triggers */}
        <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs shrink-0 overflow-x-auto max-w-full whitespace-nowrap scrollbar-none">
          <button
            onClick={() => setActiveSubTab("raw")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
              activeSubTab === "raw" ? "bg-emerald-500 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Raw Materials
          </button>
          <button
            onClick={() => setActiveSubTab("menu")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
              activeSubTab === "menu" ? "bg-emerald-500 text-white" : "text-slate-400 hover:text-white"
            }`}
            id="subtab-menu-btn"
          >
            Manage Dishes
          </button>
          <button
            onClick={() => setActiveSubTab("recipes")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
              activeSubTab === "recipes" ? "bg-emerald-500 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Recipes Mapping
          </button>
          <button
            onClick={() => setActiveSubTab("purchases")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
              activeSubTab === "purchases" ? "bg-emerald-500 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Vendor Purchases
          </button>
          <button
            onClick={() => setActiveSubTab("reports")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
              activeSubTab === "reports" ? "bg-emerald-500 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Stock Reports
          </button>
          <button
            onClick={() => setActiveSubTab("settings")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
              activeSubTab === "settings" ? "bg-emerald-500 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Stock Rules
          </button>
        </div>
      </div>

      {/* Main Inner Views */}
      <div className="flex-1 overflow-y-auto pr-1">
        
        {/* SUBTAB 1: RAW MATERIALS */}
        {activeSubTab === "raw" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-display font-bold uppercase tracking-wider text-slate-400">
                Ingredients Ledger
              </h2>
              {isManagerOrOwner && (
                <button
                  onClick={() => {
                    setEditingIngId(null);
                    setNewIng({ name: "", unit: "g", currentStock: 0, minStock: 0, costPerUnit: 0 });
                    setShowAddIngredientModal(true);
                  }}
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-3 py-2 rounded-xl text-xs flex items-center space-x-1.5 shadow"
                  id="add-ingredient-btn"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Ingredient</span>
                </button>
              )}
            </div>

            {/* List */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-850/80 border-b border-slate-800 text-slate-400 font-semibold font-mono uppercase">
                    <th className="p-4">Material Name</th>
                    <th className="p-4">Current Stock</th>
                    <th className="p-4">Min. Alert Stock</th>
                    <th className="p-4">Avg. Cost / Unit</th>
                    <th className="p-4">Holding Valuation</th>
                    <th className="p-4">Status Alert</th>
                    {isManagerOrOwner && <th className="p-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {ingredients.map((ing) => {
                    const isLow = ing.currentStock <= ing.minStock;
                    const isOutOf = ing.currentStock <= 0;
                    return (
                      <tr key={ing.id} className="hover:bg-slate-800/20 text-slate-300">
                        <td className="p-4 font-semibold text-white">{ing.name}</td>
                        <td className="p-4 font-mono font-semibold">
                          {ing.currentStock.toLocaleString()} {ing.unit}
                        </td>
                        <td className="p-4 font-mono text-slate-400">
                          {ing.minStock.toLocaleString()} {ing.unit}
                        </td>
                        <td className="p-4 font-mono">
                          <div className="flex flex-col">
                            <span className="text-white font-semibold">INR {ing.costPerUnit.toFixed(2)}</span>
                            <span className="text-[10px] text-slate-400 font-sans">per {ing.unit} (WAC)</span>
                          </div>
                        </td>
                        <td className="p-4 font-mono text-emerald-400">
                          INR {(ing.currentStock * ing.costPerUnit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4">
                          {isOutOf ? (
                            <span className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2.5 py-0.5 rounded-full font-bold">
                              Out of Stock
                            </span>
                          ) : isLow ? (
                            <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2.5 py-0.5 rounded-full font-semibold">
                              Low Stock
                            </span>
                          ) : (
                            <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full font-medium">
                              Normal
                            </span>
                          )}
                        </td>
                        {isManagerOrOwner && (
                          <td className="p-4 text-right space-x-2">
                            <button
                              onClick={() => handleEditIngredientClick(ing)}
                              className="text-slate-400 hover:text-white p-1 rounded transition"
                              id={`edit-ing-btn-${ing.id}`}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteIngredient(ing.id)}
                              className="text-slate-500 hover:text-rose-400 p-1 rounded transition"
                              id={`delete-ing-btn-${ing.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB: MANAGE DISHES (MENU) */}
        {activeSubTab === "menu" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-display font-bold uppercase tracking-wider text-slate-400">
                  Manage Restaurant Menu
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Add, edit, or delete dishes, set prices, assign categories, and specify food image emoji or custom image URL.
                </p>
              </div>
              {isManagerOrOwner && (
                <button
                  onClick={() => {
                    setEditingMenuItemId(null);
                    setNewMenuItem({
                      name: "",
                      nameHindi: "",
                      price: 0,
                      category: existingCategories[0] || "Main Course",
                      imageUrl: "🥘",
                      isVegetarian: true,
                      isAvailable: true
                    });
                    setCustomCategory("");
                    setIsCustomCategory(false);
                    setShowAddMenuItemModal(true);
                  }}
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-3 py-2 rounded-xl text-xs flex items-center space-x-1.5 shadow"
                  id="add-menu-item-btn"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Dish</span>
                </button>
              )}
            </div>

            {/* List or Grid of Menu Items */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 mt-2">
              {menuItems.map((item) => {
                const recipe = recipes.find((r) => r.menuItemId === item.id);
                const hasCustomUrl = item.imageUrl && (item.imageUrl.startsWith("http://") || item.imageUrl.startsWith("https://") || item.imageUrl.startsWith("/"));

                return (
                  <div
                    key={item.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between"
                    id={`menu-item-card-${item.id}`}
                  >
                    <div>
                      {/* Image representation */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-2xl overflow-hidden shrink-0 border border-slate-700/50">
                          {hasCustomUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span>{item.imageUrl || "🍲"}</span>
                          )}
                        </div>
                        {item.isVegetarian && (
                          <div className="border border-emerald-500/50 p-0.5 rounded bg-emerald-500/10">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                          </div>
                        )}
                      </div>

                      <h3 className="font-display font-bold text-white text-sm line-clamp-1">
                        {item.name}
                      </h3>
                      {item.nameHindi && (
                        <p className="text-slate-400 text-xs font-semibold font-sans mt-0.5">
                          {item.nameHindi}
                        </p>
                      )}

                      <div className="mt-4 space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Price:</span>
                          <span className="font-mono font-bold text-white">INR {item.price}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Category:</span>
                          <span className="font-semibold text-slate-300">{item.category}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Status:</span>
                          <span className={`font-mono text-[10px] font-bold uppercase ${item.isAvailable ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {item.isAvailable ? 'Available' : 'Unavailable'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Recipe Mapping:</span>
                          <span className={`font-mono text-[10px] font-bold ${recipe ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {recipe ? `${recipe.ingredients.length} raw linked` : 'No mapping'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {isManagerOrOwner && (
                      <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleEditMenuItemClick(item)}
                          className="bg-slate-800 hover:bg-slate-750 border border-slate-750 text-slate-300 px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 transition"
                          id={`edit-menu-btn-${item.id}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteMenuItem(item.id)}
                          className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 transition"
                          id={`delete-menu-btn-${item.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SUBTAB 2: RECIPES MAPPING */}
        {activeSubTab === "recipes" && (
          <div className="space-y-4">
            <h2 className="text-sm font-display font-bold uppercase tracking-wider text-slate-400">
              Menu Item Recipe Maps
            </h2>
            <p className="text-xs text-slate-400 max-w-xl">
              Mapping dishes to their raw material components ensures that selling 1 dish automatically deducts appropriate quantities from inventory ledger logs.
            </p>

            {/* Orphan Integrity Warning Banner */}
            {orphanStats.totalOrphans > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-amber-500/5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-200">
                      Recipe Orphan Integrity Alert: {orphanStats.totalOrphans} Broken Link(s)
                    </h4>
                    <p className="text-xs text-amber-300/80">
                      Found {orphanStats.totalOrphans} raw material reference(s) across {orphanStats.affectedDishes.length} dish recipe(s) whose ingredients were deleted.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCleanAllOrphans}
                  disabled={cleaningOrphans}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold text-xs rounded-xl transition flex items-center gap-2 whitespace-nowrap shadow-md shadow-amber-500/20 cursor-pointer shrink-0"
                  id="clean-all-orphans-btn"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{cleaningOrphans ? "Purging..." : "Purge Orphan Recipe Links"}</span>
                </button>
              </div>
            )}

            {/* Orphan Cleaned Success Banner */}
            {orphanCleanSuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3.5 flex items-center gap-3 text-emerald-300 text-xs font-semibold animate-in fade-in">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{orphanCleanSuccess}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {menuItems.map((item) => {
                const recipe = recipes.find((r) => r.menuItemId === item.id);
                const hasOrphansInRecipe = recipe && recipe.ingredients.some(ri => !ingredients.some(i => i.id === ri.ingredientId));
                const cardPortionCost = recipe && recipe.ingredients ? recipe.ingredients.reduce((sum, ri) => {
                  const ing = ingredients.find(i => i.id === ri.ingredientId);
                  return sum + (ing ? calculatePortionCost(ri.quantity, ri.unit, ing) : 0);
                }, 0) : 0;

                return (
                  <div
                    key={item.id}
                    className={`bg-slate-900 border ${hasOrphansInRecipe ? 'border-amber-500/40' : 'border-slate-800/80'} rounded-2xl p-4 flex flex-col justify-between`}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-2xl">{item.imageUrl}</span>
                          <div>
                            <h3 className="font-bold text-white text-sm">{item.name}</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-[10px] font-mono text-slate-500 uppercase">{item.category}</p>
                              {recipe && recipe.ingredients.length > 0 && (
                                <span className="text-[10px] font-mono font-semibold text-emerald-400">
                                  • BOM Cost: ₹{cardPortionCost.toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {recipe ? (
                          hasOrphansInRecipe ? (
                            <span className="text-[10px] bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded-md font-mono font-bold flex items-center gap-1">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              Has Orphans
                            </span>
                          ) : (
                            <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-md font-mono font-bold">
                              Mapped
                            </span>
                          )
                        ) : (
                          <span className="text-[10px] bg-slate-800 border border-slate-700 text-slate-400 px-2 py-0.5 rounded-md font-mono">
                            Unmapped
                          </span>
                        )}
                      </div>

                      {/* Recipe Items list */}
                      <div className="mt-3 space-y-1.5 max-h-28 overflow-y-auto border-t border-slate-800/50 pt-2.5">
                        {recipe && recipe.ingredients.length > 0 ? (
                          recipe.ingredients.map((ri, index) => {
                            const ing = ingredients.find((i) => i.id === ri.ingredientId);
                            const isOrphan = !ing;
                            const ingName = ing ? ing.name : `Deleted Material (${ri.ingredientId})`;
                            const ingUnit = ing ? ing.unit : "";
                            const recipeUnit = ri.unit || ingUnit;
                            const convertedStock = ing ? convertRecipeQuantityToIngredientStock(ri.quantity, ri.unit, ing.unit) : ri.quantity;
                            const showUnitDiff = ing && recipeUnit.toLowerCase() !== ing.unit.toLowerCase();

                            return (
                              <div
                                key={index}
                                className={`flex justify-between items-center text-xs p-1 rounded-lg ${
                                  isOrphan
                                    ? "bg-amber-500/10 border border-amber-500/20 text-amber-300"
                                    : "text-slate-300"
                                }`}
                              >
                                <span className="flex items-center gap-1.5 min-w-0">
                                  {isOrphan && (
                                    <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold px-1 rounded font-mono uppercase shrink-0">
                                      Orphan
                                    </span>
                                  )}
                                  <span className="truncate">• {ingName}</span>
                                </span>
                                <span className="font-mono font-semibold text-slate-300 shrink-0 ml-2 text-right">
                                  {ri.quantity} {recipeUnit}
                                  {showUnitDiff && (
                                    <span className="text-[10px] text-emerald-400 font-normal ml-1">
                                      ({convertedStock} {ing.unit})
                                    </span>
                                  )}
                                </span>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-slate-600 text-xs italic">No recipe mapped yet for this dish.</p>
                        )}
                      </div>
                    </div>

                    {canEditRecipe && (
                      <button
                        onClick={() => handleEditRecipeClick(item)}
                        className={`mt-4 w-full py-2 ${hasOrphansInRecipe ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-slate-850 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700'} border text-xs font-bold rounded-xl transition`}
                        id={`map-recipe-btn-${item.id}`}
                      >
                        {hasOrphansInRecipe ? "Fix & Edit Ingredient Map" : recipe ? "Edit Ingredient Map" : "Map Ingredients"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SUBTAB 3: VENDOR PURCHASES */}
        {activeSubTab === "purchases" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-display font-bold uppercase tracking-wider text-slate-400">
                Purchase Entries History
              </h2>
              {canAddPurchase && (
                <button
                  onClick={() => {
                    const first = ingredients[0];
                    setNewPur({
                      ingredientId: first?.id || "",
                      quantity: 0,
                      cost: 0,
                      ratePerUnit: first ? first.costPerUnit : 0,
                      supplier: "",
                      invoiceNumber: ""
                    });
                    setShowAddPurchaseModal(true);
                  }}
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-3 py-2 rounded-xl text-xs flex items-center space-x-1.5 shadow"
                  id="add-purchase-btn"
                >
                  <Plus className="w-4 h-4" />
                  <span>Log Stock Purchase</span>
                </button>
              )}
            </div>

            {/* List */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-850/80 border-b border-slate-800 text-slate-400 font-semibold font-mono uppercase">
                    <th className="p-4">Purchase Date</th>
                    <th className="p-4">Ingredient Name</th>
                    <th className="p-4">Purchased Qty</th>
                    <th className="p-4">Purchase Rate</th>
                    <th className="p-4">Total Cost</th>
                    <th className="p-4">Supplier</th>
                    <th className="p-4">Invoice Number</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {purchases.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center p-8 text-slate-500 font-sans italic">
                        No supply purchase entries logged yet. Click "Log Stock Purchase" to receive new stock.
                      </td>
                    </tr>
                  ) : (
                    purchases.map((purchase) => {
                      const ing = ingredients.find((i) => i.id === purchase.ingredientId);
                      const unitStr = ing ? ing.unit : "Unit";
                      const unitRate = purchase.quantity > 0 ? (purchase.cost / purchase.quantity) : 0;
                      return (
                        <tr key={purchase.id} className="hover:bg-slate-850/20 text-slate-300">
                          <td className="p-4 text-slate-400 font-mono">{purchase.date}</td>
                          <td className="p-4 font-semibold text-white">{purchase.ingredientName}</td>
                          <td className="p-4 font-mono font-bold text-emerald-400">+{purchase.quantity} {unitStr}</td>
                          <td className="p-4 font-mono text-slate-200">INR {unitRate.toFixed(2)} /{unitStr}</td>
                          <td className="p-4 font-bold text-emerald-400 font-mono">INR {purchase.cost.toLocaleString()}</td>
                          <td className="p-4 text-slate-400">{purchase.supplier}</td>
                          <td className="p-4 text-slate-500 font-mono">{purchase.invoiceNumber || "-"}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SUBTAB 4: REPORTS */}
        {activeSubTab === "reports" && (
          <div className="space-y-6">
            {/* Cards bento grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow flex flex-col justify-between">
                <span className="text-xs text-slate-400 font-medium uppercase font-mono">Total Materials</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-3xl font-display font-bold text-white">{ingredients.length}</span>
                  <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono">tracked</span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow flex flex-col justify-between">
                <span className="text-xs text-slate-400 font-medium uppercase font-mono">Low Stock Alerts</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-3xl font-display font-bold text-amber-400">{lowStockCount}</span>
                  <span className="text-xs bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded text-amber-400 font-mono">Alerts</span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow flex flex-col justify-between">
                <span className="text-xs text-slate-400 font-medium uppercase font-mono">Out of Stock</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-3xl font-display font-bold text-rose-400">{outOfStockCount}</span>
                  <span className="text-xs bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded text-rose-400 font-mono">Critical</span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow flex flex-col justify-between">
                <span className="text-xs text-slate-400 font-medium uppercase font-mono">Total Holding Value</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-display font-bold text-emerald-400">
                    INR {totalStockHoldingValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-xs bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded text-emerald-400 font-mono">Value</span>
                </div>
              </div>
            </div>

            {/* Visual Inventory stock levels check */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow">
              <h3 className="font-display font-bold text-white text-base mb-4">Material Levels Health-Check</h3>
              <div className="space-y-4">
                {ingredients.map((ing) => {
                  const percent = Math.min(100, (ing.currentStock / (ing.minStock * 2 || 1)) * 100);
                  const isLow = ing.currentStock <= ing.minStock;
                  return (
                    <div key={ing.id} className="space-y-1 text-xs">
                      <div className="flex justify-between font-medium">
                        <span className="text-white">{ing.name}</span>
                        <span className="text-slate-400 font-mono">
                          {ing.currentStock.toLocaleString()} / {(ing.minStock * 2).toLocaleString()} {ing.unit} ({percent.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${percent}%` }}
                          className={`h-full rounded-full transition-all duration-300 ${
                            isLow ? "bg-gradient-to-r from-amber-500 to-rose-500" : "bg-gradient-to-r from-emerald-500 to-teal-400"
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 5: STOCK RULES SETTINGS */}
        {activeSubTab === "settings" && (
          <div className="max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow space-y-6">
            <h2 className="text-base font-display font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-emerald-400" />
              Inventory & Rules Configuration
            </h2>

            <div className="space-y-4 divide-y divide-slate-800/40 text-sm">
              <div className="flex items-center justify-between py-3">
                <div>
                  <h3 className="font-semibold text-white">Auto-Deduct Stock on Orders</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Automatically subtract ingredients from inventory ledger when checkout completes.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoDeductStock}
                  onChange={(e) => onUpdateSettings({ ...settings, autoDeductStock: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500"
                />
              </div>

              <div className="flex items-center justify-between py-3 pt-4">
                <div>
                  <h3 className="font-semibold text-white">Block Orders if Stock Insufficient</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Prevent checking out orders if recipe ingredients currentStock levels are empty.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.blockOrdersIfInsufficient}
                  onChange={(e) => onUpdateSettings({ ...settings, blockOrdersIfInsufficient: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500"
                />
              </div>

              <div className="flex items-center justify-between py-3 pt-4">
                <div>
                  <h3 className="font-semibold text-white">Manager Can Add Purchases</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Allow employees with "Manager" role accounts to record vendor supply purchase invoices.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.managerCanAddPurchases}
                  onChange={(e) => onUpdateSettings({ ...settings, managerCanAddPurchases: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500"
                />
              </div>

              <div className="flex items-center justify-between py-3 pt-4">
                <div>
                  <h3 className="font-semibold text-white">Manager Can Edit Recipes</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Allow Manager roles to map/modify recipe ingredient weights for menu items.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.managerCanEditRecipes}
                  onChange={(e) => onUpdateSettings({ ...settings, managerCanEditRecipes: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500"
                />
              </div>

              <div className="flex items-center justify-between py-3 pt-4">
                <div>
                  <h3 className="font-semibold text-white">KDS Audio Status Alerts</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Use browser speech synthesis to read order announcements aloud on state changes.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.kdsSoundAlerts}
                  onChange={(e) => onUpdateSettings({ ...settings, kdsSoundAlerts: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500"
                />
              </div>

              <div className="flex items-center justify-between py-3 pt-4">
                <div>
                  <h3 className="font-semibold text-white">Require Quick PIN Screen</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Prompt the keypad login screen immediately when the terminal is idle or locking.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.quickPinRequired}
                  onChange={(e) => onUpdateSettings({ ...settings, quickPinRequired: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500"
                />
              </div>

              <div className="py-3 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-white">Restaurant GST % Tax Rate</h3>
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    {settings.gstPercentage ?? 5}% Active
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-3">Adjust the tax percentage rate applied to POS bills and receipts.</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={settings.gstPercentage ?? 5}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      onUpdateSettings({
                        ...settings,
                        gstPercentage: isNaN(val) ? 0 : Math.max(0, Math.min(100, val))
                      });
                    }}
                    className="w-28 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl font-mono text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                  />
                  <div className="flex gap-1.5">
                    {[0, 5, 12, 18, 28].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => onUpdateSettings({ ...settings, gstPercentage: rate })}
                        className={`px-2 py-1 rounded-lg text-xs font-bold font-mono transition border cursor-pointer ${
                          (settings.gstPercentage ?? 5) === rate
                            ? "bg-emerald-500 text-slate-950 border-emerald-500"
                            : "bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600"
                        }`}
                      >
                        {rate}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* FORM MODAL: ADD/EDIT INGREDIENT */}
      {showAddIngredientModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-base font-display font-bold text-white mb-4">
              {editingIngId ? "Edit Raw Ingredient" : "Add New Ingredient"}
            </h3>

            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 font-medium">Material Name *</label>
                <input
                  type="text"
                  placeholder="e.g., Paneer, Cheese, Tomato"
                  value={newIng.name}
                  onChange={(e) => setNewIng({ ...newIng, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 font-medium">Unit Measurement</label>
                  <select
                    value={newIng.unit}
                    onChange={(e) => setNewIng({ ...newIng, unit: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="g">Grams (g)</option>
                    <option value="ml">Milliliters (ml)</option>
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="kg">Kilograms (kg)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 font-medium">Cost per Unit (INR)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newIng.costPerUnit || ""}
                    onChange={(e) => setNewIng({ ...newIng, costPerUnit: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 font-medium">Initial Stock Quantity</label>
                  <input
                    type="number"
                    value={newIng.currentStock || ""}
                    onChange={(e) => setNewIng({ ...newIng, currentStock: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 font-medium">Min. Alert Level</label>
                  <input
                    type="number"
                    value={newIng.minStock || ""}
                    onChange={(e) => setNewIng({ ...newIng, minStock: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowAddIngredientModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveIngredient}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs transition"
                id="save-ingredient-submit-btn"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FORM MODAL: RECEIVE VENDOR PURCHASE */}
      {showAddPurchaseModal && (() => {
        const selectedPurIng = ingredients.find((i) => i.id === newPur.ingredientId);
        const curStock = selectedPurIng ? Math.max(0, selectedPurIng.currentStock) : 0;
        const curCost = selectedPurIng ? selectedPurIng.costPerUnit : 0;
        const curVal = curStock * curCost;
        const purQty = Number(newPur.quantity) || 0;
        const purCost = Number(newPur.cost) || 0;
        const purRate = purQty > 0 ? (purCost / purQty) : (newPur.ratePerUnit || 0);
        const newCombinedStock = Number((curStock + purQty).toFixed(3));
        const newCombinedVal = curVal + purCost;
        const previewWac = newCombinedStock > 0
          ? (curStock > 0 && curCost > 0 ? Number((newCombinedVal / newCombinedStock).toFixed(2)) : Number(purRate.toFixed(2)))
          : curCost;

        return (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-display font-bold text-white">Log Supply Delivery</h3>
                  <p className="text-xs text-slate-400">Stock arrival & Weighted Average Cost (WAC) update</p>
                </div>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-400 font-medium">Select Ingredient *</label>
                  <select
                    value={newPur.ingredientId}
                    onChange={(e) => {
                      const selId = e.target.value;
                      const ing = ingredients.find((i) => i.id === selId);
                      const rate = ing ? ing.costPerUnit : 0;
                      setNewPur({
                        ...newPur,
                        ingredientId: selId,
                        ratePerUnit: rate,
                        cost: newPur.quantity > 0 && rate > 0 ? Number((newPur.quantity * rate).toFixed(2)) : newPur.cost
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="">-- Choose Ingredient --</option>
                    {ingredients.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.unit}) — Current: {i.currentStock} {i.unit} @ ₹{i.costPerUnit.toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-slate-400 font-medium">Delivered Qty *</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="e.g. 10"
                      value={newPur.quantity || ""}
                      onChange={(e) => {
                        const qty = Number(e.target.value);
                        const rate = newPur.ratePerUnit > 0 ? newPur.ratePerUnit : (selectedPurIng ? selectedPurIng.costPerUnit : 0);
                        setNewPur({
                          ...newPur,
                          quantity: qty,
                          ratePerUnit: rate,
                          cost: qty > 0 && rate > 0 ? Number((qty * rate).toFixed(2)) : newPur.cost
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400 font-medium">Rate / {selectedPurIng ? selectedPurIng.unit : "Unit"} (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="e.g. 20"
                      value={newPur.ratePerUnit || ""}
                      onChange={(e) => {
                        const rate = Number(e.target.value);
                        const qty = Number(newPur.quantity) || 0;
                        setNewPur({
                          ...newPur,
                          ratePerUnit: rate,
                          cost: qty > 0 ? Number((qty * rate).toFixed(2)) : newPur.cost
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400 font-medium">Total Cost (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="e.g. 200"
                      value={newPur.cost || ""}
                      onChange={(e) => {
                        const cost = Number(e.target.value);
                        const qty = Number(newPur.quantity) || 0;
                        const derivedRate = qty > 0 ? Number((cost / qty).toFixed(2)) : newPur.ratePerUnit;
                        setNewPur({
                          ...newPur,
                          cost,
                          ratePerUnit: derivedRate
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                    />
                  </div>
                </div>

                {selectedPurIng && (
                  <div className="bg-slate-950/80 border border-emerald-500/25 rounded-2xl p-3 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                      <span className="text-[11px] font-bold text-emerald-400">Weighted Average Cost (WAC) Preview</span>
                      <span className="text-[10px] text-slate-400 font-mono">वेटेज एवरेज गणना</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-850">
                        <span className="text-slate-400 block font-medium">Current Stock in Hand:</span>
                        <span className="font-bold text-white font-mono">{curStock} {selectedPurIng.unit}</span>
                        <span className="text-slate-400 block font-mono">@ ₹{curCost.toFixed(2)} / {selectedPurIng.unit}</span>
                        <span className="text-emerald-400/90 font-mono block">Value: ₹{curVal.toFixed(2)}</span>
                      </div>

                      <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-850">
                        <span className="text-slate-400 block font-medium">Incoming Purchase:</span>
                        <span className="font-bold text-emerald-400 font-mono">+{purQty} {selectedPurIng.unit}</span>
                        <span className="text-slate-400 block font-mono">@ ₹{purRate.toFixed(2)} / {selectedPurIng.unit}</span>
                        <span className="text-emerald-400/90 font-mono block">Cost: ₹{purCost.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 flex items-center justify-between">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-emerald-400 tracking-wider block">New Total Stock</span>
                        <span className="font-mono font-bold text-white text-xs">{newCombinedStock} {selectedPurIng.unit}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] uppercase font-bold text-emerald-400 tracking-wider block">New Avg. Cost per {selectedPurIng.unit}</span>
                        <span className="font-mono font-bold text-emerald-300 text-sm">₹{previewWac.toFixed(2)} / {selectedPurIng.unit}</span>
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-500 italic">
                      Formula: (Current ₹{curVal.toFixed(0)} + Purchase ₹{purCost.toFixed(0)}) ÷ {newCombinedStock || 1} {selectedPurIng.unit} = ₹{previewWac.toFixed(2)} / {selectedPurIng.unit}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-400 font-medium">Supplier / Vendor</label>
                    <input
                      type="text"
                      placeholder="e.g. ABC Farm Wholesale"
                      value={newPur.supplier}
                      onChange={(e) => setNewPur({ ...newPur, supplier: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400 font-medium">Invoice Number</label>
                    <input
                      type="text"
                      placeholder="e.g. INV-9021"
                      value={newPur.invoiceNumber}
                      onChange={(e) => setNewPur({ ...newPur, invoiceNumber: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => setShowAddPurchaseModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddPurchaseSubmit}
                  disabled={!newPur.ingredientId || newPur.quantity <= 0}
                  className={`flex-1 py-2.5 font-bold rounded-xl text-xs transition ${
                    !newPur.ingredientId || newPur.quantity <= 0
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                      : "bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-lg shadow-emerald-500/20"
                  }`}
                  id="save-purchase-submit-btn"
                >
                  Add Inventory & Update Cost
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* FORM MODAL: MAP RECIPES */}
      {showEditRecipeModal && (() => {
        const selectedDish = menuItems.find((m) => m.id === selectedRecipeMenuItemId);
        const totalBOMCost = recipeIngredients.reduce((sum, row) => {
          const ing = ingredients.find((i) => i.id === row.ingredientId);
          return sum + (ing ? calculatePortionCost(row.quantity, row.unit, ing) : 0);
        }, 0);
        const profitMargin = selectedDish && selectedDish.price > 0
          ? Math.round(((selectedDish.price - totalBOMCost) / selectedDish.price) * 100)
          : null;

        return (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
              <div className="flex items-start justify-between mb-2 shrink-0">
                <div>
                  <h3 className="text-base font-display font-bold text-white">
                    Map Recipe Portion Deduction (BOM)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Define raw materials consumed for 1 portion of{" "}
                    <b className="text-white">{selectedDish?.name}</b> (₹{selectedDish?.price || 0})
                  </p>
                </div>
                {recipeIngredients.length > 0 && (
                  <div className="text-right shrink-0 bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-xl">
                    <div className="text-[10px] text-slate-400 uppercase font-mono">BOM Portion Cost</div>
                    <div className="text-sm font-bold font-mono text-emerald-400">
                      ₹{totalBOMCost.toFixed(2)}
                      {profitMargin !== null && (
                        <span className="text-[11px] text-slate-400 font-normal ml-1">({profitMargin}% margin)</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* List scroll */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs my-3">
                {recipeIngredients.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 italic bg-slate-950/30 rounded-2xl border border-slate-800 p-4">
                    No ingredients added to this recipe yet. Click "Add Material Link" below.
                  </div>
                ) : (
                  recipeIngredients.map((row, index) => {
                    const ing = ingredients.find((i) => i.id === row.ingredientId);
                    const currentUnit = row.unit || (ing ? getDefaultRecipeUnit(ing.unit) : "g");
                    const compatibleUnits = ing ? getCompatibleUnits(ing.unit) : [{ value: "g", label: "g" }];
                    const rowCost = ing ? calculatePortionCost(row.quantity, currentUnit, ing) : 0;
                    const stockDeduction = ing ? convertRecipeQuantityToIngredientStock(row.quantity, currentUnit, ing.unit) : row.quantity;
                    const showUnitNotice = ing && currentUnit.toLowerCase() !== ing.unit.toLowerCase();

                    return (
                      <div key={index} className="bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800 space-y-2">
                        <div className="flex items-center space-x-2">
                          <select
                            value={row.ingredientId}
                            onChange={(e) => handleUpdateRecipeRow(index, "ingredientId", e.target.value)}
                            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-white text-xs"
                          >
                            {ingredients.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name} ({item.unit})
                              </option>
                            ))}
                          </select>

                          <div className="flex items-center space-x-1">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="Qty"
                              value={row.quantity || ""}
                              onChange={(e) => handleUpdateRecipeRow(index, "quantity", Number(e.target.value))}
                              className="w-16 bg-slate-900 border border-slate-800 rounded-xl px-2 py-1.5 text-center text-white text-xs font-mono font-semibold"
                            />
                            <select
                              value={currentUnit}
                              onChange={(e) => handleUpdateRecipeRow(index, "unit", e.target.value)}
                              className="bg-slate-900 border border-slate-800 rounded-xl px-2 py-1.5 text-emerald-400 text-xs font-mono font-bold"
                              title="Recipe portion unit"
                            >
                              {compatibleUnits.map((u) => (
                                <option key={u.value} value={u.value}>
                                  {u.value}
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            onClick={() => handleRemoveRecipeRow(index)}
                            className="text-slate-500 hover:text-rose-400 p-1.5 transition rounded-lg hover:bg-rose-500/10"
                            title="Remove material link"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Conversion detail */}
                        {ing && (
                          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1 border-t border-slate-900/80">
                            <span className="font-mono text-slate-400">
                              {showUnitNotice ? (
                                <span className="text-emerald-400 font-semibold">
                                  ⚡ Deducts {stockDeduction} {ing.unit} from bulk inventory
                                </span>
                              ) : (
                                <span>Deducts {row.quantity} {ing.unit} from inventory</span>
                              )}
                            </span>
                            <span className="font-mono text-slate-300">
                              Est. Cost: <span className="text-white font-semibold">₹{rowCost.toFixed(2)}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                <button
                  onClick={handleAddIngredientRowToRecipe}
                  className="w-full py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800/80 border-dashed rounded-xl text-[11px] font-semibold text-slate-400 hover:text-white transition flex items-center justify-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Material Link</span>
                </button>
              </div>

              <div className="flex space-x-3 mt-4 shrink-0">
                <button
                  onClick={() => setShowEditRecipeModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRecipe}
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-500/20"
                  id="save-recipe-submit-btn"
                >
                  Save Mapping
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* FORM MODAL: ADD/EDIT MENU ITEM */}
      {showAddMenuItemModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <h3 className="text-base font-display font-bold text-white mb-4 shrink-0">
              {editingMenuItemId ? "Edit Dish" : "Add New Dish"}
            </h3>

            <div className="flex-1 overflow-y-auto space-y-4 text-xs pr-1">
              <div className="space-y-1">
                <label className="text-slate-400 font-medium">Dish Name *</label>
                <input
                  type="text"
                  placeholder="e.g., Kaju Curry, Paneer Pasanda"
                  value={newMenuItem.name}
                  onChange={(e) => setNewMenuItem({ ...newMenuItem, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  id="menu-item-name-input"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-medium">Hindi Translation Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., काजू करी"
                  value={newMenuItem.nameHindi}
                  onChange={(e) => setNewMenuItem({ ...newMenuItem, nameHindi: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  id="menu-item-hindi-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 font-medium">Price (INR) *</label>
                  <input
                    type="number"
                    placeholder="Price"
                    value={newMenuItem.price || ""}
                    onChange={(e) => setNewMenuItem({ ...newMenuItem, price: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    id="menu-item-price-input"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 font-medium">Dish Emoji or Image URL *</label>
                  <input
                    type="text"
                    placeholder="e.g., 🍛 or https://example.com/dish.jpg"
                    value={newMenuItem.imageUrl}
                    onChange={(e) => setNewMenuItem({ ...newMenuItem, imageUrl: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    id="menu-item-image-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-400 font-medium font-sans">Category</label>
                  <div className="flex items-center space-x-1 select-none">
                    <input
                      type="checkbox"
                      id="custom-category-checkbox"
                      checked={isCustomCategory}
                      onChange={(e) => setIsCustomCategory(e.target.checked)}
                      className="w-3.5 h-3.5 accent-emerald-500 cursor-pointer"
                    />
                    <label htmlFor="custom-category-checkbox" className="text-[10px] text-slate-500 cursor-pointer font-sans">
                      Create New Category
                    </label>
                  </div>
                </div>

                {isCustomCategory ? (
                  <input
                    type="text"
                    placeholder="Enter custom category name"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    id="menu-item-custom-category-input"
                  />
                ) : (
                  <select
                    value={newMenuItem.category}
                    onChange={(e) => setNewMenuItem({ ...newMenuItem, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                    id="menu-item-category-select"
                  >
                    {existingCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    {!existingCategories.includes("Main Course") && <option value="Main Course">Main Course</option>}
                    {!existingCategories.includes("Starters") && <option value="Starters">Starters</option>}
                    {!existingCategories.includes("Chinese") && <option value="Chinese">Chinese</option>}
                    {!existingCategories.includes("Desserts") && <option value="Desserts">Desserts</option>}
                    {!existingCategories.includes("Beverages") && <option value="Beverages">Beverages</option>}
                  </select>
                )}
              </div>

              <div className="flex items-center justify-between py-2 border-t border-slate-800/60 mt-2">
                <div>
                  <label className="text-slate-400 font-medium font-sans">Is Vegetarian Dish</label>
                  <p className="text-[10px] text-slate-500">Enable to display the green veg badge on POS billing.</p>
                </div>
                <input
                  type="checkbox"
                  checked={newMenuItem.isVegetarian}
                  onChange={(e) => setNewMenuItem({ ...newMenuItem, isVegetarian: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 cursor-pointer"
                  id="menu-item-veg-checkbox"
                />
              </div>

              {editingMenuItemId && (
                <div className="flex items-center justify-between py-2 border-t border-slate-800/60">
                  <div>
                    <label className="text-slate-400 font-medium font-sans">Is Available (In Stock)</label>
                    <p className="text-[10px] text-slate-500">Uncheck to mark as "Out of Stock" temporarily on the terminal.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={newMenuItem.isAvailable}
                    onChange={(e) => setNewMenuItem({ ...newMenuItem, isAvailable: e.target.checked })}
                    className="w-4 h-4 accent-emerald-500 cursor-pointer"
                    id="menu-item-available-checkbox"
                  />
                </div>
              )}
            </div>

            <div className="flex space-x-3 mt-6 shrink-0 border-t border-slate-800 pt-4">
              <button
                onClick={() => setShowAddMenuItemModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMenuItem}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs transition"
                id="save-menu-item-submit-btn"
              >
                {editingMenuItemId ? "Save Changes" : "Create Dish"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE RAW MATERIAL CASCADE CONFIRMATION */}
      {ingredientToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-display font-bold text-white">
                  Delete Raw Material
                </h3>
                <p className="text-xs text-slate-400">
                  {ingredientToDelete.ingredient.name} ({ingredientToDelete.ingredient.unit})
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs my-2">
              {ingredientToDelete.affectedRecipes.length > 0 ? (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-300">
                    <div className="flex items-center gap-2 font-bold mb-1">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>Linked in {ingredientToDelete.affectedRecipes.length} Active Recipe(s)</span>
                    </div>
                    <p className="text-[11px] text-amber-300/80">
                      This raw material is currently defined in the BOM (Bill of Materials) for the following dishes:
                    </p>
                  </div>

                  <div className="bg-slate-950/50 rounded-2xl border border-slate-800 p-3 space-y-2 max-h-40 overflow-y-auto">
                    {ingredientToDelete.affectedRecipes.map((aff, i) => (
                      <div key={i} className="flex justify-between items-center text-xs py-1 border-b border-slate-800/40 last:border-0">
                        <span className="font-semibold text-slate-200">• {aff.dishName}</span>
                        <span className="font-mono text-slate-400">
                          {aff.quantity} {ingredientToDelete.ingredient.unit} / portion
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-2xl text-slate-300">
                    <p className="text-[11px] leading-relaxed text-slate-400">
                      <b className="text-emerald-400">Automatic Recipe Cascade:</b> Deleting this ingredient will automatically unlink it from these recipes so no orphan data remains. Stock deductions for other ingredients in these recipes will continue normally.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-2xl text-slate-300 space-y-2">
                  <p className="text-xs leading-relaxed">
                    Are you sure you want to delete <b className="text-white">{ingredientToDelete.ingredient.name}</b> from your raw materials ledger?
                  </p>
                  <p className="text-[11px] text-slate-500">
                    No active recipes currently link to this raw material. It will be safely removed.
                  </p>
                </div>
              )}
            </div>

            <div className="flex space-x-3 mt-6 shrink-0 border-t border-slate-800 pt-4">
              <button
                onClick={() => setIngredientToDelete(null)}
                className="flex-1 py-2.5 bg-slate-850 hover:bg-slate-800 text-slate-300 font-semibold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteIngredient}
                className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-rose-500/20"
                id="confirm-delete-ingredient-btn"
              >
                {ingredientToDelete.affectedRecipes.length > 0
                  ? "Delete & Unlink Recipes"
                  : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
