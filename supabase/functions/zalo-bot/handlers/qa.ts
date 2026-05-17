import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

interface QaResult {
  type: 'class' | 'student';
  name: string;
  totalViolations: number;
  totalPoints: number;
  latestViolation?: {
    date: string;
    content: string;
    points: number;
  };
}

export async function handleQA(question: string): Promise<string> {
  const admin = getSupabaseAdmin();
  const normalized = question.trim().toLowerCase();

  // Parse question: "hỏi lớp X" or "hỏi hs X"
  const classMatch = normalized.match(/hỏi\s+lớp\s+(.+)/);
  const studentMatch = normalized.match(/hỏi\s+hs\s+(.+)/);

  if (!classMatch && !studentMatch) {
    return `Tôi không hiểu câu hỏi. Dùng:\n• "hỏi lớp TênLớp" - xem vi phạm lớp\n• "hỏi hs TênHS" - xem vi phạm học sinh`;
  }

  if (classMatch) {
    const className = classMatch[1].trim();
    const result = await queryClassViolations(admin, className);
    return formatClassResponse(result);
  }

  if (studentMatch) {
    const studentName = studentMatch[1].trim();
    const result = await queryStudentViolations(admin, studentName);
    return formatStudentResponse(result);
  }
}

async function queryClassViolations(admin: ReturnType<typeof getSupabaseAdmin>, className: string) {
  // Find class by name (case-insensitive)
  const { data: classes } = await admin
    .from('classes')
    .select('id, name')
    .ilike('name', className)
    .limit(1);

  if (!classes || classes.length === 0) {
    return { type: 'class' as const, name: className, totalViolations: 0, totalPoints: 0 };
  }

  const classId = classes[0].id;

  // Get violations for this class
  const { data: violations } = await admin
    .from('violations')
    .select('*, criteria(*)')
    .eq('classId', classId)
    .order('timestamp', { ascending: false })
    .limit(10);

  let totalPoints = 0;
  if (violations) {
    for (const v of violations) {
      totalPoints += v.points;
    }
  }

  return {
    type: 'class' as const,
    name: className,
    totalViolations: violations?.length ?? 0,
    totalPoints,
    latestViolation: violations?.[0] ? {
      date: violations[0].date,
      content: violations[0].criteria?.content ?? 'N/A',
      points: violations[0].points,
    } : undefined,
  };
}

async function queryStudentViolations(admin: ReturnType<typeof getSupabaseAdmin>, studentName: string) {
  // Find student by name (case-insensitive)
  const { data: students } = await admin
    .from('students')
    .select('id, name, classId')
    .ilike('name', `%${studentName}%`)
    .limit(1);

  if (!students || students.length === 0) {
    return { type: 'student' as const, name: studentName, totalViolations: 0, totalPoints: 0 };
  }

  const student = students[0];

  // Get violations for this student
  const { data: violations } = await admin
    .from('violations')
    .select('*, criteria(*)')
    .eq('studentId', student.id)
    .order('timestamp', { ascending: false })
    .limit(10);

  let totalPoints = 0;
  if (violations) {
    for (const v of violations) {
      totalPoints += v.points;
    }
  }

  return {
    type: 'student' as const,
    name: student.name,
    totalViolations: violations?.length ?? 0,
    totalPoints,
    latestViolation: violations?.[0] ? {
      date: violations[0].date,
      content: violations[0].criteria?.content ?? 'N/A',
      points: violations[0].points,
    } : undefined,
  };
}

function formatClassResponse(result: QaResult): string {
  let response = `📊 THÔNG TIN LỚP ${result.name.toUpperCase()}\n\n`;
  response += `Tổng vi phạm: ${result.totalViolations}\n`;
  response += `Tổng điểm: ${result.totalPoints}\n`;

  if (result.latestViolation) {
    response += `\nVi phạm gần nhất (${result.latestViolation.date}):\n`;
    response += `• ${result.latestViolation.content}\n`;
    response += `• ${result.latestViolation.points} điểm`;
  }

  return response;
}

function formatStudentResponse(result: QaResult): string {
  let response = `👤 THÔNG TIN HỌC SINH ${result.name.toUpperCase()}\n\n`;
  response += `Tổng vi phạm: ${result.totalViolations}\n`;
  response += `Tổng điểm: ${result.totalPoints}\n`;

  if (result.latestViolation) {
    response += `\nVi phạm gần nhất (${result.latestViolation.date}):\n`;
    response += `• ${result.latestViolation.content}\n`;
    response += `• ${result.latestViolation.points} điểm`;
  }

  return response;
}