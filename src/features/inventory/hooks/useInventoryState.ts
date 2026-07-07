import { useAppContext } from "../../shared/context/AppContext";

export function useInventoryState() {
  const {
    ingredients,
    setIngredients,
    recipes,
    setRecipes,
    menuItems,
    setMenuItems,
    purchases,
    setPurchases,
    settings,
    setSettings,
    handleUpdateIngredients,
    handleUpdateRecipes,
    handleUpdateMenuItems,
    handleAddPurchase
  } = useAppContext();

  return {
    ingredients,
    setIngredients,
    recipes,
    setRecipes,
    menuItems,
    setMenuItems,
    purchases,
    setPurchases,
    settings,
    setSettings,
    handleUpdateIngredients,
    handleUpdateRecipes,
    handleUpdateMenuItems,
    handleAddPurchase
  };
}
