import { BaseRepository } from "../shared/BaseRepository";
import { StaffMember } from "../../../src/features/shared/types";

export class StaffRepository extends BaseRepository<StaffMember> {
  protected sliceKey = "staffList";
}

