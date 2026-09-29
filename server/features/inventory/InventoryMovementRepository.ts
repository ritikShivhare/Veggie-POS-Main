import { BaseRepository } from "../shared/BaseRepository";
import { InventoryMovement } from "../../../src/features/shared/types";

export class InventoryMovementRepository extends BaseRepository<InventoryMovement> {
  protected sliceKey = "inventory_movements";
}
