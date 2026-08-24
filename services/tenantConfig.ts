/**
 * Cấu hình riêng của từng trường, nạp lúc chạy chứ không nhúng vào lúc build.
 *
 * Nhờ vậy chỉ cần build MỘT lần rồi mang cùng một bộ dist đi triển khai cho
 * mọi trường — mỗi nơi chỉ thay file public/tenant-config.json.
 */

export interface TenantBranding {
  schoolName: string;
  shortName: string;
  slogan?: string;
  logoUrl?: string;
  academicYear?: string;
}

export interface TenantConfig {
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
  /** Tên hiển thị tạm cho tới khi đọc được bản chính thức trong Firestore */
  branding?: Partial<TenantBranding>;
}

let cached: TenantConfig | null = null;

export const loadTenantConfig = async (): Promise<TenantConfig> => {
  if (cached) return cached;

  // Hosting đã đặt no-cache cho file này (xem firebase.json) nên đổi cấu hình
  // là có hiệu lực ngay, không phải chờ hết hạn cache
  const res = await fetch('/tenant-config.json');
  if (!res.ok) {
    throw new Error(
      'Không đọc được tenant-config.json — bản triển khai này chưa được cấu hình cho trường nào.',
    );
  }

  const config = (await res.json()) as TenantConfig;
  if (!config?.firebase?.projectId) {
    throw new Error('tenant-config.json thiếu thông tin firebase.projectId.');
  }

  cached = config;
  return config;
};

/**
 * Thương hiệu ghi trong tenant-config.json — dùng ngay từ khung hình đầu tiên
 * để màn hình chờ đã mang tên trường, trước cả khi Firestore trả về bản chính thức.
 */
export const getConfigBranding = (): Partial<TenantBranding> => cached?.branding ?? {};

/** Giá trị hiển thị mặc định khi Firestore chưa trả về hoặc trường chưa cấu hình */
export const FALLBACK_BRANDING: TenantBranding = {
  schoolName: 'Trường THPT',
  shortName: 'NỀN NẾP',
  slogan: 'Hệ Thống Quản Lý Nền Nếp',
  logoUrl: '',
  academicYear: '',
};
