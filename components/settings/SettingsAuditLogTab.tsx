
import React from 'react';
import { ClipboardList, Trash2 } from 'lucide-react';
import { useAppStore } from '../../contexts/AppContext';
import { useModal } from '../../contexts/ModalContext';

const SettingsAuditLogTab: React.FC = () => {
  const { auditLogs, clearAuditLogs } = useAppStore();
  const { showConfirm, showToast } = useModal();

  // Đỏ cho mọi thao tác xoá, xanh lá cho thêm mới, xanh dương cho tài khoản
  const DELETE_STYLE = 'text-red-600 bg-red-50 border-red-100';
  const CREATE_STYLE = 'text-green-600 bg-green-50 border-green-100';
  const ACCOUNT_STYLE = 'text-blue-600 bg-blue-50 border-blue-100';

  const actionColors: Record<string, string> = {
    DELETE_VIOLATION: DELETE_STYLE,
    BULK_DELETE: 'text-red-700 bg-red-100 border-red-200',
    DELETE_CRITERIA: DELETE_STYLE,
    DELETE_TIME_CONFIG: DELETE_STYLE,
    DELETE_CLASS: DELETE_STYLE,
    DELETE_STUDENT: DELETE_STYLE,
    DELETE_ACCOUNT: DELETE_STYLE,
    CREATE_CRITERIA: CREATE_STYLE,
    CREATE_TIME_CONFIG: CREATE_STYLE,
    CREATE_ACCOUNT: ACCOUNT_STYLE,
    IMPORT_ACCOUNTS: ACCOUNT_STYLE,
    RESET_PASSWORD: ACCOUNT_STYLE,
    SET_ACCOUNT_STATUS: ACCOUNT_STYLE,
    SET_ACCOUNT_ROLE: ACCOUNT_STYLE,
  };

  const actionLabels: Record<string, string> = {
    DELETE_VIOLATION: 'Xoá bản ghi',
    BULK_DELETE: 'Xoá hàng loạt',
    DELETE_CRITERIA: 'Xoá tiêu chí',
    DELETE_TIME_CONFIG: 'Xoá mốc thời gian',
    DELETE_CLASS: 'Xoá lớp',
    DELETE_STUDENT: 'Xoá học sinh',
    DELETE_ACCOUNT: 'Xoá tài khoản',
    CREATE_CRITERIA: 'Thêm tiêu chí',
    CREATE_TIME_CONFIG: 'Thêm mốc thời gian',
    CREATE_ACCOUNT: 'Cấp tài khoản',
    IMPORT_ACCOUNTS: 'Cấp hàng loạt',
    RESET_PASSWORD: 'Gửi lại mật khẩu',
    SET_ACCOUNT_STATUS: 'Khoá / mở tài khoản',
    SET_ACCOUNT_ROLE: 'Đổi vai trò',
  };

  const handleClearLogs = async () => {
    const ok = await showConfirm({ title: 'Xóa Audit Log', message: 'Xóa toàn bộ lịch sử thao tác? Hành động này không thể hoàn tác.', type: 'danger', confirmText: 'Xóa Log' });
    if (ok) {
      clearAuditLogs();
      showToast('Đã xóa audit log.', 'success');
    }
  };

  const formatTime = (log: any) => {
    if (log.timeStr) return log.timeStr;
    if (log.timestamp) {
      const d = new Date(log.timestamp);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    return '';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
          <ClipboardList size={20} className="text-indigo-500"/> Audit Log
        </h3>
        <button
          onClick={handleClearLogs}
          className="flex items-center gap-1 text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 font-bold"
        >
          <Trash2 size={14}/> Xóa log
        </button>
      </div>

      {auditLogs.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <ClipboardList size={40} className="mx-auto mb-2 opacity-30"/>
          <p className="italic">Chưa có hoạt động nào được ghi lại.</p>
        </div>
      ) : (
        <div className="max-h-[500px] overflow-y-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 sticky top-0">
              <tr>
                <th className="px-3 py-2 whitespace-nowrap">Thời gian</th>
                <th className="px-3 py-2">Người thực hiện</th>
                <th className="px-3 py-2">Hành động</th>
                <th className="px-3 py-2">Lớp</th>
                <th className="px-3 py-2">Ngày VP</th>
                <th className="px-3 py-2">Nội dung lỗi</th>
                <th className="px-3 py-2 text-right">Điểm</th>
              </tr>
            </thead>
            <tbody>
              {[...auditLogs].reverse().map(log => {
                const isDelete = log.action === 'DELETE_VIOLATION' || log.action === 'BULK_DELETE';
                return (
                  <tr key={log.id} className={`border-b last:border-0 hover:bg-slate-50 ${isDelete ? 'bg-red-50/30' : ''}`}>
                    <td className="px-3 py-2 text-slate-400 font-mono text-xs whitespace-nowrap">{formatTime(log)}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-700 text-xs">{log.userName}</div>
                      <div className="text-[10px] text-slate-400">{log.userRole}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${actionColors[log.action] || 'text-slate-600 bg-slate-50 border-slate-200'}`}>
                        {actionLabels[log.action] || log.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs font-medium text-slate-700">
                      {log.violationClass || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">
                      {log.violationDate || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600 max-w-[160px] truncate" title={log.violationCriteria || log.details}>
                      {log.violationCriteria || log.details}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {log.violationPoints != null
                        ? <span className="text-xs font-bold text-red-600">-{log.violationPoints}</span>
                        : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-2 text-xs text-slate-400 text-right">Tổng: {auditLogs.length} bản ghi (lưu trên DB Google Sheets)</div>
    </div>
  );
};

export default SettingsAuditLogTab;
