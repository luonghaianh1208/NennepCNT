// services/firebase.ts
//
// Lớp truy cập dữ liệu Firebase — giữ NGUYÊN tên hàm của services/googleApi.ts
// để các component không phải sửa gì ngoài dòng import.
//
// Quy ước điểm giữ như cũ: điểm dương → collection `violations` (lỗi),
// điểm âm → collection `achievements` (thành tích).

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
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

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

const MAX_BATCH = 400; // dưới hạn 500 thao tác/batch của Firestore
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
  const keep = new Set(items.map((i) => String(i.id)));
  const stale = existing.docs.filter((d) => !keep.has(d.id));

  await commitInChunks(items, (batch, item) =>
    batch.set(doc(db, name, String(item.id)), { ...item, id: String(item.id) }),
  );
  await commitInChunks(stale, (batch, d) => batch.delete(doc(db, name, d.id)));
};

export const api = {
  // 1. Lấy toàn bộ dữ liệu — trả về đúng hình dạng mà AppContext đang chờ
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
    await setDoc(doc(db, target, String(violation.id)), violation);
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
    await setDoc(doc(db, target, String(violation.id)), violation);
    await deleteDoc(doc(db, other, String(violation.id))).catch(() => {});
    return { status: 'success' };
  },

  // 4b. Cập nhật hàng loạt
  batchUpdateViolations: async (records: any[]) => {
    await commitInChunks(records, (batch, r) => {
      const target = collectionFor(r.points);
      batch.set(doc(db, target, String(r.id)), r);
    });
    return { status: 'success', updated: records.length };
  },

  // 4c. Tạo hàng loạt (import Excel)
  batchCreateViolations: async (records: any[]) => {
    await commitInChunks(records, (batch, r) => {
      batch.set(doc(db, collectionFor(r.points), String(r.id)), r);
    });
    return { status: 'success', created: records.length };
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
    await addDoc(collection(db, 'auditLogs'), log);
    return { status: 'success' };
  },

  // 8. Đọc nhật ký thao tác (mới nhất trước)
  getAuditLogs: async () => {
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
