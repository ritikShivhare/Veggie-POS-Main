import { Database, DatabaseTransaction } from "./database";
import { InventorySettings } from "../../../src/features/shared/types";

export class SettingsRepository {
  private db: Database;

  constructor() {
    this.db = Database.getInstance();
  }

  async get(tenantId: string): Promise<InventorySettings | null> {
    return this.db.getObject<InventorySettings>(tenantId, "settings");
  }

  async save(tenantId: string, settings: InventorySettings, trx?: DatabaseTransaction): Promise<void> {
    if (trx) {
      await trx.saveObject<InventorySettings>("settings", settings);
    } else {
      await this.db.saveObject<InventorySettings>(tenantId, "settings", settings);
    }
  }
}
