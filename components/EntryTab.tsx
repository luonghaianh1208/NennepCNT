import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Camera, X, Save, CheckCircle2, User as UserIcon, Calendar, ChevronDown } from 'lucide-react';
import { User as UserType, ClassEntity, Student, Criteria, Violation, RoleConfig } from '../types';
import { formatDateForInput } from '../utils';
import { api } from '../services/googleApi';

interface EntryTabProps {
  currentUser: UserType;
  classes: ClassEntity[];
  students: Student[];
  criteria: Criteria[];
  violations: Violation[];
  setViolations: React.Dispatch<React.SetStateAction<Violation[]>>;
  roleConfigs: Record<string, RoleConfig>;
  users: UserType[];
}

export default function EntryTab({ 
    currentUser, classes, students, criteria, 
    violations, setViolations, roleConfigs, users 
}: EntryTabProps) {
  const [entryMode, setEntryMode] = useState<'VIOLATION' | 'ACHIEVEMENT'>('VIOLATION');
  
  // Form States
  const [date, setDate] = useState(formatDateForInput(new Date()));
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedCriteriaId, setSelectedCriteriaId] = useState('');
  const [note, setNote] = useState('');
  const [isSecurityReport, setIsSecurityReport] = useState(false);
  
  // Image States
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtered Lists
  const filteredStudents = useMemo(() => {
    if (!selectedClassId) return [];
    return students.filter(s => s.classId === selectedClassId);
  }, [selectedClassId, students]);

  const filteredCriteria = useMemo(() => {
    return criteria.filter(c => 
      entryMode === 'VIOLATION' ? c.type === 'MINUS' : c.type === 'PLUS'
    );
  }, [entryMode, criteria]);

  // Reset dependent fields
  useEffect(() => {
    setSelectedStudentId('');
  }, [selectedClassId]);

  useEffect(() => {
    setSelectedCriteriaId('');
  }, [entryMode]);

  // Handlers
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const compressImage = async (base64Str: string, maxWidth = 800): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compress to JPEG 70%
      };
    });
  };

  const handleSubmit = async () => {
    if (!selectedClassId) return alert("Vui lòng chọn Lớp");
    if (!selectedCriteriaId) return alert("Vui lòng chọn Nội dung");
    if (entryMode === 'VIOLATION' && !previewImage) {
        return alert("Vui lòng chụp hoặc tải ảnh minh chứng (Bắt buộc với vi phạm)");
    }

    setIsSubmitting(true);

    try {
      let imageUrls: string[] = [];
      
      // Upload image if exists
      if (previewImage) {
        const compressedBase64 = await compressImage(previewImage);
        
        const uploadRes = await api.uploadImage(compressedBase64.split(',')[1], { 
            name: `img_${Date.now()}.jpg`, 
            type: 'image/jpeg' 
        });
        
        if (uploadRes && uploadRes.url) {
            imageUrls.push(uploadRes.url);
        } else {
             console.error("Upload failed or no URL returned", uploadRes);
        }
      }

      const selectedCrit = criteria.find(c => c.id === selectedCriteriaId);
      const points = selectedCrit ? selectedCrit.points : 0;
      
      let finalPoints = points;
      if (selectedCrit?.type === 'PLUS') {
          finalPoints = -Math.abs(points); // Negative points to add to score (Ranking logic uses base - delta)
      } else {
          finalPoints = Math.abs(points); // Positive points to subtract from score
      }

      const newViolation: Violation = {
        id: `V${Date.now()}`,
        date: date,
        classId: selectedClassId,
        studentId: selectedStudentId || undefined,
        criteriaId: selectedCriteriaId,
        points: finalPoints,
        note: note,
        images: imageUrls.length > 0 ? imageUrls : undefined,
        reportedBy: currentUser.id,
        isSecurityReport: isSecurityReport,
        timestamp: Date.now()
      };

      // Optimistic Update
      setViolations(prev => [newViolation, ...prev]);
      
      // Call API
      api.createViolation(newViolation);

      // Reset Form
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 2000);
      
      // Clear fields but keep Class/Date for faster entry
      setPreviewImage(null);
      if(fileInputRef.current) fileInputRef.current.value = '';
      setSelectedStudentId('');
      setSelectedCriteriaId('');
      setNote('');

    } catch (error) {
      console.error("Error creating violation", error);
      alert("Có lỗi xảy ra khi gửi dữ liệu");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pb-20">
      {/* Mode Toggle */}
      <div className="flex bg-white rounded-xl p-1 shadow-sm border border-slate-200 mb-4">
        <button
          onClick={() => setEntryMode('VIOLATION')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${entryMode === 'VIOLATION' ? 'bg-red-50 text-red-600 shadow-sm border border-red-100' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          Vi Phạm (Trừ điểm)
        </button>
        <button
          onClick={() => setEntryMode('ACHIEVEMENT')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${entryMode === 'ACHIEVEMENT' ? 'bg-green-50 text-green-600 shadow-sm border border-green-100' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          Thành Tích (Cộng điểm)
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-4">
        {/* Date Field */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ngày ghi nhận</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input 
              type="date" 
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        {/* Class Selection */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Lớp học (*)</label>
          <select 
            className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white font-bold text-lg"
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
          >
            <option value="">-- Chọn lớp --</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Student Selection (Optional) */}
        <div>
           <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Học sinh (Tùy chọn)</label>
              <span className="text-[10px] text-slate-400">Không chọn = Lỗi tập thể</span>
           </div>
           <div className="relative">
             <UserIcon className="absolute left-3 top-2.5 text-slate-400" size={18} />
             <select 
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                disabled={!selectedClassId}
             >
                <option value="">-- Tập thể lớp --</option>
                {filteredStudents.map(s => (
                  <option key={s.id} value={s.id}>{s.name} - {s.id}</option>
                ))}
             </select>
             <ChevronDown className="absolute right-3 top-3 text-slate-400 pointer-events-none" size={16} />
           </div>
        </div>

        {/* Criteria Selection */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nội dung (*)</label>
          <select 
            className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            value={selectedCriteriaId}
            onChange={(e) => setSelectedCriteriaId(e.target.value)}
          >
            <option value="">-- Chọn nội dung --</option>
            {filteredCriteria.map(c => (
              <option key={c.id} value={c.id}>
                {c.content} ({c.points}đ)
              </option>
            ))}
          </select>
        </div>

        {/* Note */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ghi chú thêm</label>
          <textarea 
            className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
            placeholder="Mô tả chi tiết..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          ></textarea>
        </div>

        {/* Image Upload */}
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

        {/* Submit Button */}
        <button 
          onClick={handleSubmit}
          disabled={isSubmitting}
          className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 ${submitSuccess ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {isSubmitting ? (
             <>Đang xử lý...</>
          ) : submitSuccess ? (
             <><CheckCircle2 size={20} /> Đã gửi thành công!</>
          ) : (
             <><Save size={20} /> Gửi Báo Cáo</>
          )}
        </button>
      </div>
    </div>
  );
}