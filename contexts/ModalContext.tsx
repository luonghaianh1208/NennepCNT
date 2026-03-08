
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// --- Types ---
export type ModalType = 'confirm' | 'alert' | 'danger';

interface ModalOptions {
  title: string;
  message: string;
  type?: ModalType;
  confirmText?: string;
  cancelText?: string;
}

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ModalContextType {
  showConfirm: (options: ModalOptions) => Promise<boolean>;
  showAlert: (title: string, message: string, type?: 'success' | 'error' | 'info') => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

// --- Context ---
const ModalContext = createContext<ModalContextType | undefined>(undefined);

// --- Provider ---
let resolveModal: ((value: boolean) => void) | null = null;

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [modal, setModal] = useState<(ModalOptions & { visible: boolean }) | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  let toastIdRef = React.useRef(0);

  const showConfirm = useCallback((options: ModalOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveModal = resolve;
      setModal({ ...options, type: options.type || 'confirm', visible: true });
    });
  }, []);

  const showAlert = useCallback((title: string, message: string, type: 'success' | 'error' | 'info' = 'info'): Promise<void> => {
    return new Promise((resolve) => {
      resolveModal = () => resolve();
      setModal({ title, message, type: 'alert', visible: true, confirmText: 'OK' });
    });
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const handleConfirm = () => {
    if (resolveModal) resolveModal(true);
    resolveModal = null;
    setModal(null);
  };

  const handleCancel = () => {
    if (resolveModal) resolveModal(false);
    resolveModal = null;
    setModal(null);
  };

  return (
    <ModalContext.Provider value={{ showConfirm, showAlert, showToast }}>
      {children}

      {/* === MODAL === */}
      {modal?.visible && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className={`p-5 pb-3 ${modal.type === 'danger' ? 'bg-red-50' : modal.type === 'alert' && modal.title.toLowerCase().includes('lỗi') ? 'bg-red-50' : 'bg-white'}`}>
              <div className="flex items-center gap-3 mb-1">
                {modal.type === 'danger' ? (
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-xl font-bold flex-shrink-0">⚠</div>
                ) : modal.type === 'alert' ? (
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${
                    modal.title.toLowerCase().includes('lỗi') || modal.title.toLowerCase().includes('thất bại') ? 'bg-red-100 text-red-600' :
                    modal.title.toLowerCase().includes('thành công') ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                  }`}>
                    {modal.title.toLowerCase().includes('lỗi') || modal.title.toLowerCase().includes('thất bại') ? '✕' :
                     modal.title.toLowerCase().includes('thành công') ? '✓' : 'ℹ'}
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xl flex-shrink-0">?</div>
                )}
                <h3 className="text-lg font-bold text-slate-800">{modal.title}</h3>
              </div>
              {modal.message && (
                <p className="text-slate-600 text-sm leading-relaxed ml-[52px]">{modal.message}</p>
              )}
            </div>

            {/* Actions */}
            <div className={`flex gap-2 p-4 pt-2 ${modal.type === 'alert' ? 'justify-center' : 'justify-end'}`}>
              {modal.type !== 'alert' && (
                <button
                  onClick={handleCancel}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors"
                >
                  {modal.cancelText || 'Hủy'}
                </button>
              )}
              <button
                onClick={handleConfirm}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all active:scale-95 shadow-md ${
                  modal.type === 'danger' ? 'bg-red-600 hover:bg-red-700 shadow-red-200' :
                  'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                }`}
              >
                {modal.confirmText || (modal.type === 'danger' ? 'Xóa' : 'Xác nhận')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === TOASTS === */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[101] flex flex-col gap-2 pointer-events-none">
          {toasts.map(toast => (
            <div
              key={toast.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-white text-sm font-medium animate-in slide-in-from-right-5 fade-in duration-200 pointer-events-auto ${
                toast.type === 'success' ? 'bg-green-600' :
                toast.type === 'error' ? 'bg-red-600' : 'bg-slate-800'
              }`}
            >
              <span className="text-base">
                {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}
              </span>
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </ModalContext.Provider>
  );
};

// --- Hook ---
export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) throw new Error('useModal must be used within ModalProvider');
  return context;
};
