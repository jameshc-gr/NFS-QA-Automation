import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { decryptSecret } from '../mobile/src/utils/crypto-utils';

dotenv.config({ path: path.resolve(process.cwd(), 'jira.env') });

// Load JIRA credentials from environment variables or .env file
const JIRA_BASE_URL = decryptSecret(process.env.JIRA_BASE_URL || 'https://rate.atlassian.net');
const JIRA_TOKEN = decryptSecret(process.env.JIRA_TOKEN || '');
const JIRA_USER = decryptSecret(process.env.JIRA_USER || 'james.chang@rate.com');

if (!JIRA_TOKEN) {
  console.error('Error: JIRA_TOKEN is not set. Please set the JIRA_TOKEN environment variable.');
  process.exit(1);
}

const JQL = `project = MSAM AND (   issue IN linkedIssues("MSAM-8082")   OR "Epic Link" = MSAM-8082) AND status NOT IN ("Ready for deployment", Done, "QA", "Ready for QA") ORDER BY priority DESC, created DESC`;

async function fetchIssues(jql: string) {
  const url = `${JIRA_BASE_URL}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=1000`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${JIRA_USER}:${JIRA_TOKEN}`).toString('base64')}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch issues: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return data.issues;
}

function ageInMonths(created: string) {
  const createdDate = new Date(created);
  const now = new Date();
  const diff = now.getTime() - createdDate.getTime();
  return diff / (1000 * 60 * 60 * 24 * 30.44); // approximate months
}

async function analyze() {
  const issues = await fetchIssues(JQL);
  const older6 = [];
  const older12 = [];
  const critical = [];
  const unassigned = [];

  for (const issue of issues) {
    const created = issue.fields.created;
    const months = ageInMonths(created);
    if (months > 12) older12.push(issue);
    else if (months > 6) older6.push(issue);

    if (!issue.fields.assignee) unassigned.push(issue);
    if (issue.fields.priority && issue.fields.priority.name === 'Critical') critical.push(issue);
  }

  const output = {
    older6: older6.map(i => i.key),
    older12: older12.map(i => i.key),
    unassigned: unassigned.map(i => i.key),
    critical: critical.map(i => i.key),
  };

  const outPath = path.resolve('jira_analysis_output.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Analysis written to ${outPath}`);
}

analyze().catch(err => {
  console.error(err);
  process.exit(1);
});
