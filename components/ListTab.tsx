
import React, { useState, useMemo } from 'react';
import { Download, Filter, Search, CheckSquare, Square, Trash2, AlertTriangle, Eye, Edit, Link2 } from 'lucide-react';
import { Violation, ClassEntity, Student, Criteria, User, RoleConfig } from '../types';
import { getWeekNumber, safeParseImages, formatDateDisplay } from '../utils';

interface ListTabProps {
  currentUser: User;
  violations: Violation[];
  classes: ClassEntity[];
  students: Student[];
  criteria: Criteria[];
  users: User[];
  roleConfigs: Record<string, RoleConfig>;
  handleDeleteViolation: (id: string) => void;
  setViewingViolation: (v: Violation | null) => void;
  handleEditClick: (e: React.MouseEvent, v: Violation) => void;
}

const ListTab: React.FC<ListTabProps> = ({ currentUser, violations, classes, students, criteria, users, roleConfigs, handleDeleteViolation, setViewingViolation, handleEditClick }) => {
  const [filterMode, setFilterMode] = useState<'MONTH' | 'WEEK' | 'SEMESTER' | 'ALL'>('MONTH');
  const [filterCriteriaType, setFilterCriteriaType] = useState<'ALL' | 'MINUS' | 'PLUS'>('ALL');
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  const [filterWeek, setFilterWeek] = useState(`${new Date().getFullYear()}-W${getWeekNumber(new Date())}`);
  const [filterSemester, setFilterSemester] = useState('1');
  const [filterClassId, setFilterClassId] = useState('ALL');
  const [selectedViolationIds, setSelectedViolationIds] = useState<Set<string>>(new Set());

  // Check Admin permission safely based on Role Config
  const isAdmin = useMemo(() => {
     const roleKey = currentUser.role.toUpperCase();
     return roleConfigs[roleKey]?.isAdmin || false;
  }, [currentUser, roleConfigs]);

  const filteredViolations = useMemo(() => {
    let list = violations;
    if (filterClassId !== 'ALL') list = list.filter(v => v.classId === filterClassId);
    
    if (filterMode === 'MONTH') list = list.filter(v => v.date.startsWith(filterMonth));
    else if (filterMode === 'WEEK') {
      list = list.filter(v => {
        const d = new Date(v.date);
        const w = getWeekNumber(d);
        const y = d.getFullYear();
        const [fY, fW] = filterWeek.split('-W');
        return parseInt(fY) === y && parseInt(fW) === w;
      });
    } else if (filterMode === 'SEMESTER') {
      list = list.filter(v => {
        const d = new Date(v.date);
        const m = d.getMonth() + 1;
        if (filterSemester === '1') return [8, 9, 10, 11, 12, 1].includes(m);
        else return [2, 3, 4, 5, 6, 7].includes(m);
      });
    }

    if (filterCriteriaType === 'MINUS') list = list.filter(v => v.points > 0);
    else if (filterCriteriaType === 'PLUS') list = list.filter(v => v.points < 0);

    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [violations, filterClassId, filterMode, filterMonth, filterWeek, filterSemester, filterCriteriaType]);

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedViolationIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedViolationIds(newSet);
  };

  const handleSelectAll = () => {
    if (selectedViolationIds.size === filteredViolations.length) setSelectedViolationIds(new Set());
    else {
       const newSet = new Set<string>();
       filteredViolations.forEach(v => newSet.add(v.id));
       setSelectedViolationIds(newSet);
    }
  };

  const handleExportFilteredData = () => {
    if (filteredViolations.length === 0) {
      alert("Không có dữ liệu nào để xuất!");
      return;
    }

    // 1. Định nghĩa Header CSV
    const headers = [
      "Mã ID",
      "Ngày",
      "Lớp",
      "Học sinh",
      "Nội dung/Lỗi",
      "Điểm cộng/trừ",
      "Người báo",
      "Vai trò người báo",
      "Ghi chú",
      "Loại"
    ];

    // 2. Map dữ liệu
    const csvRows = filteredViolations.map(v => {
      const clsName = classes.find(c => c.id === v.classId)?.name || v.classId;
      const stuName = v.studentId ? (students.find(s => s.id === v.studentId)?.name || v.studentId) : "Tập thể";
      const criContent = criteria.find(c => c.id === v.criteriaId)?.content || v.criteriaId;
      
      const reporterUser = users.find(u => u.id === v.reportedBy);
      const reporterRoleConfig = reporterUser ? roleConfigs[reporterUser.role] : null;
      const reporterRoleLabel = reporterRoleConfig ? reporterRoleConfig.label : 'Không rõ';
      
      // Logic hiển thị tên người báo khi Export:
      // Nếu là Admin hoặc chính mình thì hiện tên, không thì hiện "Ẩn danh"
      const isReporterMe = v.reportedBy === currentUser.id;
      const reporterName = (isAdmin || isReporterMe) ? (reporterUser?.name || v.reportedBy) : "Ẩn danh";
      
      const displayPoint = v.points > 0 ? `-${v.points}` : `+${Math.abs(v.points)}`;
      const typeLabel = v.points > 0 ? "Vi phạm" : "Thành tích";

      const escape = (str: string | undefined) => `"${String(str || '').replace(/"/g, '""')}"`;

      return [
        v.id,
        formatDateDisplay(v.date),
        escape(clsName),
        escape(stuName),
        escape(criContent),
        displayPoint,
        escape(reporterName),
        escape(reporterRoleLabel),
        escape(v.note),
        typeLabel
      ].join(",");
    });

    const csvString = "\uFEFF" + [headers.join(","), ...csvRows].join("\n");

    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `bao_cao_thi_dua_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 pb-28">
      <div className="flex flex-wrap gap-2 items-center justify-between mb-2">
        <h2 className="text-xl font-bold text-slate-800">Tra Cứu Dữ Liệu</h2>
        <button 
          onClick={handleExportFilteredData} 
          className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow hover:bg-green-700 active:scale-95 transition-transform"
        >
          <Download size={16} /> Xuất Excel ({filteredViolations.length})
        </button>
      </div>

      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-3">
         <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700 font-bold text-sm"><Filter size={16} /> Bộ lọc dữ liệu</div>
            {isAdmin && filteredViolations.length > 0 && (
                <button onClick={handleSelectAll} className="text-xs text-blue-600 font-medium hover:underline">
                  {selectedViolationIds.size === filteredViolations.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
            )}
         </div>
         <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <select className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-sm outline-none" value={filterMode} onChange={(e) => setFilterMode(e.target.value as any)}>
               <option value="ALL">Tất cả thời gian</option>
               <option value="WEEK">Theo Tuần</option>
               <option value="MONTH">Theo Tháng</option>
               <option value="SEMESTER">Theo Học Kỳ</option>
            </select>
            <select className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-sm outline-none" value={filterCriteriaType} onChange={(e) => setFilterCriteriaType(e.target.value as any)}>
               <option value="ALL">Tất cả loại</option>
               <option value="MINUS">Chỉ xem Vi phạm</option>
               <option value="PLUS">Chỉ xem Thành tích</option>
            </select>
            {filterMode === 'WEEK' && <input type="week" className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-sm outline-none" value={filterWeek} onChange={(e) => setFilterWeek(e.target.value)} />}
            {filterMode === 'MONTH' && <input type="month" className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-sm outline-none" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} />}
            {filterMode === 'SEMESTER' && <select className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-sm outline-none" value={filterSemester} onChange={(e) => setFilterSemester(e.target.value)}><option value="1">Học kỳ I</option><option value="2">Học kỳ II</option></select>}
            {filterMode === 'ALL' && <div className="hidden md:block"></div>}
            <select className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-sm outline-none col-span-2 md:col-span-1" value={filterClassId} onChange={(e) => setFilterClassId(e.target.value)}>
               <option value="ALL">Tất cả các lớp</option>
               {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
         </div>
      </div>

      <div className="space-y-3">
        {filteredViolations.map((v) => {
          const cls = classes.find(c => c.id === v.classId);
          const stu = students.find(s => s.id === v.studentId);
          const cri = criteria.find(c => c.id === v.criteriaId);
          const isSelected = selectedViolationIds.has(v.id);
          
          const images = safeParseImages(v.images);

          // Logic hiển thị người báo
          const reporterUser = users.find(u => u.id === v.reportedBy);
          const reporterRoleConfig = reporterUser ? roleConfigs[reporterUser.role] : null;
          const reporterRoleLabel = reporterRoleConfig ? reporterRoleConfig.label : 'Không rõ';
          
          // Nếu là Admin: "Nguyễn Văn A - Cờ đỏ"
          // Nếu không phải Admin: "Cờ đỏ"
          const reporterDisplay = isAdmin && reporterUser 
              ? `${reporterUser.name} - ${reporterRoleLabel}`
              : `Người báo: ${reporterRoleLabel}`;
          
          const reporterColor = reporterRoleConfig ? reporterRoleConfig.color : 'gray';

          return (
            <div key={v.id} className={`relative group bg-white rounded-xl shadow-sm border p-4 transition-all ${isSelected ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/30' : 'border-slate-200 hover:border-blue-300'}`}>
              {isAdmin && (
                <div className="absolute top-3 right-3 z-20 cursor-pointer" onClick={(e) => { e.stopPropagation(); toggleSelection(v.id); }}>
                  {isSelected ? <CheckSquare className="text-blue-600" size={20} fill="white" /> : <Square className="text-slate-300 hover:text-blue-400" size={20} />}
                </div>
              )}
              <div className="flex justify-between items-start" onClick={() => setViewingViolation(v)}>
                <div className="pr-8 flex-1"> 
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-lg text-blue-800">{cls?.name}</span>
                    <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-medium border border-slate-200">
                        {formatDateDisplay(v.date)}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-slate-800 mb-0.5">{stu ? `${stu.name} - Cá nhân` : 'Tập thể lớp'}</div>
                  <div className="text-sm text-slate-600 mb-1">{cri?.content}</div>
                  
                  {/* Hiển thị người báo dạng Tag */}
                  <div className="mt-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border bg-${reporterColor}-50 border-${reporterColor}-100 text-${reporterColor}-700 font-medium`}>
                          {reporterDisplay}
                      </span>
                  </div>

                  {/* Hiển thị Link Ảnh */}
                  {images.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {images.map((img, idx) => (
                        <a 
                            key={idx} 
                            href={img} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()} // Tránh kích hoạt view modal
                            className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded border border-blue-200 transition-colors"
                        >
                            <Link2 size={12} /> 
                            <span>Xem ảnh minh chứng {images.length > 1 ? idx + 1 : ''}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="text-right flex flex-col justify-between h-full min-h-[80px]">
                  <div className={`text-lg font-bold ${v.points > 0 ? 'text-red-600' : 'text-green-600'}`}>{v.points > 0 ? `-${v.points}` : `+${Math.abs(v.points)}`}</div>
                  {isAdmin && (
                    <button onClick={(e) => handleEditClick(e, v)} className="self-end p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors mt-auto"><Edit size={16} /></button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {filteredViolations.length === 0 && (
          <div className="text-center py-10 flex flex-col items-center text-slate-400">
             <Search size={48} strokeWidth={1} className="mb-2 opacity-50" />
             <p>Không tìm thấy dữ liệu phù hợp với bộ lọc.</p>
          </div>
        )}
      </div>

      {isAdmin && selectedViolationIds.size > 0 && (
        <div className="fixed bottom-20 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:max-w-2xl bg-slate-900 text-white p-3 rounded-xl shadow-xl flex items-center justify-between z-30 animate-in slide-in-from-bottom-5">
           <div className="font-bold pl-2">Đã chọn {selectedViolationIds.size} mục</div>
           <div className="flex gap-2">
              <button onClick={() => setSelectedViolationIds(new Set())} className="px-4 py-2 text-slate-300 hover:text-white font-medium">Hủy</button>
              <button onClick={() => alert("Chức năng xóa nhiều chưa được kết nối trong bản demo tách file.")} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg flex items-center gap-2"><Trash2 size={16} /> Xóa</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default ListTab;
