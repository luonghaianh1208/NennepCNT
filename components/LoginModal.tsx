import React, { useState } from 'react';
import { X, ShieldCheck, Loader2 } from 'lucide-react';
import { api, setRememberLogin } from '../services/firebase';
import { INITIAL_ROLE_DEFINITIONS, canOpenSettings } from '../utils';
import { useAppStore } from '../contexts/AppContext';

interface LoginModalProps {
  onClose: () => void;
  onSuccess: (tab: string) => void;
}

/** Logo Google chính chủ — Google yêu cầu dùng đúng biểu tượng này trên nút đăng nhập */
const GoogleMark = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

/**
 * Đăng nhập bằng tài khoản Google — hệ thống không có mật khẩu riêng.
 *
 * Trước đây mỗi người được cấp một tài khoản kèm thư đặt mật khẩu. Thư gửi từ
 * một tên miền lạ nên hay rơi vào hộp thư rác, mà học sinh cờ đỏ — nhóm dùng
 * nhiều nhất — thường không kiểm tra hộp thư. Nay quản trị viên chỉ ghi email
 * vào danh sách cho phép, ai có email trong đó là đăng nhập được ngay.
 */
const LoginModal: React.FC<LoginModalProps> = ({ onClose, onSuccess }) => {
  const { setCurrentUser, roleConfigs, branding } = useAppStore();

  const [loginError, setLoginError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleGoogleLogin = async () => {
    if (isLoggingIn) return;
    setLoginError('');
    setIsLoggingIn(true);
    try {
      await setRememberLogin(rememberMe);
      const result = await api.verifyLogin();

      if (result?.success && result.user) {
        const user = result.user;
        setCurrentUser(user);
        onClose();

        const roleKey = String(user.role).toUpperCase();
        const roleConfig = roleConfigs[roleKey] || roleConfigs['GUEST'] || INITIAL_ROLE_DEFINITIONS[roleKey];
        if (roleConfig?.entryViolation || roleConfig?.entryAchievement) onSuccess('entry');
        else if (canOpenSettings(roleConfigs, user.role)) onSuccess('settings');
        else onSuccess('dashboard');
      } else if (result?.error) {
        // Chuỗi rỗng nghĩa là người dùng tự đóng cửa sổ — không phải lỗi
        setLoginError(result.error);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-900/80 backdrop-blur-sm p-6 animate-in fade-in overflow-y-auto"
      role="dialog" aria-modal="true" aria-label="Đăng nhập">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-8 animate-in zoom-in-95 relative my-auto">
        <button onClick={onClose} aria-label="Đóng"
          className="absolute top-3 right-3 text-slate-500 hover:text-slate-700 w-11 h-11 inline-flex items-center justify-center rounded-lg hover:bg-slate-100">
          <X size={22} />
        </button>

        <div className="text-center mb-7">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-white"
            style={{ background: `linear-gradient(160deg, var(--brand-from, #b91c1c), var(--brand-to, #7f1d1d))` }}>
            <ShieldCheck size={30} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Đăng Nhập</h2>
          <p className="text-slate-500 text-sm mt-1">
            Dùng tài khoản Google của {branding?.shortName ? branding.shortName : 'nhà trường'}
          </p>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={isLoggingIn}
          className="w-full flex items-center justify-center gap-3 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-xl py-3.5 font-bold text-slate-700 transition-all active:scale-95 disabled:opacity-60"
        >
          {isLoggingIn ? <Loader2 size={20} className="animate-spin" /> : <GoogleMark />}
          {isLoggingIn ? 'Đang kiểm tra quyền…' : 'Đăng nhập bằng Google'}
        </button>

        <label className="flex items-center gap-2 mt-4 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={e => setRememberMe(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
          />
          <span className="text-sm text-slate-600">Ghi nhớ đăng nhập trên máy này</span>
        </label>

        {loginError && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 leading-relaxed">
            {loginError}
          </div>
        )}

        <p className="text-xs text-slate-500 mt-6 leading-relaxed text-center">
          Chỉ những địa chỉ đã được Đoàn trường cấp quyền mới vào được.
          Nếu chưa đăng nhập được, liên hệ Đoàn trường để thêm email của bạn vào danh sách.
        </p>
      </div>
    </div>
  );
};

export default LoginModal;
