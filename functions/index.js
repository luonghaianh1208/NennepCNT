/**
 * Cloud Functions quản lý tài khoản — những việc mà trình duyệt không được phép làm.
 *
 * Nguyên tắc:
 * - Chỉ tài khoản có vai trò ADMIN mới gọi được
 * - Không ai đặt mật khẩu hộ người khác: hệ thống gửi link để họ tự đặt
 * - "Xoá" mặc định là vô hiệu hoá, giữ nguyên dấu vết người nhập liệu;
 *   chỉ xoá hẳn khi tài khoản chưa từng ghi bản ghi nào
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

setGlobalOptions({ region: 'asia-southeast1', maxInstances: 10 });

initializeApp();
const auth = getAuth();
const db = getFirestore();

const MAX_IMPORT = 200;

/** Chặn mọi lời gọi không phải từ quản trị viên đã đăng nhập */
const requireAdmin = (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Bạn cần đăng nhập.');
  if (request.auth.token.role !== 'ADMIN') {
    throw new HttpsError('permission-denied', 'Chỉ quản trị viên mới thực hiện được thao tác này.');
  }
  return request.auth;
};

const writeAudit = (actor, action, details, targetId) =>
  db.collection('auditLogs').add({
    timestamp: Date.now(),
    userId: actor.uid,
    userName: actor.token.name || actor.token.email || actor.uid,
    userRole: actor.token.role || '',
    action,
    details,
    targetId: targetId || '',
    createdAt: FieldValue.serverTimestamp(),
  });

