
import React, { useState } from 'react';
import { LogIn, X, Mail, ArrowLeft, KeyRound } from 'lucide-react';
import { api, setRememberLogin } from '../services/firebase';
import { GUEST_USER, INITIAL_ROLE_DEFINITIONS, canOpenSettings } from '../utils';
import { useAppStore } from '../contexts/AppContext';

interface LoginModalProps {
  onClose: () => void;
  onSuccess: (tab: string) => void;
}

type View = 'login' | 'forgot' | 'forgot-success';

const LoginModal: React.FC<LoginModalProps> = ({ onClose, onSuccess }) => {
  const { setCurrentUser, roleConfigs } = useAppStore();

  // ── Login state ──────────────────────────────────────────
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // ── Forgot password state ────────────────────────────────
  const [view, setView] = useState<View>('login');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn) return;
    setLoginError('');
    setIsLoggingIn(true);
    try {
      // Firebase Auth tự lưu phiên; không còn lưu mật khẩu ở trình duyệt nữa
      await setRememberLogin(rememberMe);
      const result = await api.verifyLogin(loginUsername, loginPassword);

      if (result?.success && result.user) {
        const user = result.user;
        setCurrentUser(user);
        onClose();

        setLoginUsername('');
        setLoginPassword('');

        const userRoleKey = user.role.toUpperCase();
        const roleConfig = roleConfigs[userRoleKey] || roleConfigs['GUEST'] || INITIAL_ROLE_DEFINITIONS[userRoleKey];
        if (roleConfig?.entryViolation || roleConfig?.entryAchievement) onSuccess('entry');
        else if (canOpenSettings(roleConfigs, user.role)) onSuccess('settings');
        else onSuccess('dashboard');
      } else {
        setLoginError(result?.error || 'Tên đăng nhập hoặc mật khẩu không đúng');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSending) return;
    setForgotError('');

    if (!forgotEmail.trim()) {
      setForgotError('Vui lòng nhập email.');
      return;
    }

    setIsSending(true);
    try {
      const result = await api.resetPassword(forgotEmail.trim());
      if (result?.success) {
        setView('forgot-success');
      } else {
        setForgotError(result?.error || 'Có lỗi xảy ra, vui lòng thử lại.');
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-900/80 backdrop-blur-sm p-6 animate-in fade-in">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-8 animate-in zoom-in-95 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-slate-600">
          <X size={24} />
        </button>

        {/* ── VIEW: LOGIN ───────────────────────────────── */}
        {view === 'login' && (
          <>
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                <LogIn size={32} />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Đăng Nhập</h2>
              <p className="text-slate-500 text-sm mt-1">Vui lòng đăng nhập để tiếp tục</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Tên đăng nhập{' '}
                  <span className="text-xs font-normal text-slate-500 italic ml-1">(nhập email đã đăng ký)</span>
                </label>
                <input
                  type="text"
                  className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  value={loginUsername}
                  onChange={e => setLoginUsername(e.target.value)}
                  placeholder="admin"
                  autoFocus
                />
              </div>

              <div>
                {/* Nhãn cũ ghi "(dạng CNT@xxxx)" — vừa sai (người dùng tự đặt
                    mật khẩu), vừa gắn cứng tên viết tắt của một trường cụ thể */}
                <label className="block text-sm font-bold text-slate-700 mb-1">Mật khẩu</label>
                <input
                  type="password"
                  className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="••••••"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <label htmlFor="rememberMe" className="text-sm text-slate-600 cursor-pointer select-none">
                  Ghi nhớ đăng nhập
                </label>
              </div>

              {loginError && (
                <div className="text-red-500 text-sm font-medium text-center">{loginError}</div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className={`w-full text-white font-bold py-3.5 rounded-xl shadow-lg shadow-red-200 transition-all flex items-center justify-center gap-2 ${
                  isLoggingIn ? 'bg-red-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 active:scale-95'
                }`}
              >
                {isLoggingIn ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Đang xác thực...
                  </>
                ) : (
                  'Đăng Nhập'
                )}
              </button>

              {/* Quên mật khẩu link */}
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => { setView('forgot'); setForgotError(''); setForgotEmail(''); }}
                  className="text-sm text-red-600 hover:text-red-800 font-semibold hover:underline transition-colors"
                >
                  Quên mật khẩu?
                </button>
              </div>
            </form>
          </>
        )}

        {/* ── VIEW: FORGOT PASSWORD ─────────────────────── */}
        {view === 'forgot' && (
          <>
            <div className="text-center mb-7">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600">
                <KeyRound size={30} />
              </div>
              <h2 className="text-xl font-bold text-slate-800">Lấy lại mật khẩu</h2>
              <p className="text-slate-500 text-sm mt-1 leading-relaxed">
                Nhập email đã đăng ký — hệ thống sẽ gửi<br/>mật khẩu mới về hòm thư của bạn.
              </p>
            </div>

            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Email đã đăng ký
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-3.5 text-slate-500 pointer-events-none" />
                  <input
                    type="email"
                    className="w-full pl-9 pr-3 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    autoFocus
                  />
                </div>
              </div>

              {forgotError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm font-medium rounded-lg px-3 py-2 text-center">
                  {forgotError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSending}
                className={`w-full text-white font-bold py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 ${
                  isSending
                    ? 'bg-amber-300 cursor-not-allowed'
                    : 'bg-amber-500 hover:bg-amber-600 shadow-amber-200 active:scale-95'
                }`}
              >
                {isSending ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Đang gửi...
                  </>
                ) : (
                  <>
                    <Mail size={18} />
                    Gửi mật khẩu mới
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setView('login')}
                className="w-full flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors"
              >
                <ArrowLeft size={14} />
                Quay lại đăng nhập
              </button>
            </form>
          </>
        )}

        {/* ── VIEW: SUCCESS ─────────────────────────────── */}
        {view === 'forgot-success' && (
          <div className="text-center py-4">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5 text-green-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            {/* Hệ thống gửi ĐƯỜNG DẪN để người dùng tự đặt mật khẩu, không sinh
                mật khẩu mới. Màn hình cũ hứa một chuỗi không tồn tại nên người
                dùng mở thư đi tìm rồi kẹt luôn. */}
            <h2 className="text-xl font-bold text-slate-800 mb-2">Đã gửi thư hướng dẫn!</h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-2">
              Thư đặt lại mật khẩu đã được gửi tới
            </p>
            <p className="font-semibold text-slate-700 text-sm mb-4">{forgotEmail}</p>
            <p className="text-slate-600 text-sm leading-relaxed mb-6 bg-slate-50 border border-slate-200 rounded-lg p-3 text-left">
              Mở thư và bấm vào <strong>đường dẫn trong thư</strong> để tự đặt mật khẩu mới.
              Thư không chứa mật khẩu sẵn — bạn tự chọn mật khẩu của mình.
            </p>
            <p className="text-xs text-slate-500 mb-6">
              Chưa thấy thư? Kiểm tra thêm mục Thư rác (Spam).
            </p>
            <button
              onClick={() => setView('login')}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-red-200 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <LogIn size={18} />
              Đăng nhập ngay
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginModal;
