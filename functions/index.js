/**
 * Cloud Functions quản lý tài khoản — những việc mà trình duyệt không được phép làm.
 *
 * Hệ thống đăng nhập BẰNG TÀI KHOẢN GOOGLE, không có mật khẩu riêng. Quản trị
 * viên không tạo tài khoản cho ai cả — chỉ ghi email vào DANH SÁCH CHO PHÉP
 * (`allowlist`). Ai đăng nhập Google mà email nằm trong danh sách thì `claimAccess`
 * gắn vai trò cho họ ngay lần đầu; không có trong danh sách thì bị từ chối.
 *
 * Vì sao làm vậy: cách cũ gửi thư đặt mật khẩu cho từng người. Thư gửi từ một
 * tên miền lạ nên hay vào hộp thư rác, và học sinh cờ đỏ — nhóm dùng nhiều nhất
 * — thường không kiểm tra hộp thư. Đầu năm cấp 200 tài khoản là 200 đường có
 * thể đứt.
 *
 * Nguyên tắc giữ nguyên:
 * - Chỉ vai trò ADMIN mới gọi được các hàm quản trị
 * - "Xoá" mặc định là khoá, giữ nguyên dấu vết người nhập liệu; chỉ xoá hẳn khi
 *   tài khoản chưa từng ghi bản ghi nào
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

/** Email là khoá của danh sách cho phép — chuẩn hoá để "A@X.COM" và "a@x.com" là một */
const emailKey = (email) => String(email || '').trim().toLowerCase();

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

/** Ghi một email vào danh sách cho phép. Chưa tạo tài khoản đăng nhập nào cả. */
const addToAllowlist = async ({ name, email, role, className }) => {
  const key = emailKey(email);
  if (!key.includes('@')) throw new HttpsError('invalid-argument', `Email không hợp lệ: ${email}`);

  const ref = db.collection('allowlist').doc(key);
  if ((await ref.get()).exists) {
    throw new HttpsError('already-exists', `${key} đã có trong danh sách.`);
  }
  await ref.set({
    email: key,
    name: String(name || key),
    role: String(role || 'GUEST').toUpperCase(),
    className: String(className || ''),
    active: true,
    // Điền khi người đó đăng nhập lần đầu — quản trị viên nhìn vào biết ai đã dùng
    uid: '',
    lastSignIn: null,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { email: key };
};

// ── 0. Nhận quyền sau khi đăng nhập Google ──────────────────────────────────
//
// Hàm DUY NHẤT ở đây mà người thường gọi được. Trước khi gọi, tài khoản Google
// vừa đăng nhập chưa có vai trò nào nên luật dữ liệu chặn hết — đúng như mong đợi.
exports.claimAccess = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Bạn cần đăng nhập.');

  // Lấy email từ token đã xác thực, KHÔNG lấy từ dữ liệu client gửi lên
  const email = emailKey(request.auth.token.email);
  if (!email) throw new HttpsError('failed-precondition', 'Tài khoản Google này không có địa chỉ email.');

  const entry = await db.collection('allowlist').doc(email).get();
  if (!entry.exists) {
    throw new HttpsError(
      'permission-denied',
      `Địa chỉ ${email} chưa được cấp quyền vào hệ thống. Liên hệ Đoàn trường để được thêm vào danh sách.`,
    );
  }

  const data = entry.data();
  if (data.active === false) {
    throw new HttpsError('permission-denied', 'Tài khoản của bạn đang bị khoá. Liên hệ Đoàn trường.');
  }

  const uid = request.auth.uid;
  const role = String(data.role || 'GUEST').toUpperCase();

  // Vai trò nằm trong custom claim — đây mới là thứ luật dữ liệu tin
  await auth.setCustomUserClaims(uid, { role });

  const profile = {
    id: uid,
    name: data.name || request.auth.token.name || email,
    username: email,
    email,
    role,
    className: String(data.className || ''),
    active: true,
  };
  await db.collection('users').doc(uid).set(
    { ...profile, summaryMeetings: data.summaryMeetings ?? 0 },
    { merge: true },
  );
  await entry.ref.set({ uid, lastSignIn: FieldValue.serverTimestamp() }, { merge: true });

  return profile;
});

// ── 1. Thêm một người vào danh sách cho phép ────────────────────────────────
exports.createAccount = onCall(async (request) => {
  const actor = requireAdmin(request);
  const result = await addToAllowlist(request.data || {});
  await writeAudit(actor, 'CREATE_ACCOUNT', `Cấp quyền cho ${result.email}`, result.email);
  return result;
});

// ── 2. Thêm hàng loạt (nhập từ Excel) ───────────────────────────────────────
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
      created.push(await addToAllowlist(row));
    } catch (e) {
      failed.push({ email: emailKey(row?.email), reason: e?.message ?? String(e) });
    }
  }
  await writeAudit(actor, 'IMPORT_ACCOUNTS', `Cấp quyền cho ${created.length} người, lỗi ${failed.length}`);
  return { created, failed };
});

