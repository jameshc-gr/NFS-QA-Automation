#!/bin/bash

# This script creates auth.json by running Playwright codegen
# You'll need to complete manual Okta MFA login

echo "========================================"
echo "Setting up authenticated session..."
echo "========================================"
echo ""
echo "Steps:"
echo "1. A browser window will open"
echo "2. Login with: alex.single.mstlpedn-536a6d.w27.1@yopmail.com"
echo "3. Password: SecurePass1231!"
echo "4. Complete the Okta MFA (check email or SMS)"
echo "5. Once logged in, close the browser or wait for auto-close"
echo ""
echo "Starting Playwright codegen..."
echo ""

cd /Users/jameshc/Automation/WebAutomation

npx playwright codegen \
  https://student-loans.qa.fsp.rate.com/forgiveness/welcome \
  --save-storage=auth.json \
  --chromium

echo ""
echo "✓ auth.json created successfully!"
echo "✓ Location: /Users/jameshc/Automation/WebAutomation/auth.json"
echo ""
