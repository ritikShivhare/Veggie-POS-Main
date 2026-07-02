import { Database } from "./database";

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

  async saveAll(tenantId: string, items: T[]): Promise<void> {
    await this.db.saveSlice<T>(tenantId, this.sliceKey, items);
  }

  async getById(tenantId: string, id: KeyType): Promise<T | null> {
    const items = await this.getAll(tenantId);
    if (!items) return null;
    return items.find(item => (item[this.idKey] as any) === id) || null;
  }

  async add(tenantId: string, item: T): Promise<void> {
    const items = (await this.getAll(tenantId)) || [];
    items.push(item);
    await this.saveAll(tenantId, items);
  }

  async update(tenantId: string, item: T): Promise<void> {
    const items = (await this.getAll(tenantId)) || [];
    const index = items.findIndex(i => i[this.idKey] === item[this.idKey]);
    if (index !== -1) {
      items[index] = item;
      await this.saveAll(tenantId, items);
    }
  }

  async delete(tenantId: string, id: KeyType): Promise<void> {
    const items = (await this.getAll(tenantId)) || [];
    const filtered = items.filter(i => (i[this.idKey] as any) !== id);
    await this.saveAll(tenantId, filtered);
  }
}
