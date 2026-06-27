const dotenv = require('dotenv');

dotenv.config({ path: './jira.env' });

(async () => {
  try {
    const url = process.env.ROVO_MCP_URL;
    const key = process.env.ROVO_MCP_API_KEY;
    if (!url) throw new Error('ROVO_MCP_URL not set');
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { Authorization: `Bearer ${key}` } : {})
      },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', params: {} })
    });
    const text = await res.text();
    console.log('STATUS', res.status);
    console.log(text);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
