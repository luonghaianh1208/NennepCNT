import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables');
}
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// ── Auth helpers ──────────────────────────────────────────────
export const signIn = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password });

export const signOut = () => supabase.auth.signOut();

export const getSession = () => supabase.auth.getSession();

export const onAuthStateChange = (callback: (event: string, session: any) => void) =>
  supabase.auth.onAuthStateChange(callback);

// ── CRUD helpers ──────────────────────────────────────────────
export const getAllData = async () => {
  const [
    { data: users },
    { data: classes },
    { data: students },
    { data: criteria },
    { data: violations },
    { data: timeConfigs },
  ] = await Promise.all([
    supabase.from('user_profiles').select('*'),
    supabase.from('classes').select('*'),
    supabase.from('students').select('*'),
    supabase.from('criteria').select('*'),
    supabase.from('violations').select('*, criteria(*), students(*)').order('timestamp', { ascending: false }),
    supabase.from('time_configs').select('*').order('start_date'),
  ]);

  return { users, classes, students, criteria, violations, timeConfigs };
};

export const createViolation = (violation: any) =>
  supabase.from('violations').insert(violation).select().single();

export const updateViolation = (violation: any) =>
  supabase.from('violations').update(violation).eq('id', violation.id);

export const deleteViolation = (id: string) =>
  supabase.from('violations').delete().eq('id', id);

export const deleteViolations = (ids: string[]) =>
  supabase.from('violations').delete().in('id', ids);

export const batchCreateViolations = (records: any[]) =>
  supabase.from('violations').insert(records);

export const batchUpdateViolations = (records: any[]) =>
  supabase.from('violations').upsert(records, { onConflict: 'id' });

export const syncSettings = (payload: {
  classes?: any[];
  students?: any[];
  criteria?: any[];
  timeConfigs?: any[];
}) => Promise.all([
  payload.classes?.length && supabase.from('classes').upsert(payload.classes),
  payload.students?.length && supabase.from('students').upsert(payload.students),
  payload.criteria?.length && supabase.from('criteria').upsert(payload.criteria),
  payload.timeConfigs?.length && supabase.from('time_configs').upsert(payload.timeConfigs),
]);

export const syncUsers = (users: any[]) =>
  supabase.from('user_profiles').upsert(users);

export const getAuditLogs = () =>
  supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(500);

export const saveAuditLog = (log: any) =>
  supabase.from('audit_logs').insert(log);

// ── Storage ───────────────────────────────────────────────────
export const uploadViolationImage = async (
  file: Blob,
  fileNameInfo: { className: string; studentName: string; violation: string; date: string }
): Promise<string> => {
  const safeName = `${fileNameInfo.className}_${fileNameInfo.studentName}_${fileNameInfo.violation}_${fileNameInfo.date}`
    .replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  const fileName = `${safeName}_${Date.now()}.webp`;

  const { data, error } = await supabase.storage
    .from('violation-images')
    .upload(fileName, file, {
      contentType: 'image/webp',
      upsert: false,
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('violation-images')
    .getPublicUrl(fileName);

  if (!urlData?.publicUrl) {
    throw new Error('Failed to get public URL after upload');
  }
  return urlData.publicUrl;
};