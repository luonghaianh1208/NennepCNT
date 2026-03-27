
// services/googleApi.ts

const API_URL = 'https://script.google.com/macros/s/AKfycbzgVHCHANRKJQ4jEFMBY8VCRIFS2zyunSiljObF3vG4He3KmxjuA3ufMB1cgqRlRFfxAg/exec';

export const api = {
  // 1. Lấy toàn bộ dữ liệu
  getAllData: async () => {
    try {
      // Thêm tham số t=Time để tránh cache của trình duyệt
      const response = await fetch(`${API_URL}?action=getAllData&t=${Date.now()}`);
      return await response.json();
    } catch (error) {
      console.error("Error fetching data:", error);
      return null;
    }
  },

  // 2. Thêm mới Vi phạm
  createViolation: async (violation: any) => {
    return postData('createViolation', violation);
  },
  
  // 3. Xóa Vi phạm (Đơn lẻ)
  deleteViolation: async (id: string) => {
    return postData('deleteViolation', { id });
  },

  // 3b. Xóa nhiều Vi phạm (Mới)
  // Gửi mảng ids lên server. Nếu Server chưa hỗ trợ bulk, ta có thể loop ở đây, 
  // nhưng tốt nhất là gửi 1 request chứa danh sách ID.
  deleteViolations: async (ids: string[]) => {
    // Gửi payload dạng { ids: [...] }
    return postData('deleteViolations', { ids });
  },

  // 4. Cập nhật Vi phạm (Đơn lẻ)
  updateViolation: async (violation: any) => {
    return postData('updateViolation', violation);
  },

  // 4b. Cập nhật nhiều Vi phạm trong 1 request (Batch) — hiệu quả hơn gọi N lần đơn lẻ
  batchUpdateViolations: async (records: any[]) => {
    return postData('batchUpdateViolations', { records });
  },

  // 4c. Tạo nhiều Vi phạm / Thành tích trong 1 request (Batch Import)
  // Thay thế loop N*api.createViolation() — giảm từ >5s xuống ~1 request
  batchCreateViolations: async (records: any[]) => {
    return postData('batchCreateViolations', { records });
  },

  // 5. Đồng bộ Settings (KHÔNG bao gồm Users để tránh xóa mật khẩu)
  syncSettings: async (payload: { Classes: any[], Students: any[], Criteria: any[], TimeConfigs: any[] }) => {
    return postData('syncSettings', payload);
  },

  // 5b. Đồng bộ Users (RIÊNG BIỆT — chỉ gọi khi admin thực sự thêm/sửa/xóa tài khoản)
  // GAS phải xử lý: nếu user đã tồn tại mà không có password thì GIỮ NGUYÊN password cũ
  syncUsers: async (users: any[]) => {
    return postData('syncUsers', { users });
  },

  // 6. Upload ảnh
  uploadImage: async (base64: string, fileNameInfo: any) => {
    return postData('uploadImage', { base64, fileNameInfo });
  },

  // 7. Lưu audit log lên DB (Google Sheets)
  saveAuditLog: async (log: any) => {
    return postData('saveAuditLog', log);
  },

  // 8. Lấy audit logs từ DB
  getAuditLogs: async () => {
    try {
      const response = await fetch(`${API_URL}?action=getAuditLogs&t=${Date.now()}`);
      return await response.json() as any[];
    } catch (e) {
      console.error('getAuditLogs error:', e);
      return [];
    }
  },

  // 9. Xác thực đăng nhập server-side
  // ✅ BẢO MẬT: Password được gửi lên GAS để so sánh, KHÔNG bao giờ trả về client
  // Trả về: { success: true, user: {...} } hoặc { success: false, error: '...' }
  verifyLogin: async (username: string, password: string): Promise<{ success: boolean; user?: any; error?: string }> => {
    return postData('verifyLogin', { username, password });
  },

  // 10. Đặt lại mật khẩu qua email — tạo CNT@xxxx mới, gửi email qua GAS MailApp
  resetPassword: async (email: string): Promise<{ success: boolean; error?: string }> => {
    return postData('resetPassword', { email });
  },
};

async function postData(action: string, data: any) {
  try {
    const response = await fetch(`${API_URL}?action=${action}`, {
      method: 'POST',
      body: JSON.stringify(data),
      // Sử dụng text/plain để tránh preflight request CORS phức tạp với GAS
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
    });
    return await response.json();
  } catch (error) {
    console.error(`Error in ${action}:`, error);
    return { error: error };
  }
}
