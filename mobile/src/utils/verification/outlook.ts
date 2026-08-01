import { extractCodeFromText } from './google-voice';

export interface OutlookOptions {
  email?: string;
  password?: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  folder?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  excludeCodes?: string[];
}

export async function fetchOutlookCodeGraph(options: OutlookOptions = {}): Promise<string> {
  const email = options.email || process.env.OUTLOOK_EMAIL;
  const clientId = options.clientId || process.env.OUTLOOK_CLIENT_ID;
  const clientSecret = options.clientSecret || process.env.OUTLOOK_CLIENT_SECRET;
  const tenantId = options.tenantId || process.env.OUTLOOK_TENANT_ID || 'common';
  const folder = options.folder || process.env.OUTLOOK_FOLDER;
  const timeoutMs = options.timeoutMs ?? 120000;
  const pollIntervalMs = options.pollIntervalMs ?? 5000;
  const excludeCodes = options.excludeCodes || [];

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
  const mailboxPath = `users/${encodeURIComponent(email)}${folder ? `/mailFolders/${encodeURIComponent(folder)}` : ''}`;
  const graphUrl = `https://graph.microsoft.com/v1.0/${mailboxPath}/messages?$top=10&$orderby=receivedDateTime desc`;

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const mailRes = await fetch(graphUrl, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!mailRes.ok) {
      throw new Error(`Failed to fetch Outlook emails via Graph API: ${mailRes.statusText}`);
    }

    const mailData = (await mailRes.json()) as {
      value?: Array<{ subject?: string; body?: { content?: string } }>;
    };

    for (const message of mailData.value || []) {
      const code = extractCodeFromText(message.body?.content || message.subject || '');
      if (code && !excludeCodes.includes(code)) {
        return code;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `Could not find a new verification code in ${email}${folder ? `/${folder}` : ''} before timeout.`
  );
}
