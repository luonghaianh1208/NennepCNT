
import React, { useMemo, useState } from 'react';
import { User, Violation, ClassEntity, RoleConfig, Student } from '../types';
import { Shield, Save, Edit, Zap, X, Check, EyeOff } from 'lucide-react';

interface TaskForceTabProps {
  currentUser: User;
  users: User[];
  violations: Violation[];
  classes: ClassEntity[];
  students: Student[];
  roleConfigs: Record<string, RoleConfig>;
  onUpdateUser: (updatedUser: User) => void;
  unsavedChanges: boolean;
  onSave: () => void;
}

const TaskForceTab: React.FC<TaskForceTabProps> = ({ currentUser, users, violations, classes, students, roleConfigs, onUpdateUser, unsavedChanges, onSave }) => {
  const [filterRole, setFilterRole] = useState('ALL');
  
  // Single Edit State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editSummaryCount, setEditSummaryCount] = useState<string>('');

  // Bulk Edit State
  const [isBulkEditMode, setIsBulkEditMode] = useState(false);
  const [bulkEdits, setBulkEdits] = useState<Record<string, number>>({});

  // Quyền Quản lý (Xem tất cả + Chỉnh sửa): Admin hoặc BCH_PHU_TRACH
  const isManager = useMemo(() => {
     const role = currentUser.role.toUpperCase();
     return role === 'ADMIN' || role === 'BCH_PHU_TRACH';
  }, [currentUser]);

  // 1. Lấy danh sách các vai trò "làm nhiệm vụ" (canEntry = true, nhưng không phải Admin)
  const taskForceRoles = useMemo(() => {
    return (Object.entries(roleConfigs) as [string, RoleConfig][])
        .filter(([key, config]) => config.canEntry && !config.isAdmin)
        .map(([key, config]) => ({ key, label: config.label }));
  }, [roleConfigs]);

  // 2. Lọc User thuộc các vai trò trên
  const taskForceUsers = useMemo(() => {
      return users.filter(u => {
          const config = roleConfigs[u.role] || roleConfigs['GUEST'];
          const isTaskForce = config.canEntry && !config.isAdmin;
          if (!isTaskForce) return false;
          // Nếu là Manager thì mới áp dụng bộ lọc Role, nếu không thì lấy hết để tính xếp hạng ngầm
          if (isManager && filterRole !== 'ALL' && u.role !== filterRole) return false;
          return true;
      });
  }, [users, roleConfigs, filterRole, isManager]);

  // 3. Tính toán thống kê cho từng User và Xếp hạng
  const stats = useMemo(() => {
      const calculatedStats = taskForceUsers.map(u => {
          // A. Số lỗi họ đã báo cáo
          const reportedCount = violations.filter(v => v.reportedBy === u.id).length;
          
          // B. Số lần xuống tổng kết thi đua (Từ User Data)
          const summaryMeetings = u.summaryMeetings || 0;

          // C. Số lỗi chính họ vi phạm (Trùng tên + Trùng Lớp với Student)
          // UPDATE: Thắt chặt điều kiện lọc để tránh đếm sai
          let personalViolationsCount = 0;
          if (u.className) {
              const targetClassName = u.className.trim();
              const targetUserName = u.name.trim().toLowerCase();

              // Bước 1: Tìm Student Profile khớp chính xác Tên và Lớp
              const matchedStudent = students.find(s => 
                  s.classId === targetClassName && 
                  s.name.trim().toLowerCase() === targetUserName
              );

              if (matchedStudent) {
                  // Bước 2: Đếm lỗi trong database
                  // Điều kiện: Khớp StudentID AND Khớp ClassID AND Points > 0
                  personalViolationsCount = violations.filter(v => 
                      v.studentId === matchedStudent.id && 
                      v.classId === targetClassName && // Đảm bảo lỗi thuộc đúng lớp hiện tại
                      v.points > 0
                  ).length;
              }
          }

          // D. Tính điểm thi đua
          // Công thức: (Số lỗi báo x 2) + (Số lần tổng kết x 5) - (Số lỗi vi phạm x 5)
          const score = (reportedCount * 2) + (summaryMeetings * 5) - (personalViolationsCount * 5);
          
          return {
              ...u,
              reportedCount,
              personalViolationsCount,
              summaryMeetings,
              score
          };
      }).sort((a, b) => b.score - a.score); // Xếp theo điểm thi đua

      // Thêm thuộc tính rank vào object để hiển thị đúng thứ hạng ngay cả khi filter
      return calculatedStats.map((item, index) => ({ ...item, rank: index + 1 }));
  }, [taskForceUsers, violations, students]);

  // 4. Lọc danh sách hiển thị dựa trên quyền hạn
  const visibleStats = useMemo(() => {
      if (isManager) return stats;
      // Nếu không phải quản lý, chỉ xem của chính mình
      return stats.filter(u => u.id === currentUser.id);
  }, [stats, isManager, currentUser.id]);

  const handleStartEdit = (u: any) => {
      setEditingUserId(u.id);
      setEditSummaryCount(u.summaryMeetings.toString());
  };

  const handleSaveEdit = (u: any) => {
      const newCount = parseInt(editSummaryCount);
      if (!isNaN(newCount) && newCount >= 0) {
          const updatedUser = { ...u, summaryMeetings: newCount };
          onUpdateUser(updatedUser);
      }
      setEditingUserId(null);
  };

  // --- Bulk Edit Handlers ---
  const toggleBulkEditMode = () => {
    if (isBulkEditMode) {
      // Canceling
      setIsBulkEditMode(false);
      setBulkEdits({});
    } else {
      // Starting
      setIsBulkEditMode(true);
      // Init bulkEdits with current values
      const initialEdits: Record<string, number> = {};
      stats.forEach(u => {
        initialEdits[u.id] = u.summaryMeetings;
      });
      setBulkEdits(initialEdits);
    }
  };

  const handleBulkChange = (userId: string, val: string) => {
    const num = parseInt(val);
    if (!isNaN(num) && num >= 0) {
      setBulkEdits(prev => ({ ...prev, [userId]: num }));
    }
  };

  const handleBulkSave = () => {
     // Apply all edits to global state
     let hasChanges = false;
     stats.forEach(u => {
       if (bulkEdits[u.id] !== undefined && bulkEdits[u.id] !== u.summaryMeetings) {
          onUpdateUser({ ...u, summaryMeetings: bulkEdits[u.id] });
          hasChanges = true;
       }
     });
     
     setIsBulkEditMode(false);
     setBulkEdits({});
     
     // Gọi Save ngay lập tức nếu có thay đổi (trigger sync database)
     if (hasChanges) {
        // Use timeout 0 to allow state to settle
        setTimeout(() => {
             onSave();
        }, 0);
     }
  };

  return (
    <div className="space-y-4 pb-20 relative">
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-xl p-4 shadow-sm flex items-center justify-between">
         <div>
            <h2 className="text-xl font-bold flex items-center gap-2"><Shield className="text-yellow-400"/> Thống Kê Ban Nền Nếp</h2>
            <p className="text-slate-400 text-xs">Theo dõi hoạt động và tính điểm thi đua thành viên</p>
         </div>
      </div>

      {/* Chỉ hiển thị thanh bộ lọc và công cụ cho Manager */}
      {isManager && (
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 justify-between items-center">
           <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar w-full md:w-auto">
               <button 
                  onClick={() => setFilterRole('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${filterRole === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
               >
                  Tất cả
               </button>
               {taskForceRoles.map(r => (
                   <button 
                      key={r.key}
                      onClick={() => setFilterRole(r.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${filterRole === r.key ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                   >
                      {r.label}
                   </button>
               ))}
           </div>

           <div className="flex gap-2">
              {isBulkEditMode ? (
                <>
                  <button onClick={toggleBulkEditMode} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 font-bold text-xs flex items-center gap-1">
                     <X size={14}/> Hủy
                  </button>
                  <button onClick={handleBulkSave} className="px-3 py-1.5 rounded-lg bg-green-600 text-white font-bold text-xs flex items-center gap-1 shadow-lg shadow-green-200 animate-in zoom-in">
                     <Save size={14}/> Lưu tất cả
                  </button>
                </>
              ) : (
                <button onClick={toggleBulkEditMode} className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 font-bold text-xs flex items-center gap-1 hover:bg-indigo-100">
                   <Zap size={14}/> Nhập nhanh
                </button>
              )}
           </div>
        </div>
      )}

      {!isManager && (
         <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 flex items-center gap-2">
             <EyeOff size={16} />
             <span>Bạn đang xem thống kê cá nhân của mình.</span>
         </div>
      )}

      <div className="space-y-3">
          {visibleStats.map((u) => {
              const roleInfo = roleConfigs[u.role];
              const isEditing = editingUserId === u.id;
              // Nếu đang Bulk Mode -> dùng giá trị trong state bulkEdits, fallback về giá trị gốc
              const displaySummary = isBulkEditMode ? (bulkEdits[u.id] ?? u.summaryMeetings) : u.summaryMeetings;

              return (
                  <div key={u.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                      <div className="flex items-start justify-between mb-3 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-${roleInfo?.color || 'gray'}-100 text-${roleInfo?.color || 'gray'}-700 border border-${roleInfo?.color || 'gray'}-200`}>
                                {u.rank}
                            </div>
                            <div>
                                <div className="font-bold text-slate-800">{u.name}</div>
                                <div className="text-xs text-slate-500 flex items-center gap-1">
                                    <span>{u.className || 'Lớp ?'}</span> • 
                                    <span className={`text-${roleInfo?.color}-600 font-semibold`}>{roleInfo?.label}</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                           <div className="text-xs text-slate-400 font-bold uppercase">Điểm thi đua</div>
                           <div className={`text-xl font-black ${u.score >= 0 ? 'text-blue-600' : 'text-red-500'}`}>{u.score}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="bg-blue-50 p-2 rounded-lg border border-blue-100">
                              <div className="text-blue-400 font-medium mb-1">Báo lỗi (x2)</div>
                              <div className="font-bold text-blue-700 text-lg">{u.reportedCount}</div>
                          </div>
                          
                          <div className="bg-red-50 p-2 rounded-lg border border-red-100">
                              <div className="text-red-400 font-medium mb-1">Vi phạm (x-5)</div>
                              <div className="font-bold text-red-700 text-lg">{u.personalViolationsCount}</div>
                          </div>

                          <div className={`p-2 rounded-lg border relative group transition-colors ${isBulkEditMode ? 'bg-green-100 border-green-300 ring-1 ring-green-300' : 'bg-green-50 border-green-100'}`}>
                              <div className="text-green-600 font-medium mb-1">Tổng kết (x5)</div>
                              
                              {/* DISPLAY LOGIC */}
                              {isBulkEditMode ? (
                                  <div className="flex justify-center">
                                      <input 
                                        type="number"
                                        min="0"
                                        className="w-16 p-1 text-center font-bold text-lg rounded border border-green-400 focus:ring-2 focus:ring-green-500 outline-none"
                                        value={displaySummary}
                                        onChange={(e) => handleBulkChange(u.id, e.target.value)}
                                      />
                                  </div>
                              ) : (
                                  <>
                                      {isEditing ? (
                                          <div className="flex items-center justify-center gap-1">
                                              <input 
                                                type="number" 
                                                className="w-12 p-1 text-center border border-green-300 rounded font-bold text-sm"
                                                value={editSummaryCount}
                                                onChange={(e) => setEditSummaryCount(e.target.value)}
                                                autoFocus
                                              />
                                              <button onClick={() => handleSaveEdit(u)} className="text-green-700 bg-green-200 p-1 rounded"><Check size={14}/></button>
                                          </div>
                                      ) : (
                                          <div className="font-bold text-green-700 text-lg flex items-center justify-center gap-1">
                                              {u.summaryMeetings}
                                              {isManager && (
                                                  <button onClick={() => handleStartEdit(u)} className="opacity-50 hover:opacity-100 text-green-600 p-0.5"><Edit size={12}/></button>
                                              )}
                                          </div>
                                      )}
                                  </>
                              )}
                          </div>
                      </div>
                  </div>
              );
          })}
          
          {visibleStats.length === 0 && (
              <div className="text-center py-10 text-slate-400">
                  {isManager ? "Không tìm thấy thành viên nào." : "Tài khoản của bạn không nằm trong danh sách Ban Nền Nếp."}
              </div>
          )}
      </div>

      {/* Floating Save Button - Only show if not in bulk mode (bulk mode has its own save) and has changes */}
      {unsavedChanges && !isBulkEditMode && (
        <div className="fixed bottom-24 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in">
           <button onClick={onSave} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full shadow-xl flex items-center gap-2 active:scale-95 transition-all">
              <Save size={20} /> Lưu lên hệ thống
           </button>
        </div>
      )}
    </div>
  );
};

export default TaskForceTab;
