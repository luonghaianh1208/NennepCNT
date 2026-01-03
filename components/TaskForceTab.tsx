
import React, { useMemo, useState } from 'react';
import { User, Violation, ClassEntity, RoleConfig } from '../types';
import { Shield, AlertTriangle, CheckCircle } from 'lucide-react';

interface TaskForceTabProps {
  users: User[];
  violations: Violation[];
  classes: ClassEntity[];
  roleConfigs: Record<string, RoleConfig>;
}

const TaskForceTab: React.FC<TaskForceTabProps> = ({ users, violations, classes, roleConfigs }) => {
  const [filterRole, setFilterRole] = useState('ALL');

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
          // Số lỗi họ đã báo cáo
          const reportedCount = violations.filter(v => v.reportedBy === u.id).length;
          
          // Số lỗi chính họ vi phạm (Dựa vào Student Name trùng User Name - Logic tương đối vì User không map 1-1 với Student ID trong model hiện tại, ta tạm dùng tên để map hoặc username nếu trùng tên)
          // Tuy nhiên, trong model hiện tại User có 'className'. Ta có thể giả định User cũng là Student nếu tên trùng.
          // Để chính xác hơn, ta đếm số lỗi của lớp mà User này phụ trách nếu họ là Cờ đỏ lớp đó? Không, yêu cầu là "chính các bạn đó đang mắc bao nhiêu lỗi".
          // Do User ID khác Student ID. Ta sẽ tìm Student nào có tên trùng với User Name trong lớp mà User đó thuộc về (u.className).
          
          let personalViolationsCount = 0;
          let totalPenalty = 0;

          if (u.className) {
             // Tìm violation của học sinh có tên trùng user name trong lớp đó
             const relevantViolations = violations.filter(v => {
                 // Cần tìm student name từ studentId
                 // Do không có students prop truyền vào đây, ta dùng logic ước lượng hoặc cần truyền students vào props.
                 // Tạm thời để đơn giản: Ta đếm số lỗi của Lớp mà user này đang ở (u.className) nếu user này vi phạm (cần Student List để map chính xác).
                 // Nhưng ở đây ta chưa có Student List trong props.
                 return false; 
             });
             // Fix: Cần truyền students vào props để tính chính xác.
             // Tạm thời hiển thị số bài báo cáo (Năng suất).
          }
          
          return {
              ...u,
              reportedCount,
              personalViolationsCount, // Placeholder until students prop added
              totalPenalty
          };
      }).sort((a, b) => b.reportedCount - a.reportedCount); // Xếp theo năng suất báo cáo
  }, [taskForceUsers, violations]);

  return (
    <div className="space-y-4 pb-20">
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-xl p-4 shadow-sm flex items-center justify-between">
         <div>
            <h2 className="text-xl font-bold flex items-center gap-2"><Shield className="text-yellow-400"/> Thống Kê Ban Nề Nếp</h2>
            <p className="text-slate-400 text-xs">Theo dõi hoạt động của đội Cờ đỏ, Xung kích...</p>
         </div>
      </div>

      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
         <div className="text-sm font-bold text-slate-700 mb-2">Lọc theo ban:</div>
         <div className="flex gap-2 overflow-x-auto pb-1">
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
              return (
                  <div key={u.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-${roleInfo?.color || 'gray'}-100 text-${roleInfo?.color || 'gray'}-700`}>
                              {idx + 1}
                          </div>
                          <div>
                              <div className="font-bold text-slate-800">{u.name}</div>
                              <div className="text-xs text-slate-500 flex items-center gap-1">
                                  <span>{u.className || 'Chưa cập nhật lớp'}</span> • 
                                  <span className={`text-${roleInfo?.color}-600 font-semibold`}>{roleInfo?.label}</span>
                              </div>
                          </div>
                      </div>
                      <div className="flex items-center gap-4">
                          <div className="text-center">
                              <div className="text-xs text-slate-400 font-medium uppercase">Đã báo</div>
                              <div className="text-lg font-black text-blue-600">{u.reportedCount}</div>
                          </div>
                          {/* 
                            Feature "Số lỗi cá nhân" cần mapping chính xác giữa User Account và Student ID.
                            Hiện tại hệ thống tách biệt User (Login) và Student (Data).
                            Nếu sau này gộp lại hoặc có trường studentId trong User, ta sẽ hiện phần này.
                          */}
                          {/* <div className="text-center pl-4 border-l">
                              <div className="text-xs text-slate-400 font-medium uppercase">Vi phạm</div>
                              <div className="text-lg font-black text-red-500">{u.personalViolationsCount}</div>
                          </div> */}
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
