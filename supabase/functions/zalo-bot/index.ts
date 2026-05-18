import { sendGroupMessage, sendUserMessage } from './lib/zalo-api.ts';
import { handleStatistics, handleRanking } from './handlers/statistics.ts';
import { handleQA } from './handlers/qa.ts';
import type { ZaloWebhookPayload } from './types.ts';

const ZALO_BOT_TOKEN = Deno.env.get('ZALO_BOT_TOKEN')!;
const ZALO_BOT_SECRET_TOKEN = Deno.env.get('ZALO_BOT_SECRET_TOKEN')!;

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  const url = new URL(req.url);

  // GET: Webhook verification
  if (req.method === 'GET') {
    const hubVerifyToken = url.searchParams.get('hub.verify_token');
    const hubChallenge = url.searchParams.get('hub.challenge');

    const expectedToken = ZALO_BOT_SECRET_TOKEN;
    if (hubVerifyToken === expectedToken) {
      return new Response(hubChallenge, { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  // POST: Handle incoming events
  if (req.method === 'POST') {
    try {
      // Verify X-Bot-Api-Secret-Token header (required by Zalo webhook)
      const apiSecretToken = req.headers.get('X-Bot-Api-Secret-Token');
      if (apiSecretToken !== ZALO_BOT_SECRET_TOKEN) {
        console.error('Invalid bot api secret token');
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const payload: ZaloWebhookPayload = await req.json();
      const eventName = payload?.result?.event_name;

      // Only handle message events
      if (!eventName?.startsWith('message.')) {
        return new Response(JSON.stringify({ success: true, ignored: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const message = payload.result.message;
      const senderId = message.from.id;
      const chatType = message.chat.chat_type;
      const chatId = message.chat.id;
      const text = message.text?.trim() ?? '';

      if (!text) {
        return new Response(JSON.stringify({ success: true, ignored: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Process command and get response
      const response = await processCommand(text);

      // Send response based on chat type
      if (chatType === 'GROUP') {
        await sendGroupMessage(chatId, response);
      } else {
        await sendUserMessage(senderId, response);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error processing webhook:', error);
      return new Response(JSON.stringify({ success: false, error: String(error) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response('Method not allowed', { status: 405 });
});

async function processCommand(content: string): Promise<string> {
  const normalized = content.toLowerCase().trim();

  // Remove @bot prefix if present
  const withoutPrefix = normalized.replace(/^@bot\s*/i, '');

  // Parse command
  if (withoutPrefix.startsWith('thống kê') || withoutPrefix.startsWith('tk')) {
    const period = extractPeriod(withoutPrefix);
    const stats = await handleStatistics(period);
    return formatStatisticsResponse(stats);
  }

  if (withoutPrefix.startsWith('xếp hạng') || withoutPrefix === 'ranking' || withoutPrefix === 'rank') {
    return await handleRanking();
  }

  if (withoutPrefix.startsWith('hỏi')) {
    return await handleQA(withoutPrefix);
  }

  if (withoutPrefix === 'help' || withoutPrefix === 'trợ giúp' || withoutPrefix === '?') {
    return getHelpText();
  }

  // Unknown command - show help
  return `Tôi không hiểu lệnh "${content}"\n\n${getHelpText()}`;
}

function extractPeriod(input: string): string {
  if (input.includes('tuần')) return 'tuần';
  if (input.includes('tháng')) return 'tháng';
  if (input.includes('học kỳ') || input.includes('hk')) return 'học kỳ';
  return 'tuần'; // Default to week
}

function formatStatisticsResponse(stats: {
  totalViolations: number;
  totalAchievements: number;
  topStudents: { name: string; classId: string; points: number }[];
  topClasses: { name: string; grade: number; avgScore: number }[];
  periodLabel: string;
}): string {
  let response = `📊 THỐNG KÊ ${stats.periodLabel.toUpperCase()}\n\n`;
  response += `Tổng vi phạm: ${stats.totalViolations}\n`;
  response += `Tổng thành tích: ${stats.totalAchievements}\n`;

  if (stats.topClasses.length > 0) {
    response += `\n🏅 Top lớp:\n`;
    for (const c of stats.topClasses.slice(0, 3)) {
      response += `• ${c.name} (Khối ${c.grade}): ${c.avgScore.toFixed(1)} điểm/vi phạm\n`;
    }
  }

  return response;
}

function getHelpText(): string {
  return `🤖 BOT HƯỚNG DẪN\n\n` +
    `Dùng @bot trong nhóm hoặc nhắn riêng cho bot:\n\n` +
    `📊 "@bot thống kê [tuần/tháng/học kỳ]" - Xem thống kê\n` +
    `🏆 "@bot xếp hạng" - Xếp hạng các lớp\n` +
    `❓ "@bot hỏi lớp TênLớp" - Hỏi thông tin lớp\n` +
    `❓ "@bot hỏi hs TênHS" - Hỏi thông tin học sinh\n` +
    `📖 "@bot help" - Xem hướng dẫn này`;
}