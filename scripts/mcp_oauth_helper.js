#!/usr/bin/env node
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');

async function fetchJson(u, opts) {
  const res = await fetch(u, opts);
  const text = await res.text();
  try { return JSON.parse(text); } catch (e) { return { __raw: text, status: res.status }; }
}

function openBrowser(u) {
  const cmd = process.platform === 'darwin' ? `open "${u}"` : process.platform === 'win32' ? `start "" "${u}"` : `xdg-open "${u}"`;
  exec(cmd, (err) => { if (err) console.error('Failed to open browser:', err); });
}

async function exchangeCode(code, clientId, clientSecret, redirectUri) {
  const tokenUrl = 'https://auth.atlassian.com/oauth/token';
  const body = {
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri
  };
  return await fetchJson(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

async function callInitialize(mcpUrl, token) {
  const initPayload = {
    jsonrpc: '2.0', id: 1, method: 'initialize', params: {
      protocolVersion: '1.0', clientInfo: { name: 'mcp_oauth_helper', version: '1.0.0' }, capabilities: {}
    }
  };
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(mcpUrl, { method: 'POST', headers, body: JSON.stringify(initPayload) });
  const text = await res.text().catch(() => '');
  let parsed = null;
  try { parsed = JSON.parse(text); } catch (e) { parsed = { __raw: text }; }
  return { status: res.status, parsed, text };
}

async function main() {
  const argv = process.argv.slice(2);
  const ticket = argv[0] || 'FAL-3147';
  const clientId = process.env.ATLAS_CLIENT_ID || process.env.CLIENT_ID;
  const clientSecret = process.env.ATLAS_CLIENT_SECRET || process.env.CLIENT_SECRET || '';
  const scopeEnv = process.env.ATLAS_OAUTH_SCOPES || process.env.SCOPES || 'read:jira-user read:3p-data:mcp search:rovo:mcp';
  const port = Number(process.env.MCP_OAUTH_PORT || process.env.PORT || 5173);

  if (!clientId) {
    console.error('Missing CLIENT_ID. Set ATLAS_CLIENT_ID or pass CLIENT_ID in environment.');
    console.error('You can register an OAuth (3LO) app in Atlassian developer console and set the redirect URL to http://localhost:' + port + '/callback');
    process.exit(1);
  }

  const redirectUri = `http://localhost:${port}/callback`;
  const state = crypto.randomBytes(8).toString('hex');
  const authUrl = new URL('https://auth.atlassian.com/authorize');
  authUrl.searchParams.set('audience', 'api.atlassian.com');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('scope', scopeEnv);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('prompt', 'consent');

  console.log('Starting local server to receive OAuth callback on', redirectUri);
  const server = http.createServer(async (req, res) => {
    const u = url.parse(req.url, true);
    if (u.pathname === '/callback') {
      const q = u.query;
      if (q.state !== state) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('State mismatch');
        server.close();
        return;
      }
      if (q.error) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('OAuth error: ' + q.error);
        server.close();
        return;
      }
      const code = q.code;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><h2>Authentication complete. You can close this window.</h2></body></html>');
      server.close();
      console.log('Received authorization code, exchanging for tokens...');
      const tokenRes = await exchangeCode(code, clientId, clientSecret, redirectUri);
      if (!tokenRes || !tokenRes.access_token) {
        console.error('Token exchange failed:', tokenRes);
        return;
      }
      const accessToken = tokenRes.access_token;
      console.log('Got access token. Calling MCP initialize...');
      // load jira.env to find MCP url and ticket folder
      const jiraEnvPath = path.join(process.cwd(), 'jira.env');
      let jiraEnv = '';
      try { jiraEnv = fs.readFileSync(jiraEnvPath, 'utf8'); } catch (e) { /* ignore */ }
      const mcpUrl = (jiraEnv.match(/ROVO_MCP_URL1\s*=\s*(\S+)/m) || jiraEnv.match(/ROVO_MCP_URL2\s*=\s*(\S+)/m) || [])[1] || process.env.ROVO_MCP_URL || 'https://mcp.atlassian.com/v1/mcp/authv2';

      const initRes = await callInitialize(mcpUrl, accessToken);
      console.log('Initialize status:', initRes.status);
      const ticketDir = path.join(process.cwd(), 'Jira', 'student-refi', 'jira-tickets', ticket);
      try { fs.mkdirSync(ticketDir, { recursive: true }); } catch (e) {}
      fs.writeFileSync(path.join(ticketDir, 'initialize.raw.json'), JSON.stringify(initRes.parsed, null, 2), 'utf8');
      console.log('Saved initialize.raw.json to', path.join(ticketDir, 'initialize.raw.json'));
      const sid = (initRes.parsed && initRes.parsed.result && (initRes.parsed.result.sessionId || (initRes.parsed.result.session && initRes.parsed.result.session.id))) || initRes.parsed.sessionId || null;
      if (sid) console.log('Session ID:', sid);
      else console.warn('No sessionId found in initialize response. See saved file for details.');
      return;
    }
    res.writeHead(404); res.end('Not found');
  });

  server.listen(port, () => {
    console.log('Opening browser for consent...');
    openBrowser(authUrl.toString());
  });
}

main().catch(e => { console.error(e); process.exit(1); });
