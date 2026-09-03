/**
 * Nén ảnh minh chứng ngay trên máy người dùng trước khi tải lên.
 *
 * Công thức đã đo trên ảnh chụp thật (4032×3024 / 2,7 MB): thu về cạnh dài
 * 1600px rồi nén 82% ra khoảng 215 KB WebP — thừa nét để đọc biển số xe hay
 * nhận mặt, mà nhẹ hơn ảnh gốc khoảng 30 lần.
 *
 * Trước khi có hàm này, ảnh camera 3–8 MB đi thẳng lên dưới dạng data-URL,
 * phình thêm 33% vì mã hoá base64. Trên 4G giờ ra chơi là 30–120 giây mỗi ảnh,
 * và ảnh 8 MB vượt trần kho lưu trữ nên bị từ chối — người ghi chỉ thấy một
 * thông báo lỗi không hiểu vì sao.
 */

const MAX_EDGE = 1600;
const QUALITY = 0.82;

/**
 * Trình duyệt không hỗ trợ WebP sẽ ÂM THẦM trả về PNG — đúng theo chuẩn HTML,
 * không ném lỗi. PNG bỏ qua tham số chất lượng nên ảnh phình gấp mười, vượt
 * trần kho lưu trữ, bị chặn. Dò một lần rồi nhớ kết quả.
 */
let webpSupport: boolean | null = null;
const supportsWebp = (): boolean => {
  if (webpSupport !== null) return webpSupport;
  try {
    const probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;
    webpSupport = probe.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    webpSupport = false;
  }
  return webpSupport;
};

export interface CompressedImage {
  /** data-URL để xem trước và để tải lên */
  dataUrl: string;
  /** Định dạng THẬT sau khi mã hoá — phải khai đúng, không đoán theo mong muốn */
  mimeType: string;
  width: number;
  height: number;
}

/**
 * Đọc tệp ảnh, thu nhỏ và nén. Ném lỗi nếu tệp không phải ảnh đọc được —
 * nơi gọi bắt lại và hiện một câu tiếng Việt.
 */
export const compressImageFile = (file: File): Promise<CompressedImage> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không đọc được tệp ảnh'));
    };

    image.onload = () => {
      // Phải nhớ kích thước TRƯỚC khi vẽ: sau khi vẽ, một số trình duyệt trả
      // width/height về 0 và ảnh thu lại còn 1×1 pixel — bài kiểm đơn vị không
      // bắt được vì không có canvas thật.
      const srcW = image.naturalWidth || image.width;
      const srcH = image.naturalHeight || image.height;
      URL.revokeObjectURL(url);

      if (!srcW || !srcH) return reject(new Error('Ảnh không có kích thước hợp lệ'));

      const scale = Math.min(1, MAX_EDGE / Math.max(srcW, srcH));
      const width = Math.max(1, Math.round(srcW * scale));
      const height = Math.max(1, Math.round(srcH * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Trình duyệt không vẽ được ảnh'));
      ctx.drawImage(image, 0, 0, width, height);

      const mimeType = supportsWebp() ? 'image/webp' : 'image/jpeg';
      const dataUrl = canvas.toDataURL(mimeType, QUALITY);
      resolve({ dataUrl, mimeType, width, height });
    };

    image.src = url;
  });

/** Đuôi tệp phải khớp định dạng thật, không mặc định .jpg cho mọi ảnh */
export const extensionFor = (mimeType: string) => (mimeType === 'image/webp' ? 'webp' : 'jpg');
