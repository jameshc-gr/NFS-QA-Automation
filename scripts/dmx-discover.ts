import { chromium } from 'playwright';
import { register, runApplication, newEmail, Scenario, UnhandledPageError } from '../tests/projects/DMX/dmx-engine';
import { dumpPage } from './dmx-explore';

const base: Scenario = {
  id: 'disc', title: 'discovery', product: (process.argv[2] as any) || 'refinance', tags: [],
  borrower: { firstName: 'Sarah', lastName: 'Refi', phone: '(312) 658-4000', ssn: '999-72-5641', dob: '03/14/1985', maritalStatus: 'Unmarried' },
  residence: { address: '2215 W School St', city: 'Chicago', state: 'Illinois', zip: '60618', moveIn: '01/2018', status: 'Own' },
  employment: { employer: 'Illinois Tech Solutions LLC', title: 'Senior VP Technology', city: 'Chicago', state: 'Illinois', phone: '(312) 658-4100', start: '01/15/2020', annualSalary: 150000 },
  assets: [{ type: 'Checking account', institution: 'Chase Bank', balance: 60000 }, { type: 'Savings account', institution: 'Bank of America', balance: 80000 }],
  property: { address: '2215 W School St', city: 'Chicago', state: 'Illinois', zip: '60618', propertyType: 'Single Family', usage: 'As a primary residence' },
  loan: { price: 650000, down: 130000, refiGoal: 'Lower my rate and monthly payment', moveIn: '01/2018', origPrice: 400000, yearPurchased: 2018, currentValue: 720000, balance: 410000, newLoan: 415000 },
  expect: {},
};
if (process.argv[4]) base.loan.refiGoal = process.argv[4];
if (process.argv[3] === 'co') {
  base.borrower = { firstName: 'John', lastName: 'Homeowner', phone: '(312) 658-4000', ssn: '999-40-5000', dob: '05/12/1982', maritalStatus: 'Married' };
  base.coBorrower = { employment: { employer: 'Cook County Health', title: 'Nurse Manager', city: 'Chicago', state: 'Illinois', phone: '(312) 658-4200', start: '03/01/2019', annualSalary: 95000 }, firstName: 'Mary', lastName: 'Homeowner', phone: '(312) 658-4001', ssn: '500-22-2000', dob: '07/22/1984', maritalStatus: 'Married' };
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
  const email = newEmail('disc');
  console.log('EMAIL', email, 'product', base.product);
  try {
    await register(page, base, email);
    const v = await runApplication(page, base, { log: m => console.log(m) });
    console.log('DONE', page.url(), v.join(' > '));
  } catch (e) {
    console.log('ERR', (e as Error).message);
    if (e instanceof UnhandledPageError || true) await dumpPage(page, 'AT FAILURE');
  }
  await page.screenshot({ path: 'temp/dmx-last.png' });
  await browser.close();
})();
