
import React, { useMemo, useState } from 'react';
import { User, Violation, ClassEntity, RoleConfig, Student } from '../types';
import { Shield, Save, Edit } from 'lucide-react';

interface TaskForceTabProps {
  currentUser: User;
  users: User[];
  violations: Violation[];
  classes: ClassEntity[];
  students: Student[];
  roleConfigs: Record<string, RoleConfig>;
  onUpdateUser: (updatedUser: User) => void;
}

const TaskForceTab: React.FC<TaskForceTabProps> = ({ currentUser, users, violations, classes, students, roleConfigs, onUpdateUser }) => {
  const [filterRole, setFilterRole] = useState('ALL');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editSummaryCount, setEditSummaryCount] = useState<string>('');

  // Quyền chỉnh sửa số liệu tổng kết: Admin hoặc BCH_PHU_TRACH
  const canEditSummary = useMemo(() => {
     const role = currentUser.role.toUpperCase();
     return role === 'ADMIN' || role === 'BCH_PHU_TRACH';
  }, [currentUser]);

  // 1. Lấy danh sách các vai trò "làm nhiệm vụ" (canEntry = true, nhưng không phải Admin)
  const taskForceRoles = useMemo(() => {
    return Object.entries(roleConfigs)
        .filter(([key, config]) => config.canEntry && !config.isAdmin)
        .map(([key, config]) => ({ key, label: config.label }));
  }, [roleConfigs]);

  // 2. Lọc User thuộc các vai trò trên
  const taskForceUsers = useMemo(() => {
      return users.filter(u => {
          const config = roleConfigs[u.role] || roleConfigs['GUEST'];
          const isTaskForce = config.canEntry && !config.isAdmin;
          if (!isTaskForce) return false;
          if (filterRole !== 'ALL' && u.role !== filterRole) return false;
          return true;
      });
  }, [users, roleConfigs, filterRole]);

  // 3. Tính toán thống kê cho từng User
  const stats = useMemo(() => {
      return taskForceUsers.map(u => {
          // A. Số lỗi họ đã báo cáo
          const reportedCount = violations.filter(v => v.reportedBy === u.id).length;
          
          // B. Số lần xuống tổng kết thi đua (Từ User Data)
          const summaryMeetings = u.summaryMeetings || 0;

          // C. Số lỗi chính họ vi phạm (Trùng tên + Trùng Lớp với Student)
          // Tìm Student Profile tương ứng với User
          let personalViolationsCount = 0;
          if (u.className) {
              // Tìm học sinh trong lớp đó có tên giống tên User
              const matchedStudent = students.find(s => 
                  s.classId === u.className && s.name.toLowerCase() === u.name.toLowerCase()
              );

              if (matchedStudent) {
                  // Đếm lỗi của Student ID này (Points > 0 là lỗi)
                  personalViolationsCount = violations.filter(v => v.studentId === matchedStudent.id && v.points > 0).length;
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
  }, [taskForceUsers, violations, students]);

  const handleStartEdit = (u: any) => {
      setEditingUserId(u.id);
      setEditSummaryCount(u.summaryMeetings.toString());
  };

  const handleSaveEdit = (u: any) => {
      const newCount = parseInt(editSummaryCount);
      if (!isNaN(newCount) && newCount >= 0) {
          onUpdateUser({ ...u, summaryMeetings: newCount });
      }
      setEditingUserId(null);
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-xl p-4 shadow-sm flex items-center justify-between">
         <div>
            <h2 className="text-xl font-bold flex items-center gap-2"><Shield className="text-yellow-400"/> Thống Kê Ban Nền Nếp</h2>
            <p className="text-slate-400 text-xs">Theo dõi hoạt động và tính điểm thi đua thành viên</p>
         </div>
      </div>

      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
         <div className="text-sm font-bold text-slate-700 mb-2">Lọc theo ban:</div>
         <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
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
      </div>

      <div className="space-y-3">
          {stats.map((u, idx) => {
              const roleInfo = roleConfigs[u.role];
              const isEditing = editingUserId === u.id;

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

                          <div className="bg-green-50 p-2 rounded-lg border border-green-100 relative group">
                              <div className="text-green-600 font-medium mb-1">Tổng kết (x5)</div>
                              {isEditing ? (
                                  <div className="flex items-center justify-center gap-1">
                                      <input 
                                        type="number" 
                                        className="w-12 p-1 text-center border border-green-300 rounded font-bold text-sm"
                                        value={editSummaryCount}
                                        onChange={(e) => setEditSummaryCount(e.target.value)}
                                        autoFocus
                                      />
                                      <button onClick={() => handleSaveEdit(u)} className="text-green-700 bg-green-200 p-1 rounded"><Save size={14}/></button>
                                  </div>
                              ) : (
                                  <div className="font-bold text-green-700 text-lg flex items-center justify-center gap-1">
                                      {u.summaryMeetings}
                                      {canEditSummary && (
                                          <button onClick={() => handleStartEdit(u)} className="opacity-50 hover:opacity-100 text-green-600 p-0.5"><Edit size={12}/></button>
                                      )}
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>
              );
          })}
          
          {stats.length === 0 && (
              <div className="text-center py-10 text-slate-400">Không tìm thấy thành viên nào.</div>
          )}
      </div>
    </div>
  );
};

export default TaskForceTab;
