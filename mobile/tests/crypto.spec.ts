import { encryptSecret, decryptSecret, decryptObjectSecrets } from '../src/utils/crypto-utils';

describe('Config secret encryption & decryption', () => {
  it('should encrypt and decrypt a secret value correctly', () => {
    const rawSecret = 'MySuperSecretPassword!2026';
    const encrypted = encryptSecret(rawSecret);

    if (!encrypted.startsWith('ENC(')) {
      throw new Error('Encrypted string should start with ENC(');
    }

    const decrypted = decryptSecret(encrypted);
    if (decrypted !== rawSecret) {
      throw new Error(`Expected ${rawSecret}, got ${decrypted}`);
    }
  });

  it('should recursively decrypt object fields', () => {
    const rawSecret = 'SecretCode123';
    const encrypted = encryptSecret(rawSecret);

    const configObj = {
      user: 'plainUser',
      googleVoice: {
        password: encrypted,
      },
    };

    const decryptedObj = decryptObjectSecrets(configObj);
    if (decryptedObj.googleVoice.password !== rawSecret) {
      throw new Error('Nested encrypted field was not decrypted');
    }
    if (decryptedObj.user !== 'plainUser') {
      throw new Error('Plain field was improperly altered');
    }
  });
});
