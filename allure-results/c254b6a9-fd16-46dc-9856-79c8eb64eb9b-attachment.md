# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: projects/student-IDR/DASHBOARD-COVERAGE.spec.ts >> Student IDR dashboard coverage >> DASH-001: Overview renders and exposes dashboard sections
- Location: tests/projects/student-IDR/DASHBOARD-COVERAGE.spec.ts:15:7

# Error details

```
RangeError: Maximum call stack size exceeded
```

# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - generic [ref=e6]:
      - text:  
      - generic [ref=e8]:
        - link "Guaranteed Rate, Inc" [ref=e10] [cursor=pointer]:
          - /url: /forgiveness
          - img "Guaranteed Rate, Inc" [ref=e11]
        - generic [ref=e12]:
          - heading "Hi, Alex" [level=3] [ref=e13]
          - button [ref=e15] [cursor=pointer]:
            - generic [ref=e17]: 
    - generic [ref=e22]:
      - heading "Income driven repayment set up" [level=4] [ref=e24]
      - generic [ref=e31]:
        - generic [ref=e32]:
          - paragraph [ref=e33]: Income and household information
          - paragraph [ref=e34]: Please provide your income and household information. This helps us calculate your monthly income-driven repayment (IDR) payment and model your expected tax liability (aka the "tax bomb.)
        - generic [ref=e35]:
          - generic [ref=e36]:
            - paragraph [ref=e37]: What is your income?
            - paragraph [ref=e38]: Adjusted gross income (AGI) is the most accurate but if you do not know it use Total Income.
          - generic [ref=e39]:
            - textbox "Your AGI or total income*" [ref=e40]:
              - /placeholder: ""
            - generic: Your AGI or total income*
        - generic [ref=e41]:
          - paragraph [ref=e43]: Do you have any dependents?
          - button "+ Add child" [ref=e45] [cursor=pointer]
        - generic [ref=e46]:
          - paragraph [ref=e48]: What is your current marital status?
          - group [ref=e49]:
            - generic [ref=e50]:
              - radio "Single"
              - generic [ref=e51] [cursor=pointer]:
                - generic [ref=e52]: Single
                - text: 
            - generic [ref=e53]:
              - radio "Married"
              - generic [ref=e55] [cursor=pointer]: Married
        - generic [ref=e56]:
          - paragraph [ref=e58]: What is your state of residence?
          - generic [ref=e61]:
            - textbox [ref=e62]
            - generic: State*
        - generic [ref=e63]:
          - button "Continue" [disabled]:
            - generic: Continue
    - generic [ref=e65]:
      - generic [ref=e66]:
        - generic [ref=e67]:
          - link "Privacy Policy" [ref=e68] [cursor=pointer]:
            - /url: https://www.rate.com/privacy?adtrk=%7Cgnr%7Cguaranteedrate%7C%7C%7C%7C%7C%7C%7C%7Cdirect%7C%7C%7C%7C%7C
          - text: "|"
        - generic [ref=e69]:
          - link "Licensing" [ref=e70] [cursor=pointer]:
            - /url: https://www.rate.com/licensing?adtrk=%7Cgnr%7Cguaranteedrate%7C%7C%7C%7C%7C%7C%7C%7Cdirect%7C%7C%7C%7C%7C
          - text: "|"
        - generic [ref=e71]:
          - link "Legal" [ref=e72] [cursor=pointer]:
            - /url: https://www.rate.com/terms?adtrk=%7Cgnr%7Cguaranteedrate%7C%7C%7C%7C%7C%7C%7C%7Cdirect%7C%7C%7C%7C%7C
          - text: "|"
        - generic [ref=e73]:
          - link "Contact Us" [ref=e74] [cursor=pointer]:
            - /url: https://www.rate.com/contact-us?adtrk=%7Cgnr%7Cguaranteedrate%7C%7C%7C%7C%7C%7C%7C%7Cdirect%7C%7C%7C%7C%7C
          - text: "|"
        - generic [ref=e75]:
          - link "Accessibility" [ref=e76] [cursor=pointer]:
            - /url: https://www.rate.com/accessibility?adtrk=%7Cgnr%7Cguaranteedrate%7C%7C%7C%7C%7C%7C%7C%7Cdirect%7C%7C%7C%7C%7C
          - text: "|"
        - generic [ref=e77]:
          - link "SMS Terms" [ref=e78] [cursor=pointer]:
            - /url: https://www.rate.com/sms-terms?adtrk=%7Cgnr%7Cguaranteedrate%7C%7C%7C%7C%7C%7C%7C%7Cdirect%7C%7C%7C%7C%7C
          - text: "|"
        - generic [ref=e79]:
          - link "Notice to Vendors" [ref=e80] [cursor=pointer]:
            - /url: https://www.rate.com/notice-to-vendor?adtrk=%7Cgnr%7Cguaranteedrate%7C%7C%7C%7C%7C%7C%7C%7Cdirect%7C%7C%7C%7C%7C
          - text: "|"
        - link "NMLS Consumer Access" [ref=e82] [cursor=pointer]:
          - /url: https://www.nmlsconsumeraccess.org/TuringTestPage.aspx?ReturnUrl=/EntityDetails.aspx/COMPANY/2611?adtrk=%7Cgnr%7Cguaranteedrate%7C%7C%7C%7C%7C%7C%7C%7Cdirect%7C%7C%7C%7C%7C
      - 'link "Texas Consumer: How to file a complaint" [ref=e85] [cursor=pointer]':
        - /url: https://www.rate.com/texas-consumers-how-to-file-complaint?adtrk=%7Cgnr%7Cguaranteedrate%7C%7C%7C%7C%7C%7C%7C%7Cdirect%7C%7C%7C%7C%7C
      - img "Equal housing lender" [ref=e87]
      - paragraph [ref=e88]: Copyright © 2024 Guaranteed Rate, Inc. d/b/a Rate. All rights reserved.
      - generic [ref=e90]:
        - text: "When Your Home is On the Line: What You Should Know About Home Equity Lines of Credit"
        - link "Home Equity Lines of Credit (HELOC)" [ref=e91] [cursor=pointer]:
          - /url: https://files.consumerfinance.gov/f/documents/cfpb_heloc-brochure.pdf
  - text: 
```

# Test source

```ts
  1731 |   console.log('   ✓ After both are complete, you\'ll be logged in');
  1732 |   console.log('   ✓ Tests will automatically continue from there');
  1733 |   console.log('\n' + '='.repeat(80) + '\n');
  1734 | 
  1735 |   // Check for the security setup screen
  1736 |   const securityHeading = page.getByRole('heading', { name: /Set up security methods/i }).first();
  1737 |   const securityVisible = await securityHeading.isVisible().catch(() => false);
  1738 | 
  1739 |   if (securityVisible) {
  1740 |     console.log('✓ Security setup screen detected\n');
  1741 |     
  1742 |     // Email setup
  1743 |     const emailSetupBtn = page.getByRole('button', { name: /Set up.*Email/i }).first();
  1744 |     const emailSetupVisible = await emailSetupBtn.isVisible().catch(() => false);
  1745 |     
  1746 |     if (emailSetupVisible) {
  1747 |       console.log('📧 Setting up email verification...');
  1748 |       await emailSetupBtn.click();
  1749 |       await page.waitForTimeout(1500);
  1750 |       
  1751 |       console.log('⏳ Waiting for email MFA code entry...');
  1752 |       
  1753 |       // Wait for the verification code input or success
  1754 |       const maxWait = 300000; // 5 minutes
  1755 |       const startTime = Date.now();
  1756 |       let emailComplete = false;
  1757 |       
  1758 |       while (Date.now() - startTime < maxWait && !emailComplete) {
  1759 |         // Check if email verification succeeded (button disappears or shows success)
  1760 |         const stillHasEmailBtn = await emailSetupBtn.isVisible().catch(() => false);
  1761 |         const successMsg = page.getByText(/Email verified|email.*success|verified.*email/i).first();
  1762 |         const successVisible = await successMsg.isVisible().catch(() => false);
  1763 |         
  1764 |         if (!stillHasEmailBtn || successVisible) {
  1765 |           emailComplete = true;
  1766 |           console.log('✅ Email verification completed!\n');
  1767 |         } else {
  1768 |           await page.waitForTimeout(2000);
  1769 |         }
  1770 |       }
  1771 |       
  1772 |       if (!emailComplete) {
  1773 |         console.log('⚠️  Email verification timeout - please complete manually\n');
  1774 |       }
  1775 |     }
  1776 |     
  1777 |     // Phone setup
  1778 |     const phoneSetupBtn = page.getByRole('button', { name: /Set up.*Phone/i }).first();
  1779 |     const phoneSetupVisible = await phoneSetupBtn.isVisible().catch(() => false);
  1780 |     
  1781 |     if (phoneSetupVisible) {
  1782 |       console.log('📱 Setting up phone verification...');
  1783 |       await phoneSetupBtn.click();
  1784 |       await page.waitForTimeout(1500);
  1785 |       
  1786 |       console.log('⏳ Waiting for phone MFA code entry...');
  1787 |       
  1788 |       // Wait for the verification code input or success
  1789 |       const maxWait = 300000; // 5 minutes
  1790 |       const startTime = Date.now();
  1791 |       let phoneComplete = false;
  1792 |       
  1793 |       while (Date.now() - startTime < maxWait && !phoneComplete) {
  1794 |         // Check if phone verification succeeded
  1795 |         const stillHasPhoneBtn = await phoneSetupBtn.isVisible().catch(() => false);
  1796 |         const successMsg = page.getByText(/Phone verified|phone.*success|verified.*phone/i).first();
  1797 |         const successVisible = await successMsg.isVisible().catch(() => false);
  1798 |         
  1799 |         if (!stillHasPhoneBtn || successVisible) {
  1800 |           phoneComplete = true;
  1801 |           console.log('✅ Phone verification completed!\n');
  1802 |         } else {
  1803 |           await page.waitForTimeout(2000);
  1804 |         }
  1805 |       }
  1806 |       
  1807 |       if (!phoneComplete) {
  1808 |         console.log('⚠️  Phone verification timeout - please complete manually\n');
  1809 |       }
  1810 |     }
  1811 |   }
  1812 |   
  1813 |   // After MFA, wait for redirect or for user to continue
  1814 |   console.log('🔄 Waiting for authentication to complete...\n');
  1815 |   await page.waitForTimeout(2000);
  1816 |   
  1817 |   // Check if we're still on the security page or redirected
  1818 |   const stillOnSecurity = await securityHeading.isVisible().catch(() => false);
  1819 |   if (stillOnSecurity) {
  1820 |     console.log('⏳ Still on security setup screen, waiting for redirect...');
  1821 |     await page.waitForURL(/\/forgiveness\/|dashboard|my\.gr-dev\.com/, { timeout: 30000 }).catch(() => null);
  1822 |   }
  1823 |   
  1824 |   console.log('✅ MFA verification flow complete - continuing with IDR flow...\n');
  1825 | }
  1826 | 
  1827 | /**
  1828 |  * Enhanced login redirect that includes MFA handling.
  1829 |  * Detects when we're on security setup screen and guides user through MFA.
  1830 |  */
