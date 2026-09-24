import { BaseRepository, DatabaseTransaction } from "../shared/BaseRepository";
import { StaffMember } from "../../../src/features/shared/types";
import { hashPin, isBcryptHash } from "../auth/PinSecurityService";

export class StaffRepository extends BaseRepository<StaffMember> {
  protected sliceKey = "staffList";

  override async add(tenantId: string, item: StaffMember): Promise<void> {
    if (item && item.pin) {
      item.pin = await hashPin(item.pin);
    }
    return super.add(tenantId, item);
  }

  override async update(tenantId: string, item: StaffMember, expectedVersion?: number): Promise<StaffMember> {
    if (item && item.pin) {
      item.pin = await hashPin(item.pin);
    }
    return super.update(tenantId, item, expectedVersion);
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

    // Default seed lists for known demo tenants if they are not yet in database (All PINs securely pre-hashed with bcrypt)
    if (tenantId === "veg-main-001") {
      const defaultStaff: StaffMember[] = [
        {
          id: "s-rahul",
          name: "Rahul Sharma",
          role: "Owner",
          pin: "$2b$10$.eV6LbBYV68J0EO0MLhLIe5ZE8IBgOYdpvK2GJclRMnMToWZwhUEe", // "11111"
          permissions: ["billing", "inventory", "reports", "settings"]
        },
        {
          id: "s-amit",
          name: "Amit Kumar",
          role: "Manager",
          pin: "$2b$10$pmJPJKtm9Eicw.KWjbWuIeeCqavg3NMmldwRH4rd28S4pFRqik7lC", // "2222"
          permissions: ["billing", "inventory", "reports"]
        },
        {
          id: "s-mohan",
          name: "Mohan Lal",
          role: "Staff",
          pin: "$2b$10$4mW6ViNBwGmmEUjQ.BuATefJF5PracmvcGD44MQiCxLcXKLQQdY8u", // "3333"
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
          pin: "$2b$10$Xx13wGB3RVuvQ/AwqAK7y.gBSVVPiNrt9B8R/JA/dd/pqeWUiuBXq", // "12345"
          permissions: ["billing", "inventory", "reports", "settings"]
        },
        {
          id: "s-amit-reetesh",
          name: "Amit Kumar",
          role: "Manager",
          pin: "$2b$10$pmJPJKtm9Eicw.KWjbWuIeeCqavg3NMmldwRH4rd28S4pFRqik7lC", // "2222"
          permissions: ["billing", "inventory", "reports"]
        },
        {
          id: "s-mohan-reetesh",
          name: "Mohan Lal",
          role: "Staff",
          pin: "$2b$10$4mW6ViNBwGmmEUjQ.BuATefJF5PracmvcGD44MQiCxLcXKLQQdY8u", // "3333"
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
          pin: "$2b$10$cYPW6LNOj2Ui0QPSaKvMLuxLeP7T6yLle3ZhOTt75dwrotTntdX4W", // "22222"
          permissions: ["billing", "inventory", "reports", "settings"]
        },
        {
          id: "s-amit-kumar-cp",
          name: "Amit Kumar",
          role: "Manager",
          pin: "$2b$10$pmJPJKtm9Eicw.KWjbWuIeeCqavg3NMmldwRH4rd28S4pFRqik7lC", // "2222"
          permissions: ["billing", "inventory", "reports"]
        },
        {
          id: "s-mohan-cp",
          name: "Mohan Lal",
          role: "Staff",
          pin: "$2b$10$4mW6ViNBwGmmEUjQ.BuATefJF5PracmvcGD44MQiCxLcXKLQQdY8u", // "3333"
          permissions: ["billing"]
        }
      ];
      await this.saveAll(tenantId, defaultStaff);
      return defaultStaff;
    }

    return list;
  }
}

