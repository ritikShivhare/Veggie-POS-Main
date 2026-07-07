import { useAppContext } from "../../shared/context/AppContext";

export function usePOSState() {
  const {
    orders,
    setOrders,
    customers,
    setCustomers,
    handleOrderCreated,
    handleUpdateOrderStatus,
    menuItems,
    ingredients,
    recipes,
    settings,
    currentStaff
  } = useAppContext();

  return {
    orders,
    setOrders,
    customers,
    setCustomers,
    handleOrderCreated,
    handleUpdateOrderStatus,
    menuItems,
    ingredients,
    recipes,
    settings,
    currentStaff
  };
}
