import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

const DEFAULT_FALLBACK_KEY = 'default-webautomation-secret-key-32';

function getSecretKey(): Buffer {
  const rawKey = process.env.CONFIG_ENCRYPTION_KEY;
  if (!rawKey) {
    // eslint-disable-next-line no-console
    console.warn(
      '\n[SECURITY WARNING] CONFIG_ENCRYPTION_KEY is not set. Using the default fallback key, which provides NO real protection.\n' +
        'Set a strong, unique CONFIG_ENCRYPTION_KEY environment variable and re-encrypt all secrets.\n'
    );
    return crypto.createHash('sha256').update(DEFAULT_FALLBACK_KEY).digest();
  }
  return crypto.createHash('sha256').update(rawKey).digest();
}

export function encryptSecret(text: string): string {
  if (!text) return text;
  const iv = crypto.randomBytes(12);
  const key = getSecretKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return `ENC(${iv.toString('hex')}:${tag}:${encrypted})`;
}

export function decryptSecret(value: string): string {
  if (!value || typeof value !== 'string') return value;

  const match = value.match(/^ENC\(([0-9a-f]+):([0-9a-f]+):([0-9a-f]+)\)$/i);
  if (!match) {
    return value; // Return as plain string if not wrapped in ENC(...)
  }

  const [, ivHex, tagHex, encryptedHex] = match;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const key = getSecretKey();

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export function decryptObjectSecrets<T>(obj: T): T {
  if (typeof obj === 'string') {
    return decryptSecret(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => decryptObjectSecrets(item)) as unknown as T;
  }

  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      result[key] = decryptObjectSecrets(val);
    }
    return result as T;
  }

  return obj;
}
