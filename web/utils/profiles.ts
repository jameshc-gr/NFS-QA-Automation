import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function parseYamlScalar(value: string): string {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

export const PROFILE_KEYS = [
  'FIRST_NAME',
  'LAST_NAME',
  'EMAIL',
  'PHONE',
  'LOAN_AMOUNT',
  'MONTHLY_PAYMENT',
  'INTEREST_RATE',
  'ADDRESS',
  'SCHOOL',
  'DEGREE_LEVEL',
  'GRADUATION_DATE',
  'INCOME_TYPE',
  'EMPLOYER',
  'OCCUPATION',
  'ANNUAL_INCOME',
  'EMPLOYMENT_START',
  'CITIZEN_STATUS',
  'CREDIT_SCORE',
  'HOUSING_TYPE',
  'HOUSING_COST',
  'TOTAL_ASSETS',
  'DOB',
  'SSN'
] as const;

export type ProfileKey = (typeof PROFILE_KEYS)[number];

export function loadProfileYaml(filePath: string): void {
  const content = readFileSync(filePath, 'utf8');

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf(':');
    if (separatorIndex < 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1);

    if (key) {
      process.env[key] = parseYamlScalar(rawValue);
    }
  }
}

export function initializeProfiles(): Record<ProfileKey, string | undefined> {
  const yamlPath = path.resolve(process.cwd(), 'test-data/student-loan-refi/student-loan-refi.yaml');
  const ymlPath = path.resolve(process.cwd(), 'test-data/student-loan-refi/student-loan-refi.yml');
  const profilePath = existsSync(yamlPath) ? yamlPath : ymlPath;

  loadProfileYaml(profilePath);

  return Object.fromEntries(PROFILE_KEYS.map((key) => [key, process.env[key]])) as Record<
    ProfileKey,
    string | undefined
  >;
}

export function loadProfile(profile: string): void {
  if (!profile) {
    return;
  }

  for (const key of PROFILE_KEYS) {
    const source = `${key}_${profile}`;
    if (process.env[source]) {
      process.env[key] = process.env[source];
    }
  }
}

export function restoreBaseEnv(baseEnv: Record<ProfileKey, string | undefined>): void {
  for (const key of PROFILE_KEYS) {
    const originalValue = baseEnv[key];
    if (typeof originalValue === 'undefined') {
      delete process.env[key];
    } else {
      process.env[key] = originalValue;
    }
  }
}
