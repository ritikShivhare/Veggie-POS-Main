import bcrypt from "bcryptjs";
import crypto from "crypto";
import { StaffMember } from "../../../src/features/shared/types";

// Pre-computed dummy hash to prevent timing attacks on empty or non-existent staff lists
const DUMMY_BCRYPT_HASH = "$2b$10$pmJPJKtm9Eicw.KWjbWuIeeCqavg3NMmldwRH4rd28S4pFRqik7lC";

/**
 * Validates if a string is already formatted as a standard bcrypt hash.
 */
export function isBcryptHash(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return false;
  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
}

/**
 * Asynchronously hashes a plaintext PIN using bcrypt with a salt factor of 10.
 * If the PIN is already a bcrypt hash, it is returned untouched (idempotent).
 */
export async function hashPin(pin: string): Promise<string> {
  if (!pin || typeof pin !== "string") return pin;
  if (isBcryptHash(pin)) return pin;
  return bcrypt.hash(pin, 10);
}

/**
 * Synchronous variant of hashPin for constructors or pre-seed configs.
 */
export function hashPinSync(pin: string): string {
  if (!pin || typeof pin !== "string") return pin;
  if (isBcryptHash(pin)) return pin;
  return bcrypt.hashSync(pin, 10);
}

/**
 * Constant-time comparison between two strings to prevent timing attacks.
 * Hashes inputs with SHA-256 first so both buffers have fixed 32-byte length,
 * completely preventing timing leaks on string lengths.
 */
export function constantTimeStringCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const hashA = crypto.createHash("sha256").update(a).digest();
  const hashB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Verifies an entered PIN against a stored PIN value (bcrypt hash or legacy plaintext).
 * Uses bcrypt.compare for hashes (which operates in constant time) and
 * constantTimeStringCompare for legacy plaintext.
 */
export async function verifyPin(inputPin: string, storedHashOrPlain: string): Promise<boolean> {
  if (!inputPin || !storedHashOrPlain) return false;

  if (isBcryptHash(storedHashOrPlain)) {
    return bcrypt.compare(inputPin, storedHashOrPlain);
  }

  // Constant-time check for legacy unmigrated plaintext PINs
  return constantTimeStringCompare(inputPin, storedHashOrPlain);
}

/**
 * Performs a constant-time search across a staff collection for a matching PIN.
 * Loops through the full array without breaking early to avoid timing attacks.
 */
export async function findStaffByPinConstantTime(
  staffList: StaffMember[],
  inputPin: string
): Promise<StaffMember | null> {
  if (!inputPin || typeof inputPin !== "string") return null;

  if (!staffList || staffList.length === 0) {
    // Perform a dummy bcrypt comparison to ensure consistent elapsed time
    await bcrypt.compare(inputPin, DUMMY_BCRYPT_HASH);
    return null;
  }

  let matchedStaff: StaffMember | null = null;

  for (const member of staffList) {
    const isMatch = await verifyPin(inputPin, member.pin);
    if (isMatch && !matchedStaff) {
      matchedStaff = member;
    }
  }

  return matchedStaff;
}

/**
 * Verifies Master Verification Code with constant-time check.
 * Strictly requires the MASTER_VERIFICATION_CODE environment variable.
 * Does NOT provide any hardcoded default fallback.
 */
export function verifyMasterVerificationCode(inputCode: string): boolean {
  const masterSecret = process.env.MASTER_VERIFICATION_CODE;
  // If the environment variable is not configured or input is missing, reject immediately.
  if (!masterSecret || !masterSecret.trim() || !inputCode) {
    return false;
  }
  return constantTimeStringCompare(inputCode.trim(), masterSecret.trim());
}
