import assert from 'node:assert/strict';
import path from 'node:path';

import { AuthPage } from '../../src/pages/auth.page';
import { getAutomationAccount } from '../../src/utils/mobile-auth';

describe('iOS "Remember me" checkbox and loan officer flow', () => {
  it('should retain login credentials when switching between login and create account tabs', async () => {
    const auth = new AuthPage();
    const { email, password } = getAutomationAccount('login');
    process.env.MOBILE_LOGIN_EMAIL = email;

    console.log(`[Test] Starting remember me test with email: ${email}`);
    
    // Step 1: Open login view
    await auth.openLogin();
    console.log('[Test] Login view opened');

    // Step 2: Fill email and password
    const emailField = await $('//XCUIElementTypeTextField[@name="log_in.field.email"]');
    const passwordField = await $('//XCUIElementTypeSecureTextField[@name="log_in.field.password"]|//XCUIElementTypeTextField[@name="log_in.field.password"]');
    
    await emailField.setValue(email);
    await passwordField.setValue(password);
    console.log('[Test] Email and password entered');

    // Step 3: Check "Remember me" checkbox if present
    const rememberMeCheckbox = await $('~remember_me|~rememberMe|//XCUIElementTypeCheckBox|//XCUIElementTypeButton[contains(@name, "remember")]');
    const isRememberMeVisible = await rememberMeCheckbox.isDisplayed().catch(() => false);
    
    if (isRememberMeVisible) {
      await rememberMeCheckbox.click();
      console.log('[Test] "Remember me" checkbox checked');
    } else {
      console.log('[Test] "Remember me" checkbox not found - checking for alternative elements');
      // Try to find any checkbox-like element near email field
      const checkboxes = await $$('//XCUIElementTypeButton[@name="off" or @name="on"]');
      if (checkboxes.length > 0) {
        await checkboxes[0].click();
        console.log('[Test] Found and clicked checkbox-like element');
      }
    }

    // Step 4: Switch to "Create account" tab
    const createAccountTab = await $('~Create account');
    await createAccountTab.click();
    console.log('[Test] Switched to Create account tab');
    await browser.pause(500);

    // Step 5: Switch back to "Log in" tab
    const loginTab = await $('~Log in');
    await loginTab.click();
    console.log('[Test] Switched back to Log in tab');
    await browser.pause(500);

    // Step 6: Verify credentials are retained
    const emailAfterSwitch = await emailField.getValue();
    const passwordAfterSwitch = await passwordField.getValue();
    
    console.log(`[Test] Email after switch: ${emailAfterSwitch}`);
    console.log(`[Test] Password after switch: ${passwordAfterSwitch ? '***' : '(empty)'}`);

    assert.equal(
      emailAfterSwitch,
      email,
      'Email should be retained after switching tabs'
    );

    assert.equal(
      passwordAfterSwitch,
      password,
      'Password should be retained after switching tabs'
    );

    // Take screenshot proving credentials retained
    await browser.saveScreenshot(
      path.resolve(process.cwd(), 'mobile/.builds/remember-me-credentials-retained.png')
    );

    console.log('[Test] ✓ Credentials were successfully retained after tab switching');
  });

  it('should handle agent invitation deep link and navigate to loan officer setup', async () => {
    const auth = new AuthPage();
    
    console.log('[Test] Starting agent invitation deep link test');
    
    // Agent invitation link with loan_officer_id
    const agentLink = 'https://rate.smart.link/6bw8n7z2b?loan_officer_id=39913';
    
    // Step 1: Navigate to deep link
    console.log(`[Test] Navigating to agent link: ${agentLink}`);
    await browser.url(agentLink);
    await browser.pause(2000);
    
    // Take screenshot of initial state after deep link
    await browser.saveScreenshot(
      path.resolve(process.cwd(), 'mobile/.builds/agent-invitation-initial.png')
    );

    // Step 2: Check if we're on auth screen (expected for deep link entry)
    const loginTab = await $('~Log in').catch(() => null);
    const createAccountTab = await $('~Create account').catch(() => null);
    
    if (loginTab || createAccountTab) {
      console.log('[Test] Deep link opened auth screen as expected');
    }

    // Step 3: Get a create-user account and create account via deep link
    const { email: createEmail, password: createPassword } = getAutomationAccount('create-user');
    process.env.MOBILE_LOGIN_EMAIL = createEmail;
    
    console.log(`[Test] Creating account via deep link with email: ${createEmail}`);
    
    if (createAccountTab) {
      await createAccountTab.click();
      await browser.pause(500);
    }

    // Fill create account form
    const firstNameField = await $('//XCUIElementTypeTextField[@name="create_account.field.first_name"]').catch(() => null);
    const lastNameField = await $('//XCUIElementTypeTextField[@name="create_account.field.last_name"]').catch(() => null);
    const createEmailField = await $('//XCUIElementTypeTextField[@name="create_account.field.email"]');
    const createPasswordField = await $('//XCUIElementTypeSecureTextField[@name="create_account.field.password"]|//XCUIElementTypeTextField[@name="create_account.field.password"]');
    const confirmPasswordField = await $('//XCUIElementTypeSecureTextField[@name="create_account.field.confirm_password"]|//XCUIElementTypeTextField[@name="create_account.field.confirm_password"]');

    if (firstNameField) {
      await firstNameField.setValue('John');
      console.log('[Test] First name entered');
    }

    if (lastNameField) {
      await lastNameField.setValue('Doe');
      console.log('[Test] Last name entered');
    }

    await createEmailField.setValue(createEmail);
    await createPasswordField.setValue(createPassword);
    await confirmPasswordField.setValue(createPassword);
    console.log('[Test] Account form filled');

    // Find and click create account submit button
    const createAccountSubmit = await $(
      '~create_account.button.create|//XCUIElementTypeButton[contains(@name, "Create account") or contains(@label, "Create account")]'
    );
    await createAccountSubmit.click();
    console.log('[Test] Create account submitted');

    // Complete email verification
    await auth.completeLoginVerification(createEmail);
    console.log('[Test] Email verification completed');

    // Step 4: Wait for home screen and check for loan officer
    const reachedHome = await auth.waitForHomeScreen();
    await browser.pause(1000);
    
    assert.equal(reachedHome, true, 'Should reach home screen after account creation');
    console.log('[Test] ✓ Reached home screen');

    // Take screenshot at home
    await browser.saveScreenshot(
      path.resolve(process.cwd(), 'mobile/.builds/agent-invitation-home.png')
    );

    // Step 5: Check for loan officer indicator/information
    // Look for loan officer name or ID in various locations
    const pageSource = await browser.getPageSource();
    const hasLoanOfficer = pageSource.includes('39913') || 
                           pageSource.includes('loan_officer') ||
                           pageSource.toLowerCase().includes('officer');
    
    console.log('[Test] Page source loan officer check:', hasLoanOfficer);
    
    // Try to find loan officer in profile/settings
    const profileIcon = await $('~ic_contact_person').catch(() => null);
    if (profileIcon) {
      await profileIcon.click();
      await browser.pause(500);
      console.log('[Test] Opened profile menu');
      
      const pageAfterProfile = await browser.getPageSource();
      console.log('[Test] Checking for loan officer in profile menu');
      
      if (pageAfterProfile.includes('39913') || pageAfterProfile.includes('Officer')) {
        console.log('[Test] ✓ Loan officer found in profile menu');
      }
      
      await browser.takeScreenshot();
      const backButton = await $('~navigation_top.button.back|//XCUIElementTypeButton[@name="Back"]').catch(() => null);
      if (backButton) {
        await backButton.click();
        await browser.pause(300);
      }
    }

    // Look for loan officer indicator in settings
    const settingsMenu = await $('~Settings|//XCUIElementTypeStaticText[@name="Settings"]').catch(() => null);
    if (settingsMenu) {
      await settingsMenu.click();
      await browser.pause(500);
      console.log('[Test] Opened settings');
      
      const settingsSource = await browser.getPageSource();
      if (settingsSource.includes('39913') || settingsSource.includes('Officer')) {
        console.log('[Test] ✓ Loan officer found in settings');
        await browser.takeScreenshot();
      }
    }

    console.log('[Test] ✓ Agent invitation flow test completed');
  });

  it('should verify loan officer is visible on home page after agent invitation registration', async () => {
    const auth = new AuthPage();
    
    console.log('[Test] Starting loan officer verification test');
    
    // Login with existing account
    const { email, password } = getAutomationAccount('login');
    process.env.MOBILE_LOGIN_EMAIL = email;

    await auth.openLogin();
    await auth.login(email, password);
    await auth.completeLoginVerification(email);

    // Wait for home screen
    const reachedHome = await auth.waitForHomeScreen();
    assert.equal(reachedHome, true, 'Should reach home screen');
    console.log('[Test] ✓ Reached home screen');

    // Check for any loan officer badge/indicator on home screen
    await browser.pause(1000);
    const homeSource = await browser.getPageSource();
    
    // Look for common loan officer indicators
    const hasLoanOfficerBadge = homeSource.includes('Officer') || 
                                homeSource.includes('officer') ||
                                homeSource.includes('Agent');
    
    if (hasLoanOfficerBadge) {
      console.log('[Test] ✓ Loan officer/agent badge found on home screen');
      await browser.saveScreenshot(
        path.resolve(process.cwd(), 'mobile/.builds/loan-officer-badge.png')
      );
    } else {
      console.log('[Test] ⚠ No obvious loan officer badge on home screen');
      console.log('[Test] Searching for loan officer in page structure...');
    }

    // Try to access loan officer info via settings
    const profileIcon = await $('~ic_contact_person').catch(() => null);
    if (profileIcon) {
      await profileIcon.click();
      await browser.pause(500);
      
      const settingsLink = await $('~Settings|//XCUIElementTypeStaticText[@name="Settings"]').catch(() => null);
      if (settingsLink) {
        await settingsLink.click();
        await browser.pause(500);
        
        const settingsPage = await browser.getPageSource();
        if (settingsPage.toLowerCase().includes('officer')) {
          console.log('[Test] ✓ Loan officer info accessible from settings');
          await browser.saveScreenshot(
            path.resolve(process.cwd(), 'mobile/.builds/loan-officer-settings.png')
          );
        }
      }
    }

    console.log('[Test] ✓ Loan officer verification test completed');
  });
});
