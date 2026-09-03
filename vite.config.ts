
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Tách thư viện nền ra chunk riêng: sửa một dòng giao diện rồi phát hành
        // lại thì người dùng chỉ tải phần đổi, không tải lại ~200KB nền
        manualChunks: {
          'vendor-data': ['firebase/app', 'firebase/firestore', 'firebase/auth', 'firebase/storage', 'firebase/functions'],
          'vendor-react': ['react', 'react-dom'],
        },
      },
    },
  },
});
