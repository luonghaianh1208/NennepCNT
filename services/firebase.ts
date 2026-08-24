// services/firebase.ts
//
// Lớp truy cập dữ liệu Firebase — giữ NGUYÊN tên hàm của services/googleApi.ts
// để các component không phải sửa gì ngoài dòng import.
//
// Quy ước điểm giữ như cũ: điểm dương → collection `violations` (lỗi),
// điểm âm → collection `achievements` (thành tích).

import { initializeApp } from 'firebase/app';
import type { Firestore } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';
import type { FirebaseStorage } from 'firebase/storage';
import type { Functions } from 'firebase/functions';
import type { TenantConfig, TenantBranding } from './tenantConfig';
import { toISODate } from '../utils';
import {
  initializeFirestore,
  getDoc,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy,
  limit,
  where,
  addDoc,
  onSnapshot,
} from 'firebase/firestore';
import {
  getAuth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as fbSignOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  type User as FirebaseUser,
} from 'firebase/auth';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Firebase khởi tạo bằng cấu hình của từng trường, nạp lúc chạy (xem tenantConfig.ts).
// initFirebase() phải chạy xong trước khi render app — index.tsx lo việc đó.
export let db: Firestore;
export let auth: Auth;
export let storage: FirebaseStorage;
let functions: Functions;

export const initFirebase = (config: TenantConfig['firebase']) => {
  const app = initializeApp(config);

  // Cache trên máy: lần mở sau dữ liệu hiện gần như tức thì rồi mới đồng bộ nền,
  // và vẫn xem được khi mạng trường chập chờn
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    // Lớp phòng thủ thứ hai sau sanitize(): một field undefined lọt qua cũng
    // không được phép làm hỏng cả lô ghi
    ignoreUndefinedProperties: true,
  });
  auth = getAuth(app);
  storage = getStorage(app);
  functions = getFunctions(app, 'asia-southeast1');

  // Email đặt lại mật khẩu do Firebase gửi — đặt tiếng Việt để giáo viên đọc hiểu ngay
  auth.languageCode = 'vi';
};

const MAX_BATCH = 400; // dưới hạn 500 thao tác/batch của Firestore

/**
 * Dọn bản ghi trước khi ghi xuống Firestore.
 *
 * Hai chuyện Firestore khắt khe hơn backend cũ:
 * - Từ chối thẳng thừng giá trị `undefined` (ví dụ vi phạm tập thể không có
 *   studentId) và làm hỏng cả lô ghi, không riêng bản ghi đó.
 * - Lọc theo khoảng ngày là so sánh chuỗi, nên ngày phải ở dạng YYYY-MM-DD;
 *   ghi "20/05/2026" thì bản ghi vô hình với xếp hạng và đồng bộ trực tiếp.
 */
export const sanitize = <T extends Record<string, any>>(record: T): T => {
  const clean: Record<string, any> = {};
  Object.entries(record ?? {}).forEach(([key, value]) => {
    if (value === undefined) return;
    clean[key] = key === 'date' ? toISODate(value) : value;
  });
  return clean as T;
};

/** Nơi gọi vẫn kiểm tra `result.error` như thời còn dùng Apps Script */
type BatchResult = { status: string; created?: number; updated?: number; error?: string };

const collectionFor = (points: number) => (Number(points) < 0 ? 'achievements' : 'violations');

const readAll = async (name: string) => {
  const snap = await getDocs(collection(db, name));
  return snap.docs.map((d) => ({ ...d.data(), id: d.id })) as any[];
};

/** Ghi/xoá theo lô, tự chia nhỏ để không vượt hạn mức của Firestore */
const commitInChunks = async (
  items: any[],
  apply: (batch: ReturnType<typeof writeBatch>, item: any) => void,
) => {
  for (let i = 0; i < items.length; i += MAX_BATCH) {
    const batch = writeBatch(db);
    items.slice(i, i + MAX_BATCH).forEach((item) => apply(batch, item));
    await batch.commit();
  }
};

