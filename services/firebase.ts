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
  GoogleAuthProvider,
  signInWithPopup,
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

/**
 * Đổi lỗi kỹ thuật thành một câu tiếng Việt nói được người dùng phải làm gì.
 *
 * Không bao giờ để lọt chuỗi lỗi gốc ra giao diện: nó vừa là tiếng Anh, vừa nêu
 * đích danh nền tảng hạ tầng — thứ sản phẩm này cố ý giấu.
 */
export const friendlyError = (e: any): string => {
  const code = String(e?.code ?? '').toLowerCase();
  const raw = String(e?.message ?? '').toLowerCase();
  const has = (...needles: string[]) => needles.some(n => code.includes(n) || raw.includes(n));

  if (has('permission-denied', 'unauthorized', 'insufficient')) {
    return 'Tài khoản của bạn không có quyền thực hiện việc này. Liên hệ quản trị viên nếu cần cấp thêm quyền.';
  }
  if (has('unauthenticated')) return 'Phiên đăng nhập đã hết hạn. Đăng nhập lại rồi thử tiếp.';
  if (has('unavailable', 'network', 'offline', 'deadline-exceeded', 'timeout')) {
    return 'Mất kết nối mạng. Kiểm tra đường truyền rồi thử lại.';
  }
  if (has('quota', 'resource-exhausted')) return 'Hệ thống đang quá tải, thử lại sau ít phút.';
  if (has('not-found')) return 'Không tìm thấy dữ liệu cần thao tác — có thể ai đó vừa xoá.';
  if (has('already-exists')) return 'Dữ liệu này đã tồn tại.';
  if (has('invalid-argument', 'failed-precondition')) return 'Dữ liệu nhập vào chưa hợp lệ, kiểm tra lại các ô đã điền.';
  if (has('too-large', 'payload')) return 'Tệp quá lớn. Chọn ảnh nhỏ hơn rồi thử lại.';
  return 'Thao tác chưa thực hiện được. Thử lại, nếu vẫn lỗi thì báo quản trị viên.';
};

/**
 * Câu để hiện ra màn hình. Cloud Functions của hệ thống đã ném lỗi bằng tiếng
 * Việt ("Đây là quản trị viên còn hoạt động duy nhất…") — giữ nguyên vì nó cụ
 * thể hơn. Còn lại là lỗi hạ tầng, phải dịch.
 */
export const userMessage = (e: any): string => {
  const raw = String(e?.message ?? '').trim();
  const hasVietnamese = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(raw);
  return hasVietnamese ? raw : friendlyError(e);
};

