
import React, { useMemo, useState } from 'react';
import { User, RoleConfig } from '../types';
import { Shield, Save, Edit, Zap, X, Check, Download } from 'lucide-react';
import { exportToExcel } from '../utils';
import { useAppStore } from '../contexts/AppContext';
import { useModal } from '../contexts/ModalContext';

const TaskForceTab: React.FC = () => {
  const { showConfirm } = useModal();
  const { currentUser, users, violations, students, roleConfigs, setUsers, setUnsavedChanges, syncSettings, unsavedChanges, classes, timeConfigs } = useAppStore();
  const { showToast } = useModal();

  const [filterRole, setFilterRole] = useState('ALL');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editSummaryCount, setEditSummaryCount] = useState<string>('');
  const [isBulkEditMode, setIsBulkEditMode] = useState(false);
  const [bulkEdits, setBulkEdits] = useState<Record<string, number>>({});

  const onUpdateUser = (updatedUser: User) => {
      setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
      setUnsavedChanges(true); 
  };

  const onSave = async () => {
    const ok = await showConfirm({ title: 'Xác nhận lưu', message: 'Lưu thay đổi lên hệ thống?' });
    if (!ok) return;
    await syncSettings();
  };

  const isManager = useMemo(() => {
     const role = currentUser.role.toUpperCase();
     return role === 'ADMIN' || role === 'BCH_PHU_TRACH';
  }, [currentUser]);

  const taskForceRoles = useMemo(() => {
    return (Object.entries(roleConfigs) as [string, RoleConfig][])
        .filter(([key, config]) => config.canEntry && !config.isAdmin)
        .map(([key, config]) => ({ key, label: config.label }));
  }, [roleConfigs]);

  const taskForceUsers = useMemo(() => {
      if (!isManager) {
          return users.filter(u => u.id === currentUser.id);
      }

      return users.filter(u => {
          const config = roleConfigs[u.role] || roleConfigs['GUEST'];
          const isTaskForce = config.canEntry && !config.isAdmin;
          if (!isTaskForce) return false;
          if (filterRole !== 'ALL' && u.role !== filterRole) return false;
          return true;
      });
  }, [users, roleConfigs, filterRole, isManager, currentUser.id]);

  // Năm học = khoảng min(startDate) → max(endDate) của tất cả timeConfigs
  const academicYear = useMemo(() => {
      if (timeConfigs.length === 0) return null;
      const starts = timeConfigs.map(c => c.startDate).sort();
      const ends = timeConfigs.map(c => c.endDate).sort();
      return { start: starts[0], end: ends[ends.length - 1] };
  }, [timeConfigs]);

  const stats = useMemo(() => {
      return taskForceUsers.map(u => {
          // Chỉ đếm vi phạm trong khoảng năm học
          const yearViolations = academicYear
              ? violations.filter(v => v.date >= academicYear.start && v.date <= academicYear.end)
              : violations;
          const reportedCount = yearViolations.filter(v => v.reportedBy === u.id).length;
          const summaryMeetings = u.summaryMeetings || 0;

          let personalViolationsCount = 0;
          if (u.className) {
              const normalizedUserName = u.name.trim().toLowerCase();
              const matchedStudent = students.find(s => 
                  s.classId === u.className && s.name.trim().toLowerCase() === normalizedUserName
              );

              if (matchedStudent) {
                  personalViolationsCount = yearViolations.filter(v => 
                    v.studentId === matchedStudent.id && 
                    v.classId === u.className && 
                    v.points > 0
                  ).length;
              }
          }

          const score = (reportedCount * 2) + (summaryMeetings * 5) - (personalViolationsCount * 5);
          
          return {
              ...u,
              reportedCount,
              personalViolationsCount,
              summaryMeetings,
              score
          };
      }).sort((a, b) => b.score - a.score);
  }, [taskForceUsers, violations, students]);

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

  const toggleBulkEditMode = () => {
    if (isBulkEditMode) {
      setIsBulkEditMode(false);
      setBulkEdits({});
    } else {
      setIsBulkEditMode(true);
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
     let hasChanges = false;
     stats.forEach(u => {
       if (bulkEdits[u.id] !== undefined && bulkEdits[u.id] !== u.summaryMeetings) {
          onUpdateUser({ ...u, summaryMeetings: bulkEdits[u.id] });
          hasChanges = true;
       }
     });
     
     setIsBulkEditMode(false);
     setBulkEdits({});
     
     if (hasChanges) {
        setTimeout(() => {
             onSave();
        }, 0);
     }
  };

  const handleExportExcel = () => {
      if (stats.length === 0) {
          showToast('Không có dữ liệu để xuất.', 'error');
          return;
      }
      
      const header = ["STT", "Họ tên", "Lớp", "Vai trò", "Báo lỗi (x2)", "Vi phạm (x-5)", "Tổng kết (x5)", "Tổng điểm"];
      const data = stats.map((u, idx) => [
          idx + 1,
          u.name,
          u.className || "",
          roleConfigs[u.role]?.label || u.role,
          u.reportedCount,
          u.personalViolationsCount,
          u.summaryMeetings,
          u.score
      ]);
      
      exportToExcel([header, ...data], `Thong_ke_Ban_Nen_Nep_${new Date().toISOString().slice(0,10)}`);
  };

  return (
    <div className="space-y-4 pb-20 relative">
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-xl p-4 shadow-sm flex items-center justify-between">
         <div>
            <h2 className="text-xl font-bold flex items-center gap-2"><Shield className="text-yellow-400"/> Thống Kê Ban Nền Nếp</h2>
            <p className="text-slate-400 text-xs">Theo dõi hoạt động và tính điểm thi đua thành viên</p>
         </div>
      </div>

      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 justify-between items-center">
         {isManager ? (
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
         ) : (
             <div className="text-sm font-bold text-slate-600">Thông tin cá nhân: {currentUser.name}</div>
         )}

         <div className="flex gap-2">
            {isManager && (
                <button 
                    onClick={handleExportExcel}
                    className="px-3 py-1.5 rounded-lg bg-green-600 text-white font-bold text-xs flex items-center gap-1 shadow hover:bg-green-700"
                >
                    <Download size={14}/> Excel
                </button>
            )}
            
            {isManager && (
                 <>
                    {isBulkEditMode ? (
                      <>
                        <button onClick={toggleBulkEditMode} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 font-bold text-xs flex items-center gap-1">
                           <X size={14}/> Hủy
                        </button>
                        <button onClick={handleBulkSave} className="px-3 py-1.5 rounded-lg bg-green-600 text-white font-bold text-xs flex items-center gap-1 shadow-lg shadow-green-200 animate-in zoom-in">
                           <Save size={14}/> Lưu
                        </button>
                      </>
                    ) : (
                      <button onClick={toggleBulkEditMode} className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 font-bold text-xs flex items-center gap-1 hover:bg-indigo-100">
                         <Zap size={14}/> Nhập nhanh
                      </button>
                    )}
                 </>
             )}
         </div>
      </div>

      <div className="space-y-3">
          {stats.map((u, idx) => {
              const roleInfo = roleConfigs[u.role];
              const isEditing = editingUserId === u.id;
              const displaySummary = isBulkEditMode ? (bulkEdits[u.id] ?? u.summaryMeetings) : u.summaryMeetings;

              return (
                  <div key={u.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                      <div className="flex items-start justify-between mb-3 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-${roleInfo?.color || 'gray'}-100 text-${roleInfo?.color || 'gray'}-700`}>
                                {idx + 1}
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
          
          {stats.length === 0 && (
              <div className="text-center py-10 text-slate-400">Không tìm thấy dữ liệu.</div>
          )}
      </div>

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
