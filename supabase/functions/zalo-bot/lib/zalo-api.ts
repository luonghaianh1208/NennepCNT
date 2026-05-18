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

export async function sendGroupMessage(groupId: string, message: string): Promise<void> {
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
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Zalo API error: ${response.status} - ${errorText}`);
  }
}

export async function sendUserMessage(userId: string, message: string): Promise<void> {
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
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Zalo API error: ${response.status} - ${errorText}`);
  }
}