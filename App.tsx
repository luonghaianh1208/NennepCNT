
import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  PlusCircle,
  List,
  Trophy,
  BarChart2,
  Settings,
  User,
  Eye,
  Trash2,
  X,
  Save,
  Edit,
  LogIn,
  LogOut,
  Loader2,
  Users,
  Link2,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import { User as UserType, Violation, ClassEntity, Student, Criteria, TimeConfig, RoleConfig } from './types';
import { INITIAL_ROLE_DEFINITIONS, GUEST_USER, INITIAL_TIME_CONFIGS, formatDateForInput, formatDateDisplay, safeParseImages } from './utils';
import { api } from './services/googleApi';

import EntryTab from './components/EntryTab';
import ListTab from './components/ListTab';
import RankingTab from './components/RankingTab';
import ClassDetailTab from './components/ClassDetailTab';
import SettingsTab from './components/SettingsTab';
import TaskForceTab from './components/TaskForceTab';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('list');
  const [currentUser, setCurrentUser] = useState<UserType>(GUEST_USER);
  
  // Data States
  const [users, setUsers] = useState<UserType[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [classes, setClasses] = useState<ClassEntity[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [timeConfigs, setTimeConfigs] = useState<TimeConfig[]>(INITIAL_TIME_CONFIGS);
  
  // Role Configuration State (Dynamic Roles)
  const [roleConfigs, setRoleConfigs] = useState<Record<string, RoleConfig>>(INITIAL_ROLE_DEFINITIONS);
  
  const [academicYear, setAcademicYear] = useState<string>('2023-2024');
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showGlobalSuccess, setShowGlobalSuccess] = useState(false); // Global Success Notification

  // Login State
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Modal States
  const [editingViolation, setEditingViolation] = useState<Violation | null>(null);
  const [viewingViolation, setViewingViolation] = useState<Violation | null>(null);
  
  const [editDate, setEditDate] = useState('');
  const [editClassId, setEditClassId] = useState('');
  const [editStudentId, setEditStudentId] = useState('');
  const [editCriteriaId, setEditCriteriaId] = useState('');
  const [editNote, setEditNote] = useState('');

  // Fetch Data Function
  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    else setIsRefreshing(true);
    
    const data = await api.getAllData();
    if (data) {
      if(data.Users) setUsers(data.Users);
      if(data.Classes) setClasses(data.Classes);
      if(data.Students) setStudents(data.Students);
      if(data.Criteria) setCriteria(data.Criteria);
      if(data.Violations) setViolations(data.Violations);
      
      // Fix: Chuẩn hóa ngày tháng cho TimeConfigs ngay khi load về
      if(data.TimeConfigs && data.TimeConfigs.length > 0) {
        const normalizedTimeConfigs = data.TimeConfigs.map((tc: TimeConfig) => ({
            ...tc,
            startDate: formatDateForInput(tc.startDate),
            endDate: formatDateForInput(tc.endDate)
        }));
        setTimeConfigs(normalizedTimeConfigs);
      }
    }
    
    if (showLoading) setIsLoading(false);
    else setIsRefreshing(false);
  }, []);

  // Initial Fetch & Auto Login
  useEffect(() => {
    const init = async () => {
        await fetchData(true);
        
        // Auto Login Check
        const savedUserJson = localStorage.getItem('nnp_user_creds');
        if (savedUserJson) {
            try {
                const creds = JSON.parse(savedUserJson);
                // Cần wait users state được set từ fetchData
                // Do fetchData async, ta thực hiện check lại trong một effect khác hoặc check ngay đây nếu có data
                // Tuy nhiên users state chưa update ngay lập tức ở đây.
                // Giải pháp: Lưu creds vào state tạm và check trong useEffect khác khi users thay đổi.
                setLoginUsername(creds.username);
                setLoginPassword(creds.password);
                setRememberMe(true);
            } catch (e) {
                localStorage.removeItem('nnp_user_creds');
            }
        }
    };
    init();
  }, [fetchData]);

  // Effect để Auto Login khi users data đã load và có thông tin đăng nhập lưu sẵn
  useEffect(() => {
     if (users.length > 0 && currentUser.role === 'GUEST' && loginUsername && loginPassword && rememberMe) {
         const user = users.find(u => u.username === loginUsername && u.password === loginPassword);
         if (user) {
             setCurrentUser(user);
             // Redirect logic
             const userRoleKey = user.role.toUpperCase();
             // Assuming roleConfigs is populated or default
             const roleConfig = roleConfigs[userRoleKey] || roleConfigs['GUEST'] || INITIAL_ROLE_DEFINITIONS[userRoleKey];
             
             if (roleConfig?.canEntry) setActiveTab('entry');
             else if (roleConfig?.isAdmin) setActiveTab('settings');
             else setActiveTab('list');
         }
     }
  }, [users, loginUsername, loginPassword, rememberMe]); // Run when users load

  const handleRefresh = () => {
    fetchData(false); // Silent refresh (show small spinner)
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find(u => u.username === loginUsername && u.password === loginPassword);
    
    if (user) {
      setCurrentUser(user);
      setShowLoginModal(false);
      setLoginError('');
      
      if (rememberMe) {
          localStorage.setItem('nnp_user_creds', JSON.stringify({ username: loginUsername, password: loginPassword }));
      } else {
          localStorage.removeItem('nnp_user_creds');
      }
      
      // Clear sensitive inputs from state
      setLoginUsername('');
      setLoginPassword('');
      
      const userRoleKey = user.role.toUpperCase();
      const roleConfig = roleConfigs[userRoleKey] || roleConfigs['GUEST'];
      
      if (roleConfig.canEntry) {
        setActiveTab('entry');
      } else if (roleConfig.isAdmin) {
        setActiveTab('settings');
      } else {
        setActiveTab('list');
      }
    } else {
      setLoginError('Tên đăng nhập hoặc mật khẩu không đúng');
    }
  };

  const handleLogout = () => {
    if(confirm("Bạn có chắc muốn đăng xuất?")) {
        setCurrentUser(GUEST_USER);
        setActiveTab('list');
        localStorage.removeItem('nnp_user_creds');
    }
  };

  // Modified: Support skipConfirmation for TaskForce Tab and Silent Save
  const handleSaveSettings = async (skipConfirmation = false) => {
     if(!skipConfirmation) {
        if(!confirm("Lưu toàn bộ cấu hình lên hệ thống?")) return;
     }
     
     setIsRefreshing(true);

     const payload = {
        Users: users,
        Classes: classes,
        Students: students,
        Criteria: criteria,
        TimeConfigs: timeConfigs
     };

     try {
        await api.syncSettings(payload);
        setUnsavedChanges(false);
        
        // Show Global Success
        setShowGlobalSuccess(true);
        setTimeout(() => setShowGlobalSuccess(false), 2000);
     } catch (e) {
        alert("Lỗi khi lưu dữ liệu. Vui lòng thử lại.");
     } finally {
        setIsRefreshing(false);
     }
  };

  const handleUpdateUser = async (updatedUser: UserType) => {
      // Optimistic Update
      setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
      setUnsavedChanges(true); 
  };

  // --- Xử lý Xóa Đơn Lẻ ---
  const handleDeleteViolation = async (id: string) => {
    if (confirm("Xóa vĩnh viễn mục này trên hệ thống?")) {
      // Optimistic update
      setViolations(prev => prev.filter(v => v.id !== id));
      if (viewingViolation?.id === id) setViewingViolation(null);
      
      await api.deleteViolation(id);
    }
  };

  // --- Xử lý Xóa Nhiều (Mới) ---
  const handleBulkDelete = async (ids: string[]) => {
      if (ids.length === 0) return;
      if (!confirm(`Bạn có chắc muốn xóa ${ids.length} mục đã chọn?`)) return;

      setIsRefreshing(true); // Show loading indicator

      // 1. Optimistic update (Cập nhật giao diện ngay lập tức)
      setViolations(prev => prev.filter(v => !ids.includes(v.id)));

      // 2. Gọi API xóa hàng loạt
      try {
          await api.deleteViolations(ids);
          // Không cần alert thành công để trải nghiệm mượt hơn, hoặc alert nhỏ
      } catch (e) {
          alert("Có lỗi xảy ra khi xóa dữ liệu trên Server.");
          // Rollback nếu cần (nhưng phức tạp), ở đây ta nên refresh lại data
          fetchData(false);
      } finally {
          setIsRefreshing(false);
      }
  };

  const handleEditClick = (e: React.MouseEvent, v: Violation) => {
    e.stopPropagation();
    setEditingViolation(v);
    
    setEditDate(formatDateForInput(v.date));
    setEditClassId(v.classId);
    setEditStudentId(v.studentId || '');
    setEditCriteriaId(v.criteriaId);
    setEditNote(v.note || '');
  };

  const handleSaveEdit = async () => {
    if (!editingViolation) return;
    
    const criteriaItem = criteria.find(c => c.id === editCriteriaId);
    let finalPoints = criteriaItem ? criteriaItem.points : 0;
    if (criteriaItem?.type === 'PLUS') finalPoints = -Math.abs(finalPoints);
    else finalPoints = Math.abs(finalPoints);

    const updatedV: Violation = {
      ...editingViolation,
      date: editDate,
      classId: editClassId,
      studentId: editStudentId || undefined,
      criteriaId: editCriteriaId,
      points: finalPoints,
      note: editNote,
    };

    setViolations(prev => prev.map(v => v.id === updatedV.id ? updatedV : v));
    setEditingViolation(null);
    await api.updateViolation(updatedV);
    
    // Show quick success
    setShowGlobalSuccess(true);
    setTimeout(() => setShowGlobalSuccess(false), 1500);
  };

  const isCurrentUserAdmin = () => {
      const roleKey = currentUser.role.toUpperCase();
      return roleConfigs[roleKey]?.isAdmin || false;
  };

  const canCurrentUserEntry = () => {
      const roleKey = currentUser.role.toUpperCase();
      return roleConfigs[roleKey]?.canEntry || false;
  };

  const renderViewModal = () => {
    if (!viewingViolation) return null;
    const v = viewingViolation;
    const cls = classes.find(c => c.id === v.classId);
    
    // STRICT FIX: Tìm học sinh phải khớp cả ID và ClassID để tránh trùng ID
    const stu = students.find(s => s.id === v.studentId && s.classId === v.classId);
    
    const cri = criteria.find(c => c.id === v.criteriaId);
    const reporter = users.find(u => u.id === v.reportedBy);
    
    const images = safeParseImages(v.images);

    // Xử lý hiển thị người báo cáo
    const reporterRoleConfig = reporter ? roleConfigs[reporter.role] : null;
    const reporterRoleLabel = reporterRoleConfig ? reporterRoleConfig.label : 'Không rõ';
    const reporterColor = reporterRoleConfig ? reporterRoleConfig.color : 'gray';

    // Chỉ Admin hoặc chính người báo mới thấy tên đầy đủ
    const showReporterDetails = isCurrentUserAdmin() || currentUser.id === v.reportedBy;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
        <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
           <div className="flex justify-between items-center p-4 border-b bg-slate-50">
             <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Eye size={20} className="text-blue-600"/> Chi tiết</h3>
             <button onClick={() => setViewingViolation(null)} className="p-1 rounded-full hover:bg-slate-200"><X size={24} className="text-slate-500" /></button>
           </div>
           <div className="p-5 overflow-y-auto space-y-4">
              
              {/* Image Links instead of Preview */}
              {images.length > 0 ? (
                <div className="flex flex-col gap-2">
                    {images.map((img, idx) => (
                         <a 
                            key={idx} 
                            href={img} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 w-full p-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                        >
                            <Link2 size={18} /> 
                            <span className="font-semibold text-sm">Xem ảnh minh chứng {images.length > 1 ? idx + 1 : ''}</span>
                        </a>
                    ))}
                </div>
              ) : <div className="w-full h-20 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 text-sm italic border border-slate-200 border-dashed">Không có ảnh minh họa</div>}

              <div className="space-y-3">
                 <div>
                    <div className="text-2xl font-black text-blue-800">{cls?.name}</div>
                    <div className="text-sm font-semibold text-slate-600">{formatDateDisplay(v.date)}</div>
                 </div>
                 <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="text-xs font-bold text-slate-500 uppercase mb-1">Học sinh</div>
                    <div className="font-medium text-slate-800 flex items-center gap-2"><User size={16} /> {stu ? `${stu.name}` : 'Tập thể lớp'}</div>
                 </div>
                 <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="text-xs font-bold text-slate-500 uppercase mb-1">Nội dung</div>
                    <div className="font-medium text-slate-800">{cri?.content}</div>
                    <div className={`text-lg font-bold mt-1 ${v.points > 0 ? 'text-red-600' : 'text-green-600'}`}>{v.points > 0 ? `Trừ ${v.points} điểm` : `Cộng ${Math.abs(v.points)} điểm`}</div>
                 </div>
                 {v.note && <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-sm text-yellow-900"><span className="font-bold">Ghi chú:</span> {v.note}</div>}
                 
                 {/* Phần hiển thị Người báo cáo */}
                 <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                     <span className="text-xs text-slate-400 font-medium">Người báo cáo</span>
                     <div className="flex items-center gap-2">
                        {showReporterDetails && (
                            <span className="text-xs font-bold text-slate-700 text-right">
                                {reporter?.name} {reporter?.className ? `(${reporter.className})` : ''}
                            </span>
                        )}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border bg-${reporterColor}-50 border-${reporterColor}-200 text-${reporterColor}-700`}>
                            {reporterRoleLabel}
                        </span>
                     </div>
                 </div>
              </div>
           </div>
           <div className="p-4 border-t bg-slate-50 flex justify-end">
              {isCurrentUserAdmin() && (
                 <button onClick={() => { setViewingViolation(null); handleDeleteViolation(v.id); }} className="text-red-600 font-bold text-sm px-4 py-2 hover:bg-red-50 rounded-lg mr-auto flex items-center gap-1"><Trash2 size={16} /> Xóa</button>
              )}
              <button onClick={() => setViewingViolation(null)} className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700">Đóng</button>
           </div>
        </div>
      </div>
    );
  };

  const renderEditModal = () => {
    if (!editingViolation) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in">
        <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-4 sm:zoom-in-95">
          <div className="flex justify-between items-center p-4 border-b">
            <h3 className="font-bold text-lg flex items-center gap-2"><Edit size={20} className="text-blue-600"/> Chỉnh sửa thông tin</h3>
            <button onClick={() => setEditingViolation(null)} className="p-1 rounded-full hover:bg-slate-100"><X size={24} className="text-slate-500" /></button>
          </div>
          <div className="p-4 space-y-4 overflow-y-auto">
             <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Ngày ghi nhận</label><input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="w-full p-2 border rounded-lg" /></div>
             <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Lớp</label><select value={editClassId} onChange={e => setEditClassId(e.target.value)} className="w-full p-2 border rounded-lg">{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Học sinh</label><select value={editStudentId} onChange={e => setEditStudentId(e.target.value)} className="w-full p-2 border rounded-lg" disabled={!editingViolation.studentId && !editStudentId}><option value="">-- Tập thể --</option>{students.filter(s => s.classId === editClassId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
             </div>
             <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nội dung</label><select value={editCriteriaId} onChange={e => setEditCriteriaId(e.target.value)} className="w-full p-2 border rounded-lg"><optgroup label="Vi phạm">{criteria.filter(c => c.type === 'MINUS').map(c => <option key={c.id} value={c.id}>{c.content}</option>)}</optgroup><optgroup label="Thành tích">{criteria.filter(c => c.type === 'PLUS').map(c => <option key={c.id} value={c.id}>{c.content}</option>)}</optgroup></select></div>
             <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Ghi chú</label><textarea value={editNote} onChange={e => setEditNote(e.target.value)} className="w-full p-2 border rounded-lg" rows={2}></textarea></div>
          </div>
          <div className="p-4 border-t bg-slate-50 rounded-b-2xl flex justify-end gap-3">
             <button onClick={() => setEditingViolation(null)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg">Hủy</button>
             <button onClick={handleSaveEdit} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 flex items-center gap-2"><Save size={18} /> Lưu Thay Đổi</button>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
      return (
          <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-500 gap-3">
              <Loader2 className="animate-spin text-blue-600" size={40} />
              <p className="font-medium">Đang tải dữ liệu từ hệ thống...</p>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans mx-auto max-w-md md:max-w-2xl lg:max-w-4xl shadow-2xl overflow-hidden flex flex-col relative">
      <style>{`
          @keyframes snowfall {
            0% { transform: translateY(-10px) translateX(0px); opacity: 0; }
            20% { opacity: 0.9; }
            100% { transform: translateY(300px) translateX(20px); opacity: 0; }
          }
          @keyframes twinkle {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.3; transform: scale(0.6); }
          }
          .snowflake {
            position: absolute;
            background: white;
            border-radius: 50%;
            pointer-events: none;
            animation: snowfall linear infinite;
          }
          .star-twinkle {
            position: absolute;
            width: 3px;
            height: 3px;
            background: white;
            border-radius: 50%;
            animation: twinkle 3s ease-in-out infinite;
            box-shadow: 0 0 4px 1px rgba(255, 255, 255, 0.4);
          }
      `}</style>
      
      <header className="bg-blue-900 text-white p-4 pt-8 pb-6 sticky top-0 z-20 shadow-lg rounded-b-[2rem] relative overflow-hidden">
        {/* --- HIỆU ỨNG TUYẾT RƠI & SAO --- */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
             {/* Tuyết rơi */}
             {[...Array(15)].map((_, i) => (
               <div 
                 key={`snow-${i}`} 
                 className="snowflake"
                 style={{
                    width: `${Math.random() * 4 + 2}px`,
                    height: `${Math.random() * 4 + 2}px`,
                    left: `${Math.random() * 100}%`,
                    top: `-${Math.random() * 20}px`,
                    animationDuration: `${Math.random() * 5 + 3}s`,
                    animationDelay: `${Math.random() * 5}s`,
                    opacity: Math.random() * 0.5 + 0.3
                 }}
               ></div>
             ))}

             {/* Sao lấp lánh */}
             {[...Array(8)].map((_, i) => (
                <div 
                  key={`star-${i}`}
                  className="star-twinkle"
                  style={{
                      left: `${Math.random() * 90 + 5}%`,
                      top: `${Math.random() * 60}%`,
                      animationDelay: `${Math.random() * 2}s`
                  }}
                ></div>
             ))}

             {/* --- TUYẾT ĐỌNG Ở CHÂN (NEW) --- */}
             <div className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none z-0">
                 {/* Lớp nền mờ */}
                 <div className="absolute bottom-0 w-full h-full bg-gradient-to-t from-white/30 to-transparent"></div>
                 
                 {/* Sóng tuyết 1 (Xa) */}
                 <svg className="absolute bottom-0 w-full h-12 text-white/20 fill-current" viewBox="0 0 1440 320" preserveAspectRatio="none">
                     <path d="M0,224L48,234.7C96,245,192,267,288,266.7C384,267,480,245,576,213.3C672,181,768,139,864,138.7C960,139,1056,181,1152,197.3C1248,213,1344,203,1392,197.3L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
                 </svg>
                 
                 {/* Sóng tuyết 2 (Gần) */}
                 <svg className="absolute bottom-0 w-full h-8 text-white/40 fill-current" viewBox="0 0 1440 320" preserveAspectRatio="none">
                     <path d="M0,128L48,144C96,160,192,192,288,186.7C384,181,480,139,576,144C672,149,768,203,864,208C960,213,1056,171,1152,149.3C1248,128,1344,128,1392,128L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
                 </svg>
                 
                 {/* Tuyết đọng góc trái (Blob) */}
                 <div className="absolute -bottom-6 -left-6 w-32 h-24 bg-white/60 blur-xl rounded-full"></div>
                 <div className="absolute -bottom-2 -left-2 w-20 h-12 bg-white/80 blur-md rounded-full"></div>
                 
                 {/* Tuyết đọng góc phải (Blob) */}
                 <div className="absolute -bottom-8 -right-4 w-40 h-28 bg-white/50 blur-xl rounded-full"></div>
                 <div className="absolute -bottom-2 -right-2 w-24 h-16 bg-white/70 blur-md rounded-full"></div>
             </div>
        </div>

        <div className="flex justify-between items-start relative z-10">
           <div className="flex flex-col">
              <div className="flex items-center gap-3 mb-2">
                 <div className="flex -space-x-2"> 
                     <img src="https://upload.wikimedia.org/wikipedia/commons/7/70/THPT_Chuyen_Nguyen_Trai.png" alt="CNT" className="w-10 h-10 object-contain bg-white rounded-full p-0.5 shadow-md z-10" />
                     <img src="https://upload.wikimedia.org/wikipedia/vi/0/09/Huy_Hi%E1%BB%87u_%C4%90o%C3%A0n.png" alt="Doan" className="w-10 h-10 object-contain drop-shadow-md z-0" />
                 </div>
                 
                 <div>
                     <h1 className="text-2xl font-black tracking-tight leading-none">NỀN NẾP CNT</h1>
                     <div className="text-[10px] text-blue-200 font-bold uppercase tracking-widest mt-0.5">THPT Chuyên Nguyễn Trãi</div>
                 </div>
              </div>
              
              <div className="pl-1 space-y-0.5">
                  <p className="text-blue-100 text-xs opacity-90">Hệ thống quản lí thi đua trường THPT Chuyên Nguyễn Trãi</p>
                  <p className="text-blue-400 text-[10px] font-mono">Developed by Lương Hải Anh © 2026</p>
              </div>
           </div>
           
           <div className="flex items-center gap-2 pt-1">
              {/* Refresh Button */}
              <button 
                onClick={handleRefresh} 
                disabled={isRefreshing}
                className="p-2 rounded-full bg-blue-800 text-blue-200 hover:bg-blue-700 hover:text-white transition-colors disabled:opacity-50"
                title="Làm mới dữ liệu từ Database"
              >
                  <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
              </button>

              <div className="relative group">
                  {currentUser.role !== 'GUEST' ? (
                    <button 
                        onClick={handleLogout}
                        className="flex items-center gap-2 bg-blue-800/50 hover:bg-blue-800 pl-3 pr-2 py-1.5 rounded-full text-xs font-medium transition-colors border border-blue-700"
                    >
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold bg-white text-blue-900`}>{currentUser.name.charAt(0)}</div>
                        <span className="max-w-[80px] truncate">{currentUser.name}</span>
                        <LogOut size={14} className="ml-1 opacity-70"/>
                    </button>
                  ) : (
                    <button 
                        onClick={() => setShowLoginModal(true)}
                        className="flex items-center gap-2 bg-white text-blue-900 hover:bg-blue-50 px-4 py-2 rounded-full text-sm font-bold transition-colors shadow-md"
                    >
                        <LogIn size={16} /> Đăng nhập
                    </button>
                  )}
              </div>
           </div>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto scroll-smooth">
        {activeTab === 'entry' && currentUser.role !== 'GUEST' && canCurrentUserEntry() && (
          <EntryTab 
            currentUser={currentUser} 
            classes={classes} 
            students={students} 
            criteria={criteria} 
            violations={violations} 
            setViolations={setViolations}
            roleConfigs={roleConfigs}
            users={users}
          />
        )}
        {activeTab === 'list' && (
          <ListTab 
            currentUser={currentUser} 
            violations={violations} 
            classes={classes} 
            students={students} 
            criteria={criteria} 
            users={users} 
            roleConfigs={roleConfigs}
            timeConfigs={timeConfigs}
            handleDeleteViolation={handleDeleteViolation}
            handleBulkDelete={handleBulkDelete} 
            setViewingViolation={setViewingViolation}
            handleEditClick={handleEditClick}
          />
        )}
        {activeTab === 'ranking' && (
          <RankingTab 
            violations={violations} 
            classes={classes} 
            timeConfigs={timeConfigs} 
          />
        )}
        {activeTab === 'detail' && (
          <ClassDetailTab 
            currentUser={currentUser} 
            classes={classes} 
            violations={violations} 
            criteria={criteria} 
            students={students} 
            setViewingViolation={setViewingViolation} 
            timeConfigs={timeConfigs}
          />
        )}
        {activeTab === 'taskforce' && (isCurrentUserAdmin() || ['BCH_PHU_TRACH', 'BCH', 'RED_FLAG', 'DISCIPLINE'].includes(currentUser.role)) && (
          <TaskForceTab 
            currentUser={currentUser}
            users={users}
            violations={violations}
            classes={classes}
            students={students}
            roleConfigs={roleConfigs}
            onUpdateUser={handleUpdateUser}
            unsavedChanges={unsavedChanges}
            onSave={() => handleSaveSettings(true)} // Pass true to skip confirmation
          />
        )}
        {activeTab === 'settings' && (
          isCurrentUserAdmin() ? (
            <SettingsTab 
              currentUserRole={currentUser.role}
              currentUser={currentUser}
              setCurrentUser={setCurrentUser}
              academicYear={academicYear}
              setAcademicYear={setAcademicYear}
              timeConfigs={timeConfigs}
              setTimeConfigs={setTimeConfigs}
              classes={classes}
              setClasses={setClasses}
              students={students}
              setStudents={setStudents}
              criteria={criteria}
              setCriteria={setCriteria}
              users={users}
              setUsers={setUsers}
              roleConfigs={roleConfigs}
              setRoleConfigs={setRoleConfigs}
              handleSaveSettings={() => handleSaveSettings(false)}
              unsavedChanges={unsavedChanges}
              setUnsavedChanges={setUnsavedChanges}
            />
          ) : (activeTab === 'settings' && <div className="text-center py-20 text-slate-400">Bạn không có quyền truy cập.</div>)
        )}
        
      </main>

      <nav className="bg-white border-t border-slate-200 fixed bottom-0 left-0 right-0 max-w-md md:max-w-2xl lg:max-w-4xl mx-auto z-10 pb-safe">
        {/* Navigation Buttons */}
        <div className="flex justify-around items-center">
          {currentUser.role !== 'GUEST' && canCurrentUserEntry() && (
            <button onClick={() => setActiveTab('entry')} className={`flex flex-col items-center py-3 px-2 flex-1 transition-colors ${activeTab === 'entry' ? 'text-blue-700' : 'text-slate-400 hover:text-slate-600'}`}>
              <PlusCircle size={24} className={activeTab === 'entry' ? 'fill-blue-100' : ''} strokeWidth={activeTab === 'entry' ? 2.5 : 2} />
              <span className="text-[10px] font-bold mt-1">Nhập Lỗi</span>
            </button>
          )}
          <button onClick={() => setActiveTab('list')} className={`flex flex-col items-center py-3 px-2 flex-1 transition-colors ${activeTab === 'list' ? 'text-blue-700' : 'text-slate-400 hover:text-slate-600'}`}>
            <List size={24} strokeWidth={activeTab === 'list' ? 2.5 : 2} /><span className="text-[10px] font-bold mt-1">Tra Cứu</span>
          </button>
          <button onClick={() => setActiveTab('ranking')} className={`flex flex-col items-center py-3 px-2 flex-1 transition-colors ${activeTab === 'ranking' ? 'text-blue-700' : 'text-slate-400 hover:text-slate-600'}`}>
            <Trophy size={24} className={activeTab === 'ranking' ? 'fill-blue-100' : ''} strokeWidth={activeTab === 'ranking' ? 2.5 : 2} /><span className="text-[10px] font-bold mt-1">Xếp Hạng</span>
          </button>
          <button onClick={() => setActiveTab('detail')} className={`flex flex-col items-center py-3 px-2 flex-1 transition-colors ${activeTab === 'detail' ? 'text-blue-700' : 'text-slate-400 hover:text-slate-600'}`}>
            <BarChart2 size={24} strokeWidth={activeTab === 'detail' ? 2.5 : 2} /><span className="text-[10px] font-bold mt-1">Lớp</span>
          </button>
          
          {(isCurrentUserAdmin() || ['BCH_PHU_TRACH', 'BCH', 'RED_FLAG', 'DISCIPLINE'].includes(currentUser.role)) && (
             <button onClick={() => setActiveTab('taskforce')} className={`flex flex-col items-center py-3 px-2 flex-1 transition-colors ${activeTab === 'taskforce' ? 'text-blue-700' : 'text-slate-400 hover:text-slate-600'}`}>
               <Users size={24} strokeWidth={activeTab === 'taskforce' ? 2.5 : 2} /><span className="text-[10px] font-bold mt-1">Ban Nền Nếp</span>
             </button>
          )}

          {isCurrentUserAdmin() && (
            <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center py-3 px-2 flex-1 transition-colors ${activeTab === 'settings' ? 'text-blue-700' : 'text-slate-400 hover:text-slate-600'}`}>
              <Settings size={24} strokeWidth={activeTab === 'settings' ? 2.5 : 2} /><span className="text-[10px] font-bold mt-1">Cấu Hình</span>
            </button>
          )}
        </div>
      </nav>

      {/* Global Success Notification */}
      {showGlobalSuccess && (
         <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[60] animate-in zoom-in fade-in duration-200">
             <div className="bg-black/80 text-white backdrop-blur-md px-6 py-4 rounded-2xl shadow-2xl flex flex-col items-center gap-2">
                 <CheckCircle2 size={40} className="text-green-400" />
                 <span className="font-bold text-lg">Đã lưu thành công!</span>
             </div>
         </div>
      )}

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-blue-900/80 backdrop-blur-sm p-6 animate-in fade-in">
           <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-8 animate-in zoom-in-95 relative">
              <button onClick={() => setShowLoginModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={24}/></button>
              <div className="text-center mb-8">
                 <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
                    <LogIn size={32} />
                 </div>
                 <h2 className="text-2xl font-bold text-slate-800">Đăng Nhập</h2>
                 <p className="text-slate-500 text-sm mt-1">Vui lòng đăng nhập để tiếp tục</p>
              </div>
              <form onSubmit={handleLogin} className="space-y-4">
                 <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                        Tên đăng nhập <span className="text-xs font-normal text-slate-500 italic ml-1">(nhập email đã đăng kí)</span>
                    </label>
                    <input 
                        type="text" 
                        className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" 
                        value={loginUsername}
                        onChange={e => setLoginUsername(e.target.value)}
                        placeholder="admin"
                        autoFocus
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                        Mật khẩu <span className="text-xs font-normal text-slate-500 italic ml-1">(nhập pass đã được cấp dạng CNT@xxxx)</span>
                    </label>
                    <input 
                        type="password" 
                        className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" 
                        value={loginPassword}
                        onChange={e => setLoginPassword(e.target.value)}
                        placeholder="••••••"
                    />
                 </div>
                 
                 {/* Remember Me Checkbox */}
                 <div className="flex items-center gap-2">
                    <input 
                        type="checkbox" 
                        id="rememberMe"
                        checked={rememberMe}
                        onChange={e => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="rememberMe" className="text-sm text-slate-600 cursor-pointer select-none">
                        Ghi nhớ đăng nhập
                    </label>
                 </div>

                 {loginError && <div className="text-red-500 text-sm font-medium text-center">{loginError}</div>}
                 <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-95">
                    Đăng Nhập
                 </button>
              </form>
           </div>
        </div>
      )}

      {renderEditModal()}
      {renderViewModal()}
    </div>
  );
}
