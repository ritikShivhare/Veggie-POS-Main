import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  hashPin,
  hashPinSync,
  isBcryptHash,
  verifyPin,
  constantTimeStringCompare,
  findStaffByPinConstantTime,
  verifyMasterVerificationCode
} from "../server/features/auth/PinSecurityService";
import { StaffRepository } from "../server/features/staff/StaffRepository";
import { StaffMember } from "../src/features/shared/types";

describe("PIN Security & Master Secret Verification Tests", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("PIN Hashing with Bcrypt", () => {
    it("should hash a plaintext PIN into a valid bcrypt hash", async () => {
      const plaintextPin = "54321";
      const hash = await hashPin(plaintextPin);

      expect(hash).not.toEqual(plaintextPin);
      expect(isBcryptHash(hash)).toBe(true);
      expect(hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$")).toBe(true);
    });

    it("should be idempotent and not re-hash an already-hashed PIN", async () => {
      const plaintextPin = "11223";
      const firstHash = await hashPin(plaintextPin);
      const secondHash = await hashPin(firstHash);

      expect(secondHash).toBe(firstHash);
    });

    it("should provide synchronous hashPinSync for pre-seed configs", () => {
      const plaintextPin = "9988";
      const hash = hashPinSync(plaintextPin);

      expect(isBcryptHash(hash)).toBe(true);
    });
  });

  describe("Constant-Time String & PIN Verification", () => {
    it("should verify valid PIN against bcrypt hash", async () => {
      const pin = "4567";
      const hash = await hashPin(pin);

      const isValid = await verifyPin(pin, hash);
      expect(isValid).toBe(true);
    });

    it("should reject incorrect PIN against bcrypt hash", async () => {
      const pin = "4567";
      const hash = await hashPin(pin);

      const isValid = await verifyPin("9999", hash);
      expect(isValid).toBe(false);
    });

    it("should verify legacy plaintext PIN in constant time", async () => {
      const legacyPlaintext = "8888";
      const isValid = await verifyPin("8888", legacyPlaintext);
      expect(isValid).toBe(true);

      const isInvalid = await verifyPin("0000", legacyPlaintext);
      expect(isInvalid).toBe(false);
    });

    it("constantTimeStringCompare should compare strings safely", () => {
      expect(constantTimeStringCompare("SecretCode123", "SecretCode123")).toBe(true);
      expect(constantTimeStringCompare("SecretCode123", "WrongCode456")).toBe(false);
      expect(constantTimeStringCompare("SecretCode123", "SecretCode1234")).toBe(false);
    });
  });

  describe("Multi-Staff Constant-Time PIN Search", () => {
    it("should find the matching staff member by hashed PIN", async () => {
      const staffList: StaffMember[] = [
        {
          id: "s-1",
          name: "Rahul",
          role: "Owner",
          pin: await hashPin("11111"),
          permissions: ["billing", "inventory", "settings"]
        },
        {
          id: "s-2",
          name: "Amit",
          role: "Manager",
          pin: await hashPin("2222"),
          permissions: ["billing", "inventory"]
        },
        {
          id: "s-3",
          name: "Mohan",
          role: "Staff",
          pin: await hashPin("3333"),
          permissions: ["billing"]
        }
      ];

      const foundManager = await findStaffByPinConstantTime(staffList, "2222");
      expect(foundManager).not.toBeNull();
      expect(foundManager?.id).toBe("s-2");
      expect(foundManager?.name).toBe("Amit");
    });

    it("should return null for invalid PIN without timing anomalies", async () => {
      const staffList: StaffMember[] = [
        {
          id: "s-1",
          name: "Rahul",
          role: "Owner",
          pin: await hashPin("11111"),
          permissions: ["billing"]
        }
      ];

      const result = await findStaffByPinConstantTime(staffList, "00000");
      expect(result).toBeNull();
    });

    it("should handle empty staff list safely and return null", async () => {
      const result = await findStaffByPinConstantTime([], "1234");
      expect(result).toBeNull();
    });
  });

  describe("Master Verification Code - Removal of Hardcoded Default", () => {
    it("MUST reject verification when MASTER_VERIFICATION_CODE is not set in env (NO hardcoded fallback)", () => {
      delete process.env.MASTER_VERIFICATION_CODE;

      // Old hardcoded fallback "VEGGIE-SUPER-ADMIN-2026" must NOT work!
      expect(verifyMasterVerificationCode("VEGGIE-SUPER-ADMIN-2026")).toBe(false);
      expect(verifyMasterVerificationCode("ANY_CODE")).toBe(false);
      expect(verifyMasterVerificationCode("")).toBe(false);
    });

    it("should allow verification only when MASTER_VERIFICATION_CODE is explicitly configured in environment", () => {
      process.env.MASTER_VERIFICATION_CODE = "PROD-SECRET-ENV-KEY-9876";

      expect(verifyMasterVerificationCode("PROD-SECRET-ENV-KEY-9876")).toBe(true);
      expect(verifyMasterVerificationCode("WRONG-KEY")).toBe(false);
      expect(verifyMasterVerificationCode("VEGGIE-SUPER-ADMIN-2026")).toBe(false);
    });
  });

  describe("StaffRepository Automatic PIN Hashing", () => {
    it("should automatically hash PIN when saving or updating staff", async () => {
      const repo = new StaffRepository();
      const newStaff: StaffMember = {
        id: "s-test-new",
        name: "Test Waiter",
        role: "Staff",
        pin: "5678", // Plaintext
        permissions: ["billing"]
      };

      await repo.add("test-tenant-hash", newStaff);
      expect(isBcryptHash(newStaff.pin)).toBe(true);
      expect(newStaff.pin).not.toBe("5678");

      // Verify the hashed PIN works with verifyPin
      const match = await verifyPin("5678", newStaff.pin);
      expect(match).toBe(true);
    });
  });
});