// ── 3. Khoá / mở khoá ───────────────────────────────────────────────────────
exports.setAccountStatus = onCall(async (request) => {
  const actor = requireAdmin(request);
  const email = emailKey(request.data?.email);
  const active = request.data?.active !== false;
  if (!email) throw new HttpsError('invalid-argument', 'Thiếu email.');
  if (email === emailKey(actor.token.email) && !active) {
    throw new HttpsError('failed-precondition', 'Không thể tự khoá tài khoản của chính mình.');
  }

  const ref = db.collection('allowlist').doc(email);
  const entry = await ref.get();
  if (!entry.exists) throw new HttpsError('not-found', `${email} không có trong danh sách.`);

  await ref.set({ active }, { merge: true });

  // Chặn luôn ở tầng đăng nhập nếu người đó đã từng vào hệ thống
  const uid = entry.data().uid;
  if (uid) {
    await auth.updateUser(uid, { disabled: !active }).catch(() => {});
    await db.collection('users').doc(uid).set({ active }, { merge: true });
    // Thu hồi vai trò ngay, không đợi token cũ hết hạn sau một tiếng
    if (!active) await auth.setCustomUserClaims(uid, { role: 'GUEST' });
  }

  await writeAudit(actor, 'SET_ACCOUNT_STATUS', active ? `Mở khoá ${email}` : `Khoá ${email}`, email);
  return { email, active };
});

// ── 4. Đổi vai trò ──────────────────────────────────────────────────────────
exports.setAccountRole = onCall(async (request) => {
  const actor = requireAdmin(request);
  const email = emailKey(request.data?.email);
  const role = String(request.data?.role || '').toUpperCase();
  if (!email || !role) throw new HttpsError('invalid-argument', 'Thiếu email hoặc vai trò.');

  // Tự hạ quyền chính mình là đường khoá cứng hệ thống dễ đi nhất — nhờ người
  // quản trị khác làm hộ thì vẫn còn người bấm nút.
  if (email === emailKey(actor.token.email) && role !== 'ADMIN') {
    throw new HttpsError(
      'failed-precondition',
      'Không thể tự hạ quyền của chính mình. Nhờ một quản trị viên khác thực hiện.',
    );
  }

  const ref = db.collection('allowlist').doc(email);
  const entry = await ref.get();
  if (!entry.exists) throw new HttpsError('not-found', `${email} không có trong danh sách.`);

  // Không để hệ thống rơi vào cảnh không còn quản trị viên nào ĐĂNG NHẬP ĐƯỢC.
  // Phải đếm cả trạng thái khoá: admin đang bị khoá không cứu được hệ thống.
  if (role !== 'ADMIN' && entry.data().role === 'ADMIN') {
    const admins = await db.collection('allowlist').where('role', '==', 'ADMIN').get();
    const usable = admins.docs.filter((d) => d.id !== email && d.data()?.active !== false);
    if (usable.length === 0) {
      throw new HttpsError(
        'failed-precondition',
        'Đây là quản trị viên còn hoạt động duy nhất, không thể hạ quyền. Hãy cấp quyền quản trị cho người khác trước.',
      );
    }
  }

  await ref.set({ role }, { merge: true });

  const uid = entry.data().uid;
  if (uid) {
    await auth.setCustomUserClaims(uid, { role });
    await db.collection('users').doc(uid).set({ role }, { merge: true });
  }

  await writeAudit(actor, 'SET_ACCOUNT_ROLE', `Đổi vai trò của ${email} thành ${role}`, email);
  return { email, role };
});

// ── 5. Xoá khỏi danh sách (chỉ khi chưa từng nhập bản ghi nào) ──────────────
exports.deleteAccount = onCall(async (request) => {
  const actor = requireAdmin(request);
  const email = emailKey(request.data?.email);
  if (!email) throw new HttpsError('invalid-argument', 'Thiếu email.');
  if (email === emailKey(actor.token.email)) {
    throw new HttpsError('failed-precondition', 'Không thể tự xoá tài khoản của chính mình.');
  }

  const ref = db.collection('allowlist').doc(email);
  const entry = await ref.get();
  if (!entry.exists) throw new HttpsError('not-found', `${email} không có trong danh sách.`);

  const uid = entry.data().uid;
  if (uid) {
    const [violations, achievements] = await Promise.all([
      db.collection('violations').where('reportedBy', '==', uid).limit(1).get(),
      db.collection('achievements').where('reportedBy', '==', uid).limit(1).get(),
    ]);
    if (!violations.empty || !achievements.empty) {
      throw new HttpsError(
        'failed-precondition',
        'Tài khoản này đã từng nhập dữ liệu nên không xoá được — hãy dùng chức năng khoá để giữ nguyên dấu vết người nhập liệu.',
      );
    }
    await auth.deleteUser(uid).catch(() => {});
    await db.collection('users').doc(uid).delete().catch(() => {});
  }

  await ref.delete();
  await writeAudit(actor, 'DELETE_ACCOUNT', `Xoá ${email} khỏi danh sách`, email);
  return { email, deleted: true };
});