/** Đồng bộ một collection về đúng danh sách truyền vào: ghi mới, xoá phần thừa */
const replaceCollection = async (name: string, items: any[]) => {
  const existing = await getDocs(collection(db, name));

  // Chốt chặn mất dữ liệu: danh sách gửi lên trống trong khi hệ thống đang có
  // dữ liệu thì gần như chắc chắn là do tải chưa xong hoặc tải lỗi, không phải
  // ý định xoá sạch của người dùng. Thà báo lỗi còn hơn xoá nhầm cả trường.
  if (!items.length && existing.size > 0) {
    throw new Error(
      `Không thể lưu: danh sách "${name}" đang trống trong khi hệ thống có ${existing.size} bản ghi. ` +
        'Nhiều khả năng dữ liệu chưa tải xong — hãy tải lại trang rồi thử lại.',
    );
  }

  const keep = new Set(items.map((i) => String(i.id)));
  const stale = existing.docs.filter((d) => !keep.has(d.id));

  await commitInChunks(items, (batch, item) =>
    batch.set(doc(db, name, String(item.id)), sanitize({ ...item, id: String(item.id) })),
  );
  await commitInChunks(stale, (batch, d) => batch.delete(doc(db, name, d.id)));
};

export const api = {
  // 1a. Danh mục nhỏ, cần ngay để vẽ được màn hình đầu tiên
  getCoreData: async () => {
    const [classes, criteria, timeConfigs] = await Promise.all([
      readAll('classes'),
      readAll('criteria'),
      readAll('timeConfigs'),
    ]);
    return { classes, criteria, timeConfigs };
  },

  // 1b. Danh bạ — chỉ cần để hiện tên, tải nền sau khi giao diện đã lên
  getDirectory: async () => {
    const [students, users] = await Promise.all([readAll('students'), readAll('users')]);
    return { students, users };
  },

  /**
   * 1c. Vi phạm và thành tích trong một khoảng ngày.
   * Đây là chỗ tiết kiệm chính: thay vì kéo cả năm học mỗi lần mở app, chỉ lấy
   * đúng khoảng đang xem.
   */
  getRecordsInRange: async (startDate: string, endDate: string) => {
    const fetchRange = async (name: string) => {
      const snap = await getDocs(
        query(collection(db, name), where('date', '>=', startDate), where('date', '<=', endDate)),
      );
      return snap.docs.map((d) => ({ ...d.data(), id: d.id })) as any[];
    };
    const [violations, achievements] = await Promise.all([
      fetchRange('violations'),
      fetchRange('achievements'),
    ]);
    return [...violations, ...achievements];
  },

  /** 1d. Toàn bộ bản ghi — chỉ dùng khi người dùng thật sự chọn xem tất cả */
  getAllRecords: async () => {
    const [violations, achievements] = await Promise.all([
      readAll('violations'),
      readAll('achievements'),
    ]);
    return [...violations, ...achievements];
  },

  // 1. Lấy toàn bộ dữ liệu — giữ lại cho các luồng cũ cần một lần đủ hết
  getAllData: async () => {
    try {
      const [users, classes, students, criteria, violations, achievements, timeConfigs] =
        await Promise.all([
          readAll('users'),
          readAll('classes'),
          readAll('students'),
          readAll('criteria'),
          readAll('violations'),
          readAll('achievements'),
          readAll('timeConfigs'),
        ]);

      return {
        Users: users,
        Classes: classes,
        Students: students,
        Criteria: criteria,
        // Gộp thành tích vào cùng mảng như backend cũ vẫn làm
        Violations: [...violations, ...achievements],
        TimeConfigs: timeConfigs,
      };
    } catch (error) {
      console.error('Error fetching data:', error);
      return null;
    }
  },

  // 2. Thêm mới vi phạm / thành tích
  createViolation: async (violation: any) => {
    const target = collectionFor(violation.points);
    await setDoc(doc(db, target, String(violation.id)), sanitize(violation));
    return { status: 'success' };
  },

  // 3. Xoá một bản ghi (thử cả hai collection vì không biết dương hay âm)
  deleteViolation: async (id: string) => {
    await Promise.all([
      deleteDoc(doc(db, 'violations', id)).catch(() => {}),
      deleteDoc(doc(db, 'achievements', id)).catch(() => {}),
    ]);
    return { status: 'success' };
  },

  // 3b. Xoá nhiều bản ghi trong một lượt
  deleteViolations: async (ids: string[]) => {
    await commitInChunks(ids, (batch, id) => {
      batch.delete(doc(db, 'violations', String(id)));
      batch.delete(doc(db, 'achievements', String(id)));
    });
    return { status: 'success' };
  },

  // 4. Cập nhật một bản ghi — nếu đổi dấu điểm thì chuyển sang collection kia
  updateViolation: async (violation: any) => {
    const target = collectionFor(violation.points);
    const other = target === 'violations' ? 'achievements' : 'violations';
    await setDoc(doc(db, target, String(violation.id)), sanitize(violation));
    await deleteDoc(doc(db, other, String(violation.id))).catch(() => {});
    return { status: 'success' };
  },

  // 4b. Cập nhật hàng loạt
  batchUpdateViolations: async (records: any[]): Promise<BatchResult> => {
    await commitInChunks(records, (batch, r) => {
      const target = collectionFor(r.points);
      batch.set(doc(db, target, String(r.id)), sanitize(r));
    });
    return { status: 'success', updated: records.length };
  },

  // 4c. Tạo hàng loạt (import Excel)
  batchCreateViolations: async (records: any[]): Promise<BatchResult> => {
    await commitInChunks(records, (batch, r) => {
      batch.set(doc(db, collectionFor(r.points), String(r.id)), sanitize(r));
    });
    return { status: 'success', created: records.length };
  },

  // 4e. Thương hiệu của trường — tên, logo, khẩu hiệu, năm học
  getBranding: async (): Promise<Partial<TenantBranding> | null> => {
    try {
      const snap = await getDoc(doc(db, 'settings', 'branding'));
      return snap.exists() ? (snap.data() as Partial<TenantBranding>) : null;
    } catch (e) {
      console.warn('Không đọc được thương hiệu:', e);
      return null;
    }
  },

  saveBranding: async (branding: Partial<TenantBranding>) => {
    await setDoc(doc(db, 'settings', 'branding'), sanitize(branding), { merge: true });
    return { status: 'success' };
  },

  /** Tải logo trường lên Storage, trả về đường dẫn dùng được ngay trong thẻ img */
  uploadLogo: async (base64: string) => {
    try {
      const fileRef = ref(storage, `branding/logo_${Date.now()}`);
      await uploadString(fileRef, base64, 'data_url');
      return { status: 'success', url: await getDownloadURL(fileRef) };
    } catch (e: any) {
      console.error('uploadLogo error:', e);
      return { status: 'error', message: e?.message ?? String(e) };
    }
  },

  // 4d. Thêm một tiêu chí mới (dùng khi nhập thành tích cho hoạt động chưa có sẵn)
  createCriteria: async (criteria: { id: string; content: string; points: number; type: string }) => {
    await setDoc(doc(db, 'criteria', criteria.id), sanitize(criteria));
    return { status: 'success' };
  },

  // 5. Đồng bộ cấu hình (lớp, học sinh, tiêu chí, mốc thời gian)
  syncSettings: async (payload: {
    Classes: any[];
    Students: any[];
    Criteria: any[];
    TimeConfigs: any[];
  }) => {
    await Promise.all([
      replaceCollection('classes', payload.Classes),
      replaceCollection('students', payload.Students),
      replaceCollection('criteria', payload.Criteria),
      replaceCollection('timeConfigs', payload.TimeConfigs),
    ]);
    return { status: 'success' };
  },

  // 5b. Đồng bộ hồ sơ tài khoản.
  // Mật khẩu do Firebase Auth quản lý nên không bao giờ ghi xuống Firestore.
  syncUsers: async (users: any[]) => {
    const safe = users.map(({ password, ...rest }: any) => rest);
    await replaceCollection('users', safe);
    return { status: 'success' };
  },

  // 6. Upload ảnh minh chứng lên Storage
  uploadImage: async (base64: string, fileNameInfo: any) => {
    try {
      const safeName = `${fileNameInfo.className}_${fileNameInfo.studentName}_${fileNameInfo.violation}_${fileNameInfo.date}`
        .replace(/[^a-zA-Z0-9_\-.]/g, '_');
      const fileRef = ref(storage, `violations/${safeName}_${Date.now()}.jpg`);
      await uploadString(fileRef, base64, 'data_url');
      return { status: 'success', url: await getDownloadURL(fileRef) };
    } catch (e: any) {
      console.error('uploadImage error:', e);
      return { status: 'error', message: e?.message ?? String(e) };
    }
  },

  // 7. Ghi nhật ký thao tác
  saveAuditLog: async (log: any) => {
    await addDoc(collection(db, 'auditLogs'), sanitize(log));
    return { status: 'success' };
  },

  // 8. Đọc nhật ký thao tác (mới nhất trước)
  getAuditLogs: async () => {
    // Khách chưa đăng nhập không có quyền đọc nhật ký — khỏi gọi cho tốn một vòng mạng
    if (!auth.currentUser) return [];
    try {
      const snap = await getDocs(
        query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(500)),
      );
      return snap.docs.map((d) => ({ ...d.data(), id: d.id })) as any[];
    } catch (e) {
      console.error('getAuditLogs error:', e);
      return [];
    }
  },

  // 9. Đăng nhập. Người dùng vẫn gõ tên đăng nhập như cũ — nếu đó không phải
  // email thì tra trong hồ sơ để lấy email tương ứng rồi mới gọi Firebase Auth.
  verifyLogin: async (
    username: string,
    password: string,
  ): Promise<{ success: boolean; user?: any; error?: string }> => {
    try {
      let email = username.trim();
      if (!email.includes('@')) {
        const found = await getDocs(
          query(collection(db, 'users'), where('username', '==', email), limit(1)),
        );
        if (found.empty) return { success: false, error: 'Tên đăng nhập không tồn tại' };
        email = String(found.docs[0].data().email ?? '');
        if (!email) return { success: false, error: 'Tài khoản chưa có email, liên hệ quản trị viên' };
      }

      const cred = await signInWithEmailAndPassword(auth, email, password);
      const profileSnap = await getDocs(
        query(collection(db, 'users'), where('email', '==', email), limit(1)),
      );
      const profile = profileSnap.empty
        ? { id: cred.user.uid, name: cred.user.displayName ?? email, username: email, email, role: 'GUEST' }
        : { ...profileSnap.docs[0].data(), id: profileSnap.docs[0].id };

      return { success: true, user: profile };
    } catch (e: any) {
      const code = String(e?.code ?? '');
      const message =
        code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')
          ? 'Tên đăng nhập hoặc mật khẩu không đúng'
          : code.includes('too-many-requests')
            ? 'Sai quá nhiều lần, vui lòng thử lại sau ít phút'
            : 'Không đăng nhập được, vui lòng thử lại';
      return { success: false, error: message };
    }
  },

  // 10. Quên mật khẩu — Firebase gửi link đặt lại, không sinh mật khẩu mới
  resetPassword: async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return { success: true };
    } catch (e: any) {
      const code = String(e?.code ?? '');
      return {
        success: false,
        error: code.includes('user-not-found')
          ? 'Email này chưa được đăng ký trong hệ thống'
          : 'Không gửi được email, vui lòng thử lại',
      };
    }
  },
};

