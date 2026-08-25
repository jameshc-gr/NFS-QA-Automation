import assert from 'node:assert/strict';
import { getVerificationCode } from '../mobile/src/utils/verification-service';
import { authSelectors } from '../mobile/src/selectors';
import {
  recordLocatorHistory,
  recordFlakyTest,
  recordHealingHistory,
} from '../mobile/src/utils/memory';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

async function runSanityChecks() {
  console.log('[Sanity] 1. Testing mock verification provider...');
  process.env.MOBILE_VERIFICATION_MODE = 'mock';

  const mockEmailCode = await getVerificationCode('email');
  assert.equal(mockEmailCode, '123456', 'Default mock email code should be 123456');

  const mockSmsCode = await getVerificationCode('phone');
  assert.equal(mockSmsCode, '654321', 'Default mock phone code should be 654321');

  const mockEmailRetry = await getVerificationCode('email', { excludeCodes: ['123456'] });
  assert.equal(mockEmailRetry, '111111', 'Mock retry code should avoid excluded codes');

  console.log('  ✓ Mock verification returns deterministic codes with retry handling');

  console.log('[Sanity] 2. Testing selector registry resolution...');
  process.env.MOBILE_PLATFORM = 'android';
  const androidSelectors = authSelectors();
  assert.ok(androidSelectors.loginButton.length > 0, 'Android login button selectors present');
  assert.ok(androidSelectors.emailInput.length > 0, 'Android email input selectors present');

  process.env.MOBILE_PLATFORM = 'ios';
  const iosSelectors = authSelectors();
  assert.ok(iosSelectors.loginButton.length > 0, 'iOS login button selectors present');
  assert.ok(iosSelectors.emailInput.length > 0, 'iOS email input selectors present');
  console.log('  ✓ Selectors resolve correctly for Android and iOS');

  console.log('[Sanity] 2b. Guarding against string-selector truncation (e.g. accidental [0] indexing)...');
  // Regression guard: several selector-registry fields (e.g. emailVerificationPrompt,
  // smsVerificationPrompt) are plain XPath/accessibility-id strings, not arrays.
  // A caller mistakenly indexing them with [0] silently truncates to a single
  // character (often just "/"), which still type-checks but breaks at runtime.
  // Assert every string field is a full, valid-looking selector.
  for (const [platformName, selectors] of [['android', androidSelectors], ['ios', iosSelectors]] as const) {
    for (const [key, value] of Object.entries(selectors)) {
      if (typeof value === 'string') {
        assert.ok(
          value.length > 2,
          `${platformName} selector "${key}" looks truncated (value: ${JSON.stringify(value)}). ` +
          'Check for accidental [0] indexing on a plain-string selector.'
        );
      }
    }
  }
  console.log('  ✓ No truncated string selectors detected');

  console.log('[Sanity] 3. Testing memory tracking...');
  const testTimestamp = new Date().toISOString();
  recordLocatorHistory({
    timestamp: testTimestamp,
    platform: 'android',
    selectorKey: 'loginButton',
    previousSelectors: ['old-selector'],
    newSelectors: ['new-selector'],
    reason: 'Sanity test verification',
    testFile: 'mobile/tests/android/create-user.spec.ts',
  });

  recordFlakyTest({
    timestamp: testTimestamp,
    testFile: 'mobile/tests/android/create-user.spec.ts',
    testName: 'creates a new user',
    failureType: 'timing',
    rootCause: 'Sanity test test',
    fixApplied: 'poll condition added',
    status: 'resolved',
  });

  recordHealingHistory({
    timestamp: testTimestamp,
    testFile: 'mobile/tests/android/create-user.spec.ts',
    testName: 'creates a new user',
    failureType: 'selector',
    remediation: 'Updated auth.selectors.ts candidate list',
    filesChanged: ['mobile/src/selectors/android/auth.selectors.ts'],
    verificationStatus: 'pass',
  });

  const locatorHistory = JSON.parse(
    readFileSync(path.resolve(process.cwd(), 'memory/locator-history.json'), 'utf8')
  );
  assert.ok(
    locatorHistory.locators.some((e: any) => e.reason === 'Sanity test verification'),
    'Locator history recorded correctly'
  );

  const flakyHistory = JSON.parse(
    readFileSync(path.resolve(process.cwd(), 'memory/flaky-tests.json'), 'utf8')
  );
  assert.ok(
    flakyHistory.flaky.some((e: any) => e.rootCause === 'Sanity test test'),
    'Flaky test memory recorded correctly'
  );

  const healingHistory = JSON.parse(
    readFileSync(path.resolve(process.cwd(), 'memory/healing-history.json'), 'utf8')
  );
  assert.ok(
    healingHistory.history.some((e: any) => e.failureType === 'selector'),
    'Healing history recorded correctly'
  );

  console.log('  ✓ Memory tracking correctly writes and reads JSON logs');

  console.log('[Sanity] 4. Testing stepCheckpoint and mustPassStep...');
  const { stepCheckpoint, mustPassStep } = await import('../mobile/src/utils/step-checkpoint');

  let actionExecuted = false;
  const checkpointResult = await stepCheckpoint({
    name: 'Sanity action step',
    action: async () => {
      actionExecuted = true;
      return 42;
    },
    expectedState: async () => true,
  });
  assert.equal(checkpointResult.success, true, 'Checkpoint should succeed');
  assert.equal(checkpointResult.value, 42, 'Checkpoint should return action value');
  assert.equal(actionExecuted, true, 'Action should have executed');

  const mustPassValue = await mustPassStep({
    name: 'Must pass step test',
    action: async () => 'ok',
  });
  assert.equal(mustPassValue, 'ok', 'mustPassStep should return action value');
  console.log('  ✓ stepCheckpoint and mustPassStep validated');

  console.log('\n[Sanity] All mobile framework sanity checks passed successfully!\n');
}

runSanityChecks().catch((err) => {
  console.error('[Sanity] FAILED:', err);
  process.exit(1);
});
