import { extractCodeFromText } from './google-voice';

export interface OutlookOptions {
  email?: string;
  password?: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  timeoutMs?: number;
}

export async function fetchOutlookCodeGraph(options: OutlookOptions = {}): Promise<string> {
  const email = options.email || process.env.OUTLOOK_EMAIL;
  const clientId = options.clientId || process.env.OUTLOOK_CLIENT_ID;
  const clientSecret = options.clientSecret || process.env.OUTLOOK_CLIENT_SECRET;
  const tenantId = options.tenantId || process.env.OUTLOOK_TENANT_ID || 'common';

  if (!email || !clientId || !clientSecret) {
    throw new Error('Outlook Microsoft Graph credentials missing. Set OUTLOOK_EMAIL, OUTLOOK_CLIENT_ID, and OUTLOOK_CLIENT_SECRET.');
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const bodyParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const tokenRes = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: bodyParams.toString(),
  });

  if (!tokenRes.ok) {
    throw new Error(`Failed to retrieve Graph token: ${tokenRes.statusText}`);
  }

  const tokenData = (await tokenRes.json()) as { access_token: string };
  const graphUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}/messages?$top=1`;

  const mailRes = await fetch(graphUrl, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!mailRes.ok) {
    throw new Error(`Failed to fetch Outlook emails via Graph API: ${mailRes.statusText}`);
  }

  const mailData = (await mailRes.json()) as { value?: Array<{ body?: { content?: string } }> };
  const latestMessage = mailData.value?.[0]?.body?.content || '';

  const code = extractCodeFromText(latestMessage);
  if (!code) {
    throw new Error('Could not find verification code in latest Outlook email.');
  }

  return code;
}
