import { BaseRepository } from "../shared/BaseRepository";
import { Purchase } from "../../../src/features/shared/types";

export class PurchaseRepository extends BaseRepository<Purchase> {
  protected sliceKey = "purchases";
}

