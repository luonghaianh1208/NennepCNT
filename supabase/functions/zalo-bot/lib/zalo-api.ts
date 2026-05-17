const ZALO_API_BASE = 'https://bot-api.zaloplatforms.com/bot';

function buildZaloUrl(endpoint: string): string {
  const token = Deno.env.get('ZALO_BOT_TOKEN');
  if (!token) {
    throw new Error('ZALO_BOT_TOKEN is not set');
  }
  return `${ZALO_API_BASE}${token}${endpoint}`;
}

export interface SendMessageRequest {
  recipient: { group_id?: string; user_id?: string };
  message: { text: string };
}

export async function sendGroupMessage(groupId: string, message: string): Promise<void> {
  const token = Deno.env.get('ZALO_BOT_TOKEN');
  if (!token) {
    throw new Error('ZALO_BOT_TOKEN is not set');
  }

  const url = buildZaloUrl('/sendMessage');

  const body: SendMessageRequest = {
    recipient: { group_id: groupId },
    message: { text },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
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

  const body: SendMessageRequest = {
    recipient: { user_id: userId },
    message: { text },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Zalo API error: ${response.status} - ${errorText}`);
  }
}