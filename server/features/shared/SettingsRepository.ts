import { Database } from "./database";
import { InventorySettings } from "../../../src/features/shared/types";

export class SettingsRepository {
  private db: Database;

  constructor() {
    this.db = Database.getInstance();
  }

  async get(tenantId: string): Promise<InventorySettings | null> {
    return this.db.getObject<InventorySettings>(tenantId, "settings");
  }

  async save(tenantId: string, settings: InventorySettings): Promise<void> {
    await this.db.saveObject<InventorySettings>(tenantId, "settings", settings);
  }
}
