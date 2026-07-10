import { BaseRepository } from "../shared/BaseRepository";
import { StaffMember } from "../../../src/features/shared/types";

export class StaffRepository extends BaseRepository<StaffMember> {
  protected sliceKey = "staffList";

  override async getAll(tenantId: string): Promise<StaffMember[] | null> {
    const list = await super.getAll(tenantId);
    if (list && list.length > 0) {
      return list;
    }

    // Default seed lists for known demo tenants if they are not yet in database
    if (tenantId === "veg-main-001") {
      const defaultStaff: StaffMember[] = [
        {
          id: "s-rahul",
          name: "Rahul Sharma",
          role: "Owner",
          pin: "11111",
          permissions: ["billing", "inventory", "reports", "settings"]
        },
        {
          id: "s-amit",
          name: "Amit Kumar",
          role: "Manager",
          pin: "2222",
          permissions: ["billing", "inventory", "reports"]
        },
        {
          id: "s-mohan",
          name: "Mohan Lal",
          role: "Staff",
          pin: "3333",
          permissions: ["billing"]
        }
      ];
      await this.saveAll(tenantId, defaultStaff);
      return defaultStaff;
    }

    if (tenantId === "veg-reetesh-dhaba") {
      const defaultStaff: StaffMember[] = [
        {
          id: "s-reetesh-dhaba",
          name: "Reetesh",
          role: "Owner",
          pin: "12345",
          permissions: ["billing", "inventory", "reports", "settings"]
        },
        {
          id: "s-amit-reetesh",
          name: "Amit Kumar",
          role: "Manager",
          pin: "2222",
          permissions: ["billing", "inventory", "reports"]
        },
        {
          id: "s-mohan-reetesh",
          name: "Mohan Lal",
          role: "Staff",
          pin: "3333",
          permissions: ["billing"]
        }
      ];
      await this.saveAll(tenantId, defaultStaff);
      return defaultStaff;
    }

    if (tenantId === "veg-cp-002") {
      const defaultStaff: StaffMember[] = [
        {
          id: "s-amit-cp",
          name: "Amit Verma",
          role: "Owner",
          pin: "22222",
          permissions: ["billing", "inventory", "reports", "settings"]
        },
        {
          id: "s-amit-kumar-cp",
          name: "Amit Kumar",
          role: "Manager",
          pin: "2222",
          permissions: ["billing", "inventory", "reports"]
        },
        {
          id: "s-mohan-cp",
          name: "Mohan Lal",
          role: "Staff",
          pin: "3333",
          permissions: ["billing"]
        }
      ];
      await this.saveAll(tenantId, defaultStaff);
      return defaultStaff;
    }

    return list;
  }
}

