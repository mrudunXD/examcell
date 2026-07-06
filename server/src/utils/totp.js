import crypto from 'crypto';

function base32tohex(base32) {
  const base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  let hex = "";
  for (let i = 0; i < base32.length; i++) {
    const val = base32chars.indexOf(base32.charAt(i).toUpperCase());
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  for (let i = 0; i + 4 <= bits.length; i += 4) {
    const chunk = bits.substring(i, i + 4);
    hex = hex + parseInt(chunk, 2).toString(16);
  }
  return hex;
}

export function generateSecret(length = 16) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let secret = "";
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    secret += chars[randomBytes[i] % chars.length];
  }
  return secret;
}

export function getOTPAuthURL(label, secret, issuer = 'MIT WPU ExamCell') {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
}

export function verifyTOTP(token, secret) {
  if (!token || !secret) return false;
  try {
    const hex = base32tohex(secret);
    const key = Buffer.from(hex, 'hex');
    
    // Check current time window, previous window, and next window to allow time drift
    const epoch = Math.round(new Date().getTime() / 1000.0);
    const timeStep = 30;
    const currentCounter = Math.floor(epoch / timeStep);
    
    for (let i = -1; i <= 1; i++) {
      const counter = currentCounter + i;
      // Convert counter to 8-byte hex buffer
      let counterHex = counter.toString(16).padStart(16, '0');
      const counterBuffer = Buffer.from(counterHex, 'hex');
      
      const hmac = crypto.createHmac('sha1', key);
      hmac.update(counterBuffer);
      const hmacResult = hmac.digest();
      
      // Dynamic truncation
      const offset = hmacResult[hmacResult.length - 1] & 0xf;
      const code = (
        ((hmacResult[offset] & 0x7f) << 24) |
        ((hmacResult[offset + 1] & 0xff) << 16) |
        ((hmacResult[offset + 2] & 0xff) << 8) |
        (hmacResult[offset + 3] & 0xff)
      ) % 1000000;
      
      if (code.toString().padStart(6, '0') === String(token).trim()) {
        return true;
      }
    }
  } catch (err) {
    console.error('Error verifying TOTP:', err);
  }
  return false;
}
