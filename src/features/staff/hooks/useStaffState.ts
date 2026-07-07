import { useAppContext } from "../../shared/context/AppContext";

export function useStaffState() {
  const {
    staffList,
    setStaffList,
    shifts,
    setShifts,
    activeShift,
    handleShiftAction,
    currentStaff
  } = useAppContext();

  return {
    staffList,
    setStaffList,
    shifts,
    setShifts,
    activeShift,
    handleShiftAction,
    currentStaff
  };
}
