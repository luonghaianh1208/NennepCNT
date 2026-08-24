
import React, { useState, useRef, useMemo } from 'react';
import { AlertTriangle, Star, ChevronDown, Camera, X, CheckCircle2, Loader2, StopCircle, FileSpreadsheet, Download, Settings } from 'lucide-react';
import { Violation } from '../types';
import { api } from '../services/firebase';
import { isDateInRange, removeVietnameseTones, exportToExcel, getLocalDateString, matchVietnamese, fuzzyMatchScore } from '../utils';
import { useAppStore } from '../contexts/AppContext';
import { useModal } from '../contexts/ModalContext';
import AchievementBulkEntry from './AchievementBulkEntry';
// xlsx + exceljs chỉ dùng khi import/tải file mẫu → nạp động, xem chú thích ở utils.ts
import { saveAs } from 'file-saver';

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

  // --- PREVIEW IMPORT STATE ---
  interface PreviewRow {
    rowIndex: number;
    date: string;
    className: string;
    studentName: string;
    inputCriteria: string;
    matchedCriteriaId: string;
    matchedCriteriaLabel: string;
    matchScore: number;
    note: string;
    reporterId: string;
    imageUrl?: string;
    status: 'ok' | 'review' | 'error';
    errorReason?: string;
  }
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [showPreview, setShowPreview] = useState(false);

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

  // --- TẢI FILE EXCEL MẪU (ExcelJS: tiêu chí thực + 100 dòng + dropdown validation thực) ---
  const handleDownloadTemplate = async () => {
    const today = getLocalDateString();
    const sampleClass = classes[0]?.name || '10A1';
    const sampleStudent = students.find(s => s.classId === classes[0]?.id)?.name || 'Nguyễn Văn A';
    const TEMPLATE_ROWS = 100;

    const isViolation = entryMode === 'VIOLATION';
    const filteredCriteria = criteria.filter(c => c.type === (isViolation ? 'MINUS' : 'PLUS'));
    const criteriaEndRow = filteredCriteria.length + 1; // +1 for header
    const fileName = isViolation ? 'Mau_Import_VPham.xlsx' : 'Mau_Import_ThanhTich.xlsx';
    const colDHeader = isViolation ? 'Noi_dung_loi' : 'Loai_thanh_tich';
    const headers = isViolation
      ? ['Ngay', 'Ten_Lop', 'Ten_HS', 'Noi_dung_loi', 'Ghi_chu', 'Link_anh', 'Nguoi_ghi']
      : ['Ngay', 'Ten_Lop', 'Ten_HS', 'Loai_thanh_tich', 'Ghi_chu'];
    const sheet2Header = isViolation
      ? ['Tên lỗi vi phạm', 'Điểm trừ']
      : ['Tên thành tích', 'Điểm cộng'];

    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();

    // ── SHEET 2: Danh sách tiêu chí ──────────────────────────────────
    const ws2 = wb.addWorksheet('Danh_sach_tieu_chi');
    ws2.addRow(sheet2Header);
    ws2.getRow(1).font = { bold: true };
    ws2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
    ws2.getColumn(1).width = 40;
    ws2.getColumn(2).width = 12;
    filteredCriteria.forEach(c => ws2.addRow([c.content, c.points]));

    // ── SHEET 1: Dữ liệu nhập ────────────────────────────────────────
    const ws1 = wb.addWorksheet('Du_lieu_nhap');
    ws1.addRow(headers);
    const headerRow = ws1.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Độ rộng cột
    ws1.getColumn(1).width = 14; // Ngay
    ws1.getColumn(2).width = 10; // Ten_Lop
    ws1.getColumn(3).width = 22; // Ten_HS
    ws1.getColumn(4).width = 36; // Loai_thanh_tich / Noi_dung_loi
    ws1.getColumn(5).width = 32; // Ghi_chu
    if (isViolation) {
      ws1.getColumn(6).width = 30; // Link_anh
      ws1.getColumn(7).width = 14; // Nguoi_ghi
    }

    // 3 dòng ví dụ từ tiêu chí thực
    const exampleCriteria = filteredCriteria.slice(0, 3);
    if (exampleCriteria.length > 0) {
      exampleCriteria.forEach((c, idx) => {
        const rowData = isViolation
          ? [today, sampleClass, idx % 2 === 0 ? sampleStudent : '', c.content, `Ghi chú: ${c.content}`, '', '']
          : [today, sampleClass, idx % 2 === 0 ? sampleStudent : '', c.content, `Ghi chú: ${c.content}`];
        const row = ws1.addRow(rowData);
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF3E8' } };
        row.getCell(4).font = { italic: true, color: { argb: 'FF375623' } };
      });
    }

    // 100 dòng trống
    const totalDataRows = ws1.rowCount; // sau header + examples
    const lastRow = totalDataRows + TEMPLATE_ROWS;
    for (let i = totalDataRows + 1; i <= lastRow; i++) {
      ws1.addRow(isViolation ? ['', '', '', '', '', '', ''] : ['', '', '', '', '']);
    }

    // ── DATA VALIDATION: dropdown cột D (row 2 → lastRow+1) ──────────
    if (filteredCriteria.length > 0) {
      const validationRange = `D2:D${lastRow + 1}`;
      (ws1 as any).dataValidations.add(validationRange, {
        type: 'list',
        allowBlank: true,
        formulae: [`Danh_sach_tieu_chi!$A$2:$A$${criteriaEndRow}`],
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: isViolation ? 'Nội dung lỗi' : 'Loại thành tích',
        error: 'Nên chọn từ danh sách. Hệ thống vẫn nhận nếu nhập gần đúng.',
        showInputMessage: true,
        promptTitle: isViolation ? 'Nội dung lỗi vi phạm' : 'Loại thành tích',
        prompt: `Chọn từ danh sách hoặc nhập gần đúng. Xem toàn bộ tiêu chí ở Sheet "Danh_sach_tieu_chi".`,
      });
    }

    // Freeze header row
    ws1.views = [{ state: 'frozen', ySplit: 1 }];

    // Xuất file
    const buffer = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
  };


  // --- IMPORT TỪ EXCEL (Fuzzy Match + Preview) ---
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const XLSX = await import('xlsx');
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (rows.length < 2) {
          await showAlert('File rỗng', 'File Excel không có dữ liệu (chỉ có header hoặc trống).', 'error');
          if (excelInputRef.current) excelInputRef.current.value = '';
          return;
        }

        const criteriaType = entryMode === 'VIOLATION' ? 'MINUS' : 'PLUS';
        const filteredCriteriaForImport = criteria.filter(c => c.type === criteriaType);
        const parsed: PreviewRow[] = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.every((cell: any) => cell === '' || cell === null || cell === undefined)) continue;

          // --- Xử lý ngày ---
          const ngayRaw = row[0];
          let ngay: string;
          if (ngayRaw instanceof Date) {
            const y = ngayRaw.getFullYear();
            const m = String(ngayRaw.getMonth() + 1).padStart(2, '0');
            const d = String(ngayRaw.getDate()).padStart(2, '0');
            ngay = `${y}-${m}-${d}`;
          } else {
            ngay = String(ngayRaw || '').trim() || getLocalDateString();
          }

          const tenLop = String(row[1] || '').trim();
          const tenHS = String(row[2] || '').trim();
          const inputCriteriaRaw = String(row[3] || '').trim();
          const ghiChu = String(row[4] || '').trim();

          // VIOLATION thêm: linkAnh (col5), nguoiGhi (col6)
          const linkAnh = entryMode === 'VIOLATION' ? String(row[5] || '').trim() : '';
          const nguoiGhiStr = entryMode === 'VIOLATION' ? String(row[6] || '').trim() : '';

          // --- Tìm lớp ---
          const targetClass = classes.find(c =>
            matchVietnamese(c.name, tenLop) || matchVietnamese(c.id, tenLop)
          );
          if (!targetClass) {
            parsed.push({
              rowIndex: i,
              date: ngay, className: tenLop, studentName: tenHS,
              inputCriteria: inputCriteriaRaw, matchedCriteriaId: '',
              matchedCriteriaLabel: '', matchScore: 0, note: ghiChu,
              reporterId: currentUser.id, imageUrl: linkAnh || undefined,
              status: 'error', errorReason: `Không tìm thấy lớp "${tenLop}"`,
            });
            continue;
          }

          // --- Reporter ---
          let reporterId = currentUser.id;
          if (nguoiGhiStr) {
            const foundUser = users.find(u =>
              u.name.toLowerCase() === nguoiGhiStr.toLowerCase() ||
              u.username.toLowerCase() === nguoiGhiStr.toLowerCase()
            );
            if (foundUser) reporterId = foundUser.id;
          }

          // --- Fuzzy match tiêu chí ---
          let bestId = '';
          let bestLabel = '';
          let bestScore = 0;

          // Ưu tiên exact match trước
          const exactMatch = filteredCriteriaForImport.find(c => matchVietnamese(c.content, inputCriteriaRaw));
          if (exactMatch) {
            bestId = exactMatch.id;
            bestLabel = exactMatch.content;
            bestScore = 100;
          } else {
            for (const c of filteredCriteriaForImport) {
              const score = fuzzyMatchScore(inputCriteriaRaw, c.content);
              if (score > bestScore) {
                bestScore = score;
                bestId = c.id;
                bestLabel = c.content;
              }
            }
          }

          const AUTO_MATCH_THRESHOLD = 70;
          const status: 'ok' | 'review' | 'error' =
            bestScore >= AUTO_MATCH_THRESHOLD ? 'ok' : 'review';

          parsed.push({
            rowIndex: i,
            date: ngay,
            className: targetClass.name,
            studentName: tenHS,
            inputCriteria: inputCriteriaRaw,
            matchedCriteriaId: bestScore >= AUTO_MATCH_THRESHOLD ? bestId : '',
            matchedCriteriaLabel: bestScore >= AUTO_MATCH_THRESHOLD ? bestLabel : '',
            matchScore: bestScore,
            note: ghiChu,
            reporterId,
            imageUrl: linkAnh || undefined,
            status,
          });
        }

        if (parsed.length === 0) {
          await showAlert('Không có dữ liệu hợp lệ', 'Không tìm thấy dòng nào có thể đọc được. Hãy kiểm tra lại file.', 'error');
          if (excelInputRef.current) excelInputRef.current.value = '';
          return;
        }

        setPreviewRows(parsed);
        setShowPreview(true);
      } catch (err) {
        await showAlert('Lỗi đọc file', 'Không thể đọc file Excel. Hãy chắc chắn file đúng định dạng .xlsx/.xls.', 'error');
      }
      if (excelInputRef.current) excelInputRef.current.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  // --- XÁC NHẬN IMPORT SAU KHI XEM PREVIEW ---
  const handleConfirmImport = async () => {
    const validRows = previewRows.filter(r => r.status !== 'error' && r.matchedCriteriaId);
    if (validRows.length === 0) {
      await showAlert('Không có dòng nào hợp lệ', 'Vui lòng chọn tiêu chí cho các dòng chờ xem xét trước khi import.', 'error');
      return;
    }

    const existingIds = new Set(violations.map(v => v.id));
    const generateUniqueId = (prefix: string, index: number): string => {
      let id = `${prefix}${Date.now()}_${index}`;
      while (existingIds.has(id)) id = `${prefix}${Date.now()}_${index}_${Math.floor(Math.random() * 9999)}`;
      existingIds.add(id);
      return id;
    };

    const recordsToSave: Violation[] = validRows.map((r, idx) => {
      const prefix = entryMode === 'VIOLATION' ? 'V' : 'A';
      const foundCriteria = criteria.find(c => c.id === r.matchedCriteriaId)!;
      const targetClass = classes.find(c => c.name === r.className || c.id === r.className);
      const targetStudent = r.studentName
        ? students.find(s => s.classId === targetClass?.id && matchVietnamese(s.name, r.studentName))
        : undefined;
      const imageList = r.imageUrl ? [r.imageUrl] : [];

      return {
        id: generateUniqueId(prefix, idx),
        date: r.date,
        classId: targetClass?.id || r.className,
        studentId: targetStudent?.id,
        criteriaId: foundCriteria.id,
        points: entryMode === 'VIOLATION' ? Math.abs(foundCriteria.points) : -Math.abs(foundCriteria.points),
        note: r.note,
        images: imageList,
        reportedBy: r.reporterId,
        isSecurityReport: false,
        timestamp: Date.now(),
      };
    });

    setShowPreview(false);
    setIsSubmitting(true);
    abortImportRef.current = false;
    setImportProgress(`Đang gửi ${recordsToSave.length} bản ghi lên server...`);

    try {
      // ✅ Issue 5: Batch import — 1 API call thay cho N*50ms sequential loop
      const result = await api.batchCreateViolations(recordsToSave);
      if (result?.error) throw new Error(result.error);

      setViolations(prev => [...recordsToSave, ...prev]);
      setIsSubmitting(false);
      setImportProgress('');
      await showAlert(
        'Import Thành Công',
        `Đã lưu thành công ${recordsToSave.length} bản ghi cùng lúc.`,
        'success'
      );
    } catch (err) {
      console.error('Batch import error:', err);
      setIsSubmitting(false);
      setImportProgress('');
      await showAlert('Import Thất Bại', 'Có lỗi khi gửi dữ liệu lên server. Vui lòng thử lại.', 'error');
    }
    setPreviewRows([]);
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

  const criteriaForImport = criteria.filter(c => c.type === (entryMode === 'VIOLATION' ? 'MINUS' : 'PLUS'));

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-24 relative">

      {/* ── IMPORT PREVIEW MODAL ──────────────────────────────────── */}
      {showPreview && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4">
            {/* Header */}
            <div className="flex justify-between items-center px-5 py-4 border-b border-slate-200">
              <div>
                <h2 className="font-bold text-lg text-slate-800">Xem trước dữ liệu import</h2>
                <div className="text-xs text-slate-500 mt-0.5 flex gap-3">
                  <span className="text-green-600 font-semibold">🟢 Tự động: {previewRows.filter(r => r.status === 'ok').length}</span>
                  <span className="text-yellow-600 font-semibold">🟡 Cần chọn: {previewRows.filter(r => r.status === 'review').length}</span>
                  <span className="text-red-600 font-semibold">🔴 Lỗi: {previewRows.filter(r => r.status === 'error').length}</span>
                </div>
              </div>
              <button onClick={() => { setShowPreview(false); setPreviewRows([]); }} className="p-2 hover:bg-slate-100 rounded-full">
                <X size={20} />
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left w-8">#</th>
                    <th className="px-3 py-2 text-left">Ngày</th>
                    <th className="px-3 py-2 text-left">Lớp</th>
                    <th className="px-3 py-2 text-left">Học sinh</th>
                    <th className="px-3 py-2 text-left">Từ Excel</th>
                    <th className="px-3 py-2 text-left min-w-[200px]">Tiêu chí áp dụng</th>
                    <th className="px-3 py-2 text-left">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr
                      key={row.rowIndex}
                      className={
                        row.status === 'error' ? 'bg-red-50 border-b border-red-100' :
                          row.status === 'review' ? 'bg-yellow-50 border-b border-yellow-100' :
                            'bg-white border-b border-slate-100'
                      }
                    >
                      <td className="px-3 py-2 text-slate-400">{row.rowIndex}</td>
                      <td className="px-3 py-2 font-medium text-slate-700">{row.date}</td>
                      <td className="px-3 py-2 text-slate-700">{row.className}</td>
                      <td className="px-3 py-2 text-slate-600">{row.studentName || <span className="italic text-slate-400">Tập thể</span>}</td>
                      <td className="px-3 py-2">
                        <span className="text-slate-500 italic">{row.inputCriteria || '—'}</span>
                        {row.status === 'ok' && (
                          <span className="ml-1 text-green-600 font-bold" title={`Khớp ${row.matchScore}%`}>✓{row.matchScore < 100 ? ` ~${row.matchScore}%` : ''}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {row.status === 'error' ? (
                          <span className="text-red-600 font-semibold">{row.errorReason}</span>
                        ) : (
                          <select
                            value={row.matchedCriteriaId}
                            onChange={(ev) => {
                              const chosen = criteriaForImport.find(c => c.id === ev.target.value);
                              setPreviewRows(prev => prev.map(r =>
                                r.rowIndex === row.rowIndex
                                  ? { ...r, matchedCriteriaId: ev.target.value, matchedCriteriaLabel: chosen?.content || '', status: ev.target.value ? 'ok' : 'review' }
                                  : r
                              ));
                            }}
                            className={
                              `w-full p-1.5 rounded border text-xs font-medium ${row.matchedCriteriaId
                                ? 'border-green-300 bg-green-50 text-green-800'
                                : 'border-yellow-300 bg-yellow-100 text-yellow-800'
                              }`
                            }
                          >
                            <option value="">-- Chọn tiêu chí --</option>
                            {criteriaForImport.map(c => (
                              <option key={c.id} value={c.id}>
                                {c.content} ({entryMode === 'VIOLATION' ? `-${c.points}đ` : `+${c.points}đ`})
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-500 max-w-[140px] truncate" title={row.note}>{row.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-slate-200 flex justify-between items-center gap-3 flex-wrap">
              <p className="text-xs text-slate-500">
                ⚠️ Dòng <span className="text-yellow-700 font-bold">vàng</span> cần chọn tiêu chí trước khi import. Dòng <span className="text-red-700 font-bold">đỏ</span> sẽ bị bỏ qua.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowPreview(false); setPreviewRows([]); }}
                  className="px-4 py-2 text-sm bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200"
                >
                  Hủy
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={previewRows.filter(r => r.status !== 'error' && r.matchedCriteriaId).length === 0}
                  className="px-5 py-2 text-sm bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle2 size={15} />
                  Import {previewRows.filter(r => r.status !== 'error' && r.matchedCriteriaId).length} dòng hợp lệ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
              <li>Bấm <span className="font-bold">Tải mẫu</span> — file có sẵn <span className="font-bold">100 dòng</span>, ví dụ thực từ tiêu chí đã cấu hình và <span className="font-bold">Sheet 2</span> danh sách tiêu chí.</li>
              <li>Điền dữ liệu vào <span className="font-bold">Sheet 1</span>: <span className="font-bold">Ten_HS để trống</span> = vi phạm / thành tích tập thể lớp.</li>
              <li>
                Cột <span className="underline font-bold">{entryMode === 'VIOLATION' ? 'Noi_dung_loi' : 'Loai_thanh_tich'}</span>: chọn từ <span className="font-bold">menu thả xuống</span> trong ô hoặc nhập gần đúng — hệ thống sẽ tự nhận diện.
              </li>
              <li>Bấm <span className="font-bold">Import Excel</span> → xem bảng <span className="font-bold">xem trước</span> (🟢 tự khớp / 🟡 cần chọn / 🔴 lỗi) rồi xác nhận.</li>
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

          {/* Thành tích nhập theo hoạt động: một hoạt động, nhiều lớp, lưu một lần */}
          {entryMode === 'ACHIEVEMENT' ? <AchievementBulkEntry /> : (
          <>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Ngày ghi nhận</label>
            <input type="date" className="w-full p-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-700" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Khối</label>
              <div className="relative">
                <select className="w-full p-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 appearance-none" value={selectedGrade} onChange={(e) => { setSelectedGrade(e.target.value); setSelectedClassId(''); setSelectedStudentId(''); }}>
                  <option value="">Tất cả</option>
                  <option value="10">Khối 10</option>
                  <option value="11">Khối 11</option>
                  <option value="12">Khối 12</option>
                </select>
                <ChevronDown className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" size={16} />
              </div>
            </div>
            {/* Lớp — trường quan trọng */}
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">
                Lớp <span className="text-red-500">*</span>
              </label>
              <div className="relative ring-2 ring-blue-100 rounded-lg focus-within:ring-blue-400 transition-all">
                <select className={`w-full p-3 rounded-lg border-2 bg-white appearance-none font-medium ${selectedClassId ? 'border-blue-500 text-blue-800' : 'border-blue-300 text-slate-600'}`} value={selectedClassId} onChange={(e) => { setSelectedClassId(e.target.value); setSelectedStudentId(''); }}>
                  <option value="">-- Chọn Lớp --</option>
                  {filteredClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-3.5 text-blue-400 pointer-events-none" size={16} />
              </div>
            </div>
          </div>

          <div className="flex rounded-lg bg-slate-100 p-1">
            <button className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${selectedType === 'PERSONAL' ? 'bg-white shadow text-blue-700' : 'text-slate-500'}`} onClick={() => setSelectedType('PERSONAL')}>Cá nhân</button>
            <button className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${selectedType === 'GROUP' ? 'bg-white shadow text-blue-700' : 'text-slate-500'}`} onClick={() => setSelectedType('GROUP')}>Tập thể</button>
          </div>

          {selectedType === 'PERSONAL' && (
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">
                Học sinh <span className="text-red-500">*</span>
              </label>
              <select className="w-full p-3 rounded-lg border-2 border-slate-300 bg-white" value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} disabled={!selectedClassId}>
                <option value="">-- Chọn Học Sinh --</option>
                {students.filter(s => s.classId === selectedClassId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          {/* Nội dung — trường quan trọng nhất */}
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1">
              Nội dung <span className="text-red-500">*</span>
            </label>
            <div className="ring-2 ring-blue-100 rounded-lg focus-within:ring-blue-400 transition-all">
              <select className={`w-full p-3 rounded-lg border-2 bg-white font-medium ${selectedCriteriaId ? 'border-blue-500 text-blue-800' : 'border-blue-300 text-slate-600'}`} value={selectedCriteriaId} onChange={(e) => setSelectedCriteriaId(e.target.value)}>
                <option value="">-- Chọn Nội Dung --</option>
                {filteredCriteria.map(c => <option key={c.id} value={c.id}>{c.content} {entryMode === 'VIOLATION' ? `(-${c.points}đ)` : `(+${c.points}đ)`}</option>)}
              </select>
            </div>
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

          {/* Ghi chú — trường phụ */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Ghi chú thêm <span className="italic">(tùy chọn)</span></label>
            <textarea placeholder="Ghi chú thêm..." className="w-full p-3 rounded-lg border border-slate-200 bg-slate-50/70 text-sm text-slate-600 placeholder:text-slate-300" rows={2} value={entryNote} onChange={(e) => setEntryNote(e.target.value)} />
          </div>

          <button
            disabled={isSubmitting}
            onClick={handleSubmitViolation}
            className={`w-full text-white font-bold py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${entryMode === 'VIOLATION' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
          >
            {isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            {isSubmitting ? 'Đang lưu...' : 'Lưu Vi Phạm'}
          </button>
          </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EntryTab;