// ── Theo dõi trực tiếp một khoảng thời gian ─────────────────────────────────
//
// Chỉ mở listener cho tuần đang xem — vừa đủ để nhiều người chấm cùng lúc thấy
// nhau ngay, vừa không phải trả tiền đọc lại cả năm học mỗi khi có thay đổi.
// Dữ liệu ngoài khoảng này vẫn tải một lần và làm mới bằng tay.

export const subscribeToRange = (
  startDate: string,
  endDate: string,
  onChange: (records: any[]) => void,
): (() => void) => {
  const buckets: Record<string, any[]> = { violations: [], achievements: [] };

  const unsubs = Object.keys(buckets).map((name) =>
    onSnapshot(
      query(collection(db, name), where('date', '>=', startDate), where('date', '<=', endDate)),
      (snap) => {
        buckets[name] = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        onChange([...buckets.violations, ...buckets.achievements]);
      },
      (err) => console.warn(`Mất kết nối trực tiếp với ${name}:`, err.message),
    ),
  );

  return () => unsubs.forEach((stop) => stop());
};

// ── Quản lý tài khoản (chạy trên Cloud Functions, chỉ ADMIN gọi được) ───────
//
// Không hàm nào ở đây đặt mật khẩu hộ người dùng: hệ thống gửi link để họ tự đặt.

