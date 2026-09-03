
import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from './contexts/AppContext';
import { ModalProvider } from './contexts/ModalContext';
import { loadTenantConfig } from './services/tenantConfig';
import { initFirebase } from './services/firebase';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

/** Màn hình báo lỗi khi bản triển khai chưa được cấu hình cho trường nào */
const showConfigError = (message: string) => {
  root.render(
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-md bg-white border border-red-200 rounded-2xl p-6 shadow-sm text-center">
        <h1 className="text-lg font-bold text-red-700 mb-2">Chưa cấu hình được hệ thống</h1>
        <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
        <p className="text-xs text-slate-400 mt-4">
          Vui lòng liên hệ đơn vị triển khai để kiểm tra tệp <code>tenant-config.json</code>.
        </p>
      </div>
    </div>,
  );
};

// Cấu hình của trường nạp trước, Firebase khởi tạo sau, rồi mới dựng giao diện
loadTenantConfig()
  .then(config => {
    initFirebase(config.firebase);

    const shortName = config.branding?.shortName;
    if (shortName) document.title = shortName;

    root.render(
      <React.StrictMode>
        <ModalProvider>
          <AppProvider>
            <App />
          </AppProvider>
        </ModalProvider>
      </React.StrictMode>
    );
  })
  .catch((e: Error) => showConfigError(e.message));
