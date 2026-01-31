
import React, { useState, useMemo, useEffect } from 'react';
import { Download, Filter, Search, CheckSquare, Square, Trash2, Edit, Link2, ListChecks, ChevronDown, Copy, RefreshCw } from 'lucide-react';
import { Violation } from '../types';
import { safeParseImages, formatDateDisplay, isDateInRange, exportToExcel } from '../utils';
import { useAppStore } from '../contexts/AppContext';

interface ListTabProps {
  handleDeleteViolation: (id: string) => void;
  handleBulkDelete: (ids: string[]) => void;
  setViewingViolation: (v: Violation | null) => void;
  handleEditClick: (e: React.MouseEvent, v: Violation) => void;
}

const ITEMS_PER_PAGE = 50;

const ListTab: React.FC<ListTabProps> = ({ handleDeleteViolation, handleBulkDelete, setViewingViolation, handleEditClick }) => {
  const { currentUser, violations, classes, students, criteria, users, roleConfigs, timeConfigs } = useAppStore();

  const [filterMode, setFilterMode] = useState<'MONTH' | 'WEEK' | 'SEMESTER' | 'ALL'>('ALL');
  const [filterCriteriaType, setFilterCriteriaType] = useState<'ALL' | 'MINUS' | 'PLUS'>('ALL');
  
  const [filterConfigId, setFilterConfigId] = useState('');
  const [filterClassId, setFilterClassId] = useState('ALL');
  
  // State mới cho bộ lọc trùng lặp
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);

  const [selectedViolationIds, setSelectedViolationIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination State
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  useEffect(() => {
     if (filterMode !== 'ALL') {
         const configs = timeConfigs.filter(c => c.type === filterMode);
         const currentIsValid = configs.find(c => c.id === filterConfigId);
         if (!currentIsValid && configs.length > 0) {
             setFilterConfigId(configs[0].id);
         }
     }
  }, [filterMode, timeConfigs, filterConfigId]);

  // Reset pagination when filters change
  useEffect(() => {
      setVisibleCount(ITEMS_PER_PAGE);
  }, [filterMode, filterCriteriaType, filterConfigId, filterClassId, searchTerm, showDuplicatesOnly]);

  const isAdmin = useMemo(() => {
     const roleKey = currentUser.role.toUpperCase();
     return roleConfigs[roleKey]?.isAdmin || false;
  }, [currentUser, roleConfigs]);

  const filteredViolations = useMemo(() => {
    let list = violations;

    // --- LOGIC LỌC TRÙNG LẶP (Dành cho Admin) ---
    if (showDuplicatesOnly && isAdmin) {
        // 1. Áp dụng bộ lọc Loại (Vi phạm/Thành tích) trước khi tìm trùng
        if (filterCriteriaType === 'MINUS') list = list.filter(v => v.points > 0);
        else if (filterCriteriaType === 'PLUS') list = list.filter(v => v.points < 0);

        // Tạo map đếm số lần xuất hiện của từng bộ dữ liệu (trừ ghi chú)
        const counts = new Map<string, number>();
        
        // Hàm tạo chữ ký duy nhất cho mỗi bản ghi
        const getSignature = (v: Violation) => {
            // Chuẩn hóa ngày về YYYY-MM-DD để so sánh chính xác
            const dateStr = v.date.includes('T') ? v.date.split('T')[0] : v.date;
            // Key = Ngày | Lớp | Học sinh | Loại lỗi
            return `${dateStr}|${v.classId}|${v.studentId || 'GROUP'}|${v.criteriaId}`;
        };

        // Bước 1: Đếm
        list.forEach(v => {
            const sig = getSignature(v);
            counts.set(sig, (counts.get(sig) || 0) + 1);
        });

        // Bước 2: Lọc lấy những thằng có count > 1
        list = list.filter(v => (counts.get(getSignature(v)) || 0) > 1);

        // Bước 3: Sắp xếp
        list.sort((a, b) => {
             // Ưu tiên 1: Ngày mới nhất lên đầu (Dùng timestamp để chính xác tuyệt đối)
             const timeA = new Date(a.date).getTime();
             const timeB = new Date(b.date).getTime();
             
             if (timeA !== timeB) {
                 return timeB - timeA; // Giảm dần theo thời gian (Mới nhất lên đầu)
             }

             // Ưu tiên 2: Nếu cùng ngày, gom nhóm theo chữ ký để các bản ghi trùng nằm cạnh nhau
             const sigA = getSignature(a);
             const sigB = getSignature(b);
             return sigA.localeCompare(sigB);
        });

    } else {
        // --- LOGIC LỌC THÔNG THƯỜNG ---
        if (filterClassId !== 'ALL') list = list.filter(v => v.classId === filterClassId);
        
        if (filterMode !== 'ALL') {
            const config = timeConfigs.find(c => c.id === filterConfigId);
            if (config) {
                list = list.filter(v => isDateInRange(v.date, config.startDate, config.endDate));
            } else {
                 if (timeConfigs.filter(c => c.type === filterMode).length > 0) list = []; 
            }
        }

        if (filterCriteriaType === 'MINUS') list = list.filter(v => v.points > 0);
        else if (filterCriteriaType === 'PLUS') list = list.filter(v => v.points < 0);
        
        // Sắp xếp mặc định theo thời gian mới nhất (Timestamp tạo ra)
        list.sort((a, b) => b.timestamp - a.timestamp);
    }

    // --- LOGIC TÌM KIẾM (Áp dụng cho cả 2 chế độ) ---
    if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        list = list.filter(v => {
            const studentName = v.studentId ? students.find(s => s.id === v.studentId && s.classId === v.classId)?.name : 'Tập thể';
            const className = classes.find(c => c.id === v.classId)?.name;
            const criteriaContent = criteria.find(c => c.id === v.criteriaId)?.content;
            const note = v.note ? String(v.note) : ''; 
            const reporter = users.find(u => u.id === v.reportedBy)?.name;
            
            return (
                (studentName && studentName.toLowerCase().includes(term)) ||
                (className && className.toLowerCase().includes(term)) ||
                (criteriaContent && criteriaContent.toLowerCase().includes(term)) ||
                (note && note.toLowerCase().includes(term)) ||
                (reporter && reporter.toLowerCase().includes(term))
            );
        });
    }

    return list;
  }, [violations, filterClassId, filterMode, filterConfigId, filterCriteriaType, searchTerm, timeConfigs, classes, students, criteria, users, showDuplicatesOnly, isAdmin]);

  // Thông báo khi lọc xong (Chỉ chạy khi showDuplicatesOnly chuyển sang true)
  useEffect(() => {
    if (showDuplicatesOnly && isAdmin) {
        // Dùng setTimeout để đảm bảo UI render xong mới alert (tránh block render)
        const timer = setTimeout(() => {
            alert(`Đã hoàn tất quét dữ liệu.\nTìm thấy: ${filteredViolations.length} bản ghi có dấu hiệu trùng lặp.`);
        }, 300);
        return () => clearTimeout(timer);
    }
  }, [showDuplicatesOnly]); // Không cho dependency filteredViolations vào để tránh alert lại khi search/filter

  // Derived visible violations for rendering
  const visibleViolations = useMemo(() => {
      return filteredViolations.slice(0, visibleCount);
  }, [filteredViolations, visibleCount]);

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

  const handleLoadMore = () => {
      setVisibleCount(prev => prev + ITEMS_PER_PAGE);
  };

  const handleExportFilteredData = () => {
    if (filteredViolations.length === 0) {
      alert("Không có dữ liệu nào để xuất!");
      return;
    }

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

    const dataRows = filteredViolations.map(v => {
      const clsName = classes.find(c => c.id === v.classId)?.name || v.classId;
      const stuName = v.studentId ? (students.find(s => s.id === v.studentId && s.classId === v.classId)?.name || v.studentId) : "Tập thể";
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
      <div className="flex flex-col gap-3 mb-2">
        <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800">Tra Cứu Dữ Liệu</h2>
            <div className="flex gap-2">
                {isAdmin && (
                    <button 
                        onClick={() => setShowDuplicatesOnly(!showDuplicatesOnly)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium shadow transition-all active:scale-95 ${showDuplicatesOnly ? 'bg-orange-600 text-white' : 'bg-white text-orange-600 border border-orange-200 hover:bg-orange-50'}`}
                        title="Tìm các lỗi trùng lặp (Ngày, Lớp, Học sinh, Lỗi)"
                    >
                        {showDuplicatesOnly ? <RefreshCw size={16} className="animate-spin" /> : <Copy size={16} />}
                        <span className="hidden sm:inline">{showDuplicatesOnly ? 'Đang lọc trùng' : 'Lọc trùng lặp'}</span>
                    </button>
                )}
                <button 
                    onClick={handleExportFilteredData} 
                    className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow hover:bg-green-700 active:scale-95 transition-transform"
                >
                    <Download size={16} /> <span className="hidden sm:inline">Xuất Excel</span>
                </button>
            </div>
        </div>
        
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

        <div className="flex items-center justify-between text-sm text-slate-500 pl-1">
            <div className="flex items-center gap-2 italic">
                <ListChecks size={16} className="text-blue-500" />
                <span>Hiển thị <strong>{visibleViolations.length}</strong> / {filteredViolations.length} kết quả phù hợp.</span>
            </div>
            {showDuplicatesOnly && (
                <span className="text-orange-600 font-bold text-xs bg-orange-50 px-2 py-1 rounded border border-orange-100 animate-pulse">
                    Đang xem chế độ trùng lặp
                </span>
            )}
        </div>
      </div>

      <div className={`bg-white p-3 rounded-xl border shadow-sm space-y-3 transition-colors ${showDuplicatesOnly ? 'border-orange-200 bg-orange-50/30' : 'border-slate-200'}`}>
         <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700 font-bold text-sm"><Filter size={16} /> Bộ lọc dữ liệu</div>
            {isAdmin && filteredViolations.length > 0 && (
                <button onClick={handleSelectAll} className="text-xs text-blue-600 font-medium hover:underline">
                  {selectedViolationIds.size === filteredViolations.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
            )}
         </div>
         
         <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <select 
                className={`bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-sm outline-none ${showDuplicatesOnly ? 'opacity-50 pointer-events-none' : ''}`}
                value={filterMode} 
                onChange={(e) => setFilterMode(e.target.value as any)}
                disabled={showDuplicatesOnly}
            >
               <option value="ALL">Tất cả thời gian</option>
               <option value="WEEK">Theo Tuần (Cấu hình)</option>
               <option value="MONTH">Theo Tháng (Cấu hình)</option>
               <option value="SEMESTER">Theo Học Kỳ (Cấu hình)</option>
            </select>
            
            {/* Vẫn cho phép chọn loại khi đang lọc trùng */}
            <select 
                className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-sm outline-none" 
                value={filterCriteriaType} 
                onChange={(e) => setFilterCriteriaType(e.target.value as any)}
            >
               <option value="ALL">Tất cả loại</option>
               <option value="MINUS">Chỉ xem Vi phạm</option>
               <option value="PLUS">Chỉ xem Thành tích</option>
            </select>
            
            {filterMode !== 'ALL' && (
                <select 
                    className={`bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-sm outline-none ${showDuplicatesOnly ? 'opacity-50 pointer-events-none' : ''}`}
                    value={filterConfigId} 
                    onChange={(e) => setFilterConfigId(e.target.value)}
                    disabled={showDuplicatesOnly}
                >
                    {getTimeOptions().length === 0 && <option value="">Chưa có cấu hình</option>}
                    {getTimeOptions().map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            )}
            
            {filterMode === 'ALL' && <div className="hidden md:block"></div>}
            
            <select 
                className={`bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-sm outline-none col-span-2 md:col-span-1 ${showDuplicatesOnly ? 'opacity-50 pointer-events-none' : ''}`}
                value={filterClassId} 
                onChange={(e) => setFilterClassId(e.target.value)}
                disabled={showDuplicatesOnly}
            >
               <option value="ALL">Tất cả các lớp</option>
               {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
         </div>
      </div>

      <div className="space-y-3">
        {visibleViolations.map((v) => {
          const cls = classes.find(c => c.id === v.classId);
          const stu = students.find(s => s.id === v.studentId && s.classId === v.classId);
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
                  
                  <div className="mt-1">
                      {reporterDisplay}
                  </div>

                  {images.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {images.map((img, idx) => (
                        <a 
                            key={idx} 
                            href={img} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
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
        
        {/* Empty State */}
        {filteredViolations.length === 0 && (
          <div className="text-center py-10 flex flex-col items-center text-slate-400">
             <Search size={48} strokeWidth={1} className="mb-2 opacity-50" />
             <p>{showDuplicatesOnly ? "Không tìm thấy dữ liệu trùng lặp." : "Không tìm thấy dữ liệu phù hợp với bộ lọc."}</p>
          </div>
        )}

        {/* Load More Button */}
        {visibleCount < filteredViolations.length && (
            <div className="flex justify-center pt-2 pb-6">
                <button 
                    onClick={handleLoadMore}
                    className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 shadow-sm rounded-full text-slate-600 font-bold hover:bg-slate-50 hover:text-blue-600 hover:border-blue-200 transition-all active:scale-95"
                >
                    <ChevronDown size={18} />
                    Xem thêm ({filteredViolations.length - visibleCount} mục nữa)
                </button>
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
