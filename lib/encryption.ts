import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 characters (32 bytes hex encoded)');
  }

  return Buffer.from(key, 'hex');
}

export function encryptCredentials(password: string): { encrypted: string; encryptionKeyId: string } {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  const encryptedData = {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    encrypted: encrypted
  };

  const encryptionKeyId = process.env.ENCRYPTION_KEY_ID || 'default';

  return {
    encrypted: JSON.stringify(encryptedData),
    encryptionKeyId
  };
}

export function decryptCredentials(encryptedData: string, encryptionKeyId: string): string {
  const key = getEncryptionKey();

  let data: { iv: string; authTag: string; encrypted: string };
  try {
    data = JSON.parse(encryptedData);
  } catch {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(data.iv, 'hex');
  const authTag = Buffer.from(data.authTag, 'hex');
  const encrypted = data.encrypted;

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
