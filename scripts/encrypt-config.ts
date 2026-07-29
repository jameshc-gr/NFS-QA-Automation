import { encryptSecret, decryptSecret } from '../mobile/src/utils/crypto-utils';

const command = process.argv[2];
const value = process.argv[3];

if (!command || !value || (command !== 'encrypt' && command !== 'decrypt')) {
  console.log('Usage: npx ts-node scripts/encrypt-config.ts <encrypt|decrypt> <string>');
  console.log('Optional environment variable: CONFIG_ENCRYPTION_KEY');
  process.exit(1);
}

if (command === 'encrypt') {
  console.log('\nEncrypted string:');
  console.log(encryptSecret(value));
} else {
  console.log('\nDecrypted string:');
  console.log(decryptSecret(value));
}
