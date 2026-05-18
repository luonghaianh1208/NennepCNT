import { sendGroupMessage, sendUserMessage } from './lib/zalo-api.ts';
import { handleStatistics, handleRanking } from './handlers/statistics.ts';
import { handleQA } from './handlers/qa.ts';
import type { ZaloWebhookPayload } from './types.ts';

const ZALO_BOT_TOKEN = Deno.env.get('ZALO_BOT_TOKEN')!;
const ZALO_BOT_SECRET_TOKEN = Deno.env.get('ZALO_BOT_SECRET_TOKEN')!;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;

const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `Bạn là trợ lý AI của hệ thống Nền Nếp CNT - hệ thống quản lý vi phạm và thành tích học sinh trường THPT Chuyên Nguyễn Trãi (Hải Dương).

Hệ thống có các chức năng:
- Quản lý vi phạm/thành tích của học sinh
- Xếp hạng các lớp theo nền nếp
- Thống kê vi phạm theo tuần/tháng/học kỳ
- Hỏi đáp về thông tin lớp và học sinh

Khi người dùng hỏi về:
- "thống kê", "tk", "báo cáo" → gọi handleStatistics
- "xếp hạng", "ranking", "rank" → gọi handleRanking
- "hỏi lớp", "hỏi hs", "hỏi học sinh" → gọi handleQA
- "help", "trợ giúp", "?" → trả về hướng dẫn

Nếu câu hỏi không rõ ràng, hãy trả lời thân thiện và hỏi thêm chi tiết. Luôn trả lời bằng tiếng Việt, ngắn gọn, dễ hiểu.`;

// Check if message contains command keywords
function isRuleBasedCommand(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.startsWith('thống kê') || lower.startsWith('tk') ||
         lower.startsWith('xếp hạng') || lower === 'ranking' || lower === 'rank' ||
         lower.startsWith('hỏi') ||
         lower === 'help' || lower === 'trợ giúp' || lower === '?';
}

// Format statistics as text
function formatStatisticsText(stats: {
  totalViolations: number;
  totalAchievements: number;
  topStudents: { name: string; classId: string; points: number }[];
  topClasses: { name: string; grade: number; avgScore: number }[];
  periodLabel: string;
}): string {
  let text = `📊 THỐNG KÊ ${stats.periodLabel.toUpperCase()}\n\n`;
  text += `Tổng vi phạm: ${stats.totalViolations}\n`;
  text += `Tổng thành tích: ${stats.totalAchievements}\n`;
  if (stats.topClasses.length > 0) {
    text += `\n🏅 Top lớp:\n`;
    for (const c of stats.topClasses.slice(0, 3)) {
      text += `• ${c.name} (Khối ${c.grade}): ${c.avgScore.toFixed(1)} điểm/vi phạm\n`;
    }
  }
  return text;
}

// Format ranking as text
function formatRankingText(ranking: string): string {
  return ranking;
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

async function callGeminiAI(userMessage: string): Promise<string> {
  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `${SYSTEM_PROMPT}\n\nNgười dùng: ${userMessage}`
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Gemini API error:', error);
    return null;
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

async function processCommand(content: string): Promise<string> {
  const normalized = content.toLowerCase().trim();
  const withoutPrefix = normalized.replace(/^@bot\s*/i, '');

  // Rule-based commands first
  if (withoutPrefix.startsWith('thống kê') || withoutPrefix.startsWith('tk')) {
    const period = extractPeriod(withoutPrefix);
    const stats = await handleStatistics(period);
    return formatStatisticsText(stats);
  }

  if (withoutPrefix.startsWith('xếp hạng') || withoutPrefix === 'ranking' || withoutPrefix === 'rank') {
    const ranking = await handleRanking();
    return formatRankingText(ranking);
  }

  if (withoutPrefix.startsWith('hỏi')) {
    return await handleQA(withoutPrefix);
  }

  if (withoutPrefix === 'help' || withoutPrefix === 'trợ giúp' || withoutPrefix === '?') {
    return getHelpText();
  }

  // Use Gemini AI for everything else
  const aiResponse = await callGeminiAI(withoutPrefix);
  if (aiResponse) {
    return aiResponse;
  }

  // Fallback if AI fails
  return `Tôi không hiểu "${content}". Gõ "@bot help" để xem các lệnh.`;
}

function extractPeriod(input: string): string {
  if (input.includes('tuần')) return 'tuần';
  if (input.includes('tháng')) return 'tháng';
  if (input.includes('học kỳ') || input.includes('hk')) return 'học kỳ';
  return 'tuần';
}

Deno.serve(async (req) => {
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
    if (hubVerifyToken === ZALO_BOT_SECRET_TOKEN) {
      return new Response(hubChallenge, { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  // POST: Handle incoming events
  if (req.method === 'POST') {
    try {
      const apiSecretToken = req.headers.get('X-Bot-Api-Secret-Token');
      if (apiSecretToken !== ZALO_BOT_SECRET_TOKEN) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const payload: ZaloWebhookPayload = await req.json();
      const eventName = payload?.result?.event_name;

      // Handle follow event
      if (eventName === 'follow' || eventName === 'user.follow') {
        const senderId = payload.result.message.from.id;
        const chatType = payload.result.message.chat.chat_type;
        const response = getHelpText();

        if (chatType === 'GROUP') {
          await sendGroupMessage(payload.result.message.chat.id, response);
        } else {
          await sendUserMessage(senderId, response);
        }
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

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

      // Process command and get AI response
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