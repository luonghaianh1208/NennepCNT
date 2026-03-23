
import React, { useState, useRef, useMemo } from 'react';
import { AlertTriangle, Star, ChevronDown, Camera, X, CheckCircle2, Loader2, StopCircle, FileSpreadsheet, Download, Settings } from 'lucide-react';
import { Violation } from '../types';
import { api } from '../services/googleApi';
import { isDateInRange, removeVietnameseTones, exportToExcel, getLocalDateString } from '../utils';
import { useAppStore } from '../contexts/AppContext';
import { useModal } from '../contexts/ModalContext';
import * as XLSX from 'xlsx';

interface EntryTabProps {
  onNavigateToCriteria?: (mode: 'VIOLATION' | 'ACHIEVEMENT') => void;
}

const EntryTab: React.FC<EntryTabProps> = ({ onNavigateToCriteria }) => {
  const { currentUser, classes, students, criteria, violations, setViolations, roleConfigs, users, createViolation, timeConfigs } = useAppStore();
  const { showConfirm, showAlert, showToast } = useModal();

  const [entryMode, setEntryMode] = useState<'VIOLATION' | 'ACHIEVEMENT'>('VIOLATION');
  const [entryDate, setEntryDate] = useState(getLocalDateString());
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedType, setSelectedType] = useState<'PERSONAL' | 'GROUP'>('PERSONAL');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedCriteriaId, setSelectedCriteriaId] = useState('');
  const [isSecurityReport, setIsSecurityReport] = useState(false);
  const [entryNote, setEntryNote] = useState('');

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importProgress, setImportProgress] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const abortImportRef = useRef<boolean>(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const isAdmin = useMemo(() => {
    if (!roleConfigs) return currentUser.role === 'ADMIN';
    const roleKey = currentUser.role.toUpperCase();
    return roleConfigs[roleKey]?.isAdmin || false;
  }, [currentUser, roleConfigs]);

  const filteredClasses = useMemo(() => {
    if (!selectedGrade || selectedGrade === 'Tất cả') return classes;
    return classes.filter(c => c.grade.toString() === selectedGrade);
  }, [classes, selectedGrade]);

  const filteredCriteria = useMemo(() => {
    return criteria.filter(c => entryMode === 'VIOLATION' ? c.type === 'MINUS' : c.type === 'PLUS');
  }, [criteria, entryMode]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPreviewImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleCancelImport = async () => {
    const ok = await showConfirm({ title: 'Hủy Import', message: 'Bạn có chắc muốn hủy? Dữ liệu đã xử lý trước đó vẫn được lưu.', type: 'confirm', confirmText: 'Hủy Import' });
    if (ok) {
      abortImportRef.current = true;
    }
  };

  // --- TẢI FILE EXCEL MẪU ---
  const handleDownloadTemplate = () => {
    if (entryMode === 'VIOLATION') {
      const data = [
        ['Ngay', 'Ten_Lop', 'Ten_HS', 'Noi_dung_loi', 'Ghi_chu', 'Link_anh', 'Nguoi_ghi'],
        // Ten_HS để trống = vi phạm tập thể lớp; có tên = vi phạm cá nhân
        // Noi_dung_loi phải khớp chính xác với tiêu chí đã cấu hình
        ['2026-03-20', '10A1', 'Nguyễn Văn A', 'Đi học muộn', 'Đến trường lúc 7h15, trễ 15 phút', '', 'admin'],
        ['2026-03-20', '10A1', '', 'Không mặc đồng phục', 'Cả lớp không mặc đồng phục thể dục tiết 3', '', ''],
        ['2026-03-21', '10A2', 'Trần Thị B', 'Không đeo khăn quàng/phù hiệu', 'Không đeo phù hiệu từ đầu buổi sáng', '', ''],
      ];
      exportToExcel(data, 'Mau_Import_VPham');
    } else {
      const data = [
        ['Ngay', 'Ten_Lop', 'Ten_HS', 'Loai_thanh_tich', 'Ghi_chu'],
        // Ten_HS để trống = thành tích tập thể lớp; có tên = thành tích cá nhân
        // Loai_thanh_tich phải khớp chính xác với tiêu chí đã cấu hình
        ['2026-03-20', '10A1', 'Trần Thị B', 'Học sinh tiêu biểu', 'Đạt giải Nhất kỳ thi Toán cấp trường tháng 3/2026'],
        ['2026-03-20', '10A2', '', 'Lớp xuất sắc tuần', 'Không có vi phạm, nộp đủ bài tập tuần 15'],
        ['2026-03-21', '11A1', 'Lê Văn C', 'Giải thưởng cuộc thi', 'Giải Ba cuộc thi Hùng biện tiếng Anh cấp thành phố'],
      ];
      exportToExcel(data, 'Mau_Import_ThanhTich');
    }
  };

  // --- IMPORT TỪ EXCEL ---
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Sinh ID duy nhất: check against existing violations
    const existingIds = new Set(violations.map(v => v.id));

    const generateUniqueId = (prefix: string, index: number): string => {
      let id = `${prefix}${Date.now()}_${index}`;
      // Nếu trùng (cực kỳ hiếm), thêm random
      while (existingIds.has(id)) {
        id = `${prefix}${Date.now()}_${index}_${Math.floor(Math.random() * 9999)}`;
      }
      existingIds.add(id); // Đánh dấu đã dùng trong lượt này
      return id;
    };

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (rows.length < 2) {
          await showAlert('File rỗng', 'File Excel không có dữ liệu (chỉ có header hoặc trống).', 'error');
          if (excelInputRef.current) excelInputRef.current.value = '';
          return;
        }

        const recordsToProcess: Violation[] = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          // Bỏ qua dòng trống hoàn toàn
          if (!row || row.every((cell: any) => cell === '' || cell === null || cell === undefined)) continue;

          if (entryMode === 'VIOLATION') {
            // Cột: Ngay | Ten_Lop | Ten_HS | Noi_dung_loi | Ghi_chu | Link_anh | Nguoi_ghi
            const [ngayRaw, tenLop, tenHS, noiDungLoi, ghiChu, linkAnh, nguoiGhi] = row;

            // Chuẩn hoá ngày: có thể là Date object (XLSX cellDates:true) hoặc string
            let ngay: string;
            if (ngayRaw instanceof Date) {
              const y = ngayRaw.getFullYear();
              const m = String(ngayRaw.getMonth() + 1).padStart(2, '0');
              const d = String(ngayRaw.getDate()).padStart(2, '0');
              ngay = `${y}-${m}-${d}`;
            } else {
              ngay = String(ngayRaw || '').trim() || getLocalDateString();
            }

            const targetClass = classes.find(c =>
              c.name.toLowerCase() === String(tenLop).toLowerCase().trim() ||
              c.id.toLowerCase() === String(tenLop).toLowerCase().trim()
            );
            if (!targetClass) continue;

            let targetStudentId: string | undefined = undefined;
            if (tenHS && String(tenHS).trim()) {
              const student = students.find(s =>
                s.classId === targetClass.id &&
                s.name.toLowerCase() === String(tenHS).toLowerCase().trim()
              );
              targetStudentId = student?.id;
            }

            const foundCriteria = criteria.find(c =>
              c.content.toLowerCase() === String(noiDungLoi).toLowerCase().trim() &&
              c.type === 'MINUS'
            );
            if (!foundCriteria) continue; // Bỏ qua nếu không tìm thấy tiêu chí hợp lệ

            let reporterId = currentUser.id;
            const nguoiGhiStr = String(nguoiGhi || '').trim();
            if (nguoiGhiStr) {
              const foundUser = users.find(u =>
                u.name.toLowerCase() === nguoiGhiStr.toLowerCase() ||
                u.username.toLowerCase() === nguoiGhiStr.toLowerCase()
              );
              if (foundUser) reporterId = foundUser.id;
            }

            const imageList = linkAnh && String(linkAnh).trim() ? [String(linkAnh).trim()] : [];

            recordsToProcess.push({
              id: generateUniqueId('V', i),
              date: ngay,
              classId: targetClass.id,
              studentId: targetStudentId,
              criteriaId: foundCriteria.id,
              points: Math.abs(foundCriteria.points),
              note: String(ghiChu || '').trim(),
              reportedBy: reporterId,
              isSecurityReport: false,
              timestamp: Date.now(),
              images: imageList,
            });

          } else {
            // Cột: Ngay | Ten_Lop | Ten_HS | Loai_thanh_tich | Ghi_chu
            const [ngayRaw, tenLop, tenHS, loaiThanhTich, ghiChu] = row;

            let ngay: string;
            if (ngayRaw instanceof Date) {
              const y = ngayRaw.getFullYear();
              const m = String(ngayRaw.getMonth() + 1).padStart(2, '0');
              const d = String(ngayRaw.getDate()).padStart(2, '0');
              ngay = `${y}-${m}-${d}`;
            } else {
              ngay = String(ngayRaw || '').trim() || getLocalDateString();
            }

            const targetClass = classes.find(c =>
              c.name.toLowerCase() === String(tenLop).toLowerCase().trim() ||
              c.id.toLowerCase() === String(tenLop).toLowerCase().trim()
            );
            if (!targetClass) continue;

            let targetStudentId: string | undefined = undefined;
            if (tenHS && String(tenHS).trim()) {
              const student = students.find(s =>
                s.classId === targetClass.id &&
                s.name.toLowerCase() === String(tenHS).toLowerCase().trim()
              );
              targetStudentId = student?.id;
            }

            const foundCriteria = criteria.find(c =>
              c.content.toLowerCase() === String(loaiThanhTich).toLowerCase().trim() &&
              c.type === 'PLUS'
            );
            if (!foundCriteria) continue;

            recordsToProcess.push({
              id: generateUniqueId('A', i),
              date: ngay,
              classId: targetClass.id,
              studentId: targetStudentId,
              criteriaId: foundCriteria.id,
              points: -Math.abs(foundCriteria.points),
              note: String(ghiChu || '').trim(),
              reportedBy: currentUser.id,
              isSecurityReport: false,
              timestamp: Date.now(),
              images: [],
            });
          }
        }

        if (recordsToProcess.length === 0) {
          await showAlert('Không có dữ liệu hợp lệ', 'Không tìm thấy dòng nào hợp lệ. Hãy kiểm tra lại tên lớp, tên học sinh và nội dung lỗi phải khớp với dữ liệu trong hệ thống.', 'error');
          if (excelInputRef.current) excelInputRef.current.value = '';
          return;
        }

        const outOfConfigCount = timeConfigs.length > 0
          ? recordsToProcess.filter(r => !timeConfigs.some(cfg => isDateInRange(r.date, cfg.startDate, cfg.endDate))).length
          : 0;
        const warningNote = outOfConfigCount > 0
          ? `\n\n⚠️ Cảnh báo: ${outOfConfigCount}/${recordsToProcess.length} dòng có ngày nằm ngoài cấu hình thời gian.`
          : '';

        const confirmed = await showConfirm({
          title: 'Xác nhận Import',
          message: `Tìm thấy ${recordsToProcess.length} dòng hợp lệ.${warningNote}\n\nBắt đầu lưu vào hệ thống?`,
          confirmText: 'Import',
        });
        if (!confirmed) {
          if (excelInputRef.current) excelInputRef.current.value = '';
          return;
        }

        setIsSubmitting(true);
        abortImportRef.current = false;
        let successCount = 0;
        let errorCount = 0;
        const successfulRecords: Violation[] = [];

        for (let i = 0; i < recordsToProcess.length; i++) {
          if (abortImportRef.current) {
            setImportProgress('🛑 Import đã hủy!');
            break;
          }
          setImportProgress(`Đang xử lý ${i + 1}/${recordsToProcess.length}...`);
          try {
            await api.createViolation(recordsToProcess[i]);
            successfulRecords.push(recordsToProcess[i]);
            successCount++;
            await new Promise(resolve => setTimeout(resolve, 50));
          } catch (err) {
            console.error(err);
            errorCount++;
          }
        }

        if (successfulRecords.length > 0) {
          setViolations(prev => [...successfulRecords, ...prev]);
        }

        setIsSubmitting(false);
        setImportProgress('');

        if (abortImportRef.current) {
          await showAlert('Import bị hủy', `Đã lưu: ${successCount}\nLỗi: ${errorCount}\nChưa xử lý: ${recordsToProcess.length - (successCount + errorCount)}`, 'info');
        } else {
          await showAlert(
            successCount > 0 ? 'Import Thành Công' : 'Import Thất Bại',
            `Thành công: ${successCount}\nLỗi: ${errorCount}`,
            successCount > 0 ? 'success' : 'error'
          );
        }
      } catch (err) {
        setIsSubmitting(false);
        setImportProgress('');
        await showAlert('Lỗi đọc file', 'Không thể đọc file Excel. Hãy chắc chắn file đúng định dạng .xlsx/.xls.', 'error');
      }

      if (excelInputRef.current) excelInputRef.current.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSubmitViolation = async () => {
    if (!selectedClassId || !selectedCriteriaId) return showAlert('Thiếu thông tin', 'Vui lòng chọn lớp và nội dung', 'error');
    if (selectedType === 'PERSONAL' && !selectedStudentId) return showAlert('Thiếu thông tin', 'Vui lòng chọn học sinh', 'error');

    if (entryMode === 'VIOLATION' && !previewImage) {
      return showAlert('Thiếu ảnh', 'Bắt buộc phải có ảnh minh họa/bằng chứng cho lỗi vi phạm.', 'error');
    }

    setIsSubmitting(true);

    try {
      const criteriaItem = criteria.find(c => c.id === selectedCriteriaId);
      let finalPoints = criteriaItem ? criteriaItem.points : 0;
      if (criteriaItem?.type === 'PLUS') finalPoints = -Math.abs(finalPoints);
      else finalPoints = Math.abs(finalPoints);

      const selectedClass = classes.find(c => c.id === selectedClassId);
      const selectedStudent = students.find(s => s.id === selectedStudentId);

      let imageUrls: string[] = [];
      if (previewImage) {
        const safeStudentName = selectedStudent ? removeVietnameseTones(selectedStudent.name) : 'TapThe';
        const safeClassName = selectedClass ? removeVietnameseTones(selectedClass.name) : selectedClassId;
        const safeViolation = criteriaItem ? removeVietnameseTones(criteriaItem.content) : 'LoiViPham';

        const fileNameInfo = {
          studentName: safeStudentName,
          className: safeClassName,
          violation: safeViolation,
          date: entryDate
        };
        const uploadRes = await api.uploadImage(previewImage, fileNameInfo);
        if (uploadRes.status === 'success') {
          imageUrls.push(uploadRes.url);
        } else {
          showToast('Lỗi upload ảnh: ' + uploadRes.message, 'error');
          setIsSubmitting(false);
          return;
        }
      }

      const newViolation: Violation = {
        id: `V${Date.now()}`,
        date: entryDate,
        classId: selectedClassId,
        studentId: selectedType === 'PERSONAL' ? selectedStudentId : undefined,
        criteriaId: selectedCriteriaId,
        points: finalPoints,
        note: entryNote,
        images: imageUrls,
        reportedBy: currentUser.id,
        isSecurityReport,
        timestamp: Date.now()
      };

      await createViolation(newViolation);
      const inAnyConfig = timeConfigs.some(cfg => isDateInRange(entryDate, cfg.startDate, cfg.endDate));
      if (!inAnyConfig && timeConfigs.length > 0) {
        showToast('⚠️ Ngày vi phạm nằm ngoài tất cả cấu hình thời gian — sẽ không xuất hiện trong bộ lọc tuần/tháng/học kỳ.', 'info');
      }
      setShowSuccessModal(true);

      setSelectedStudentId('');
      setSelectedCriteriaId('');
      setEntryNote('');
      setPreviewImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setShowSuccessModal(false), 2000);

    } catch (error) {
      showToast('Có lỗi xảy ra khi lưu dữ liệu.', 'error');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-24 relative">
      {isSubmitting && importProgress && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-xl flex flex-col items-center shadow-2xl border border-slate-200 w-80">
            <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
            <div className="font-bold text-slate-800 text-lg mb-1">Đang xử lý...</div>
            <div className="text-sm text-slate-500 mb-6 text-center">{importProgress}</div>

            <button
              onClick={handleCancelImport}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-full font-bold hover:bg-red-100 transition-colors"
            >
              <StopCircle size={18} /> Hủy Import
            </button>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 shadow-2xl flex flex-col items-center animate-in zoom-in-95">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600">
              <CheckCircle2 size={40} />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Đã Lưu Thành Công!</h3>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700 bg-slate-50/50 flex justify-between items-center">
          <span>{entryMode === 'VIOLATION' ? 'Nhập Lỗi Vi Phạm' : 'Nhập Điểm Thành Tích'}</span>
          {isAdmin && (
            <div className="flex items-center gap-2">
              {/* Nút tải Excel mẫu */}
              <button
                onClick={handleDownloadTemplate}
                disabled={isSubmitting}
                className="text-xs flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100 font-bold border border-blue-200 disabled:opacity-50"
                title="Tải file Excel mẫu để điền dữ liệu"
              >
                <Download size={13} /> Tải mẫu
              </button>
              {/* Nút Import Excel */}
              <input type="file" ref={excelInputRef} onChange={handleExcelImport} accept=".xlsx,.xls" className="hidden" />
              <button
                onClick={() => excelInputRef.current?.click()}
                disabled={isSubmitting}
                className="text-xs flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 font-bold border border-green-200 disabled:opacity-50"
                title="Import dữ liệu từ file Excel"
              >
                <FileSpreadsheet size={13} /> Import Excel
              </button>
            </div>
          )}
        </div>

        {/* ── HƯỚNG DẪN IMPORT EXCEL ───────────────────────────────────── */}
        {isAdmin && (
          <div className="mx-4 mt-3 mb-0 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
            <div className="font-bold text-blue-900 mb-1.5 flex items-center gap-1">
              <FileSpreadsheet size={13} /> Hướng dẫn Import Excel
            </div>
            <ol className="list-decimal list-inside space-y-1 leading-relaxed">
              <li>Bấm <span className="font-bold">Tải mẫu</span> để tải file Excel với đúng cấu trúc cột.</li>
              <li>Điền dữ liệu: <span className="font-bold">Ten_HS để trống</span> = vi phạm / thành tích tập thể lớp.</li>
              <li className="font-bold text-blue-900">
                Cột <span className="underline">{entryMode === 'VIOLATION' ? 'Noi_dung_loi' : 'Loai_thanh_tich'}</span> phải khớp chính xác với tên tiêu chí đã cấu hình.
              </li>
              <li>Lưu file và bấm <span className="font-bold">Import Excel</span> để nhập hàng loạt.</li>
            </ol>
            <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
              <p className="text-blue-700 italic">
                ⚠️ Chưa có tiêu chí? Cần thêm vào Cấu hình trước khi import.
              </p>
              {onNavigateToCriteria && (
                <button
                  onClick={() => onNavigateToCriteria(entryMode === 'VIOLATION' ? 'VIOLATION' : 'ACHIEVEMENT')}
                  className="flex items-center gap-1 bg-blue-600 text-white text-xs px-2.5 py-1.5 rounded-lg font-bold hover:bg-blue-700 transition-colors shrink-0"
                >
                  <Settings size={12} /> Đến Cấu hình {entryMode === 'VIOLATION' ? 'Vi phạm' : 'Thành tích'}
                </button>
              )}
            </div>
          </div>
        )}
        <div className="p-4 space-y-4">
          {isAdmin && (
            <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
              <button
                onClick={() => { setEntryMode('VIOLATION'); setPreviewImage(null); }}
                className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${entryMode === 'VIOLATION' ? 'bg-white shadow text-red-600' : 'text-slate-500'}`}
              >
                <AlertTriangle size={16} /> Nhập Vi Phạm
              </button>
              <button
                onClick={() => { setEntryMode('ACHIEVEMENT'); setPreviewImage(null); }}
                className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${entryMode === 'ACHIEVEMENT' ? 'bg-white shadow text-green-600' : 'text-slate-500'}`}
              >
                <Star size={16} /> Nhập Thành Tích
              </button>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Ngày ghi nhận</label>
            <input type="date" className="w-full p-3 rounded-lg border border-slate-300" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Khối</label>
              <div className="relative">
                <select className="w-full p-3 rounded-lg border border-slate-300 bg-white appearance-none" value={selectedGrade} onChange={(e) => { setSelectedGrade(e.target.value); setSelectedClassId(''); setSelectedStudentId(''); }}>
                  <option value="">Tất cả</option>
                  <option value="10">Khối 10</option>
                  <option value="11">Khối 11</option>
                  <option value="12">Khối 12</option>
                </select>
                <ChevronDown className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" size={16} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Lớp</label>
              <div className="relative">
                <select className={`w-full p-3 rounded-lg border border-slate-300 bg-white appearance-none`} value={selectedClassId} onChange={(e) => { setSelectedClassId(e.target.value); setSelectedStudentId(''); }}>
                  <option value="">-- Chọn Lớp --</option>
                  {filteredClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" size={16} />
              </div>
            </div>
          </div>

          <div className="flex rounded-lg bg-slate-100 p-1">
            <button className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${selectedType === 'PERSONAL' ? 'bg-white shadow text-blue-700' : 'text-slate-500'}`} onClick={() => setSelectedType('PERSONAL')}>Cá nhân</button>
            <button className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${selectedType === 'GROUP' ? 'bg-white shadow text-blue-700' : 'text-slate-500'}`} onClick={() => setSelectedType('GROUP')}>Tập thể</button>
          </div>

          {selectedType === 'PERSONAL' && (
            <div>
              <label className="block text-sm font-medium mb-1">Học sinh</label>
              <select className="w-full p-3 rounded-lg border border-slate-300 bg-white" value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} disabled={!selectedClassId}>
                <option value="">-- Chọn Học Sinh --</option>
                {students.filter(s => s.classId === selectedClassId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Nội dung</label>
            <select className="w-full p-3 rounded-lg border border-slate-300 bg-white" value={selectedCriteriaId} onChange={(e) => setSelectedCriteriaId(e.target.value)}>
              <option value="">-- Chọn Nội Dung --</option>
              {filteredCriteria.map(c => <option key={c.id} value={c.id}>{c.content} {entryMode === 'VIOLATION' ? `(-${c.points}đ)` : `(+${c.points}đ)`}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageChange} />
              <button onClick={() => fileInputRef.current?.click()} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${!previewImage ? (entryMode === 'VIOLATION' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-slate-50 text-slate-600 border border-slate-200') : 'bg-blue-50 text-blue-600'}`}>
                <Camera size={18} />
                <span>{previewImage ? 'Đổi ảnh khác' : (entryMode === 'VIOLATION' ? 'Chụp/Tải ảnh (Bắt buộc)' : 'Chụp/Tải ảnh (Không bắt buộc)')}</span>
              </button>

              {entryMode === 'VIOLATION' && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500" checked={isSecurityReport} onChange={(e) => setIsSecurityReport(e.target.checked)} />
                  <span className="text-sm font-medium">Bảo vệ báo</span>
                </label>
              )}
            </div>
            {previewImage && (
              <div className="relative w-full h-40 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 mt-2 group">
                <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
                <button onClick={() => { setPreviewImage(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70">
                  <X size={16} />
                </button>
              </div>
            )}
          </div>

          <textarea placeholder="Ghi chú thêm..." className="w-full p-3 rounded-lg border border-slate-300 text-sm" rows={3} value={entryNote} onChange={(e) => setEntryNote(e.target.value)}></textarea>

          <button
            disabled={isSubmitting}
            onClick={handleSubmitViolation}
            className={`w-full text-white font-bold py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${entryMode === 'VIOLATION' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
          >
            {isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            {isSubmitting ? 'Đang lưu...' : (entryMode === 'VIOLATION' ? 'Lưu Vi Phạm' : 'Lưu Thành Tích')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EntryTab;
