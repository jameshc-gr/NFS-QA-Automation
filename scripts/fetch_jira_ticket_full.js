#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

async function downloadFile(url, dest, auth) {
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  const buffer = await res.arrayBuffer();
  await fs.promises.writeFile(dest, Buffer.from(buffer));
}

function toText(description) {
  if (!description) return '';
  if (typeof description === 'string') return description;
  try { return JSON.stringify(description, null, 2); } catch (e) { return String(description); }
}

function renderProseMirror(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  let out = '';
  const recurse = (n) => {
    if (!n) return;
    if (Array.isArray(n)) return n.map(recurse).join('');
    switch (n.type) {
      case 'text':
        out += n.text || '';
        break;
      case 'paragraph':
        if (n.content) recurse(n.content);
        out += '\n\n';
        break;
      case 'heading':
        out += (n.attrs && n.attrs.level ? '#'.repeat(n.attrs.level) + ' ' : '') ;
        if (n.content) recurse(n.content);
        out += '\n\n';
        break;
      case 'bulletList':
      case 'orderedList':
        if (n.content) recurse(n.content);
        out += '\n';
        break;
      case 'listItem':
        out += '- ';
        if (n.content) recurse(n.content);
        out += '\n';
        break;
      default:
        if (n.content) recurse(n.content);
    }
  };
  if (node.content) recurse(node.content);
  return out.trim();
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) { console.error('Usage: node scripts/fetch_jira_ticket_full.js TICKET-KEY'); process.exit(2); }
  const ticket = argv[0];

  const envPath = path.join(process.cwd(), 'jira.env');
  if (!fs.existsSync(envPath)) { console.error('jira.env not found'); process.exit(1); }
  dotenv.config({ path: envPath });
  const { JIRA_USER, JIRA_TOKEN, JIRA_INSTANCE } = process.env;
  if (!JIRA_USER || !JIRA_TOKEN || !JIRA_INSTANCE) { console.error('Missing env vars'); process.exit(1); }

  const auth = Buffer.from(`${JIRA_USER}:${JIRA_TOKEN}`).toString('base64');
  const apiUrl = `${JIRA_INSTANCE.replace(/\/$/, '')}/rest/api/3/issue/${ticket}`;
  console.log('Fetching', apiUrl);
  const res = await fetch(apiUrl, { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } });
  if (!res.ok) { console.error('Failed to fetch ticket', res.status); process.exit(1); }
  const issue = await res.json();

  const targetDir = path.join(process.cwd(), 'Jira', 'student-refi', 'jira-tickets', ticket);
  await fs.promises.mkdir(targetDir, { recursive: true });

  const summary = issue.fields.summary || '';
  const description = toText(issue.fields.description);
  const reporter = issue.fields.reporter && issue.fields.reporter.displayName;
  const assignee = issue.fields.assignee && issue.fields.assignee.displayName;
  const status = issue.fields.status && issue.fields.status.name;
  const labels = issue.fields.labels || [];

  let humanDescription = description;
  try {
    const parsed = issue.fields.description;
    if (parsed && typeof parsed === 'object' && parsed.type === 'doc') {
      humanDescription = renderProseMirror(parsed);
    }
  } catch (e) {
    // fallback
  }

  const jiraContent = `# ${ticket} - ${summary}\n\nStatus: ${status}\nReporter: ${reporter || 'n/a'}\nAssignee: ${assignee || 'n/a'}\nLabels: ${labels.join(', ')}\n\n## Description\n\n${humanDescription}\n`;
  const jiraContentPath = path.join(targetDir, 'jira_content.md');
  await fs.promises.writeFile(jiraContentPath, jiraContent, 'utf8');

  // attachments
  const attachments = issue.fields.attachment || [];
  const attachmentsDir = path.join(targetDir, 'attachments');
  if (attachments.length) await fs.promises.mkdir(attachmentsDir, { recursive: true });
  for (const a of attachments) {
    const filename = a.filename || 'attachment';
    const url = a.content;
    const dest = path.join(attachmentsDir, filename);
    try {
      console.log('Downloading attachment', filename);
      await downloadFile(url, dest, auth);
    } catch (e) {
      console.warn('Failed to download attachment', filename, e.message);
    }
  }

  // generate test_cases.md and test_plan.md as human-friendly placeholders
  // Simple heuristics: split description into sections and extract bullet points as test cases
  let testCasesText = `# Test Cases for ${ticket}\n\nBased on ticket summary: ${summary}\n\n`;
  if (humanDescription) {
    testCasesText += humanDescription.split('\n\n').slice(0,5).map((p,i) => `${i+1}) ${p.replace(/\n/g,' ')}\n`).join('\n');
  } else {
    testCasesText += `1) Happy path - steps TBD\n2) Negative path - steps TBD\n`;
  }
  const testCases = testCasesText;
  const testCasesPath = path.join(targetDir, 'test_cases.md');
  await fs.promises.writeFile(testCasesPath, testCases, 'utf8');

  const testPlan = `# Test Plan for ${ticket}\n\nPriority: P0\nEstimated time: 30m\n\nTests:\n- Happy path: 15m\n- Negative flows: 15m\n`;
  const testPlanPath = path.join(targetDir, 'test_plan.md');
  await fs.promises.writeFile(testPlanPath, testPlan, 'utf8');

  // UI analysis placeholder
  const uiAnalysis = `# UI Analysis for ${ticket}\n\nNo screenshots analyzed yet. Place attachments in attachments/ and re-run analysis.`;
  await fs.promises.writeFile(path.join(targetDir, 'ui_analysis.md'), uiAnalysis, 'utf8');

  // automation instruction
  const automationInstruction = `# Automation Instruction for ${ticket}\n\nSee test_plan.md and test_cases.md. Use Playwright for Web; use Appium MCP for mobile.\n\nRequired env vars: BASE_URL, API_TOKEN, JIRA_USER\n`;
  await fs.promises.writeFile(path.join(targetDir, 'automation_instruction.md'), automationInstruction, 'utf8');

  console.log('Wrote files to', targetDir);
}

main().catch(err => { console.error(err); process.exit(1); });
