/**
 * Crest Study Consult — Admin Login OTP (two-factor)
 *
 * Strict, secure one-time passcodes emailed during admin login.
 *
 * Security properties:
 * - 6-digit codes generated with a cryptographically secure RNG.
 * - Codes are stored only as bcrypt hashes (never plaintext).
 * - Short 10-minute expiry, single-use, with a hard per-code attempt cap.
 * - Constant-time verification via bcrypt.
 * - The systems administrator (ADMIN_EMAIL / SYSTEMS_ADMIN_EMAIL) is exempt.
 */

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "./db.server";
import { sendAdminOtpEmail } from "./email.server";
import { SYSTEMS_ADMIN_EMAIL } from "./constants";

export const OTP_LENGTH = 6;
export const OTP_TTL_SECONDS = 10 * 60; // 10 minutes
export const OTP_MAX_ATTEMPTS = 5;
/** Minimum seconds between OTP requests for a user (resend throttle). */
export const OTP_RESEND_COOLDOWN_SECONDS = 30;

/**
 * Whether a given email is exempt from OTP (the systems administrator).
 * Driven by ADMIN_EMAIL, falling back to the canonical systems-admin email.
 */
export function isOtpExempt(email: string): boolean {
  const exempt = (process.env.ADMIN_EMAIL || SYSTEMS_ADMIN_EMAIL).toLowerCase();
  return email.toLowerCase() === exempt;
}

/**
 * Generate a zero-padded numeric OTP using a secure RNG.
 */
function generateCode(): string {
  const max = 10 ** OTP_LENGTH;
  return crypto.randomInt(0, max).toString().padStart(OTP_LENGTH, "0");
}

/**
 * Create and email a fresh OTP for a user.
 *
 * Invalidates any outstanding codes for the user first, so only the latest
 * code is ever valid. Returns whether the email dispatch succeeded.
 */
export async function issueOtp({
  userId,
  email,
  name,
}: {
  userId: string;
  email: string;
  name: string;
}): Promise<{ sent: boolean; cooldown?: number }> {
  // Throttle: refuse if a code was issued very recently.
  const recent = await db.adminOtp.findFirst({
    where: { userId, consumedAt: null },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (recent) {
    const ageSeconds = (Date.now() - recent.createdAt.getTime()) / 1000;
    if (ageSeconds < OTP_RESEND_COOLDOWN_SECONDS) {
      return { sent: false, cooldown: Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - ageSeconds) };
    }
  }

  // Invalidate previous outstanding codes (single active code policy).
  await db.adminOtp.updateMany({
    where: { userId, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

  await db.adminOtp.create({
    data: { userId, codeHash, expiresAt },
  });

  const result = await sendAdminOtpEmail({
    to: email,
    name,
    code,
    expiresMinutes: Math.round(OTP_TTL_SECONDS / 60),
  });

  return { sent: result.success };
}

export type OtpVerifyResult =
  | { ok: true }
  | { ok: false; reason: "expired" | "invalid" | "locked" | "none" };

/**
 * Verify a submitted OTP for a user.
 *
 * Enforces single-use, expiry, and a per-code attempt cap. On success the code
 * is consumed so it cannot be replayed.
 */
export async function verifyOtp(userId: string, submittedCode: string): Promise<OtpVerifyResult> {
  const code = submittedCode.trim();

  const record = await db.adminOtp.findFirst({
    where: { userId, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!record) return { ok: false, reason: "none" };

  if (record.expiresAt.getTime() <= Date.now()) {
    await db.adminOtp.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
    return { ok: false, reason: "expired" };
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    await db.adminOtp.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
    return { ok: false, reason: "locked" };
  }

  const matches = /^\d+$/.test(code) && (await bcrypt.compare(code, record.codeHash));

  if (!matches) {
    const attempts = record.attempts + 1;
    await db.adminOtp.update({
      where: { id: record.id },
      data: {
        attempts,
        // Burn the code once the attempt cap is reached.
        consumedAt: attempts >= OTP_MAX_ATTEMPTS ? new Date() : null,
      },
    });
    return { ok: false, reason: attempts >= OTP_MAX_ATTEMPTS ? "locked" : "invalid" };
  }

  // Success — consume the code.
  await db.adminOtp.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });

  return { ok: true };
}
