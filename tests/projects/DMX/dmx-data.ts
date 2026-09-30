import { readFileSync, appendFileSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { parse } from 'yaml';
import type { Scenario, Person, Employment } from './dmx-engine';

const ROOT = process.cwd();
const SCENARIO_FILE = resolve(ROOT, 'test-data/DMX/dmx-scenarios.yml');
export const ACCOUNTS_FILE = resolve(ROOT, 'test-data/DMX/dmx-created-accounts.csv');

interface RawFile {
  defaults: { phone: string; employer_phone: string; password: string };
  credit_profiles: Record<string, { first: string; last: string; ssn: string }>;
  scenarios: any[];
  incomplete: { id: string; base: string; stop_at: string; note: string }[];
}

let cache: RawFile | undefined;
const raw = (): RawFile => (cache ??= parse(readFileSync(SCENARIO_FILE, 'utf8')) as RawFile);

function person(r: RawFile, p: any, phoneOverride?: string): Person {
  const prof = r.credit_profiles[p.profile];
  if (!prof) throw new Error(`Unknown credit profile "${p.profile}" in dmx-scenarios.yml`);
  return {
    firstName: prof.first,
    lastName: prof.last,
    phone: phoneOverride ?? r.defaults.phone,
    ssn: prof.ssn,
    dob: p.dob,
    maritalStatus: p.marital,
  };
}

function employment(r: RawFile, e: any): Employment {
  return { employer: e.employer, title: e.title, city: e.city, state: e.state, phone: r.defaults.employer_phone, start: e.start, annualSalary: e.salary };
}

function toScenario(r: RawFile, y: any): Scenario {
  const l = y.loan ?? {};
  const s: Scenario = {
    id: y.id,
    title: y.title,
    product: y.product,
    tags: y.tags ?? [],
    borrower: person(r, y.borrower),
    residence: {
      address: y.residence.address, city: y.residence.city, state: y.residence.state, zip: y.residence.zip,
      moveIn: y.residence.move_in, status: y.residence.status, monthlyRent: y.residence.monthly_rent,
    },
    employment: employment(r, y.employment),
    assets: y.assets,
    property: { address: y.property.address, city: y.property.city, state: y.property.state, zip: y.property.zip, propertyType: y.property.type, usage: y.property.usage },
    loan: {
      price: l.price, down: l.down, refiGoal: l.refi_goal, timeline: l.timeline, currentValue: l.current_value, balance: l.balance,
      annualTaxes: l.taxes, annualInsurance: l.insurance, interestRate: l.interest_rate, origPrice: l.orig_price,
      yearPurchased: l.year_purchased, newLoan: l.new_loan, targetPayment: l.target_payment, maxPayment: l.max_payment,
      moveIn: y.residence.move_in.replace('/', ''),
    },
    expect: y.expect ?? {},
  };
  if (y.co_borrower) {
    s.coBorrower = {
      ...person(r, y.co_borrower, '(312) 658-4001'),
      sameAddress: y.co_borrower.same_address,
      employment: y.co_borrower.employment ? employment(r, y.co_borrower.employment) : undefined,
    };
  }
  return s;
}

export function loadScenarios(): Scenario[] {
  const r = raw();
  return r.scenarios.map(y => toScenario(r, y));
}

export interface IncompleteCase { id: string; note: string; stopAt: string; scenario: Scenario }

export function loadIncomplete(): IncompleteCase[] {
  const r = raw();
  const all = loadScenarios();
  return r.incomplete.map(i => {
    const base = all.find(s => s.id === i.base);
    if (!base) throw new Error(`incomplete case ${i.id} references unknown scenario ${i.base}`);
    return { id: i.id, note: i.note, stopAt: i.stop_at, scenario: { ...base, id: i.id, title: `${i.id}: ${i.note}` } };
  });
}

export const TEST_CASES_FILE = resolve(ROOT, 'test-data/DMX/dmx-test-cases.csv');

export interface TestCaseRow {
  test_id: string; category: string; title: string; scenario_ref: string; stop_at_route: string;
  product: string; steps: string; expected_result: string; [column: string]: string;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

let casesCache: TestCaseRow[] | undefined;

/** Test cases from test-data/DMX/dmx-test-cases.csv, keyed by test_id. */
export function loadTestCase(id: string): TestCaseRow {
  casesCache ??= (() => {
    const [head, ...body] = parseCsv(readFileSync(TEST_CASES_FILE, 'utf8')).filter(r => r.length > 1);
    return body.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])) as TestCaseRow);
  })();
  const row = casesCache.find(r => r.test_id === id);
  if (!row) throw new Error(`dmx-test-cases.csv has no test case "${id}" (run npm run dmx:test-cases)`);
  return row;
}

export type AccountStatus = 'registered' | 'incomplete' | 'complete' | 'resumed-complete' | 'failed';

const HEADER = 'createdAt,email,password,scenarioId,product,status,stoppedAt,loanGuid,loanNumber,dashboardUrl,note\n';
const csv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/** Append-only event log; the last row for an email is its current state. Single appendFileSync calls are safe across workers. */
export function recordAccount(a: { email: string; password?: string; scenarioId: string; product: string; status: AccountStatus; stoppedAt?: string; loanGuid?: string | null; loanNumber?: string | null; dashboardUrl?: string; note?: string }) {
  mkdirSync(dirname(ACCOUNTS_FILE), { recursive: true });
  try { writeFileSync(ACCOUNTS_FILE, HEADER, { flag: 'wx' }); } catch { /* header already written by another worker */ }
  const row = [new Date().toISOString(), a.email, a.password ?? raw().defaults.password, a.scenarioId, a.product, a.status, a.stoppedAt, a.loanGuid, a.loanNumber, a.dashboardUrl, a.note].map(csv).join(',') + '\n';
  appendFileSync(ACCOUNTS_FILE, row);
}
