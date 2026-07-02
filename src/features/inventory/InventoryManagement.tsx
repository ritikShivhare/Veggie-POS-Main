import React, { useState, useMemo } from "react";
import { Ingredient, MenuItem, Recipe, Purchase, InventorySettings, StaffMember } from "../shared/types";
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
  Sparkles
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

  // Ingredient Form State
  const [newIng, setNewIng] = useState({ name: "", unit: "g", currentStock: 0, minStock: 0, costPerUnit: 0 });
  const [editingIngId, setEditingIngId] = useState<string | null>(null);

  // Purchase Form State
  const [newPur, setNewPur] = useState({ ingredientId: "", quantity: 0, cost: 0, supplier: "", invoiceNumber: "" });

  // Recipe Form State
  const [selectedRecipeMenuItemId, setSelectedRecipeMenuItemId] = useState("");
  const [recipeIngredients, setRecipeIngredients] = useState<{ ingredientId: string; quantity: number }[]>([]);

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

  const handleDeleteIngredient = (id: string) => {
    if (confirm("Are you sure you want to delete this ingredient? It will also break any recipe mapping associated with it.")) {
      onUpdateIngredients(ingredients.filter((i) => i.id !== id));
    }
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
        isAvailable: true
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

    const purchaseEntry: Purchase = {
      id: `pur-${Date.now()}`,
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      ingredientId: newPur.ingredientId,
      ingredientName: selectedIng.name,
      quantity: Number(newPur.quantity),
      cost: Number(newPur.cost),
      supplier: newPur.supplier || "Direct",
      invoiceNumber: newPur.invoiceNumber || undefined
    };

    onAddPurchase(purchaseEntry);

    // Increase current stock in inventory
    const updatedIngredients = ingredients.map((ing) =>
      ing.id === newPur.ingredientId
        ? { ...ing, currentStock: ing.currentStock + Number(newPur.quantity) }
        : ing
    );
    onUpdateIngredients(updatedIngredients);

    setNewPur({ ingredientId: "", quantity: 0, cost: 0, supplier: "", invoiceNumber: "" });
    setShowAddPurchaseModal(false);
  };

  // Recipe Management
  const handleEditRecipeClick = (menuItem: MenuItem) => {
    const existingRecipe = recipes.find((r) => r.menuItemId === menuItem.id);
    setSelectedRecipeMenuItemId(menuItem.id);
    setRecipeIngredients(existingRecipe ? [...existingRecipe.ingredients] : []);
    setShowEditRecipeModal(true);
  };

  const handleAddIngredientRowToRecipe = () => {
    const unusedIng = ingredients.find(
      (ing) => !recipeIngredients.some((ri) => ri.ingredientId === ing.id)
    );
    if (unusedIng) {
      setRecipeIngredients([...recipeIngredients, { ingredientId: unusedIng.id, quantity: 1 }]);
    }
  };

  const handleUpdateRecipeRow = (index: number, key: "ingredientId" | "quantity", value: any) => {
    const updated = [...recipeIngredients];
    updated[index] = { ...updated[index], [key]: value };
    setRecipeIngredients(updated);
  };

  const handleRemoveRecipeRow = (index: number) => {
    setRecipeIngredients(recipeIngredients.filter((_, i) => i !== index));
  };

  const handleSaveRecipe = () => {
    const updatedRecipe: Recipe = {
      menuItemId: selectedRecipeMenuItemId,
      ingredients: recipeIngredients.filter((ri) => ri.quantity > 0)
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
                    <th className="p-4">Est. Cost / Unit</th>
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
                        <td className="p-4 font-mono">INR {ing.costPerUnit.toFixed(2)}</td>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {menuItems.map((item) => {
                const recipe = recipes.find((r) => r.menuItemId === item.id);
                return (
                  <div
                    key={item.id}
                    className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-2xl">{item.imageUrl}</span>
                          <div>
                            <h3 className="font-bold text-white text-sm">{item.name}</h3>
                            <p className="text-[10px] font-mono text-slate-500 uppercase">{item.category}</p>
                          </div>
                        </div>
                        {recipe ? (
                          <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-md font-mono font-bold">
                            Mapped
                          </span>
                        ) : (
                          <span className="text-[10px] bg-slate-800 border border-slate-700 text-slate-400 px-2 py-0.5 rounded-md font-mono">
                            Unmapped
                          </span>
                        )}
                      </div>

                      {/* Recipe Items list */}
                      <div className="mt-3 space-y-1 max-h-24 overflow-y-auto border-t border-slate-800/50 pt-2.5">
                        {recipe && recipe.ingredients.length > 0 ? (
                          recipe.ingredients.map((ri, index) => {
                            const ingName = ingredients.find((i) => i.id === ri.ingredientId)?.name || ri.ingredientId;
                            const ingUnit = ingredients.find((i) => i.id === ri.ingredientId)?.unit || "g";
                            return (
                              <div key={index} className="flex justify-between text-xs text-slate-300">
                                <span>• {ingName}</span>
                                <span className="font-mono font-semibold text-slate-400">
                                  {ri.quantity} {ingUnit}
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
                        className="mt-4 w-full py-2 bg-slate-850 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs font-bold rounded-xl text-slate-300 transition"
                        id={`map-recipe-btn-${item.id}`}
                      >
                        {recipe ? "Edit Ingredient Map" : "Map Ingredients"}
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
                    setNewPur({ ingredientId: ingredients[0]?.id || "", quantity: 0, cost: 0, supplier: "", invoiceNumber: "" });
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
                    <th className="p-4">Total Cost</th>
                    <th className="p-4">Supplier</th>
                    <th className="p-4">Invoice Number</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {purchases.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center p-8 text-slate-500 font-sans italic">
                        No supply purchase entries logged yet. Click "Log Stock Purchase" to receive new stock.
                      </td>
                    </tr>
                  ) : (
                    purchases.map((purchase) => (
                      <tr key={purchase.id} className="hover:bg-slate-850/20 text-slate-300">
                        <td className="p-4 text-slate-400 font-mono">{purchase.date}</td>
                        <td className="p-4 font-semibold text-white">{purchase.ingredientName}</td>
                        <td className="p-4 font-mono">{purchase.quantity}</td>
                        <td className="p-4 font-bold text-emerald-400">INR {purchase.cost.toLocaleString()}</td>
                        <td className="p-4 text-slate-400">{purchase.supplier}</td>
                        <td className="p-4 text-slate-500 font-mono">{purchase.invoiceNumber || "-"}</td>
                      </tr>
                    ))
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
      {showAddPurchaseModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-base font-display font-bold text-white mb-4">Receive Supply Delivery</h3>

            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 font-medium">Select Ingredient *</label>
                <select
                  value={newPur.ingredientId}
                  onChange={(e) => setNewPur({ ...newPur, ingredientId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                >
                  <option value="">-- Choose Ingredient --</option>
                  {ingredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 font-medium">Delivered Quantity *</label>
                  <input
                    type="number"
                    value={newPur.quantity || ""}
                    onChange={(e) => {
                      const qty = Number(e.target.value);
                      const selectedIng = ingredients.find(i => i.id === newPur.ingredientId);
                      const estimatedCost = selectedIng ? selectedIng.costPerUnit * qty : 0;
                      setNewPur({ ...newPur, quantity: qty, cost: estimatedCost });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 font-medium">Delivered Invoice Cost (INR)</label>
                  <input
                    type="number"
                    value={newPur.cost || ""}
                    onChange={(e) => setNewPur({ ...newPur, cost: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-medium">Supplier / Vendor Name</label>
                <input
                  type="text"
                  placeholder="e.g. ABC Dairy Wholesale"
                  value={newPur.supplier}
                  onChange={(e) => setNewPur({ ...newPur, supplier: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-medium">Invoice Number</label>
                <input
                  type="text"
                  placeholder="e.g. INV-2026-904"
                  value={newPur.invoiceNumber}
                  onChange={(e) => setNewPur({ ...newPur, invoiceNumber: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
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
                    : "bg-emerald-500 hover:bg-emerald-600 text-slate-950"
                }`}
                id="save-purchase-submit-btn"
              >
                Add Inventory
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FORM MODAL: MAP RECIPES */}
      {showEditRecipeModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
            <h3 className="text-base font-display font-bold text-white mb-2 shrink-0">
              Map Recipe Portion Deduction
            </h3>
            <p className="text-xs text-slate-400 mb-4 shrink-0">
              Define the raw materials consumed when 1 portion of{" "}
              <b className="text-white">
                {menuItems.find((m) => m.id === selectedRecipeMenuItemId)?.name}
              </b>{" "}
              is sold.
            </p>

            {/* List scroll */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs my-2">
              {recipeIngredients.length === 0 ? (
                <div className="text-center py-6 text-slate-500 italic bg-slate-950/30 rounded-2xl border border-slate-800 p-4">
                  No ingredients added to this recipe yet. Click "Add Material Link" below.
                </div>
              ) : (
                recipeIngredients.map((row, index) => (
                  <div key={index} className="flex items-center space-x-2 bg-slate-950/40 p-2 rounded-xl border border-slate-800">
                    <select
                      value={row.ingredientId}
                      onChange={(e) => handleUpdateRecipeRow(index, "ingredientId", e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-white"
                    >
                      {ingredients.map((ing) => (
                        <option key={ing.id} value={ing.id}>
                          {ing.name} ({ing.unit})
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center space-x-1.5 w-24">
                      <input
                        type="number"
                        placeholder="Qty"
                        value={row.quantity || ""}
                        onChange={(e) => handleUpdateRecipeRow(index, "quantity", Number(e.target.value))}
                        className="w-16 bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-center text-white"
                      />
                      <span className="text-slate-500 font-mono">
                        {ingredients.find((i) => i.id === row.ingredientId)?.unit || "g"}
                      </span>
                    </div>

                    <button
                      onClick={() => handleRemoveRecipeRow(index)}
                      className="text-slate-500 hover:text-rose-400 p-1 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}

              <button
                onClick={handleAddIngredientRowToRecipe}
                className="w-full py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800/80 border-dashed rounded-xl text-[11px] font-semibold text-slate-400 hover:text-white transition flex items-center justify-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Material Link</span>
              </button>
            </div>

            <div className="flex space-x-3 mt-6 shrink-0">
              <button
                onClick={() => setShowEditRecipeModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRecipe}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs transition"
                id="save-recipe-submit-btn"
              >
                Save Mapping
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}
