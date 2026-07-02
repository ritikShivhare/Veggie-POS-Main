import { createClient } from "@supabase/supabase-js";

export class Database {
  private static instance: Database;
  private syncedStatesByTenant: Record<string, any> = {};
  private supabase: any = null;

  private constructor() {}

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  private getSupabaseClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (
      supabaseUrl &&
      supabaseKey &&
      supabaseUrl !== "YOUR_SUPABASE_URL" &&
      supabaseKey !== "YOUR_SUPABASE_ANON_KEY"
    ) {
      if (!this.supabase) {
        try {
          this.supabase = createClient(supabaseUrl, supabaseKey);
        } catch (err) {
          console.error("Error creating Supabase client:", err);
        }
      }
      return this.supabase;
    }
    return null;
  }

  /**
   * Fetches the entire synced state object for a tenant.
   */
  public async getTenantState(tenantId: string): Promise<any> {
    const client = this.getSupabaseClient();
    if (!client) {
      return this.syncedStatesByTenant[tenantId] || null;
    }

    try {
      const { data, error } = await client
        .from("restaurant_sync")
        .select("data")
        .eq("id", `tenant_state_${tenantId}`)
        .maybeSingle();

      if (error) {
        console.warn(`Supabase load warning for tenant ${tenantId} (using local fallback):`, error.message);
        return this.syncedStatesByTenant[tenantId] || null;
      }

      if (data && data.data) {
        this.syncedStatesByTenant[tenantId] = data.data;
      }
    } catch (err) {
      console.error(`Failed to fetch state for tenant ${tenantId} from Supabase:`, err);
    }

    return this.syncedStatesByTenant[tenantId] || null;
  }

  /**
   * Persists the entire synced state object for a tenant.
   */
  public async saveTenantState(tenantId: string, state: any): Promise<void> {
    this.syncedStatesByTenant[tenantId] = state;
    const client = this.getSupabaseClient();
    if (!client) {
      return;
    }

    try {
      const { error } = await client
        .from("restaurant_sync")
        .upsert({
          id: `tenant_state_${tenantId}`,
          data: state,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.warn(`Supabase save warning for tenant ${tenantId} (using local fallback):`, error.message);
      }
    } catch (err) {
      console.error(`Failed to save state for tenant ${tenantId} to Supabase:`, err);
    }
  }

  /**
   * Get an array slice from the tenant state.
   */
  public async getSlice<T>(tenantId: string, sliceKey: string): Promise<T[] | null> {
    const state = await this.getTenantState(tenantId);
    if (!state) return null;
    return state[sliceKey] || [];
  }

  /**
   * Save an array slice back to the tenant state.
   */
  public async saveSlice<T>(tenantId: string, sliceKey: string, data: T[]): Promise<void> {
    const state = (await this.getTenantState(tenantId)) || {};
    state[sliceKey] = data;
    await this.saveTenantState(tenantId, state);
  }

  /**
   * Get an object value from the tenant state.
   */
  public async getObject<T>(tenantId: string, sliceKey: string): Promise<T | null> {
    const state = await this.getTenantState(tenantId);
    if (!state) return null;
    return state[sliceKey] || null;
  }

  /**
   * Save an object value back to the tenant state.
   */
  public async saveObject<T>(tenantId: string, sliceKey: string, data: T): Promise<void> {
    const state = (await this.getTenantState(tenantId)) || {};
    state[sliceKey] = data;
    await this.saveTenantState(tenantId, state);
  }
}