/** Tạo tài khoản Auth + hồ sơ Firestore, mật khẩu tạm ngẫu nhiên (người dùng tự đặt lại) */
const provision = async ({ name, email, role, className }) => {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail.includes('@')) throw new HttpsError('invalid-argument', `Email không hợp lệ: ${email}`);

  const user = await auth.createUser({
    email: cleanEmail,
    password: `Tmp@${Math.random().toString(36).slice(2, 10)}`,
    displayName: String(name || cleanEmail),
  });
  await auth.setCustomUserClaims(user.uid, { role: String(role || 'GUEST').toUpperCase() });
  await db.collection('users').doc(user.uid).set({
    id: user.uid,
    name: String(name || cleanEmail),
    username: cleanEmail,
    email: cleanEmail,
    role: String(role || 'GUEST').toUpperCase(),
    className: String(className || ''),
    summaryMeetings: 0,
    active: true,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Link đặt mật khẩu lần đầu — trả về để quản trị viên gửi tay nếu cần
  const setupLink = await auth.generatePasswordResetLink(cleanEmail);
  return { uid: user.uid, email: cleanEmail, setupLink };
};

// ── 1. Tạo một tài khoản ────────────────────────────────────────────────────
exports.createAccount = onCall(async (request) => {
  const actor = requireAdmin(request);
  const result = await provision(request.data || {});
  await writeAudit(actor, 'CREATE_ACCOUNT', `Tạo tài khoản ${result.email}`, result.uid);
  return result;
});

// ── 2. Tạo hàng loạt (import từ Excel) ──────────────────────────────────────
exports.importAccounts = onCall(async (request) => {
  const actor = requireAdmin(request);
  const rows = Array.isArray(request.data?.accounts) ? request.data.accounts : [];
  if (!rows.length) throw new HttpsError('invalid-argument', 'Danh sách tài khoản trống.');
  if (rows.length > MAX_IMPORT) {
    throw new HttpsError('invalid-argument', `Mỗi lần chỉ nhập tối đa ${MAX_IMPORT} tài khoản.`);
  }

  const created = [];
  const failed = [];
  for (const row of rows) {
    try {
      created.push(await provision(row));
    } catch (e) {
      failed.push({ email: row?.email ?? '', reason: e?.message ?? String(e) });
    }
  }
  await writeAudit(actor, 'IMPORT_ACCOUNTS', `Nhập ${created.length} tài khoản, lỗi ${failed.length}`);
  return { created, failed };
});

// ── 3. Gửi lại link đặt mật khẩu ────────────────────────────────────────────
exports.sendPasswordReset = onCall(async (request) => {
  const actor = requireAdmin(request);
  const email = String(request.data?.email || '').trim().toLowerCase();
  if (!email) throw new HttpsError('invalid-argument', 'Thiếu email.');

  const link = await auth.generatePasswordResetLink(email);
  await writeAudit(actor, 'RESET_PASSWORD', `Cấp lại mật khẩu cho ${email}`);
  return { email, link };
});

// ── 4. Khoá / mở khoá tài khoản ─────────────────────────────────────────────
exports.setAccountStatus = onCall(async (request) => {
  const actor = requireAdmin(request);
  const { uid, active } = request.data || {};
  if (!uid) throw new HttpsError('invalid-argument', 'Thiếu mã tài khoản.');
  if (uid === actor.uid && active === false) {
    throw new HttpsError('failed-precondition', 'Không thể tự khoá tài khoản của chính mình.');
  }

  await auth.updateUser(uid, { disabled: !active });
  await db.collection('users').doc(uid).set({ active: !!active }, { merge: true });
  await writeAudit(actor, 'SET_ACCOUNT_STATUS', active ? 'Mở khoá tài khoản' : 'Khoá tài khoản', uid);
  return { uid, active: !!active };
});

// ── 5. Đổi vai trò ──────────────────────────────────────────────────────────
exports.setAccountRole = onCall(async (request) => {
  const actor = requireAdmin(request);
  const { uid, role } = request.data || {};
  if (!uid || !role) throw new HttpsError('invalid-argument', 'Thiếu mã tài khoản hoặc vai trò.');

  // Không để hệ thống rơi vào cảnh không còn quản trị viên nào
  if (String(role).toUpperCase() !== 'ADMIN') {
    const current = await db.collection('users').doc(uid).get();
    if (current.data()?.role === 'ADMIN') {
      const admins = await db.collection('users').where('role', '==', 'ADMIN').count().get();
      if (admins.data().count <= 1) {
        throw new HttpsError('failed-precondition', 'Đây là quản trị viên cuối cùng, không thể hạ quyền.');
      }
    }
  }

  await auth.setCustomUserClaims(uid, { role: String(role).toUpperCase() });
  await db.collection('users').doc(uid).set({ role: String(role).toUpperCase() }, { merge: true });
  await writeAudit(actor, 'SET_ACCOUNT_ROLE', `Đổi vai trò thành ${role}`, uid);
  return { uid, role: String(role).toUpperCase() };
});

// ── 6. Xoá vĩnh viễn (chỉ khi tài khoản chưa từng nhập bản ghi nào) ─────────
exports.deleteAccount = onCall(async (request) => {
  const actor = requireAdmin(request);
  const uid = String(request.data?.uid || '');
  if (!uid) throw new HttpsError('invalid-argument', 'Thiếu mã tài khoản.');
  if (uid === actor.uid) throw new HttpsError('failed-precondition', 'Không thể tự xoá tài khoản của chính mình.');

  const [violations, achievements] = await Promise.all([
    db.collection('violations').where('reportedBy', '==', uid).limit(1).get(),
    db.collection('achievements').where('reportedBy', '==', uid).limit(1).get(),
  ]);
  if (!violations.empty || !achievements.empty) {
    throw new HttpsError(
      'failed-precondition',
      'Tài khoản này đã từng nhập dữ liệu nên không xoá được — hãy dùng chức năng khoá tài khoản để giữ nguyên dấu vết người nhập liệu.',
    );
  }

  await auth.deleteUser(uid);
  await db.collection('users').doc(uid).delete();
  await writeAudit(actor, 'DELETE_ACCOUNT', 'Xoá vĩnh viễn tài khoản', uid);
  return { uid, deleted: true };
});
