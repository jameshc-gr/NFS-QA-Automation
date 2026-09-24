import fs from 'fs';
import path from 'path';
import yaml from 'yaml';

export interface RateWealthConfig {
  TEST_URL_QA: string;
  TEST_URL_REGISTRATION: string;
  pages: Record<string, {
    page_name: string;
    page_id: string;
    route: string;
    heading: string;
    locators: Record<string, string>;
  }>;
  [key: string]: any;
}

export function loadRateWealthConfig(): RateWealthConfig {
  const yamlPath = path.resolve(process.cwd(), 'test-data/rate-wealth/rate-wealth.yml');
  const fileContent = fs.readFileSync(yamlPath, 'utf8');
  return yaml.parse(fileContent) as RateWealthConfig;
}
