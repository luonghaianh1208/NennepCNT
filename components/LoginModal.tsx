
import React, { useState } from 'react';
import { LogIn, X } from 'lucide-react';
import { api } from '../services/googleApi';
import { GUEST_USER, INITIAL_ROLE_DEFINITIONS } from '../utils';
import { useAppStore } from '../contexts/AppContext';

interface LoginModalProps {
  onClose: () => void;
  onSuccess: (tab: string) => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ onClose, onSuccess }) => {
  const { setCurrentUser, roleConfigs } = useAppStore();

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn) return;
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const result = await api.verifyLogin(loginUsername, loginPassword);

      if (result?.success && result.user) {
        const user = result.user;
        setCurrentUser(user);
        onClose();

        localStorage.setItem('nnp_user_session', JSON.stringify(user));
        if (rememberMe) {
          localStorage.setItem('nnp_user_creds', btoa(`${loginUsername}:${loginPassword}`));
        } else {
          localStorage.removeItem('nnp_user_creds');
        }

        setLoginUsername('');
        setLoginPassword('');

        const userRoleKey = user.role.toUpperCase();
        const roleConfig = roleConfigs[userRoleKey] || roleConfigs['GUEST'] || INITIAL_ROLE_DEFINITIONS[userRoleKey];
        if (roleConfig?.canEntry) onSuccess('entry');
        else if (roleConfig?.isAdmin) onSuccess('settings');
        else onSuccess('dashboard');
      } else {
        setLoginError(result?.error || 'Tên đăng nhập hoặc mật khẩu không đúng');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-900/80 backdrop-blur-sm p-6 animate-in fade-in">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-8 animate-in zoom-in-95 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
        >
          <X size={24} />
        </button>

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
              <span className="text-xs font-normal text-slate-500 italic ml-1">(nhập email đã đăng kí)</span>
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
            <label className="block text-sm font-bold text-slate-700 mb-1">
              Mật khẩu{' '}
              <span className="text-xs font-normal text-slate-500 italic ml-1">(dạng CNT@xxxx)</span>
            </label>
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
        </form>
      </div>
    </div>
  );
};

export default LoginModal;
