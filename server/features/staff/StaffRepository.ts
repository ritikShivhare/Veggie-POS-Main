import { BaseRepository, DatabaseTransaction } from "../shared/BaseRepository";
import { StaffMember } from "../../../src/features/shared/types";
import { hashPin, isBcryptHash } from "../auth/PinSecurityService";

export class StaffRepository extends BaseRepository<StaffMember> {
  protected sliceKey = "staffList";

  override async add(tenantId: string, item: StaffMember, trx?: DatabaseTransaction): Promise<void> {
    if (item && item.pin) {
      item.pin = await hashPin(item.pin);
    }
    return super.add(tenantId, item, trx);
  }

  override async update(tenantId: string, item: StaffMember, expectedVersion?: number, trx?: DatabaseTransaction): Promise<StaffMember> {
    if (item && item.pin) {
      item.pin = await hashPin(item.pin);
    }
    return super.update(tenantId, item, expectedVersion, trx);
  }

  override async saveAll(tenantId: string, items: StaffMember[], trx?: DatabaseTransaction): Promise<void> {
    if (items && Array.isArray(items)) {
      for (const item of items) {
        if (item && item.pin) {
          item.pin = await hashPin(item.pin);
        }
      }
    }
    return super.saveAll(tenantId, items, trx);
  }

  override async getAll(tenantId: string): Promise<StaffMember[] | null> {
    const list = await super.getAll(tenantId);
    if (list && list.length > 0) {
      return list;
    }

    // Demo accounts must never be created from a failed or empty production read.
    return list;
  }
}