/** Nơi gọi vẫn kiểm tra `result.error` như thời còn dùng backend cũ */
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

  // 3. Xoá một bản ghi.
  //
  // Dấu điểm quyết định collection: dương là vi phạm, âm là thành tích. Trước
  // đây hàm này xoá mù cả hai rồi nuốt lỗi bằng .catch(() => {}) và luôn báo
  // thành công — vai trò không có quyền ghi khen thưởng xoá một thành tích thì
  // giao diện báo "đã xoá", bản ghi biến mất khỏi màn hình, nhưng còn nguyên
  // trên máy chủ và quay lại sau khi làm mới.
  deleteViolation: async (id: string, points?: number) => {
    try {
      if (typeof points === 'number') {
        await deleteDoc(doc(db, collectionFor(points), String(id)));
      } else {
        // Không biết dấu (bản ghi cũ) thì thử lần lượt, nhưng vẫn phải có ít
        // nhất một lần xoá thành công mới được báo thành công
        const results = await Promise.allSettled([
          deleteDoc(doc(db, 'violations', String(id))),
          deleteDoc(doc(db, 'achievements', String(id))),
        ]);
        if (results.every(r => r.status === 'rejected')) throw (results[0] as PromiseRejectedResult).reason;
      }
      return { status: 'success' };
    } catch (e: any) {
      return { status: 'error', message: friendlyError(e) };
    }
  },

  // 3b. Xoá nhiều bản ghi trong một lượt.
  // Nhận kèm dấu điểm để chỉ đụng đúng collection — trước đây mỗi id phát lệnh
  // xoá ở cả hai nơi, vừa tính tiền gấp đôi vừa làm cả lô bị từ chối khi người
  // dùng không có quyền với collection kia.
  deleteViolations: async (ids: string[], pointsById?: Record<string, number>) => {
    try {
      await commitInChunks(ids, (batch, id) => {
        const key = String(id);
        const points = pointsById?.[key];
        if (typeof points === 'number') {
          batch.delete(doc(db, collectionFor(points), key));
        } else {
          batch.delete(doc(db, 'violations', key));
          batch.delete(doc(db, 'achievements', key));
        }
      });
      return { status: 'success' };
    } catch (e: any) {
      return { status: 'error', message: friendlyError(e) };
    }
  },

  // 4. Cập nhật một bản ghi — nếu đổi dấu điểm thì chuyển sang collection kia
  updateViolation: async (violation: any) => {
    const target = collectionFor(violation.points);
    const other = target === 'violations' ? 'achievements' : 'violations';
    await setDoc(doc(db, target, String(violation.id)), sanitize(violation));
    await deleteDoc(doc(db, other, String(violation.id))).catch(() => {});
    return { status: 'success' };
  },

  // 4b. Cập nhật hàng loạt.
  // Phải xoá bản ghi ở collection cũ khi điểm đổi dấu, giống updateViolation —
  // sửa hàng loạt cho phép đổi tiêu chí, nên đổi một loạt vi phạm sang tiêu chí
  // thành tích là sinh bản sao không bao giờ bị xoá.
  batchUpdateViolations: async (records: any[]): Promise<BatchResult> => {
    await commitInChunks(records, (batch, r) => {
      const target = collectionFor(r.points);
      const other = target === 'violations' ? 'achievements' : 'violations';
      batch.set(doc(db, target, String(r.id)), sanitize(r));
      batch.delete(doc(db, other, String(r.id)));
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

  // 4g. Quy định riêng của trường: công thức điểm, khối lớp, giải thưởng, tông màu
  getSchoolSettings: async (): Promise<Record<string, any> | null> => {
    try {
      const snap = await getDoc(doc(db, 'settings', 'school'));
      return snap.exists() ? (snap.data() as Record<string, any>) : null;
    } catch (e) {
      console.warn('Không đọc được quy định của trường:', e);
      return null;
    }
  },

  saveSchoolSettings: async (settings: Record<string, any>) => {
    await setDoc(doc(db, 'settings', 'school'), settings);
    return { status: 'success' };
  },

  // 4f. Bảng vai trò và quyền — chính quy tắc bảo mật cũng đọc tài liệu này
  getRoleConfigs: async (): Promise<Record<string, any> | null> => {
    try {
      const snap = await getDoc(doc(db, 'settings', 'roles'));
      return snap.exists() ? (snap.data() as Record<string, any>) : null;
    } catch (e) {
      console.warn('Không đọc được bảng quyền:', e);
      return null;
    }
  },

  saveRoleConfigs: async (roles: Record<string, any>) => {
    await setDoc(doc(db, 'settings', 'roles'), roles);
    return { status: 'success' };
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
  // Tên tệp KHÔNG chứa tên học sinh, lớp hay nội dung vi phạm: ai thấy đường
  // dẫn ảnh là đọc được câu chuyện mà chưa cần mở ảnh. Mô tả nằm trong bản ghi.
  uploadImage: async (base64: string, _fileNameInfo?: any) => {
    try {
      const extension = base64.startsWith('data:image/webp') ? 'webp' : 'jpg';
      const id = (crypto as any)?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const fileRef = ref(storage, `violations/${id}.${extension}`);
      await uploadString(fileRef, base64, 'data_url');
      return { status: 'success', url: await getDownloadURL(fileRef) };
    } catch (e: any) {
      console.error('uploadImage error:', e);
      return { status: 'error', message: friendlyError(e) };
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
  /**
   * Đăng nhập bằng tài khoản Google — cách duy nhất vào hệ thống.
   *
   * Dùng cửa sổ phụ chứ không chuyển trang: trang web chạy ở `<project>.web.app`
   * còn phần đăng nhập ở `<project>.firebaseapp.com`, hai tên miền khác nhau nên
   * trình duyệt đời mới chặn lưu trữ giữa chúng và luồng chuyển trang hỏng
   * giữa chừng.
   *
   * Google xác thực xong thì tài khoản vẫn CHƯA có vai trò nào. `claimAccess`
   * đối chiếu email với danh sách cho phép rồi mới gắn vai trò; email không có
   * trong danh sách thì bị đăng xuất ngay để không kẹt ở trạng thái lửng lơ.
   */
  verifyLogin: async (): Promise<{ success: boolean; user?: any; error?: string }> => {
    try {
      const provider = new GoogleAuthProvider();
      // Luôn hiện ô chọn tài khoản: máy tính dùng chung ở trường thường đã đăng
      // nhập sẵn Google của người trước
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);

      const profile = await callFn<any>('claimAccess', {});
      // Vai trò vừa gắn vào token — phải lấy token mới thì luật dữ liệu mới
      // thấy, không thì mọi thao tác đầu tiên đều bị từ chối
      await auth.currentUser?.getIdToken(true);
      return { success: true, user: profile };
    } catch (e: any) {
      const code = String(e?.code ?? '');
      // Người dùng tự đóng cửa sổ — không phải lỗi, không báo gì
      if (code.includes('popup-closed') || code.includes('cancelled-popup')) {
        return { success: false, error: '' };
      }
      await fbSignOut(auth).catch(() => undefined);
      if (code.includes('popup-blocked')) {
        return { success: false, error: 'Trình duyệt đang chặn cửa sổ đăng nhập. Cho phép cửa sổ bật lên cho trang này rồi thử lại.' };
      }
      // Lỗi cấu hình lúc bàn giao, không phải lỗi của người dùng — nói thẳng để
      // đơn vị triển khai biết phải bật gì, thay vì "thử lại sau"
      if (code.includes('operation-not-allowed')) {
        return { success: false, error: 'Hệ thống chưa bật đăng nhập bằng Google. Báo đơn vị triển khai để bật giúp.' };
      }
      if (code.includes('unauthorized-domain')) {
        return { success: false, error: 'Tên miền này chưa được cho phép đăng nhập. Báo đơn vị triển khai.' };
      }
      return { success: false, error: userMessage(e) };
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
  // Nơi nhận sẽ THAY SẠCH phần dữ liệu trong khoảng này, nên chỉ được báo khi cả
  // hai nguồn đã về. Bắn sớm lúc nguồn kia còn rỗng là xoá hết thành tích của
  // tuần hiện tại khỏi màn hình — và mất hẳn nếu nguồn kia lỗi.
  const arrived = new Set<string>();

  const unsubs = Object.keys(buckets).map((name) =>
    onSnapshot(
      query(collection(db, name), where('date', '>=', startDate), where('date', '<=', endDate)),
      (snap) => {
        buckets[name] = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        arrived.add(name);
        if (arrived.size === Object.keys(buckets).length) {
          onChange([...buckets.violations, ...buckets.achievements]);
        }
      },
      (err) => console.warn(`Mất kết nối trực tiếp với ${name}:`, err.message),
    ),
  );

  return () => unsubs.forEach((stop) => stop());
};

// ── Quản lý tài khoản (chạy trên Cloud Functions, chỉ ADMIN gọi được) ───────
//
// Hệ thống không có mật khẩu riêng: quản trị viên chỉ ghi email vào danh sách
// cho phép, người dùng đăng nhập bằng chính tài khoản Google của họ. Khoá của
// mọi thao tác dưới đây là EMAIL, không phải mã tài khoản — vì người trong
// danh sách có thể chưa từng đăng nhập lần nào.

type AccountInput = { name: string; email: string; role: string; className?: string };

/** Một dòng trong danh sách cho phép */
export interface AllowlistEntry {
  email: string;
  name: string;
  role: string;
  className?: string;
  active?: boolean;
  /** Rỗng nghĩa là người này chưa đăng nhập lần nào */
  uid?: string;
  lastSignIn?: any;
}

/** Bóc thông báo lỗi tiếng Việt do Cloud Function trả về */
const callFn = async <T>(name: string, payload: any): Promise<T> => {
  try {
    const res = await httpsCallable(functions, name)(payload);
    return res.data as T;
  } catch (e: any) {
    throw new Error(e?.message || 'Thao tác không thành công, vui lòng thử lại.');
  }
};

export const accounts = {
  /** Đọc danh sách cho phép — chỉ người có quyền quản lý tài khoản đọc được */
  list: async (): Promise<AllowlistEntry[]> => {
    const snap = await getDocs(collection(db, 'allowlist'));
    return snap.docs.map(d => ({ ...(d.data() as AllowlistEntry), email: d.id }));
  },

  /** Cấp quyền cho một email. Không tạo tài khoản, không gửi thư. */
  create: (input: AccountInput) => callFn<{ email: string }>('createAccount', input),

  /** Cấp quyền hàng loạt từ file Excel */
  importMany: (list: AccountInput[]) =>
    callFn<{
      created: { email: string }[];
      failed: { email: string; reason: string }[];
    }>('importAccounts', { accounts: list }),

  /** Khoá / mở khoá, giữ nguyên dữ liệu đã nhập */
  setStatus: (email: string, active: boolean) =>
    callFn<{ email: string; active: boolean }>('setAccountStatus', { email, active }),

  setRole: (email: string, role: string) =>
    callFn<{ email: string; role: string }>('setAccountRole', { email, role }),

  /** Chỉ xoá được khi tài khoản chưa từng nhập bản ghi nào */
  remove: (email: string) => callFn<{ email: string; deleted: boolean }>('deleteAccount', { email }),
};

// ── Tiện ích phiên đăng nhập ────────────────────────────────────────────────

export const signOut = () => fbSignOut(auth);

/** "Ghi nhớ đăng nhập": giữ phiên sau khi đóng trình duyệt hay chỉ trong tab hiện tại */
export const setRememberLogin = (remember: boolean) =>
  setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);

/**
 * Theo dõi trạng thái đăng nhập và cả những thay đổi về hồ sơ của chính người
 * đang dùng.
 *
 * Vai trò nằm trong token, mà token chỉ tự làm mới mỗi giờ — quản trị viên đổi
 * vai trò cho ai thì người đó phải chờ tới một tiếng, hoặc đăng xuất rồi vào
 * lại, mới thấy quyền mới. Ở đây theo dõi thẳng hồ sơ: hễ vai trò trong cơ sở
 * dữ liệu khác với vai trò trong token là ép lấy token mới ngay.
 */
export const onAuthChange = (callback: (profile: any | null) => void) => {
  let stopProfileWatch: (() => void) | null = null;

  const stopAll = onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
    stopProfileWatch?.();
    stopProfileWatch = null;

    if (!user?.email) return callback(null);

    stopProfileWatch = onSnapshot(
      doc(db, 'users', user.uid),
      async (snap) => {
        if (!snap.exists()) {
          // Chưa nhận quyền lần nào, hoặc vừa bị thu hồi
          return callback({
            id: user.uid, name: user.displayName ?? user.email,
            username: user.email, email: user.email, role: 'GUEST',
          });
        }
        const profile = { ...snap.data(), id: snap.id } as any;

        // Vai trò trong hồ sơ đã đổi mà token còn giữ vai trò cũ → lấy token mới,
        // nếu không thì giao diện mở khoá mà tầng dữ liệu vẫn từ chối
        const token = await user.getIdTokenResult().catch(() => null);
        if (token && String(token.claims.role ?? '') !== String(profile.role ?? '')) {
          await user.getIdToken(true).catch(() => undefined);
        }
        callback(profile);
      },
      () => callback(null),
    );
  });

  return () => {
    stopProfileWatch?.();
    stopAll();
  };
};
