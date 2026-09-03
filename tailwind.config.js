/** @type {import('tailwindcss').Config} */

// Màu nhận diện của vai trò do quản trị viên chọn lúc chạy, nên tên class được
// GHÉP CHUỖI (`bg-${color}-50`). Bộ quét của Tailwind chỉ đọc mã nguồn tĩnh nên
// không thấy chúng — phải liệt kê ở đây, nếu không nhãn vai trò mất sạch màu.
// Danh sách này khớp đúng ô chọn màu trong Cấu hình → Vai trò.
const ROLE_COLORS = ['gray', 'blue', 'red', 'green', 'purple', 'orange', 'indigo'];

const roleColorSafelist = ROLE_COLORS.flatMap((c) => [
  `bg-${c}-50`, `bg-${c}-100`, `bg-${c}-500`,
  `border-${c}-100`, `border-${c}-200`,
  `text-${c}-700`,
]);

export default {
  content: ['./index.html', './App.tsx', './index.tsx', './components/**/*.{ts,tsx}', './contexts/**/*.{ts,tsx}', './utils.ts'],
  safelist: roleColorSafelist,
  theme: {
    extend: {
      // Chừa chỗ cho vạch Home của iPhone; máy không có thì env() trả 0
      padding: {
        safe: 'env(safe-area-inset-bottom, 0px)',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    // .pb-safe và .no-scrollbar được dùng khắp mã nguồn nhưng vốn không có
    // trong Tailwind — trước đây chạy qua CDN nên chúng lặng lẽ không sinh ra gì
    function ({ addUtilities }) {
      addUtilities({
        '.pb-safe': { paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' },
        '.no-scrollbar': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        },
      });
    },
  ],
};
