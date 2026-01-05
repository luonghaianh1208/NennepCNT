
import React, { useState, useRef, useMemo } from 'react';
import { AlertTriangle, Star, ChevronDown, Camera, X, CheckCircle2, Shield, Upload, Info, Loader2, StopCircle } from 'lucide-react';
import { User, ClassEntity, Student, Criteria, Violation, RoleConfig } from '../types';
import { api } from '../services/googleApi';
import { parseCSVLine, removeVietnameseTones } from '../utils';

interface EntryTabProps {
  currentUser: User;
  classes: ClassEntity[];
  students: Student[];
  criteria: Criteria[];
  violations: Violation[];
  setViolations: (v: Violation[]) => void;
  roleConfigs?: Record<string, RoleConfig>;
  // Thêm props users để tìm kiếm người báo cáo khi import CSV
  users?: User[]; 
}

const EntryTab: React.FC<EntryTabProps & { users?: User[] }> = ({ currentUser, classes, students, criteria, violations, setViolations, roleConfigs, users = [] }) => {
  const [entryMode, setEntryMode] = useState<'VIOLATION' | 'ACHIEVEMENT'>('VIOLATION');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
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
  const csvInputRef = useRef<HTMLInputElement>(null);
  const abortImportRef = useRef<boolean>(false); // Ref để kiểm soát việc hủy
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Check Admin permission dynamically
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

  const handleCancelImport = () => {
      if (confirm("Bạn có chắc muốn hủy quá trình Import? Dữ liệu đã xử lý trước đó vẫn sẽ được lưu.")) {
          abortImportRef.current = true;
      }
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r\n|\n/);
      
      const recordsToProcess: Violation[] = [];
      
      // 1. Parse CSV based on Mode
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = parseCSVLine(line);
        
        if (entryMode === 'VIOLATION') {
             // Columns: Ngay_vi_pham, Lop_vi_pham, HS_vi_pham, Loi_vi_pham, Diem_tru, Ghi_chu, Link_anh, Nguoi_ghi_loi, Role_nguoi_ghi_loi
             if (parts.length >= 5) {
                const [ngay, tenLop, tenHS, noiDungLoi, diemTruStr, ghiChu, linkAnh, nguoiGhi] = parts;
                const targetClass = classes.find(c => c.name.toLowerCase() === tenLop.toLowerCase() || c.id.toLowerCase() === tenLop.toLowerCase());
                
                if (targetClass) {
                    let targetStudentId: string | undefined = undefined;
                    if (tenHS && tenHS.trim()) {
                         const student = students.find(s => s.classId === targetClass.id && s.name.toLowerCase() === tenHS.toLowerCase().trim());
                         targetStudentId = student ? student.id : undefined;
                    }

                    // Tìm Criteria ID dựa trên nội dung, nếu không có thì tạo ID ảo
                    const foundCriteria = criteria.find(c => c.content.toLowerCase() === noiDungLoi.toLowerCase() && c.type === 'MINUS');
                    const criteriaId = foundCriteria ? foundCriteria.id : `IMP_V_${Date.now()}_${i}`;
                    
                    const points = parseFloat(diemTruStr);
                    const finalPoints = Math.abs(points);

                    const imageList = linkAnh ? [linkAnh] : [];
                    const noteContent = ghiChu ? ghiChu.trim() : '';
                    
                    let reporterId = currentUser.id; // Default Admin
                    if (nguoiGhi) {
                        const foundUser = users.find(u => 
                            u.name.toLowerCase() === nguoiGhi.toLowerCase() || 
                            u.username.toLowerCase() === nguoiGhi.toLowerCase()
                        );
                        if (foundUser) reporterId = foundUser.id;
                    }

                    recordsToProcess.push({
                        id: `VCSV_V_${Date.now()}_${i}`,
                        date: ngay || new Date().toISOString().slice(0, 10),
                        classId: targetClass.id,
                        studentId: targetStudentId,
                        criteriaId: criteriaId,
                        points: finalPoints,
                        note: noteContent,
                        reportedBy: reporterId, 
                        isSecurityReport: false,
                        timestamp: Date.now(),
                        images: imageList
                    });
                }
             }
        } else {
             // ACHIEVEMENT MODE - CẬP NHẬT THEO YÊU CẦU 6 CỘT
             // Columns: Ngay, Ten_Lop, HS_dat_thanh_tich, Loai_thanh_tich, Diem_cong, Ghi_chu
             // Index:   0     1        2                  3                4          5
             if (parts.length >= 5) { // Ghi chú (cột 6) có thể trống
                 const [ngay, tenLop, tenHS, loaiThanhTich, diemCongStr, ghiChu] = parts;
                 
                 const targetClass = classes.find(c => c.name.toLowerCase() === tenLop.toLowerCase() || c.id.toLowerCase() === tenLop.toLowerCase());

                 if (targetClass) {
                    let targetStudentId: string | undefined = undefined;
                    if (tenHS && tenHS.trim()) {
                         const student = students.find(s => s.classId === targetClass.id && s.name.toLowerCase() === tenHS.toLowerCase().trim());
                         targetStudentId = student ? student.id : undefined;
                    }

                    const foundCriteria = criteria.find(c => c.content.toLowerCase() === loaiThanhTich.toLowerCase() && c.type === 'PLUS');
                    const criteriaId = foundCriteria ? foundCriteria.id : `IMP_A_${Date.now()}_${i}`;
                    
                    // Xử lý điểm cộng: Đảm bảo là số âm trong hệ thống (vì hệ thống quy định Điểm = Số trừ, nên điểm cộng là số âm của số trừ)
                    // Tuy nhiên trong code này mình đang dùng convention: 
                    // points > 0 là Vi phạm (Trừ điểm).
                    // points < 0 là Thành tích (Cộng điểm).
                    // File CSV nhập vào cột "Điểm cộng" (VD: 10), thì phải chuyển thành -10.
                    let points = 0;
                    if (diemCongStr) {
                         points = parseFloat(diemCongStr);
                    } else if (foundCriteria) {
                         points = foundCriteria.points;
                    }
                    const finalPoints = -Math.abs(points); // Luôn là số âm

                    recordsToProcess.push({
                        id: `VCSV_A_${Date.now()}_${i}`,
                        date: ngay || new Date().toISOString().slice(0, 10),
                        classId: targetClass.id,
                        studentId: targetStudentId,
                        criteriaId: criteriaId,
                        points: finalPoints, 
                        note: ghiChu ? ghiChu.trim() : '',
                        reportedBy: currentUser.id,
                        isSecurityReport: false,
                        timestamp: Date.now(),
                        images: []
                    });
                 }
             }
        }
      }

      if (recordsToProcess.length === 0) {
          alert("Không tìm thấy dữ liệu hợp lệ trong file CSV hoặc sai định dạng cột.");
          if (csvInputRef.current) csvInputRef.current.value = '';
          return;
      }

      if (!confirm(`Tìm thấy ${recordsToProcess.length} dòng hợp lệ. Bắt đầu lưu vào hệ thống?`)) {
          if (csvInputRef.current) csvInputRef.current.value = '';
          return;
      }

      // 2. Send to API sequentially with Abort check
      setIsSubmitting(true);
      abortImportRef.current = false; // Reset abort flag
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < recordsToProcess.length; i++) {
          if (abortImportRef.current) {
              setImportProgress("Đã hủy quá trình Import!");
              break;
          }

          setImportProgress(`Đang xử lý ${i + 1}/${recordsToProcess.length}...`);
          try {
              await api.createViolation(recordsToProcess[i]);
              successCount++;
              // Thêm delay nhỏ để UI kịp cập nhật nếu cần
              await new Promise(resolve => setTimeout(resolve, 50));
          } catch (err) {
              console.error(err);
              errorCount++;
          }
      }

      // 3. Update UI
      const processedRecords = recordsToProcess.slice(0, successCount + errorCount);
      setViolations([...processedRecords, ...violations]); 
      
      setIsSubmitting(false);
      setImportProgress('');
      
      if (abortImportRef.current) {
          alert(`Đã HỦY Import:\n- Đã lưu thành công: ${successCount}\n- Lỗi: ${errorCount}\n- Còn lại: ${recordsToProcess.length - (successCount + errorCount)} chưa xử lý.`);
      } else {
          alert(`Hoàn tất import:\n- Thành công: ${successCount}\n- Lỗi: ${errorCount}`);
      }
      
      if (csvInputRef.current) csvInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleSubmitViolation = async () => {
    if (!selectedClassId || !selectedCriteriaId) return alert("Vui lòng chọn lớp và nội dung");
    if (selectedType === 'PERSONAL' && !selectedStudentId) return alert("Vui lòng chọn học sinh");
    
    // Check image requirement: REQUIRED for Violation, OPTIONAL for Achievement
    if (entryMode === 'VIOLATION' && !previewImage) {
        return alert("Bắt buộc phải có ảnh minh họa/bằng chứng cho lỗi vi phạm.");
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
            // Chuẩn hóa tên file
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
                alert("Lỗi upload ảnh: " + uploadRes.message);
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

        await api.createViolation(newViolation);
        setViolations([newViolation, ...violations]);
        setShowSuccessModal(true);
        
        setSelectedStudentId('');
        setSelectedCriteriaId('');
        setEntryNote('');
        setPreviewImage(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setTimeout(() => setShowSuccessModal(false), 2000);

    } catch (error) {
        alert("Có lỗi xảy ra khi lưu dữ liệu.");
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
                <div>
                    <input type="file" ref={csvInputRef} onChange={handleCSVImport} accept=".csv" className="hidden" />
                    <button 
                        onClick={() => csvInputRef.current?.click()}
                        disabled={isSubmitting}
                        className="text-xs flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 font-bold border border-green-200 disabled:opacity-50"
                    >
                        <Upload size={14} /> Import CSV
                    </button>
                </div>
            )}
        </div>
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
          
          {isAdmin && (
             <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-800 flex items-start gap-2 mb-2 border border-blue-100">
                <Info size={16} className="shrink-0 mt-0.5" />
                {entryMode === 'VIOLATION' ? (
                   <div className="space-y-1">
                      <strong>Cấu trúc CSV Vi Phạm (9 cột):</strong>
                      <div className="font-mono bg-blue-100/50 p-1 rounded break-all">
                        Ngay_vi_pham, Lop_vi_pham, HS_vi_pham, Loi_vi_pham, Diem_tru, Ghi_chu, Link_anh, Nguoi_ghi_loi, Role_nguoi_ghi_loi
                      </div>
                      <em>HS_vi_pham để trống nếu là tập thể.</em>
                   </div>
                ) : (
                   <div className="space-y-1">
                      <strong>Cấu trúc CSV Thành Tích (6 cột):</strong>
                      <div className="font-mono bg-blue-100/50 p-1 rounded break-all">
                        Ngay, Ten_Lop, HS_dat_thanh_tich, Loai_thanh_tich, Diem_cong, Ghi_chu
                      </div>
                      <em>HS_dat_thanh_tich để trống nếu là tập thể.</em>
                   </div>
                )}
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
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageChange} capture="environment" />
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
