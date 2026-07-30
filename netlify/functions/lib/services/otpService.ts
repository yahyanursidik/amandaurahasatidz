interface OtpRecord {
  code: string;
  email: string;
  expiresAt: number;
  attempts: number;
}

const otpStore = new Map<string, OtpRecord>();

export function generateEmailOtp(email: string): string {
  // Generate 6-digit numeric OTP code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const normalizedEmail = email.trim().toLowerCase();
  
  // Store with 5-minute expiry
  otpStore.set(normalizedEmail, {
    code,
    email: normalizedEmail,
    expiresAt: Date.now() + 300000, // 5 minutes
    attempts: 0,
  });

  return code;
}

export function verifyEmailOtp(email: string, code: string): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  const record = otpStore.get(normalizedEmail);

  if (!record) return false;
  if (Date.now() > record.expiresAt) {
    otpStore.delete(normalizedEmail);
    return false;
  }

  record.attempts += 1;
  if (record.attempts > 5) {
    otpStore.delete(normalizedEmail);
    return false;
  }

  if (record.code === code.trim()) {
    otpStore.delete(normalizedEmail);
    return true;
  }

  return false;
}
