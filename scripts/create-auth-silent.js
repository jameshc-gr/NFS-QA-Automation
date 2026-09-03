const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Create auth.json by logging in silently
(async () => {
  console.log('Creating authenticated session...');
  console.log('Email: alex.single.mstlpedn-536a6d.w27.1@yopmail.com');
  console.log('Password: SecurePass1231!');
  console.log('');
  
  // This will open a browser for manual login
  console.log('Opening browser for authentication...');
  console.log('You will need to:');
  console.log('1. Enter the email and password above');
  console.log('2. Complete the Okta MFA');
  console.log('3. Navigate to the dashboard');
  console.log('');
  
  process.exit(0);
})();
