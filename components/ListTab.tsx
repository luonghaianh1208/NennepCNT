
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Download, Filter, Search, CheckSquare, Square, Trash2, Edit, Link2, ListChecks, ChevronDown, Copy, RefreshCw, AlertTriangle, X } from 'lucide-react';
import { Violation } from '../types';
import { safeParseImages, formatDateDisplay, isDateInRange, exportToExcel, findDuplicateViolations, can } from '../utils';
import { useAppStore } from '../contexts/AppContext';
import { useModal } from '../contexts/ModalContext';

interface ListTabProps {
  onDeleteViolation: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
  onBulkUpdate: (ids: string[], patch: Partial<Violation>, onProgress?: (done: number, total: number) => void) => Promise<void>;
  onUndoBulkUpdate: () => void;
  undoSnapshot: Violation[] | null;
  setViewingViolation: (v: Violation | null) => void;
  setEditingViolation: (v: Violation | null) => void;
  // Filter state lifted to App.tsx for persistence across tab switches
  filterMode: 'MONTH' | 'WEEK' | 'SEMESTER' | 'ALL';
  setFilterMode: (m: 'MONTH' | 'WEEK' | 'SEMESTER' | 'ALL') => void;
  filterConfigId: string;
  setFilterConfigId: (id: string) => void;
  filterClassId: string;
  setFilterClassId: (id: string) => void;
  filterCriteriaType: 'ALL' | 'MINUS' | 'PLUS';
  setFilterCriteriaType: (t: 'ALL' | 'MINUS' | 'PLUS') => void;
}

const ITEMS_PER_PAGE = 20;

