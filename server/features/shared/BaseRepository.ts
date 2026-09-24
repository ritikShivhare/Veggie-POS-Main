import { Database, OptimisticLockConflictError, DatabaseTransaction, TransactionRollbackError } from "./database";
export { OptimisticLockConflictError, TransactionRollbackError };
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

  async add(tenantId: string, item: T): Promise<void> {
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
    await this.saveAll(tenantId, items);
  }

  /**
   * Updates an item conditionally using optimistic locking:
   * Requires WHERE id = ? AND version = ?
   * If version mismatch or record changed concurrently, rejects with 409 CONFLICT.
   * Increments version on confirmed update.
   */
  async update(tenantId: string, item: T, expectedVersion?: number): Promise<T> {
    const idVal = item[this.idKey];
    return await this.db.updateItem<T>(tenantId, this.sliceKey, idVal, item, expectedVersion);
  }

  /**
   * Helper method to perform conditional update by id and expected version
   */
  async updateConditional(tenantId: string, id: KeyType, updates: Partial<T>, expectedVersion: number): Promise<T> {
    const current = await this.getById(tenantId, id);
    if (!current) {
      throw new Error(`Item not found for id '${String(id)}' in '${this.sliceKey}'`);
    }
    return await this.update(tenantId, { ...current, ...updates } as T, expectedVersion);
  }

  async delete(tenantId: string, id: KeyType): Promise<void> {
    const existing = (await this.getAll(tenantId)) || [];
    const filtered = existing.filter(i => (i[this.idKey] as any) !== id);
    await this.saveAll(tenantId, filtered);
  }
}
