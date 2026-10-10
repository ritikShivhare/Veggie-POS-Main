import { Database, OptimisticLockConflictError, DatabaseTransaction, TransactionRollbackError, NotFoundError } from "./database";
export { OptimisticLockConflictError, TransactionRollbackError, NotFoundError };
export type { DatabaseTransaction };

export abstract class BaseRepository<T, KeyType = string> {
  protected db: Database;
  protected abstract sliceKey: string;
  protected idKey: keyof T = "id" as keyof T;

  constructor() {
    this.db = Database.getInstance();
  }

  async getAll(tenantId: string): Promise<T[] | null> {
    return this.db.getSlice<T>(tenantId, this.sliceKey);
  }

  async saveAll(tenantId: string, items: T[], trx?: DatabaseTransaction): Promise<void> {
    if (trx) {
      await trx.saveSlice<T>(this.sliceKey, items);
    } else {
      await this.db.saveSlice<T>(tenantId, this.sliceKey, items);
    }
  }

  async getById(tenantId: string, id: KeyType): Promise<T | null> {
    const items = await this.getAll(tenantId);
    if (!items) return null;
    return items.find(item => (item[this.idKey] as any) === id) || null;
  }

  async get(tenantId: string, id: KeyType): Promise<T | null> {
    return this.getById(tenantId, id);
  }

  async save(tenantId: string, item: T, trx?: DatabaseTransaction): Promise<void> {
    const existing = await this.getById(tenantId, item[this.idKey] as any);
    if (existing) {
      await this.update(tenantId, item, undefined, trx);
    } else {
      await this.add(tenantId, item, trx);
    }
  }

  async add(tenantId: string, item: T, trx?: DatabaseTransaction): Promise<void> {
    const existing = (await this.getAll(tenantId)) || [];
    const items = [...existing];
    const record = { ...item } as any;
    if (record.version === undefined) {
      record.version = 1;
    }
    if (!record.updated_at) {
      record.updated_at = new Date().toISOString();
    }
    items.push(record);
    await this.saveAll(tenantId, items, trx);
  }

  /**
   * Updates an item conditionally using optimistic locking:
   * Requires WHERE id = ? AND version = ?
   * If version mismatch or record changed concurrently, rejects with 409 CONFLICT.
   * Increments version on confirmed update.
   */
  async update(tenantId: string, item: T, expectedVersion?: number, trx?: DatabaseTransaction): Promise<T> {
    if (trx) {
      const existing = (await this.getAll(tenantId)) || [];
      const items = [...existing];
      const idVal = item[this.idKey];
      const index = items.findIndex(i => (i[this.idKey] as any) === idVal);
      if (index === -1) {
        throw new NotFoundError(`Resource with ${String(this.idKey)} '${String(idVal)}' not found in table '${this.sliceKey}' for tenant '${tenantId}'.`);
      }
      const currentVer = typeof (items[index] as any).version === "number" ? (items[index] as any).version : 1;
      const targetExpectedVer = expectedVersion !== undefined ? expectedVersion : (item as any).version;
      if (targetExpectedVer !== undefined && targetExpectedVer !== currentVer) {
        throw new OptimisticLockConflictError(
          `Optimistic lock conflict on table '${this.sliceKey}' for ${String(this.idKey)} '${String(idVal)}': expected version was ${targetExpectedVer}, but current version is ${currentVer}.`,
          { entityId: String(idVal), expectedVersion: targetExpectedVer, currentVersion: currentVer }
        );
      }
      const updatedRecord = {
        ...item,
        version: currentVer + 1,
        updated_at: new Date().toISOString()
      };
      items[index] = updatedRecord;
      await trx.saveSlice<T>(this.sliceKey, items);
      return updatedRecord;
    }
    const idVal = item[this.idKey];
    return await this.db.updateItem<T>(tenantId, this.sliceKey, idVal, item, expectedVersion);
  }

  /**
   * Helper method to perform conditional update by id and expected version
   */
  async updateConditional(tenantId: string, id: KeyType, updates: Partial<T>, expectedVersion: number, trx?: DatabaseTransaction): Promise<T> {
    const current = await this.getById(tenantId, id);
    if (!current) {
      throw new Error(`Item not found for id '${String(id)}' in '${this.sliceKey}'`);
    }
    return await this.update(tenantId, { ...current, ...updates } as T, expectedVersion, trx);
  }

  async delete(tenantId: string, id: KeyType, trx?: DatabaseTransaction): Promise<void> {
    const existing = (await this.getAll(tenantId)) || [];
    const exists = existing.some(i => (i[this.idKey] as any) === id);
    if (!exists) {
      throw new NotFoundError(`Resource with ${String(this.idKey)} '${String(id)}' not found in table '${this.sliceKey}' for tenant '${tenantId}'.`);
    }
    const filtered = existing.filter(i => (i[this.idKey] as any) !== id);
    await this.saveAll(tenantId, filtered, trx);
  }
}
