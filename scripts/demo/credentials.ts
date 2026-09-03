/**
 * Tài khoản demo — KHÔNG bao giờ viết mật khẩu thẳng vào mã nguồn.
 *
 * Kho này công khai. Mật khẩu từng nằm trong sáu file ở đây và đã lộ; nay chỉ
 * đọc từ biến môi trường. Đặt trong `.env` (đã bị .gitignore chặn):
 *
 *     DEMO_PASSWORD=...
 *     DEMO_EMAIL_DOMAIN=nennep.demo      # tuỳ chọn
 */
// Node 22 đọc được .env sẵn, không cần thêm thư viện
try { process.loadEnvFile(); } catch { /* chưa có .env thì bỏ qua */ }

export const DEMO_PASSWORD = (() => {
  const value = process.env.DEMO_PASSWORD;
  if (!value) {
    console.error(
      '\n✖ Thiếu DEMO_PASSWORD.\n' +
      '  Thêm dòng DEMO_PASSWORD=<mật khẩu> vào tệp .env rồi chạy lại.\n' +
      '  Không viết mật khẩu thẳng vào mã nguồn — kho này công khai.\n'
    );
    process.exit(1);
  }
  return value;
})();

const DOMAIN = process.env.DEMO_EMAIL_DOMAIN || 'nennep.demo';

export const DEMO_EMAIL = {
  admin: `admin@${DOMAIN}`,
  bch: `bch@${DOMAIN}`,
  redFlag: `codo@${DOMAIN}`,
  teacher: `gv@${DOMAIN}`,
} as const;
