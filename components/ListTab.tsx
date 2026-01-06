
import React, { useState, useMemo, useEffect } from 'react';
import { Download, Filter, Search, CheckSquare, Square, Trash2, AlertTriangle, Eye, Edit, Link2, ListChecks } from 'lucide-react';
import { Violation, ClassEntity, Student, Criteria, User, RoleConfig, TimeConfig } from '../types';
import { getWeekNumber, safeParseImages, formatDateDisplay, removeVietnameseTones, isDateInRange, exportToExcel } from '../utils';

interface ListTabProps {
  currentUser: User;
  violations: Violation[];
  classes: ClassEntity[];
  students: Student[];
  criteria: Criteria[];
  users: User[];
  roleConfigs: Record<string, RoleConfig>;
  timeConfigs: TimeConfig[]; 
  handleDeleteViolation: (id: string) => void;
  handleBulkDelete: (ids: string[]) => void;
  setViewingViolation: (v: Violation | null) => void;
  handleEditClick: (e: React.MouseEvent, v: Violation) => void;
}

const ListTab: React.FC<ListTabProps> = ({ currentUser, violations, classes, students, criteria, users, roleConfigs, timeConfigs, handleDeleteViolation, handleBulkDelete, setViewingViolation, handleEditClick }) => {
  // Default to ALL to show everything by default as requested
  const [filterMode, setFilterMode] = useState<'MONTH' | 'WEEK' | 'SEMESTER' | 'ALL'>('ALL');
  const [filterCriteriaType, setFilterCriteriaType] = useState<'ALL' | 'MINUS' | 'PLUS'>('ALL');
  
  // State for Filters
  const [filterConfigId, setFilterConfigId] = useState(''); // Dùng chung ID cho cả WEEK, MONTH, SEMESTER
  const [filterClassId, setFilterClassId] = useState('ALL');
  
  const [selectedViolationIds, setSelectedViolationIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // Auto-select first config if available when switching Mode
  useEffect(() => {
     if (filterMode !== 'ALL') {
         const configs = timeConfigs.filter(c => c.type === filterMode);
         // Nếu chưa chọn hoặc config hiện tại không thuộc mode mới, chọn cái đầu tiên
         const currentIsValid = configs.find(c => c.id === filterConfigId);
         if (!currentIsValid && configs.length > 0) {
             setFilterConfigId(configs[0].id);
         }
     }
  }, [filterMode, timeConfigs, filterConfigId]);

  // Check Admin permission safely based on Role Config
  const isAdmin = useMemo(() => {
     const roleKey = currentUser.role.toUpperCase();
     return roleConfigs[roleKey]?.isAdmin || false;
  }, [currentUser, roleConfigs]);

  const filteredViolations = useMemo(() => {
    let list = violations;

    // 1. Filter by Class
    if (filterClassId !== 'ALL') list = list.filter(v => v.classId === filterClassId);
    
    // 2. Filter by Time Mode (WEEK/MONTH/SEMESTER dùng chung logic lấy config từ ID)
    if (filterMode !== 'ALL') {
        const config = timeConfigs.find(c => c.id === filterConfigId);
        if (config) {
            // SỬ DỤNG HÀM isDateInRange ĐỂ ĐẢM BẢO CHÍNH XÁC (bao gồm cả ngày start và end)
            list = list.filter(v => isDateInRange(v.date, config.startDate, config.endDate));
        } else {
             // Nếu chọn mode mà không có config, list rỗng
             if (timeConfigs.filter(c => c.type === filterMode).length > 0) list = []; 
        }
    }

    // 3. Filter by Criteria Type
    if (filterCriteriaType === 'MINUS') list = list.filter(v => v.points > 0);
    else if (filterCriteriaType === 'PLUS') list = list.filter(v => v.points < 0);

    // 4. Search Filter (Client-side)
    if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        list = list.filter(v => {
            const studentName = v.studentId ? students.find(s => s.id === v.studentId)?.name : 'Tập thể';
            const className = classes.find(c => c.id === v.classId)?.name;
            const criteriaContent = criteria.find(c => c.id === v.criteriaId)?.content;
            const note = v.note || '';
            const reporter = users.find(u => u.id === v.reportedBy)?.name;
            
            // Search in: Student Name, Class Name, Criteria, Note, Reporter
            return (
                (studentName && studentName.toLowerCase().includes(term)) ||
                (className && className.toLowerCase().includes(term)) ||
                (criteriaContent && criteriaContent.toLowerCase().includes(term)) ||
                (note && note.toLowerCase().includes(term)) ||
                (reporter && reporter.toLowerCase().includes(term))
            );
        });
    }

    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [violations, filterClassId, filterMode, filterConfigId, filterCriteriaType, searchTerm, timeConfigs, classes, students, criteria, users]);

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

    // 1. Định nghĩa Header
    const headerRow = [
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
    const dataRows = filteredViolations.map(v => {
      const clsName = classes.find(c => c.id === v.classId)?.name || v.classId;
      const stuName = v.studentId ? (students.find(s => s.id === v.studentId)?.name || v.studentId) : "Tập thể";
      const criContent = criteria.find(c => c.id === v.criteriaId)?.content || v.criteriaId;
      
      const reporterUser = users.find(u => u.id === v.reportedBy);
      const reporterRoleConfig = reporterUser ? roleConfigs[reporterUser.role] : null;
      const reporterRoleLabel = reporterRoleConfig ? reporterRoleConfig.label : 'Không rõ';
      
      const isReporterMe = v.reportedBy === currentUser.id;
      const reporterName = (isAdmin || isReporterMe) ? (reporterUser?.name || v.reportedBy) : "Ẩn danh";
      
      const displayPoint = v.points > 0 ? -v.points : Math.abs(v.points);
      const typeLabel = v.points > 0 ? "Vi phạm" : "Thành tích";

      return [
        v.id,
        formatDateDisplay(v.date),
        clsName,
        stuName,
        criContent,
        displayPoint,
        reporterName,
        reporterRoleLabel,
        v.note || '',
        typeLabel
      ];
    });

    const fullData = [headerRow, ...dataRows];
    exportToExcel(fullData, `Du_lieu_thi_dua_${new Date().toISOString().slice(0,10)}`);
  };

  const getTimeOptions = () => {
      return timeConfigs.filter(c => c.type === filterMode);
  };

  return (
    <div className="space-y-4 pb-28">
      {/* Search Bar & Export */}
      <div className="flex flex-col gap-3 mb-2">
        <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800">Tra Cứu Dữ Liệu</h2>
            <button 
            onClick={handleExportFilteredData} 
            className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow hover:bg-green-700 active:scale-95 transition-transform"
            >
            <Download size={16} /> Xuất Excel
            </button>
        </div>
        
        {/* Search Input */}
        <div className="relative w-full">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input 
                type="text" 
                placeholder="Tìm kiếm theo tên HS, lớp, lỗi vi phạm, ghi chú..." 
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>

        {/* --- KẾT QUẢ BỘ LỌC (New Feature) --- */}
        <div className="flex items-center gap-2 text-sm text-slate-500 italic pl-1">
            <ListChecks size={16} className="text-blue-500" />
            <span>Hiển thị <strong>{filteredViolations.length}</strong> kết quả phù hợp.</span>
        </div>
      </div>

      {/* Filter Section */}
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
               <option value="WEEK">Theo Tuần (Cấu hình)</option>
               <option value="MONTH">Theo Tháng (Cấu hình)</option>
               <option value="SEMESTER">Theo Học Kỳ (Cấu hình)</option>
            </select>
            <select className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-sm outline-none" value={filterCriteriaType} onChange={(e) => setFilterCriteriaType(e.target.value as any)}>
               <option value="ALL">Tất cả loại</option>
               <option value="MINUS">Chỉ xem Vi phạm</option>
               <option value="PLUS">Chỉ xem Thành tích</option>
            </select>
            
            {/* Dynamic Time Filter Inputs */}
            {filterMode !== 'ALL' && (
                <select className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-sm outline-none" value={filterConfigId} onChange={(e) => setFilterConfigId(e.target.value)}>
                    {getTimeOptions().length === 0 && <option value="">Chưa có cấu hình</option>}
                    {getTimeOptions().map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            )}
            
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

          const reporterUser = users.find(u => u.id === v.reportedBy);
          const reporterRoleConfig = reporterUser ? roleConfigs[reporterUser.role] : null;
          const reporterRoleLabel = reporterRoleConfig ? reporterRoleConfig.label : 'Không rõ';
          
          const isReporterMe = v.reportedBy === currentUser.id;
          const reporterColor = reporterRoleConfig ? reporterRoleConfig.color : 'gray';

          let reporterDisplay: React.ReactNode;

          if (isAdmin || isReporterMe) {
               const reporterClass = reporterUser?.className ? ` (${reporterUser.className})` : '';
               reporterDisplay = (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border bg-${reporterColor}-50 border-${reporterColor}-100 text-${reporterColor}-700 font-medium`}>
                      {reporterUser ? `${reporterUser.name}${reporterClass} - ${reporterRoleLabel}` : reporterRoleLabel}
                  </span>
               );
          } else {
               reporterDisplay = (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border bg-${reporterColor}-50 border-${reporterColor}-100 text-${reporterColor}-700 font-medium`}>
                      {reporterRoleLabel}
                  </span>
               );
          }

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
                      {reporterDisplay}
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
              <button onClick={() => { handleBulkDelete(Array.from(selectedViolationIds)); setSelectedViolationIds(new Set()); }} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg flex items-center gap-2">
                 <Trash2 size={16} /> Xóa
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default ListTab;