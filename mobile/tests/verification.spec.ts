import { extractCodeFromText } from '../src/utils/verification/google-voice';

describe('Verification utilities', () => {
  it('should extract verification codes from plain text correctly', () => {
    const text1 = 'Your security verification code is 849201. Do not share it.';
    const text2 = 'Your verification code is 103902';

    if (extractCodeFromText(text1) !== '849201') {
      throw new Error('Failed to extract 6-digit code');
    }

    if (extractCodeFromText(text2) !== '103902') {
      throw new Error('Failed to extract 6-digit code with expected phrase');
    }
  });
});
