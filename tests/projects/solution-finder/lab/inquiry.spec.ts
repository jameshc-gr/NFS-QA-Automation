import { test } from '@playwright/test';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { parseLabRequest, validateLabDirectory } from '../../../../scripts/solution-finder/lab/contracts';
import { runScenario } from '../workbook-scenarios/helpers/scenario';

test('Solution Finder Lab: submit pasted inquiry and verify UI/API offers', async ({ page }, testInfo) => {
  const directory = validateLabDirectory(process.env.SF_LAB_RUN_DIR || '');
  const settings = z.object({
    request: z.unknown(), preserveEmail: z.boolean()
  }).strict().parse(JSON.parse(readFileSync(join(directory, 'input.json'), 'utf8')));
  const request = parseLabRequest(settings.request);
  await runScenario(page, testInfo, { id: 'LAB', name: 'Pasted inquiry', request, notes: [] }, {
    compareWorkbook: false, preserveEmail: settings.preserveEmail,
    onStep(name, status) {
      const progress = join(directory, 'progress.json');
      writeFileSync(`${progress}.tmp`, JSON.stringify({ name, status, at: new Date().toISOString() }));
      renameSync(`${progress}.tmp`, progress);
    }
  });
});
