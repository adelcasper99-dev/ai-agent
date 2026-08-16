import crypto from 'crypto';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_PREFIX = 'enc:v1:';
const IV_LENGTH = 12; // 96 bits standard for AES-GCM
const TAG_LENGTH = 16; // 128 bits auth tag

/**
 * Derives a 32-byte cryptographic key from environment secrets.
 */
function getEncryptionKey(): Buffer {
  const secret =
    process.env.INTERNAL_SERVICE_SECRET ||
    process.env.JWT_SECRET ||
    process.env.INTERNAL_API_KEY ||
    'casper-default-dev-secret-key-32';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a string using AES-256-GCM with a fresh random IV per invocation.
 * Output format: `enc:v1:<ivHex>:<tagHex>:<ciphertextHex>`
 */
export function encryptField(plaintext: string): string {
  if (!plaintext || typeof plaintext !== 'string') {
    return plaintext;
  }
  // Idempotent: don't double-encrypt
  if (plaintext.startsWith(ENCRYPTION_PREFIX)) {
    return plaintext;
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted payload (`enc:v1:...`).
 * If the input is not encrypted (e.g. legacy plaintext), returns it as-is (fail-safe / zero-downtime).
 */
export function decryptField(ciphertext: string): string {
  if (!ciphertext || typeof ciphertext !== 'string') {
    return ciphertext;
  }
  if (!ciphertext.startsWith(ENCRYPTION_PREFIX)) {
    return ciphertext; // Plaintext fallback
  }

  try {
    const rawPayload = ciphertext.slice(ENCRYPTION_PREFIX.length);
    const [ivHex, tagHex, dataHex] = rawPayload.split(':');

    if (!ivHex || !tagHex || !dataHex) {
      return ciphertext;
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');
    const key = getEncryptionKey();

    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(dataHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[Crypto] Failed to decrypt field:', err);
    return ciphertext;
  }
}

/**
 * Resolves a list of Setting records from the database, decrypting any encrypted fields.
 */
export function resolveDecryptedSettings(rows: Array<{ key: string; value: string }>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of rows) {
    if (row.value) {
      map[row.key] = decryptField(row.value);
    }
  }
  return map;
}

/**
 * Redacts an API key or sensitive secret for safe administrative UI display.
 * Example: `AIzaSyD...8xY2` or `gsk_...9aZ1`
 */
export function maskSecret(secret: string): string {
  if (!secret || typeof secret !== 'string') {
    return '';
  }

  // If encrypted, decrypt before masking
  const plain = secret.startsWith(ENCRYPTION_PREFIX) ? decryptField(secret) : secret;
  if (!plain) return '';

  const len = plain.length;
  if (len <= 8) {
    return '****';
  }
  const start = plain.slice(0, 4);
  const end = plain.slice(-4);
  return `${start}...${end}`;
}
