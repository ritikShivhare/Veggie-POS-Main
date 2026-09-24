import { describe, it, expect } from "vitest";
import { Database } from "../server/features/shared/database";

describe("Database State Slice Engine Tests", () => {
  it("should retrieve a singleton instance of the database", () => {
    const db1 = Database.getInstance();
    const db2 = Database.getInstance();
    expect(db1).toBe(db2);
  });

  it("should successfully save and retrieve a relational slice data array", async () => {
    const db = Database.getInstance();
    const mockTenantId = "test-tenant-123";
    const mockSliceKey = "ingredients";
    const mockData = [
      { id: "ing-1", name: "Fresh Broccoli", stock: 100 },
      { id: "ing-2", name: "Organic Spinach", stock: 150 }
    ];

    // Save the data slice
    await db.saveSlice(mockTenantId, mockSliceKey, mockData);

    // Retrieve the data slice
    const result = await db.getSlice(mockTenantId, mockSliceKey);
    expect(result).toEqual(mockData);
  });

  it("should return an empty array if a requested slice key has no data", async () => {
    const db = Database.getInstance();
    const mockTenantId = "test-tenant-123";
    const mockSliceKey = "non-existent-slice";

    const result = await db.getSlice(mockTenantId, mockSliceKey);
    expect(result).toEqual([]);
  });

  it("should successfully save and retrieve custom tenant config objects", async () => {
    const db = Database.getInstance();
    const mockTenantId = "test-tenant-123";
    const mockObjectKey = "custom_dashboard_layout";
    const mockConfig = {
      theme: "dark",
      showAnalytics: true,
      refreshIntervalMs: 5000
    };

    // Save the configuration object
    await db.saveObject(mockTenantId, mockObjectKey, mockConfig);

    // Fetch the configuration object
    const result = await db.getObject(mockTenantId, mockObjectKey);
    expect(result).toEqual(mockConfig);
  });

  it("should return null for non-existent objects in database", async () => {
    const db = Database.getInstance();
    const mockTenantId = "test-tenant-123";
    const mockObjectKey = "non_existent_config_object_999";

    const result = await db.getObject(mockTenantId, mockObjectKey);
    expect(result).toBeNull();
  });

  it("should reject writes with 503 DATABASE_UNAVAILABLE and mark cache as stale in production without DB commit confirmation", async () => {
    const db = Database.getInstance();
    const mockTenantId = "prod-tenant-reliability";
    const mockSliceKey = "orders";
    const mockData = [{ id: "order-999", totalAmount: 450 }];

    const originalNodeEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";

      // Should fail loudly and throw DatabaseUnavailableError
      await expect(db.saveSlice(mockTenantId, mockSliceKey, mockData)).rejects.toMatchObject({
        code: "DATABASE_UNAVAILABLE",
        status: 503
      });

      // Slice should be marked as STALE / READONLY
      expect(db.isSliceStale(mockTenantId, mockSliceKey)).toBe(true);

      // saveObject should also fail loudly with 503 in production
      await expect(db.saveObject(mockTenantId, "custom_key", { key: "val" })).rejects.toMatchObject({
        code: "DATABASE_UNAVAILABLE",
        status: 503
      });

      expect(db.isObjectStale(mockTenantId, "custom_key")).toBe(true);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});