> 1831 | export async function handleLoginAndMfa(page: Page, email: string, password: string) {
       |                                        ^ RangeError: Maximum call stack size exceeded
  1832 |   // First, try standard login
  1833 |   await handleLoginAndMfa(page, email, password);
  1834 |   
  1835 |   // Wait a moment for any redirects
  1836 |   await page.waitForTimeout(3000);
  1837 |   
  1838 |   // Check if we landed on security setup screen (MFA required)
  1839 |   const securityHeading = page.getByRole('heading', { name: /Set up security methods/i }).first();
  1840 |   const onSecurityScreen = await securityHeading.isVisible().catch(() => false);
  1841 |   
  1842 |   if (onSecurityScreen) {
  1843 |     // User is on the MFA screen - handle it interactively
  1844 |     await handleMfaSetup(page, email);
  1845 |   }
  1846 |   
  1847 |   // After MFA (if needed), check if login was successful
  1848 |   await page.waitForTimeout(2000);
  1849 |   
  1850 |   // If still on login page, try again
  1851 |   if (isLoginUrl(page.url())) {
  1852 |     console.log('ℹ️  Still on login screen, retrying...');
  1853 |     await page.waitForTimeout(2000);
  1854 |   }
  1855 | }
  1856 | 
  1857 | 
  1858 | /**
  1859 |  * Handles post-MFA redirect back to IDR flow.
  1860 |  * After user completes email and phone verification, this redirects to the IDR URL
  1861 |  * and clicks login if needed to resume the application flow.
  1862 |  */
  1863 | export async function handlePostMfaRedirect(page: Page) {
  1864 |   console.log('🔄 Handling post-MFA redirect...\n');
  1865 |   
  1866 |   const idrUrl = resolveTestUrl();
  1867 |   console.log(`📍 Redirecting to: ${idrUrl}`);
  1868 |   
  1869 |   try {
  1870 |     await page.goto(idrUrl, { waitUntil: 'domcontentloaded' });
  1871 |     await page.waitForTimeout(2000);
  1872 |   } catch (error) {
  1873 |     console.log(`⚠️  Redirect error: ${error}`);
  1874 |   }
  1875 |   
  1876 |   // Look for login button (top right)
  1877 |   const loginBtn = page.getByRole('button', { name: /log in|sign in/i }).first();
  1878 |   const loginBtnVisible = await loginBtn.isVisible().catch(() => false);
  1879 |   
  1880 |   if (loginBtnVisible) {
  1881 |     console.log('🔐 Found login button - clicking to resume flow');
  1882 |     await loginBtn.click();
  1883 |     await page.waitForTimeout(2000);
  1884 |   }
  1885 |   
  1886 |   // Check if we reached the dashboard or welcome/income page
  1887 |   const currentUrl = page.url();
  1888 |   if (currentUrl.includes('/forgiveness/') || currentUrl.includes('dashboard')) {
  1889 |     console.log('✅ Successfully at IDR application page');
  1890 |   } else if (currentUrl.includes('/login') || currentUrl.includes('/auth')) {
  1891 |     console.log('⏳ Still on auth page, waiting for redirect...');
  1892 |     await page.waitForURL(/forgiveness|dashboard/, { timeout: 15000 }).catch(() => null);
  1893 |   }
  1894 |   
  1895 |   console.log('✅ Post-MFA redirect complete\n');
  1896 | }
  1897 | 
  1898 | 
```