const ListTab: React.FC<ListTabProps> = ({
  setViewingViolation, setEditingViolation, onDeleteViolation, onBulkDelete, onBulkUpdate, onUndoBulkUpdate, undoSnapshot,
  filterMode, setFilterMode,
  filterConfigId, setFilterConfigId,
  filterClassId, setFilterClassId,
  filterCriteriaType, setFilterCriteriaType,
}) => {
  const { currentUser, violations, classes, students, criteria, users, roleConfigs, timeConfigs, isRefreshing,
    isBackgroundLoading, ensureRangeLoaded, ensureAllLoaded } = useAppStore();
  const { showToast } = useModal();

  // Local-only state (không cần persist)
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [showOutOfConfig, setShowOutOfConfig] = useState(false);
  const [selectedViolationIds, setSelectedViolationIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkEditField, setBulkEditField] = useState<'date' | 'note' | 'criteriaId' | ''>('');
  const [bulkEditValue, setBulkEditValue] = useState('');
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  // Pagination State
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  // Intersection Observer sentinel ref — tự động load khi scroll đến cuối
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
     if (filterMode !== 'ALL') {
         const configs = [...timeConfigs.filter(c => c.type === filterMode)].sort((a, b) => b.startDate.localeCompare(a.startDate));
         const currentIsValid = configs.find(c => c.id === filterConfigId);
         if (!currentIsValid && configs.length > 0) {
             setFilterConfigId(configs[0].id);
         }
     }
  }, [filterMode, timeConfigs, filterConfigId]);

  // Dữ liệu chỉ tải sẵn cho khoảng đang diễn ra — chọn mốc khác thì lấy thêm
  useEffect(() => {
    if (filterMode === 'ALL') {
      ensureAllLoaded();
      return;
    }
    const config = timeConfigs.find(c => c.id === filterConfigId);
    if (config) ensureRangeLoaded(config.startDate, config.endDate);
  }, [filterMode, filterConfigId, timeConfigs, ensureRangeLoaded, ensureAllLoaded]);

  // Reset pagination when filters change
  useEffect(() => {
      setVisibleCount(ITEMS_PER_PAGE);
  }, [filterMode, filterCriteriaType, filterConfigId, filterClassId, searchTerm, showDuplicatesOnly, showOutOfConfig]);


  const canEditOthers = useMemo(() => can(roleConfigs, currentUser.role, 'editOthers'), [currentUser, roleConfigs]);
  const canBulkDelete = useMemo(() => can(roleConfigs, currentUser.role, 'bulkDelete'), [currentUser, roleConfigs]);
  const canSeeReporter = useMemo(() => can(roleConfigs, currentUser.role, 'seeReporter'), [currentUser, roleConfigs]);
  const canModerate = useMemo(() => can(roleConfigs, currentUser.role, 'moderation'), [currentUser, roleConfigs]);
  // Tính violations nằm ngoài tất cả timeConfig (chỉ admin cần)
  const outOfConfigViolations = useMemo(() => {
    if (!canModerate) return [];
    if (timeConfigs.length === 0) return []; // Chưa có cấu hình nào thì không hiển thị cảnh báo
    return violations.filter(v => {
      return !timeConfigs.some(tc => isDateInRange(v.date, tc.startDate, tc.endDate));
    });
  }, [violations, timeConfigs, canModerate]);

  const filteredViolations = useMemo(() => {
    // --- LOGIC LỌC NGOÀI CẤU HÌNH (Chỉ admin) ---
    if (showOutOfConfig && canModerate) {
      let list = outOfConfigViolations;
      if (filterCriteriaType === 'MINUS') list = list.filter(v => v.points > 0);
      else if (filterCriteriaType === 'PLUS') list = list.filter(v => v.points < 0);
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        list = list.filter(v => {
          const studentName = v.studentId ? students.find(s => s.id === v.studentId && s.classId === v.classId)?.name : 'Tập thể';
          const className = classes.find(c => c.id === v.classId)?.name;
          const criteriaContent = criteria.find(c => c.id === v.criteriaId)?.content;
          return (studentName && studentName.toLowerCase().includes(term)) ||
                 (className && className.toLowerCase().includes(term)) ||
                 (criteriaContent && criteriaContent.toLowerCase().includes(term));
        });
      }
      return list.sort((a, b) => b.timestamp - a.timestamp);
    }

    let list = violations;

    // --- LOGIC LỌC TRÙNG LẶP (Dành cho Admin) — dùng util từ utils.ts ---
    if (showDuplicatesOnly && canModerate) {
        // Áp dụng bộ lọc Loại trước khi tìm trùng
        let subset = list;
        if (filterCriteriaType === 'MINUS') subset = subset.filter(v => v.points > 0);
        else if (filterCriteriaType === 'PLUS') subset = subset.filter(v => v.points < 0);
        return findDuplicateViolations(subset);
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
  }, [violations, filterClassId, filterMode, filterConfigId, filterCriteriaType, searchTerm, timeConfigs, classes, students, criteria, users, showDuplicatesOnly, canModerate, showOutOfConfig, outOfConfigViolations]);

  // Thông báo khi lọc xong (Chỉ chạy khi showDuplicatesOnly chuyển sang true)
  useEffect(() => {
    if (showDuplicatesOnly && canModerate) {
        // Dùng setTimeout để đảm bảo UI render xong mới alert (tránh block render)
        const timer = setTimeout(() => {
            showToast(`Quét xong. Tìm thấy ${filteredViolations.length} bản ghi có dấu hiệu trùng lặp.`, 'info');
        }, 300);
        return () => clearTimeout(timer);
    }
  }, [showDuplicatesOnly]); // Không cho dependency filteredViolations vào để tránh alert lại khi search/filter

  // Derived visible violations for rendering
  const visibleViolations = useMemo(() => {
      return filteredViolations.slice(0, visibleCount);
  }, [filteredViolations, visibleCount]);

  // Intersection Observer: tự động load thêm khi scroll đến sentinel (sau khi filteredViolations được khai báo)
  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < filteredViolations.length) {
          setVisibleCount(prev => Math.min(prev + ITEMS_PER_PAGE, filteredViolations.length));
        }
      },
      { rootMargin: '120px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, filteredViolations.length]);

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
      showToast('Không có dữ liệu nào để xuất!', 'error');
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
      const reporterName = (canSeeReporter || isReporterMe) ? (reporterUser?.name || v.reportedBy) : "Ẩn danh";
      
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

  const handleBulkEdit = async () => {
    if (!bulkEditField || !bulkEditValue.trim()) return;
    const count = selectedViolationIds.size;
    setIsBulkUpdating(true);
    setBulkProgress({ done: 0, total: count });
    const patch: Partial<Violation> = {};
    if (bulkEditField === 'date') patch.date = bulkEditValue;
    if (bulkEditField === 'note') patch.note = bulkEditValue;
    if (bulkEditField === 'criteriaId') patch.criteriaId = bulkEditValue;
    await onBulkUpdate(Array.from(selectedViolationIds), patch, (done, total) => setBulkProgress({ done, total }));
    setIsBulkUpdating(false);
    setBulkProgress({ done: 0, total: 0 });
    setShowBulkEdit(false);
    setBulkEditField('');
    setBulkEditValue('');
    setSelectedViolationIds(new Set());
    showToast(`Đã cập nhật ${count} mục thành công! Có thể hoàn tác trong 8 giây.`, 'success');
  };

  const getTimeOptions = () => {
      // Sắp xếp từ mới nhất xuống (startDate giảm dần)
      return [...timeConfigs.filter(c => c.type === filterMode)].sort((a, b) => b.startDate.localeCompare(a.startDate));
  };

  return (
    <div className="space-y-4 pb-28">
      <div className="flex flex-col gap-3 mb-2">
        <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800">Tra Cứu Dữ Liệu</h2>
            <div className="flex gap-2">
                {canModerate && (
                    <button 
                        onClick={() => setShowDuplicatesOnly(!showDuplicatesOnly)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium shadow transition-all active:scale-95 ${showDuplicatesOnly ? 'bg-orange-600 text-white' : 'bg-white text-orange-600 border border-orange-200 hover:bg-orange-50'}`}
                        title="Tìm các lỗi trùng lặp (Ngày, Lớp, Học sinh, Lỗi)"
                    >
                        {showDuplicatesOnly ? <RefreshCw size={16} className="animate-spin" /> : <Copy size={16} />}
                        <span className="hidden sm:inline">{showDuplicatesOnly ? 'Đang lọc trùng' : 'Lọc trùng lặp'}</span>
                    </button>
                )}
                {canModerate && outOfConfigViolations.length > 0 && (
                  <button
                    onClick={() => {
                      setShowOutOfConfig(!showOutOfConfig);
                      setShowDuplicatesOnly(false);
                      setFilterMode('ALL');
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium shadow transition-all active:scale-95 ${showOutOfConfig ? 'bg-yellow-500 text-white' : 'bg-yellow-50 text-yellow-700 border border-yellow-300 hover:bg-yellow-100'}`}
                    title="Vi phạm nằm ngoài khoảng thời gian cấu hình"
                  >
                    <AlertTriangle size={15} />
                    <span>{outOfConfigViolations.length} ngoài cấu hình</span>
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
                {isBackgroundLoading && (
                  <span className="ml-2 text-blue-600 font-semibold animate-pulse">đang lấy thêm dữ liệu…</span>
                )}
            </div>
            {showDuplicatesOnly && (
                <span className="text-orange-600 font-bold text-xs bg-orange-50 px-2 py-1 rounded border border-orange-100 animate-pulse">
                    Đang xem chế độ trùng lặp
                </span>
            )}
            {showOutOfConfig && (
                <span className="text-yellow-700 font-bold text-xs bg-yellow-50 px-2 py-1 rounded border border-yellow-200 animate-pulse flex items-center gap-1">
                  <AlertTriangle size={12} /> Đang xem lỗi ngoài cấu hình
                </span>
            )}
        </div>
      </div>

      <div className={`bg-white p-3 rounded-xl border shadow-sm space-y-3 transition-colors ${showDuplicatesOnly ? 'border-orange-200 bg-orange-50/30' : 'border-slate-200'}`}>
         <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700 font-bold text-sm"><Filter size={16} /> Bộ lọc dữ liệu</div>
            {canBulkDelete && filteredViolations.length > 0 && (
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
        {/* Skeleton loading khi isRefreshing */}
        {isRefreshing && (
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-8">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-5 w-16 bg-slate-200 rounded" />
                      <div className="h-4 w-24 bg-slate-100 rounded" />
                    </div>
                    <div className="h-4 w-32 bg-slate-200 rounded mb-1.5" />
                    <div className="h-4 w-48 bg-slate-100 rounded mb-2" />
                    <div className="h-5 w-28 bg-slate-100 rounded" />
                  </div>
                  <div className="h-7 w-10 bg-slate-200 rounded" />
                </div>
              </div>
            ))}
            <p className="text-center text-slate-400 text-sm py-2 animate-pulse">Đang tải dữ liệu mới nhất...</p>
          </div>
        )}
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

          // Nhãn cộng dồn: màu + chức vụ luôn hiện, tên ghép thêm phía sau và chỉ
          // với người có quyền hoặc chính người đã ghi. Cả trường nhìn màu là biết
          // bản ghi do cờ đỏ, nền nếp hay BCH ghi, mà không lộ danh tính.
          const canSeeName = canSeeReporter || isReporterMe;
          const reporterFullName = reporterUser
            ? `${reporterUser.name}${reporterUser.className ? ` (${reporterUser.className})` : ''}`
            : null;
          const reporterDisplay = (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded border bg-${reporterColor}-50 border-${reporterColor}-100 text-${reporterColor}-700 font-medium`}
              title={canSeeName && reporterFullName
                ? `${reporterRoleLabel} · ${reporterFullName}`
                : 'Tên người ghi chỉ hiện với người có quyền xem'}
            >
              {reporterRoleLabel}
              {canSeeName && reporterFullName ? <> · <span className="font-bold">{reporterFullName}</span></> : null}
            </span>
          );

          return (
            <div key={v.id} className={`relative group bg-white rounded-xl shadow-sm border p-4 transition-all ${isSelected ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/30' : 'border-slate-200 hover:border-blue-300'}`}>
              {canEditOthers && (
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
                  {canEditOthers && (
                    <button onClick={(e) => { e.stopPropagation(); setEditingViolation(v); }} className="self-end p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors mt-auto"><Edit size={16} /></button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        
        {/* Empty State */}
        {!isRefreshing && filteredViolations.length === 0 && (
          <div className="text-center py-12 flex flex-col items-center">
            {/* SVG Illustration */}
            <div className="w-24 h-24 mb-4 text-slate-200">
              <svg viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="16" y="12" width="64" height="72" rx="8" fill="#e2e8f0"/>
                <rect x="28" y="28" width="40" height="6" rx="3" fill="#cbd5e1"/>
                <rect x="28" y="42" width="32" height="6" rx="3" fill="#cbd5e1"/>
                <rect x="28" y="56" width="24" height="6" rx="3" fill="#cbd5e1"/>
                {searchTerm.trim() ? (
                  <>
                    <circle cx="70" cy="70" r="14" fill="#bfdbfe" />
                    <line x1="62" y1="78" x2="79" y2="61" stroke="#93c5fd" strokeWidth="3" strokeLinecap="round"/>
                    <line x1="66" y1="66" x2="74" y2="74" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round"/>
                  </>
                ) : (
                  <>
                    <circle cx="68" cy="68" r="16" fill="#fef9c3" stroke="#fde047" strokeWidth="2"/>
                    <text x="68" y="74" textAnchor="middle" fontSize="18" fill="#ca8a04">📋</text>
                  </>
                )}
              </svg>
            </div>
            {searchTerm.trim() ? (
              <>
                <p className="font-bold text-slate-600 text-base mb-1">Không tìm thấy kết quả</p>
                <p className="text-slate-400 text-sm mb-3">Không có bản ghi nào khớp với “<span className="font-semibold text-slate-600">{searchTerm}</span>”</p>
                <button
                  onClick={() => setSearchTerm('')}
                  className="text-sm text-blue-600 font-semibold hover:underline"
                >Xóa bộ lọc tìm kiếm</button>
              </>
            ) : showDuplicatesOnly ? (
              <>
                <p className="font-bold text-green-600 text-base mb-1">✅ Không có bản ghi trùng lập</p>
                <p className="text-slate-400 text-sm">Dữ liệu trong khoảng thời gian này hoàn toàn sạch.</p>
              </>
            ) : (
              <>
                <p className="font-bold text-slate-600 text-base mb-1">Chưa có dữ liệu</p>
                <p className="text-slate-400 text-sm mb-4">Chưa có bản ghi nào phù hợp với bộ lọc hiện tại.</p>
                <div className="flex flex-col sm:flex-row gap-2 items-center">
                  <button
                    onClick={() => { setFilterMode('ALL'); setFilterClassId('ALL'); }}
                    className="text-sm bg-slate-100 text-slate-600 px-4 py-2 rounded-lg font-semibold hover:bg-slate-200 transition-colors"
                  >Xóa bộ lọc</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Sentinel + Load More Button */}
        {visibleCount < filteredViolations.length && (
          <div>
            {/* Sentinel: IntersectionObserver sẽ trigger load thêm khi đến đây */}
            <div ref={loadMoreRef} className="h-1" />
            <div className="flex justify-center pt-2 pb-6">
              <button
                  onClick={handleLoadMore}
                  className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 shadow-sm rounded-full text-slate-600 font-bold hover:bg-slate-50 hover:text-blue-600 hover:border-blue-200 transition-all active:scale-95"
              >
                  <ChevronDown size={18} />
                  Xem thêm ({filteredViolations.length - visibleCount} mục nữa)
              </button>
            </div>
          </div>
        )}
      </div>

      {canBulkDelete && selectedViolationIds.size > 0 && (
        <div className="fixed bottom-20 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:max-w-2xl bg-slate-900 text-white p-3 rounded-xl shadow-xl flex items-center justify-between z-30 animate-in slide-in-from-bottom-5">
           <div className="font-bold pl-2">Đã chọn {selectedViolationIds.size} mục</div>
           <div className="flex gap-2">
              <button onClick={() => setSelectedViolationIds(new Set())} className="px-4 py-2 text-slate-300 hover:text-white font-medium">Hủy</button>
              <button onClick={() => { setShowBulkEdit(true); setBulkEditField(''); setBulkEditValue(''); }} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg flex items-center gap-2">
                 <Edit size={16} /> Sửa
              </button>
              <button onClick={() => { onBulkDelete(Array.from(selectedViolationIds)); setSelectedViolationIds(new Set()); }} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg flex items-center gap-2">
                 <Trash2 size={16} /> Xóa
              </button>
           </div>
        </div>
      )}
    {/* ---- Undo Toast ---- */}
    {undoSnapshot && undoSnapshot.length > 0 && (
      <div className="fixed bottom-36 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:max-w-sm bg-slate-700 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center justify-between z-40 animate-in slide-in-from-bottom-3">
        <span className="text-sm">✏️ Đã sửa {undoSnapshot.length} mục</span>
        <button onClick={onUndoBulkUpdate} className="ml-4 px-3 py-1.5 bg-yellow-400 text-slate-900 text-xs font-bold rounded-lg hover:bg-yellow-300 transition-colors whitespace-nowrap">↩ Hoàn tác</button>
      </div>
    )}
    {/* ---- Bulk Edit Modal ---- */}
    {showBulkEdit && (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-slate-800">Ấp dụng cho {selectedViolationIds.size} mục</h3>
            <button onClick={() => setShowBulkEdit(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Chọn trường cần sửa</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { setBulkEditField('date'); setBulkEditValue(new Date().toISOString().slice(0,10)); }} className={`py-2.5 px-3 rounded-xl border-2 text-sm font-bold transition-all ${bulkEditField === 'date' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                  📅 Ngày vi phạm
                </button>
                <button onClick={() => { setBulkEditField('note'); setBulkEditValue(''); }} className={`py-2.5 px-3 rounded-xl border-2 text-sm font-bold transition-all ${bulkEditField === 'note' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                  📝 Ghi chú
                </button>
                <button onClick={() => { setBulkEditField('criteriaId'); setBulkEditValue(''); }} className={`py-2.5 px-3 rounded-xl border-2 text-sm font-bold transition-all col-span-2 ${bulkEditField === 'criteriaId' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                  🏷️ Tiêu chí vi phạm
                </button>
              </div>
            </div>

            {bulkEditField === 'date' && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Ngày mới</label>
                <input type="date" value={bulkEditValue} onChange={e => setBulkEditValue(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            )}
            {bulkEditField === 'note' && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Ghi chú mới</label>
                <textarea value={bulkEditValue} onChange={e => setBulkEditValue(e.target.value)} rows={3} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 resize-none" placeholder="Ghi chú cho tất cả mục được chọn..." />
              </div>
            )}
            {bulkEditField === 'criteriaId' && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tiêu chí mới</label>
                <select value={bulkEditValue} onChange={e => setBulkEditValue(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-400">
                  <option value="">-- Chọn tiêu chí --</option>
                  {criteria.map(cr => <option key={cr.id} value={cr.id}>{cr.type === 'MINUS' ? '🔴' : '🟢'} {cr.content} ({cr.points} điểm)</option>)}
                </select>
              </div>
            )}

            {bulkEditField && (
              <button
                onClick={handleBulkEdit}
                disabled={!bulkEditValue.trim() || isBulkUpdating}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {isBulkUpdating ? (
                  <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Đang lưu...</>
                ) : (
                  <>✅ Ấp dụng cho {selectedViolationIds.size} mục</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    )}
    </div>
  );
};

export default ListTab;
