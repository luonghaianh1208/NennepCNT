
import React from 'react';
import { Eye, X, Link2, User, Trash2 } from 'lucide-react';
import { Violation } from '../../types';
import { safeParseImages, formatDateDisplay } from '../../utils';
import { useAppStore } from '../../contexts/AppContext';

interface ViewViolationModalProps {
  violation: Violation | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}

const ViewViolationModal: React.FC<ViewViolationModalProps> = ({
  violation,
  onClose,
  onDelete,
}) => {
  const { classes, students, criteria, users, currentUser, roleConfigs } = useAppStore();

  if (!violation) return null;

  const cls = classes.find((c) => c.id === violation.classId);
  const stu = students.find((s) => s.id === violation.studentId && s.classId === violation.classId);
  const cri = criteria.find((c) => c.id === violation.criteriaId);
  const reporter = users.find((u) => u.id === violation.reportedBy);
  const images = safeParseImages(violation.images);

  const reporterRoleConfig = reporter ? roleConfigs[reporter.role] : null;
  const reporterRoleLabel = reporterRoleConfig ? reporterRoleConfig.label : 'Không rõ';
  const reporterColor = reporterRoleConfig ? reporterRoleConfig.color : 'gray';

  const isCurrentUserAdmin = () => {
    const roleKey = currentUser.role.toUpperCase();
    return roleConfigs[roleKey]?.isAdmin || false;
  };

  const showReporterDetails = isCurrentUserAdmin() || currentUser.id === violation.reportedBy;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b bg-slate-50">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <Eye size={20} className="text-blue-600" /> Chi tiết
          </h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200">
            <X size={24} className="text-slate-500" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto space-y-4">
          {images.length > 0 ? (
            <div className="flex flex-col gap-2">
              {images.map((img, idx) => (
                <a
                  key={idx}
                  href={img}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 w-full p-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  <Link2 size={18} />
                  <span className="font-semibold text-sm">Xem ảnh minh chứng {images.length > 1 ? idx + 1 : ''}</span>
                </a>
              ))}
            </div>
          ) : (
            <div className="w-full h-20 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 text-sm italic border border-slate-200 border-dashed">
              Không có ảnh minh họa
            </div>
          )}

          <div className="space-y-3">
            <div>
              <div className="text-2xl font-black text-blue-800">{cls?.name}</div>
              <div className="text-sm font-semibold text-slate-600">{formatDateDisplay(violation.date)}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div className="text-xs font-bold text-slate-500 uppercase mb-1">Học sinh</div>
              <div className="font-medium text-slate-800 flex items-center gap-2">
                <User size={16} /> {stu ? `${stu.name}` : 'Tập thể lớp'}
              </div>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div className="text-xs font-bold text-slate-500 uppercase mb-1">Nội dung</div>
              <div className="font-medium text-slate-800">{cri?.content}</div>
              <div
                className={`text-lg font-bold mt-1 ${
                  violation.points > 0 ? 'text-red-600' : 'text-green-600'
                }`}
              >
                {violation.points > 0
                  ? `Trừ ${violation.points} điểm`
                  : `Cộng ${Math.abs(violation.points)} điểm`}
              </div>
            </div>
            {violation.note && (
              <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-sm text-yellow-900">
                <span className="font-bold">Ghi chú:</span> {violation.note}
              </div>
            )}

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-400 font-medium">Người báo cáo</span>
              <div className="flex items-center gap-2">
                {showReporterDetails && (
                  <span className="text-xs font-bold text-slate-700 text-right">
                    {reporter?.name} {reporter?.className ? `(${reporter.className})` : ''}
                  </span>
                )}
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border bg-${reporterColor}-50 border-${reporterColor}-200 text-${reporterColor}-700`}
                >
                  {reporterRoleLabel}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="p-4 border-t bg-slate-50 flex justify-end">
          {isCurrentUserAdmin() && (
            <button
              onClick={() => {
                onClose();
                onDelete(violation.id);
              }}
              className="text-red-600 font-bold text-sm px-4 py-2 hover:bg-red-50 rounded-lg mr-auto flex items-center gap-1"
            >
              <Trash2 size={16} /> Xóa
            </button>
          )}
          <button
            onClick={onClose}
            className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewViolationModal;
