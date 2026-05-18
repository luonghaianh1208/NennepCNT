// supabase/functions/zalo-scheduler/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ZALO_BOT_TOKEN = Deno.env.get('ZALO_BOT_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

serve(async (req: Request) => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const dayOfMonth = now.getDate();

  try {
    // Weekly: Sunday (dayOfWeek === 0)
    if (dayOfWeek === 0) {
      await sendWeeklyReport();
    }

    // Monthly: day 28-31
    if (dayOfMonth >= 28) {
      await sendMonthlyReport();
    }

    return Response.json({ status: 'ok', timestamp: now.toISOString() });
  } catch (err) {
    console.error('Zalo scheduler error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});

async function sendWeeklyReport(): Promise<void> {
  // Calculate week start (Monday) and end (Sunday)
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + diff);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const startStr = weekStart.toISOString().split('T')[0];
  const endStr = weekEnd.toISOString().split('T')[0];

  const { data: violations } = await supabase
    .from('violations')
    .select('id, date, class_id, points, criteria(type)')
    .gte('date', startStr)
    .lte('date', endStr);

  if (!violations || violations.length === 0) return;

  const totalMinus = violations.filter(v => v.criteria?.type === 'MINUS').reduce((s, v) => s + v.points, 0);
  const totalPlus = violations.filter(v => v.criteria?.type === 'PLUS').reduce((s, v) => s + Math.abs(v.points), 0);

  const classCount: Record<string, number> = {};
  violations.filter(v => v.criteria?.type === 'MINUS')
    .forEach(v => { classCount[v.class_id] = (classCount[v.class_id] || 0) + 1; });

  const topClasses = Object.entries(classCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, c]) => `• Lớp ${id}: ${c} vi phạm`)
    .join('\n');

  const message = `📅 **BÁO CÁO TUẦN NÀY** (${startStr} → ${endStr})\n\n`
    + `📌 Tổng vi phạm: ${violations.filter(v => v.criteria?.type === 'MINUS').length}\n`
    + `📌 Tổng điểm trừ: ${totalMinus} | Tổng điểm cộng: ${totalPlus}\n\n`
    + `🏆 Top lớp:\n${topClasses}`;

  await sendToAllGroups(message, 'weekly');
}

async function sendMonthlyReport(): Promise<void> {
  const now = new Date();
  const startStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const endStr = now.toISOString().split('T')[0];

  const { data: violations } = await supabase
    .from('violations')
    .select('id, class_id, points, criteria(type)')
    .gte('date', startStr)
    .lte('date', endStr);

  if (!violations || violations.length === 0) return;

  const totalMinus = violations.filter(v => v.criteria?.type === 'MINUS').reduce((s, v) => s + v.points, 0);
  const totalViolations = violations.filter(v => v.criteria?.type === 'MINUS').length;

  const message = `📊 **BÁO CÁO THÁNG ${now.getMonth()+1}/${now.getFullYear()}**\n\n`
    + `📌 Tổng vi phạm: ${totalViolations}\n`
    + `📌 Tổng điểm trừ: ${totalMinus}\n\n`
    + `📅 Đã gửi tự động bởi Bot Nền Nếp CNT`;

  await sendToAllGroups(message, 'monthly');
}

async function sendToAllGroups(message: string, notifyType: string): Promise<void> {
  const { data: groups } = await supabase
    .from('zalo_groups')
    .select('group_id, group_name, notify_types')
    .contains('notify_types', [notifyType]);

  if (!groups) return;

  for (const group of groups) {
    await sendZaloMessage(group.group_id, message);
  }
}

async function sendZaloMessage(groupId: string, message: string): Promise<void> {
  await fetch(`https://bot-api.zaloplatforms.com/bot${ZALO_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ZALO_BOT_TOKEN}`,
    },
    body: JSON.stringify({
      chat_id: groupId,
      text: message,
    }),
  });
}