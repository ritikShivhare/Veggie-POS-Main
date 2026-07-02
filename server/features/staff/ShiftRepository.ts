import { BaseRepository } from "../shared/BaseRepository";
import { Shift } from "../../../src/features/shared/types";

export class ShiftRepository extends BaseRepository<Shift> {
  protected sliceKey = "shifts";
}

