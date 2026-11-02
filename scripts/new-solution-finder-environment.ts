import { resolve, relative, isAbsolute, join, sep } from 'node:path';
import environments from '../test-data/solution-finder/workbook-scenarios/environments.json';

export type NewSolutionFinderTenant = keyof typeof environments;

export function resolveNewSolutionFinderEnvironment(value = process.env.SF_TENANT ?? 'gri') {
  const tenant = value.trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(environments, tenant)) {
    throw new Error(`Unknown SF_TENANT "${value}". Choose: ${Object.keys(environments).join(', ')}.`);
  }
  const key = tenant as NewSolutionFinderTenant;
  const environment = environments[key];
  const url = new URL(environment.intakeUrl);
  if (url.protocol !== 'https:' || url.searchParams.get('playwright') !== 'true') {
    throw new Error(`Invalid Solution Finder intake URL for ${key}: ${environment.intakeUrl}`);
  }
  return { tenant: key, tenantLabel: environment.label, intakeUrl: environment.intakeUrl, baseURL: url.origin };
}

export function newSolutionFinderOutputDirectory(
  root: string,
  tenant: NewSolutionFinderTenant,
  runId = process.env.RUN_ID || new Date().toISOString().replace(/[:.]/g, '-')
) {
  if (!/^[a-zA-Z0-9._-]+$/.test(runId) || runId === '.' || runId === '..') {
    throw new Error('RUN_ID must be a non-empty filename-safe identifier, not a path.');
  }
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const output = resolve(root, 'test-results', date, 'solution-finder', 'workbook-scenarios', tenant, runId);
  assertNewSolutionFinderOutputPath(root, output);
  return output;
}

export function assertNewSolutionFinderOutputPath(root: string, output: string) {
  const base = resolve(root, 'test-results');
  const path = relative(base, resolve(output));
  if (!path || path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path)) {
    throw new Error(`New Solution Finder artifacts must be inside ${base}: ${output}`);
  }
  return join(base, path);
}
