#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

function loadFileIfExists(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; }
}

async function postJson(url, headers, body) {
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await res.text().catch(() => '');
  let parsed = null;
  try { parsed = JSON.parse(text); } catch (e) { parsed = { __raw: text }; }
  return { status: res.status, ok: res.ok, parsed, text, headers: Object.fromEntries(res.headers) };
}

async function tryInitialize(url, apiKey, jiraUser) {
  const initPayload = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '1.0',
      clientInfo: { name: 'run_rovo_mcp', version: '1.0.0' },
      capabilities: {}
    }
  };

  const authHeaders = [];
  if (apiKey) authHeaders.push({ Authorization: `Bearer ${apiKey}`, label: 'Bearer' });
  if (apiKey && jiraUser) {
    const basic = Buffer.from(`${jiraUser}:${apiKey}`).toString('base64');
    authHeaders.push({ Authorization: `Basic ${basic}`, label: 'Basic' });
  }
  // always try without auth as last resort
  authHeaders.push({ Authorization: null, label: 'none' });

  for (const a of authHeaders) {
    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' };
    if (a.Authorization) headers['Authorization'] = a.Authorization;
    console.log('Initializing with auth:', a.label);
    try {
      const res = await postJson(url, headers, initPayload);
      if (!res.ok) {
        console.warn('initialize returned status', res.status, res.text.slice(0,300));
        continue;
      }
      // check for session id in parsed response
      const parsed = res.parsed || {};
      const sid = (parsed && parsed.result && (parsed.result.sessionId || (parsed.result.session && parsed.result.session.id))) || parsed.sessionId || null;
      if (sid) return { auth: a.label, response: parsed, rawText: res.text };
      // otherwise keep trying other auth variants
      console.log('initialize returned no sessionId with auth', a.label);
      continue;
    } catch (e) {
      console.warn('initialize attempt error:', e.message);
      continue;
    }
  }
  throw new Error('All initialize attempts failed');
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) { console.error('Usage: node scripts/run_rovo_mcp.js TICKET-KEY'); process.exit(2); }
  const ticket = argv[0];

  dotenv.config({ path: path.join(process.cwd(), 'jira.env') });
  const jiraEnvPath = path.join(process.cwd(), 'jira.env');
  const jiraEnvText = loadFileIfExists(jiraEnvPath) || '';
  const jiraEnvUrl = (jiraEnvText.match(/^\s*ROVO_MCP_URL\s*=\s*(\S+)/m) || [])[1] || (jiraEnvText.match(/^\s*ROVO_MCP_URL1\s*=\s*(\S+)/m) || [])[1] || (jiraEnvText.match(/^\s*ROVO_MCP_URL2\s*=\s*(\S+)/m) || [])[1] || null;

  const url = jiraEnvUrl || process.env.ROVO_MCP_URL || process.env.MCP_ROVO_URL;
  const apiKey = process.env.ROVO_MCP_API_KEY || process.env.ROVO_MCP_BEARER || null;
  const jiraUser = process.env.JIRA_USER || null;
  console.log('Using ROVO_MCP_URL:', url, jiraEnvUrl ? '(from jira.env)' : '(from env)');
  if (!url) { console.error('Missing ROVO_MCP_URL'); process.exit(1); }

  const ticketDir = path.join(process.cwd(), 'Jira', 'student-refi', 'jira-tickets', ticket);
  if (!fs.existsSync(ticketDir)) { console.error('Ticket folder not found:', ticketDir); process.exit(1); }

  console.log('Calling initialize...');
  const init = await tryInitialize(url, apiKey, jiraUser).catch(err => { console.error('Initialize failed:', err.message); process.exit(1); });
  console.log('Initialize response (auth used =', init.auth + '):');
  console.log(JSON.stringify(init.response, null, 2));
  fs.writeFileSync(path.join(ticketDir, 'initialize.raw.json'), JSON.stringify(init.response, null, 2), 'utf8');

  // try to extract session id
  const res = init.response || {};
  const sessionId = (res && res.result && (res.result.sessionId || (res.result.session && res.result.session.id))) || res.sessionId || null;
  if (!sessionId) {
    console.warn('No sessionId found in initialize response. The server may require interactive OAuth, admin enablement for API tokens, or a different client flow. See Jira/student-refi/jira-tickets/' + ticket + '/initialize.raw.json for details.');
    process.exit(1);
  }

  // if we have a sessionId, perform a call
  const payload = {
    jsonrpc: '2.0', id: 'call-1', method: 'call', params: { sessionId, tool: 'generate', arguments: { ticket } }
  };
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  console.log('Calling MCP call with sessionId');
  const callRes = await postJson(url, headers, payload).catch(e => ({ ok: false, text: String(e) }));
  console.log('Call response status:', callRes.status);
  fs.writeFileSync(path.join(ticketDir, 'call.raw.json'), JSON.stringify(callRes.parsed, null, 2), 'utf8');
  console.log('Saved initialize.raw.json and call.raw.json to ticket folder.');
}

main().catch(e => { console.error(e); process.exit(1); });