type AccountInput = { name: string; email: string; role: string; className?: string };

/** Bóc thông báo lỗi tiếng Việt do Cloud Function trả về */
const callFn = async <T>(name: string, payload: any): Promise<T> => {
  try {
    const res = await httpsCallable(functions, name)(payload);
    return res.data as T;
  } catch (e: any) {
    throw new Error(e?.message || 'Thao tác không thành công, vui lòng thử lại.');
  }
};

/**
 * Admin SDK chỉ *tạo* được link đặt mật khẩu chứ không gửi thư.
 * Việc gửi do chính Firebase Auth đảm nhiệm qua lời gọi này (miễn phí, mẫu thư tiếng Việt).
 */
const mailResetLink = (email: string) => sendPasswordResetEmail(auth, email);

export const accounts = {
  /** Tạo một tài khoản rồi gửi thư để người dùng tự đặt mật khẩu */
  create: async (input: AccountInput) => {
    const res = await callFn<{ uid: string; email: string; setupLink: string }>('createAccount', input);
    await mailResetLink(res.email);
    return res;
  },

  /** Tạo hàng loạt từ file Excel; gửi thư lần lượt để tránh bị Firebase chặn vì gửi quá nhanh */
  importMany: async (list: AccountInput[]) => {
    const res = await callFn<{
      created: { email: string }[];
      failed: { email: string; reason: string }[];
    }>('importAccounts', { accounts: list });

    const mailFailed: { email: string; reason: string }[] = [];
    for (const acc of res.created) {
      try {
        await mailResetLink(acc.email);
      } catch (e: any) {
        mailFailed.push({ email: acc.email, reason: 'Tạo được tài khoản nhưng chưa gửi được thư' });
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    return { ...res, failed: [...res.failed, ...mailFailed] };
  },

  /** Quản trị viên cấp lại mật khẩu cho một người */
  sendReset: async (email: string) => {
    const res = await callFn<{ email: string; link: string }>('sendPasswordReset', { email });
    await mailResetLink(email);
    return res;
  },

  /** Khoá / mở khoá đăng nhập, giữ nguyên dữ liệu đã nhập */
  setStatus: (uid: string, active: boolean) =>
    callFn<{ uid: string; active: boolean }>('setAccountStatus', { uid, active }),

  setRole: (uid: string, role: string) =>
    callFn<{ uid: string; role: string }>('setAccountRole', { uid, role }),

  /** Chỉ xoá được khi tài khoản chưa từng nhập bản ghi nào */
  remove: (uid: string) => callFn<{ uid: string; deleted: boolean }>('deleteAccount', { uid }),
};

// ── Tiện ích phiên đăng nhập ────────────────────────────────────────────────

export const signOut = () => fbSignOut(auth);

/** "Ghi nhớ đăng nhập": giữ phiên sau khi đóng trình duyệt hay chỉ trong tab hiện tại */
export const setRememberLogin = (remember: boolean) =>
  setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);

/** Theo dõi trạng thái đăng nhập; trả về hồ sơ trong Firestore của người đang đăng nhập */
export const onAuthChange = (callback: (profile: any | null) => void) =>
  onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
    if (!user?.email) return callback(null);
    const snap = await getDocs(
      query(collection(db, 'users'), where('email', '==', user.email), limit(1)),
    );
    callback(
      snap.empty
        ? { id: user.uid, name: user.displayName ?? user.email, username: user.email, email: user.email, role: 'GUEST' }
        : { ...snap.docs[0].data(), id: snap.docs[0].id },
    );
  });
