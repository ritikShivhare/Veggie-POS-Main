import {getPlanLimits} from '../billing/SubscriptionLifecycle';
import { BaseRepository, DatabaseTransaction } from "../shared/BaseRepository";
import { StaffMember } from "../../../src/features/shared/types";
import { countActiveStaff, isActiveStaff } from "../../../src/features/shared/staffStatus";
import { getSubscription } from "../shared/subscription";
import { hashPin } from "../auth/PinSecurityService";

export class StaffRepository extends BaseRepository<StaffMember> {
  protected sliceKey = "staffList";

  /** Called inside the tenant transaction by both command and sync writes. */
  async assertActiveCapacity(tenantId: string, next: StaffMember[]): Promise<void> {
    const current = (await this.getAll(tenantId)) || [];
    const nonowners=(list:StaffMember[])=>list.filter(s=>s.role!=='Owner' && isActiveStaff(s)).length;
    const activeOwners=(list:StaffMember[])=>list.filter(s=>s.role==='Owner' && isActiveStaff(s)).length;
    if(activeOwners(next)>Math.max(1,activeOwners(current))) throw Object.assign(new Error('Only one active Owner is allowed per restaurant.'),{status:403,code:'OWNER_LIMIT_EXCEEDED'});
    const nextCount = nonowners(next);
    if (nextCount <= nonowners(current)) return;
    const sub = await getSubscription(tenantId);
    const limit = getPlanLimits(sub).staffCount;
    if (nextCount > limit) throw Object.assign(new Error(`Your plan supports up to ${limit} active staff members.`), {
      status: 403, code: 'PLAN_LIMIT_EXCEEDED'
    });
  }

  override async add(tenantId: string, item: StaffMember, trx?: DatabaseTransaction): Promise<void> {
    if (!trx) return this.db.runTransaction(tenantId, tx => this.add(tenantId, item, tx));
    const record = { ...item, status: item.status ?? 'active' } as StaffMember;
    await this.assertActiveCapacity(tenantId, [...((await this.getAll(tenantId)) || []), record]);
    if (record.pin) { record.pin = await hashPin(record.pin); item.pin = record.pin; }
    return super.add(tenantId, record, trx);
  }

  override async update(tenantId: string, item: StaffMember, expectedVersion?: number, trx?: DatabaseTransaction): Promise<StaffMember> {
    if (!trx) return this.db.runTransaction(tenantId, tx => this.update(tenantId, item, expectedVersion, tx));
    const current = (await this.getAll(tenantId)) || [];
    await this.assertActiveCapacity(tenantId, current.map(s => s.id === item.id ? { ...s, ...item } : s));
    const record = { ...item };
    if (record.pin) { record.pin = await hashPin(record.pin); item.pin = record.pin; }
    return super.update(tenantId, record, expectedVersion, trx);
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

