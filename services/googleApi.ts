
// services/googleApi.ts

const API_URL = 'https://script.google.com/macros/s/AKfycbzQIfHO-37u4YAXJH4H-66HpUbydkY-mvxYxxXAZShqLWQOISXPp4XXVQ5Nd81EUnc4vw/exec';

export const api = {
  // 1. Lấy toàn bộ dữ liệu
  getAllData: async () => {
    try {
      const response = await fetch(`${API_URL}?action=getAllData`);
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
  
  // 3. Xóa Vi phạm
  deleteViolation: async (id: string) => {
    return postData('deleteViolation', { id });
  },

  // 4. Cập nhật Vi phạm
  updateViolation: async (violation: any) => {
    return postData('updateViolation', violation);
  },

  // 5. Đồng bộ Settings
  syncSettings: async (payload: { Users: any[], Classes: any[], Students: any[], Criteria: any[], TimeConfigs: any[] }) => {
    return postData('syncSettings', payload);
  },

  // 6. Upload ảnh
  uploadImage: async (base64: string, fileNameInfo: any) => {
    return postData('uploadImage', { base64, fileNameInfo });
  }
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
