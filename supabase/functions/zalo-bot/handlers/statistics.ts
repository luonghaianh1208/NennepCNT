import { createClient } from 'jsr:@supabase/supabase-js@2';
import type { ViolationStats } from '../types.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function handleStatistics(period: string): Promise<ViolationStats> {
  const admin = getSupabaseAdmin();
  const now = new Date();

  let startDate: Date;
  let endDate: Date = now;
  let periodLabel: string;

  switch (period) {
    case 'tuần':
    case 'tuần này': {
      // Start of current week (Monday)
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      startDate = new Date(now);
      startDate.setDate(now.getDate() + mondayOffset);
      startDate.setHours(0, 0, 0, 0);
      periodLabel = 'Tuần này';
      break;
    }
    case 'tháng':
    case 'tháng này': {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      periodLabel = 'Tháng này';
      break;
    }
    case 'học kỳ':
    case 'học kỳ này': {
      // Determine current semester based on month
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      if (month >= 1 && month <= 5) {
        // HK2 of previous academic year
        startDate = new Date(year, 0, 15); // Jan 15
        periodLabel = `HK2 ${year - 1}-${year}`;
      } else if (month >= 9 && month <= 12) {
        // HK1 of current academic year
        startDate = new Date(year, 8, 15); // Sep 15
        periodLabel = `HK1 ${year}-${year + 1}`;
      } else {
        // Summer break - use current month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        periodLabel = 'Học kỳ hiện tại';
      }
      break;
    }
    default:
      throw new Error(`Unknown period: ${period}`);
  }

  const startTimestamp = startDate.getTime();
  const endTimestamp = endDate.getTime();

  // Query violations in period
  const { data: violations } = await admin
    .from('violations')
    .select('*, criteria(*)')
    .gte('timestamp', startTimestamp)
    .lte('timestamp', endTimestamp);

  // Query achievements in period
  const { data: achievements } = await admin
    .from('achievements')
    .select('*')
    .gte('timestamp', startTimestamp)
    .lte('timestamp', endTimestamp);

  const totalViolations = violations?.length ?? 0;
  const totalAchievements = achievements?.length ?? 0;

  // Calculate top students
  const studentScores: Record<string, { name: string; classId: string; points: number }> = {};
  if (violations) {
    for (const v of violations) {
      if (v.studentId) {
        if (!studentScores[v.studentId]) {
          studentScores[v.studentId] = { name: v.studentName ?? 'Unknown', classId: v.classId, points: 0 };
        }
        studentScores[v.studentId].points += v.points;
      }
    }
  }

  const topStudents = Object.values(studentScores)
    .sort((a, b) => b.points - a.points)
    .slice(0, 5);

  // Calculate top classes
  const classScores: Record<string, { name: string; grade: number; totalPoints: number; count: number }> = {};
  if (violations) {
    for (const v of violations) {
      if (!classScores[v.classId]) {
        classScores[v.classId] = { name: v.className ?? 'Unknown', grade: v.classGrade ?? 0, totalPoints: 0, count: 0 };
      }
      classScores[v.classId].totalPoints += v.points;
      classScores[v.classId].count += 1;
    }
  }

  const topClasses = Object.values(classScores)
    .map(c => ({ name: c.name, grade: c.grade, avgScore: c.count > 0 ? c.totalPoints / c.count : 0 }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 5);

  return {
    totalViolations,
    totalAchievements,
    topStudents,
    topClasses,
    periodLabel,
  };
}

export async function handleRanking(): Promise<string> {
  const admin = getSupabaseAdmin();
  const now = new Date();

  // Get current semester boundaries
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  let startDate: Date;

  if (month >= 1 && month <= 5) {
    startDate = new Date(year, 0, 15);
  } else if (month >= 9 && month <= 12) {
    startDate = new Date(year, 8, 15);
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const startTimestamp = startDate.getTime();

  // Get all violations for current semester
  const { data: violations } = await admin
    .from('violations')
    .select('*, classes(*)')
    .gte('timestamp', startTimestamp);

  if (!violations || violations.length === 0) {
    return 'Chưa có dữ liệu vi phạm trong học kỳ này.';
  }

  // Calculate class rankings
  const classScores: Record<string, { name: string; grade: number; totalPoints: number }> = {};
  for (const v of violations) {
    const classId = v.classId;
    if (!classScores[classId]) {
      classScores[classId] = {
        name: v.classes?.name ?? 'Unknown',
        grade: v.classes?.grade ?? 0,
        totalPoints: 0,
      };
    }
    classScores[classId].totalPoints += v.points;
  }

  const rankings = Object.values(classScores)
    .sort((a, b) => b.totalPoints - a.totalPoints);

  let response = '🏆 XẾP HẠNG HỌC KỲ\n\n';
  for (let i = 0; i < rankings.length; i++) {
    const r = rankings[i];
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    response += `${medal} ${r.name} (Khối ${r.grade}): ${r.totalPoints} điểm\n`;
  }

  return response;
}