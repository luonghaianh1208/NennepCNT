const ZALO_API_BASE = 'https://bot-api.zaloplatforms.com/bot';

function buildZaloUrl(endpoint: string): string {
  const token = Deno.env.get('ZALO_BOT_TOKEN');
  if (!token) {
    throw new Error('ZALO_BOT_TOKEN is not set');
  }
  return `${ZALO_API_BASE}${token}${endpoint}`;
}

export interface ZaloSendMessageRequest {
  chat_id: string;
  text: string;
}

export async function sendGroupMessage(groupId: string, message: string): Promise<unknown> {
  const token = Deno.env.get('ZALO_BOT_TOKEN');
  if (!token) {
    throw new Error('ZALO_BOT_TOKEN is not set');
  }

  const url = buildZaloUrl('/sendMessage');

  const body: ZaloSendMessageRequest = {
    chat_id: groupId,
    text: message,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000), // 10 second timeout
  });

  const responseText = await response.text();
  console.log('Zalo API response:', response.status, responseText);

  if (!response.ok) {
    throw new Error(`Zalo API error: ${response.status} - ${responseText}`);
  }

  return JSON.parse(responseText);
}

export async function sendUserMessage(userId: string, message: string): Promise<unknown> {
  const token = Deno.env.get('ZALO_BOT_TOKEN');
  if (!token) {
    throw new Error('ZALO_BOT_TOKEN is not set');
  }

  const url = buildZaloUrl('/sendMessage');

  const body: ZaloSendMessageRequest = {
    chat_id: userId,
    text: message,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000), // 10 second timeout
  });

  const responseText = await response.text();
  console.log('Zalo API response:', response.status, responseText);

  if (!response.ok) {
    throw new Error(`Zalo API error: ${response.status} - ${responseText}`);
  }

  return JSON.parse(responseText);
}