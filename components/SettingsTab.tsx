
import React, { useState, useRef } from 'react';
import { Save, Clock, PlusCircle, Trash2, Plus, LogOut, Info, Upload, Users, GraduationCap, Calendar, X, Settings, AlertTriangle, Star, UserPlus, Edit, Check, Shield } from 'lucide-react';
import { TimeConfig, ClassEntity, Student, Criteria, User, RoleConfig } from '../types';
import { parseCSVLine } from '../utils';

interface SettingsTabProps {
  currentUserRole: string;
  currentUser: User;
  setCurrentUser: (u: User) => void;
  academicYear: string;
  setAcademicYear: (y: string) => void;
  timeConfigs: TimeConfig[];
  setTimeConfigs: (tc: TimeConfig[]) => void;
  classes: ClassEntity[];
  setClasses: (c: ClassEntity[]) => void;
  students: Student[];
  setStudents: (s: Student[]) => void;
  criteria: Criteria[];
  setCriteria: (c: Criteria[]) => void;
  users: User[];
  setUsers: (u: User[]) => void;
  roleConfigs: Record<string, RoleConfig>;
  setRoleConfigs: (r: Record<string, RoleConfig>) => void;
  handleSaveSettings: () => void;
  unsavedChanges: boolean;
  setUnsavedChanges: (b: boolean) => void;
}

const SettingsTab: React.FC<SettingsTabProps> = (props) => {
  const { 
      academicYear, setAcademicYear, 
      timeConfigs, setTimeConfigs, 
      classes, setClasses, 
      students, setStudents, 
      criteria, setCriteria, 
      users, setUsers, 
      roleConfigs, setRoleConfigs,
      currentUser, setCurrentUser,
      setUnsavedChanges, handleSaveSettings, unsavedChanges 
  } = props;

  const [activeSubTab, setActiveSubTab] = useState<'ROLES' | 'TIME' | 'CLASSES' | 'STUDENTS' | 'CRITERIA_VIOLATION' | 'CRITERIA_ACHIEVEMENT' | 'ACCOUNTS'>('ROLES');
  
  // States
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState('10');
  const [newClassTeacher, setNewClassTeacher] = useState('');
  
  const [selectedClassForStudent, setSelectedClassForStudent] = useState(classes[0]?.id || '');
  const [newStudentName, setNewStudentName] = useState('');
  
  const [newCriteriaContent, setNewCriteriaContent] = useState('');
  const [newCriteriaPoints, setNewCriteriaPoints] = useState('');

  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<string>('RED_FLAG');
  const [newUserClass, setNewUserClass] = useState('');

  const [editingUser, setEditingUser] = useState<User | null>(null);

  // New Role States
  const [newRoleKey, setNewRoleKey] = useState('');
  const [newRoleLabel, setNewRoleLabel] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('gray');

  // New Time Config State
  const [newTimeType, setNewTimeType] = useState<'WEEK' | 'MONTH' | 'SEMESTER'>('WEEK');

  const csvClassInputRef = useRef<HTMLInputElement>(null);
  const csvStudentInputRef = useRef<HTMLInputElement>(null);
  const csvViolationInputRef = useRef<HTMLInputElement>(null);
  const csvAchievementInputRef = useRef<HTMLInputElement>(null);
  const csvAccountInputRef = useRef<HTMLInputElement>(null);

  const handleUpdateTimeConfig = (id: string, field: 'startDate' | 'endDate' | 'name' | 'type', value: string) => {
    setUnsavedChanges(true);
    setTimeConfigs(timeConfigs.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleAddClass = () => {
    if(!newClassName) return alert("Vui lòng nhập tên lớp");
    const newId = newClassName.replace(/\s/g, '');
    if(classes.find(c => c.id === newId)) return alert("Lớp này đã tồn tại");
    setClasses([...classes, { id: newId, name: newClassName, grade: parseInt(newClassGrade), homeroomTeacher: newClassTeacher || 'Chưa cập nhật' }]);
    setNewClassName(''); setNewClassTeacher(''); setUnsavedChanges(true);
  };

  const handleDeleteClass = (id: string) => {
     if(confirm("Xóa lớp sẽ xóa cả học sinh trong lớp. Tiếp tục?")) {
        setClasses(classes.filter(c => c.id !== id));
        setStudents(students.filter(s => s.classId !== id));
        setUnsavedChanges(true);
     }
  };

  const handleAddStudent = () => {
    if(!newStudentName || !selectedClassForStudent) return;
    const newId = `S${Date.now()}`;
    setStudents([...students, { id: newId, name: newStudentName, classId: selectedClassForStudent }]);
    setNewStudentName(''); setUnsavedChanges(true);
  };

  const handleDeleteStudent = (id: string) => {
    setStudents(students.filter(s => s.id !== id));
    setUnsavedChanges(true);
  };

  const handleAddCriteria = (type: 'MINUS' | 'PLUS') => {
    if (!newCriteriaContent || !newCriteriaPoints) return alert("Vui lòng nhập đầy đủ nội dung và điểm");
    const newId = `C${Date.now()}`;
    setCriteria([...criteria, { 
      id: newId, 
      content: newCriteriaContent, 
      points: parseFloat(newCriteriaPoints), 
      type: type 
    }]);
    setNewCriteriaContent('');
    setNewCriteriaPoints('');
    setUnsavedChanges(true);
  };

  const handleDeleteCriteria = (id: string) => {
    if(confirm("Bạn có chắc muốn xóa tiêu chí này không?")) {
      setCriteria(criteria.filter(c => c.id !== id));
      setUnsavedChanges(true);
    }
  };

  // --- Roles Logic ---
  const handleAddRole = () => {
    if (!newRoleKey || !newRoleLabel) return alert("Mã vai trò và Tên hiển thị không được trống");
    const key = newRoleKey.toUpperCase().replace(/\s/g, '_');
    if (roleConfigs[key]) return alert("Mã vai trò này đã tồn tại");

    setRoleConfigs({
      ...roleConfigs,
      [key]: {
        label: newRoleLabel,
        color: newRoleColor,
        canEntry: false,
        isAdmin: false
      }
    });
    setNewRoleKey('');
    setNewRoleLabel('');
    setUnsavedChanges(true);
  };

  const handleDeleteRole = (key: string) => {
    if (key === 'ADMIN' || key === 'GUEST') return alert("Không thể xóa vai trò mặc định");
    if (confirm(`Xóa vai trò ${key}? Các tài khoản đang dùng vai trò này sẽ bị lỗi quyền.`)) {
      const newConfigs = { ...roleConfigs };
      delete newConfigs[key];
      setRoleConfigs(newConfigs);
      setUnsavedChanges(true);
    }
  };

  const handleToggleRolePermission = (key: string, field: 'canEntry' | 'isAdmin') => {
      setRoleConfigs({
          ...roleConfigs,
          [key]: {
              ...roleConfigs[key],
              [field]: !roleConfigs[key][field]
          }
      });
      setUnsavedChanges(true);
  };

  // --- Users Logic ---
  const handleAddUser = () => {
    if (!newUserFullName || !newUserUsername || !newUserPassword) return alert("Vui lòng nhập đầy đủ thông tin bắt buộc");
    if (users.find(u => u.username === newUserUsername)) return alert("Tên đăng nhập/Email đã tồn tại");
    
    const newUser: User = {
        id: `U${Date.now()}`,
        name: newUserFullName,
        username: newUserUsername,
        password: newUserPassword,
        role: newUserRole,
        className: newUserClass || undefined
    };
    
    setUsers([...users, newUser]);
    setNewUserFullName('');
    setNewUserUsername('');
    setNewUserPassword('');
    setNewUserClass('');
    setUnsavedChanges(true);
  };

  const handleDeleteUser = (id: string) => {
      if(id === 'U1') return alert("Không thể xóa Admin mặc định");
      if(confirm("Xóa tài khoản này?")) {
          setUsers(users.filter(u => u.id !== id));
          setUnsavedChanges(true);
      }
  };

  const handleEditUserClick = (user: User) => {
      setEditingUser({ ...user });
  };

  const handleSaveUserEdit = () => {
      if (!editingUser) return;
      if (!editingUser.name || !editingUser.username) return alert("Tên và Username không được để trống");
      
      const originalUser = users.find(u => u.id === editingUser.id);
      if (originalUser?.username !== editingUser.username) {
          if (users.find(u => u.username === editingUser.username)) return alert("Username này đã tồn tại");
      }

      const updatedUser = editingUser;
      setUsers(users.map(u => u.id === editingUser.id ? updatedUser : u));
      
      if (currentUser.id === updatedUser.id) {
          setCurrentUser(updatedUser);
      }

      setEditingUser(null);
      setUnsavedChanges(true);
  };

  // --- CSV Handlers ---
  const processCSV = (e: React.ChangeEvent<HTMLInputElement>, callback: (rows: string[][]) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split(/\r\n|\n/);
        const rows: string[][] = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const parts = parseCSVLine(line);
            if (parts.length > 0) rows.push(parts);
        }
        callback(rows);
        e.target.value = ''; 
    };
    reader.readAsText(file);
  };

  const handleImportClassesCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    processCSV(e, (rows) => {
        const newClasses: ClassEntity[] = [];
        let count = 0;
        rows.forEach(row => {
            if (row.length >= 2) {
                const grade = parseInt(row[0]);
                const name = row[1];
                const teacher = row[2] || 'Chưa cập nhật';
                const id = name.replace(/\s/g, ''); 
                
                if (!classes.find(c => c.id === id) && !newClasses.find(c => c.id === id)) {
                   newClasses.push({ id, name, grade, homeroomTeacher: teacher });
                   count++;
                }
            }
        });
        if (count > 0) {
            setClasses([...classes, ...newClasses]);
            setUnsavedChanges(true);
            alert(`Đã thêm ${count} lớp mới. Vui lòng bấm LƯU để đồng bộ.`);
        } else {
            alert("Không tìm thấy lớp mới hoặc file lỗi format.");
        }
    });
  };

  const handleImportStudentsCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    processCSV(e, (rows) => {
        const newStudents: Student[] = [];
        let count = 0;
        let missingClassCount = 0;
        rows.forEach(row => {
            if (row.length >= 2) {
                const className = row[0];
                const studentName = row[1];
                const bikeNumber = row[2] || '';
                const cls = classes.find(c => c.name.toLowerCase() === className.toLowerCase() || c.id.toLowerCase() === className.toLowerCase());
                if (cls) {
                    newStudents.push({
                        id: `S_IMP_${Date.now()}_${Math.floor(Math.random()*1000)}`,
                        name: studentName,
                        classId: cls.id,
                        bikeNumber
                    });
                    count++;
                } else {
                    missingClassCount++;
                }
            }
        });
        if (count > 0) {
            setStudents([...students, ...newStudents]);
            setUnsavedChanges(true);
            alert(`Đã thêm ${count} học sinh.${missingClassCount > 0 ? `\nBỏ qua ${missingClassCount} học sinh do không tìm thấy lớp tương ứng.` : ''}\nVui lòng bấm LƯU.`);
        }
    });
  };

  const handleImportViolationCriteria = (e: React.ChangeEvent<HTMLInputElement>) => {
    processCSV(e, (rows) => {
        const newCriteria: Criteria[] = [];
        let count = 0;
        rows.forEach(row => {
             if (row.length >= 3) {
                 const content = row[1];
                 const points = parseFloat(row[2]);
                 if (!isNaN(points)) {
                     newCriteria.push({
                         id: `C_IMP_${Date.now()}_${Math.random()}`,
                         content: content,
                         points: Math.abs(points),
                         type: 'MINUS'
                     });
                     count++;
                 }
             }
        });
        if (count > 0) {
            setCriteria([...criteria, ...newCriteria]);
            setUnsavedChanges(true);
            alert(`Đã thêm ${count} tiêu chí vi phạm. Vui lòng bấm LƯU.`);
        }
    });
  };

  const handleImportAchievementCriteria = (e: React.ChangeEvent<HTMLInputElement>) => {
      processCSV(e, (rows) => {
        const newCriteria: Criteria[] = [];
        let count = 0;
        rows.forEach(row => {
             if (row.length >= 2) {
                 const content = row[0];
                 const points = parseFloat(row[1]);
                 if (!isNaN(points)) {
                     newCriteria.push({
                         id: `C_PLUS_IMP_${Date.now()}_${Math.random()}`,
                         content: content,
                         points: Math.abs(points),
                         type: 'PLUS'
                     });
                     count++;
                 }
             }
        });
        if (count > 0) {
            setCriteria([...criteria, ...newCriteria]);
            setUnsavedChanges(true);
            alert(`Đã thêm ${count} tiêu chí thành tích. Vui lòng bấm LƯU.`);
        }
    });
  };

  const handleImportAccountsCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
      processCSV(e, (rows) => {
          const newUsers: User[] = [];
          let count = 0;
          rows.forEach(row => {
              if (row.length >= 4) {
                  const name = row[0];
                  const username = row[1];
                  const password = row[2];
                  const classNameStr = row[3];
                  const roleStr = row[4] ? row[4].trim().toUpperCase().replace(/\s/g, '_') : 'GUEST';
                  if (!users.find(u => u.username === username) && !newUsers.find(u => u.username === username)) {
                      let role = roleConfigs[roleStr] ? roleStr : 'GUEST';
                      if (row[4]?.toLowerCase().includes('cờ đỏ')) role = 'RED_FLAG';
                      if (row[4]?.toLowerCase().includes('nền nếp')) role = 'DISCIPLINE';
                      if (row[4]?.toLowerCase().includes('giáo viên')) role = 'TEACHER';
                      if (row[4]?.toLowerCase().includes('admin')) role = 'ADMIN';
                      const cls = classes.find(c => c.name === classNameStr || c.id === classNameStr);
                      newUsers.push({
                          id: `U_IMP_${Date.now()}_${Math.random()}`,
                          name,
                          username,
                          password,
                          role,
                          className: cls?.id
                      });
                      count++;
                  }
              }
          });
          if (count > 0) {
              setUsers([...users, ...newUsers]);
              setUnsavedChanges(true);
              alert(`Đã thêm ${count} tài khoản. Vui lòng bấm LƯU.`);
          }
      });
  };


  const renderEditUserModal = () => {
      if (!editingUser) return null;
      return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
                  <div className="bg-slate-50 p-4 border-b flex justify-between items-center">
                      <h3 className="font-bold text-lg text-slate-800">Chỉnh sửa tài khoản</h3>
                      <button onClick={() => setEditingUser(null)} className="p-1 rounded-full hover:bg-slate-200 text-slate-500"><X size={20}/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Họ tên</label>
                          <input className="w-full p-2 border rounded-lg" value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Username / Email</label>
                          <input className="w-full p-2 border rounded-lg bg-slate-50" value={editingUser.username} onChange={e => setEditingUser({...editingUser, username: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mật khẩu mới (Để trống nếu không đổi)</label>
                          <input className="w-full p-2 border rounded-lg" type="password" placeholder="******" onChange={e => { if(e.target.value) setEditingUser({...editingUser, password: e.target.value}) }} />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vai trò & Màu sắc</label>
                          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                             {Object.entries(roleConfigs).map(([key, config]) => (
                                 <button 
                                    key={key} 
                                    onClick={() => setEditingUser({...editingUser, role: key as string})}
                                    className={`p-2 rounded-lg border text-sm flex items-center justify-between transition-all ${editingUser.role === key ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200 hover:border-blue-300'}`}
                                 >
                                    <span className="flex items-center gap-2">
                                        <span className={`w-3 h-3 rounded-full bg-${config.color}-500 shadow-sm`}></span>
                                        {config.label}
                                    </span>
                                    {editingUser.role === key && <Check size={14} className="text-blue-600"/>}
                                 </button>
                             ))}
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phụ trách Lớp (Tùy chọn)</label>
                          <select className="w-full p-2 border rounded-lg bg-white" value={editingUser.className || ''} onChange={e => setEditingUser({...editingUser, className: e.target.value})}>
                              <option value="">-- Không phụ trách --</option>
                              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                      </div>
                  </div>
                  <div className="bg-slate-50 p-4 border-t flex justify-end gap-2">
                      <button onClick={() => setEditingUser(null)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg">Hủy</button>
                      <button onClick={handleSaveUserEdit} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 flex items-center gap-2">
                          <Save size={18} /> Lưu thông tin
                      </button>
                  </div>
              </div>
          </div>
      );
  };

  const renderSubTabs = () => (
    <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 mb-6 overflow-x-auto no-scrollbar">
        {[
            { id: 'ROLES', label: 'Vai trò', icon: <Shield size={16}/> },
            { id: 'TIME', label: 'Thời gian', icon: <Calendar size={16}/> },
            { id: 'CLASSES', label: 'Lớp học', icon: <GraduationCap size={16}/> },
            { id: 'STUDENTS', label: 'Học sinh', icon: <Users size={16}/> },
            { id: 'CRITERIA_VIOLATION', label: 'Vi phạm', icon: <AlertTriangle size={16}/> },
            { id: 'CRITERIA_ACHIEVEMENT', label: 'Thành tích', icon: <Star size={16}/> },
            { id: 'ACCOUNTS', label: 'Tài khoản', icon: <UserPlus size={16}/> },
        ].map(tab => (
            <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap transition-all ${activeSubTab === tab.id ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                {tab.icon} <span className="hidden sm:inline">{tab.label}</span>
            </button>
        ))}
    </div>
  );

  return (
    <div className="space-y-6 pb-24 relative">
      {renderSubTabs()}

      {unsavedChanges && (
        <div className="fixed bottom-24 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in">
           <button onClick={handleSaveSettings} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full shadow-xl flex items-center gap-2 active:scale-95 transition-all">
              <Save size={20} /> Lưu Thay Đổi
           </button>
        </div>
      )}

      {/* ROLES TAB */}
      {activeSubTab === 'ROLES' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
             <h3 className="font-bold text-lg mb-4 text-slate-800">Quản lý Vai trò</h3>
             
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                 {Object.entries(roleConfigs).map(([key, config]) => (
                     <div key={key} className="border p-3 rounded-lg flex flex-col gap-2 relative group hover:border-blue-300 bg-slate-50/50">
                         {key !== 'ADMIN' && key !== 'GUEST' && (
                             <button onClick={() => handleDeleteRole(key)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                         )}
                         <div className="flex items-center gap-2">
                             <div className={`w-4 h-4 rounded-full bg-${config.color}-500 shadow-sm`}></div>
                             <div>
                                 <div className="font-bold text-sm text-slate-800">{config.label}</div>
                                 <div className="text-[10px] text-slate-500 font-mono">{key}</div>
                             </div>
                         </div>
                         <div className="flex gap-2 mt-1">
                             <button 
                                onClick={() => handleToggleRolePermission(key, 'canEntry')}
                                className={`flex-1 text-xs py-1 rounded border ${config.canEntry ? 'bg-green-100 border-green-200 text-green-700 font-bold' : 'bg-white border-slate-200 text-slate-500'}`}
                             >
                                {config.canEntry ? 'Được chấm' : 'Không chấm'}
                             </button>
                             <button 
                                onClick={() => handleToggleRolePermission(key, 'isAdmin')}
                                className={`flex-1 text-xs py-1 rounded border ${config.isAdmin ? 'bg-blue-100 border-blue-200 text-blue-700 font-bold' : 'bg-white border-slate-200 text-slate-500'}`}
                             >
                                {config.isAdmin ? 'Là Admin' : 'Không Admin'}
                             </button>
                         </div>
                     </div>
                 ))}
             </div>

             <div className="border-t pt-4">
                 <h4 className="text-sm font-bold text-slate-700 mb-2">Thêm vai trò mới</h4>
                 <div className="flex flex-col sm:flex-row gap-2">
                     <input className="flex-1 p-2 border rounded text-sm uppercase" placeholder="Mã (VD: VE_SINH)" value={newRoleKey} onChange={e => setNewRoleKey(e.target.value)} />
                     <input className="flex-[2] p-2 border rounded text-sm" placeholder="Tên hiển thị (VD: Ban Vệ Sinh)" value={newRoleLabel} onChange={e => setNewRoleLabel(e.target.value)} />
                     <select className="p-2 border rounded text-sm" value={newRoleColor} onChange={e => setNewRoleColor(e.target.value)}>
                         <option value="gray">Xám</option>
                         <option value="red">Đỏ</option>
                         <option value="blue">Xanh dương</option>
                         <option value="green">Xanh lá</option>
                         <option value="purple">Tím</option>
                         <option value="orange">Cam</option>
                         <option value="indigo">Chàm</option>
                     </select>
                     <button onClick={handleAddRole} className="bg-blue-600 text-white px-4 rounded font-bold text-sm flex items-center justify-center gap-1"><Plus size={16}/> Thêm</button>
                 </div>
             </div>
          </div>
      )}

      {/* TIME TAB */}
      {activeSubTab === 'TIME' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2">
                <h3 className="font-bold text-lg text-slate-800">Quản lý Thời gian (Tuần/Tháng/Kỳ)</h3>
                <div className="flex gap-2">
                    <select className="border border-slate-300 rounded-lg p-1.5 text-sm outline-none" value={newTimeType} onChange={(e) => setNewTimeType(e.target.value as any)}>
                        <option value="WEEK">Thêm Tuần</option>
                        <option value="MONTH">Thêm Tháng</option>
                        <option value="SEMESTER">Thêm Học Kỳ</option>
                    </select>
                    <button onClick={() => { 
                        const newId = `${newTimeType.charAt(0)}${Date.now()}`;
                        const name = newTimeType === 'WEEK' ? 'Tuần Mới' : (newTimeType === 'MONTH' ? 'Tháng Mới' : 'Học Kỳ Mới');
                        setTimeConfigs([...timeConfigs, { id: newId, name: name, type: newTimeType, startDate: new Date().toISOString().slice(0, 10), endDate: new Date().toISOString().slice(0, 10) }]);
                        setUnsavedChanges(true);
                    }} className="bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded-lg transition-colors flex items-center gap-1 text-sm px-3 font-bold">
                        <PlusCircle size={16} /> Thêm
                    </button>
                </div>
            </div>
            
            <div className="space-y-4">
                {/* Group by Types */}
                {['WEEK', 'MONTH', 'SEMESTER'].map(type => {
                    const configs = timeConfigs.filter(c => c.type === type);
                    if (configs.length === 0) return null;
                    return (
                        <div key={type}>
                             <div className="text-xs font-bold text-slate-500 uppercase mb-2 border-b border-slate-100 pb-1">
                                {type === 'WEEK' ? 'Danh sách Tuần' : (type === 'MONTH' ? 'Danh sách Tháng' : 'Danh sách Học Kỳ')}
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {configs.map((config) => (
                                    <div key={config.id} className="bg-slate-50 p-3 rounded-lg border border-slate-200 relative group hover:border-blue-300 transition-colors">
                                        <div className="absolute top-2 right-2">
                                            <button onClick={() => { if(confirm("Xóa mốc thời gian này?")) { setTimeConfigs(timeConfigs.filter(c => c.id !== config.id)); setUnsavedChanges(true); }}} className="text-slate-400 hover:text-red-500 transition-colors p-1">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                        <div className="mb-2 pr-6">
                                            <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Tên hiển thị</label>
                                            <input type="text" className="w-full text-sm font-bold bg-transparent border-b border-transparent focus:border-blue-500 outline-none pb-0.5 text-slate-800" value={config.name} onChange={(e) => handleUpdateTimeConfig(config.id, 'name', e.target.value)} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Bắt đầu</label>
                                                <input type="date" className="w-full text-xs p-1.5 rounded border border-slate-300 bg-white" value={config.startDate} onChange={(e) => handleUpdateTimeConfig(config.id, 'startDate', e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Kết thúc</label>
                                                <input type="date" className="w-full text-xs p-1.5 rounded border border-slate-300 bg-white" value={config.endDate} onChange={(e) => handleUpdateTimeConfig(config.id, 'endDate', e.target.value)} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                             </div>
                        </div>
                    );
                })}
            </div>
          </div>
      )}

      {/* CLASSES TAB */}
      {activeSubTab === 'CLASSES' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
             <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-slate-800">Danh sách Lớp học</h3>
                <div>
                    <input type="file" ref={csvClassInputRef} onChange={handleImportClassesCSV} accept=".csv" className="hidden" />
                    <button onClick={() => csvClassInputRef.current?.click()} className="flex items-center gap-1 text-sm bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200 font-bold border border-green-200">
                        <Upload size={16} /> Import CSV
                    </button>
                </div>
             </div>
             
             <div className="bg-blue-50 p-2 rounded text-xs text-blue-800 mb-4 border border-blue-100">
                <strong>Format CSV Lớp:</strong> Khoi_lop, Ten_lop, Ten_GVCN
             </div>

             <div className="flex flex-col sm:flex-row gap-2 bg-slate-100 p-3 rounded-lg border border-slate-200 mb-4">
               <input className="flex-1 p-2 rounded border border-slate-300 text-sm outline-none" placeholder="Tên lớp (VD: 10A5)" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} />
               <select className="p-2 rounded border border-slate-300 text-sm outline-none bg-white" value={newClassGrade} onChange={(e) => setNewClassGrade(e.target.value)}>
                 <option value="10">Khối 10</option>
                 <option value="11">Khối 11</option>
                 <option value="12">Khối 12</option>
               </select>
               <input className="flex-1 p-2 rounded border border-slate-300 text-sm outline-none" placeholder="GVCN (Tùy chọn)" value={newClassTeacher} onChange={(e) => setNewClassTeacher(e.target.value)} />
               <button onClick={handleAddClass} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded text-sm flex items-center justify-center gap-1">
                 <Plus size={16} /> Thêm
               </button>
             </div>

             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
               {classes.map(c => (
                 <div key={c.id} className="bg-white border border-slate-200 p-3 rounded-lg relative group hover:shadow-md transition-shadow">
                    <button onClick={() => handleDeleteClass(c.id)} className="absolute top-1 right-1 text-slate-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-all">
                       <X size={14} />
                    </button>
                    <div className="font-bold text-slate-800 text-center text-lg">{c.name}</div>
                    <div className="text-xs text-slate-500 text-center truncate">{c.homeroomTeacher}</div>
                 </div>
               ))}
             </div>
          </div>
      )}

      {/* STUDENTS TAB */}
      {activeSubTab === 'STUDENTS' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
             <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-slate-800">Quản lý Học sinh</h3>
                <div>
                     <input type="file" ref={csvStudentInputRef} onChange={handleImportStudentsCSV} accept=".csv" className="hidden" />
                     <button onClick={() => csvStudentInputRef.current?.click()} className="flex items-center gap-1 text-sm bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200 font-bold border border-green-200">
                         <Upload size={16} /> Import CSV
                     </button>
                 </div>
             </div>

             <div className="bg-blue-50 p-2 rounded text-xs text-blue-800 mb-4 border border-blue-100">
                <strong>Format CSV Học sinh:</strong> Ten_lop, Ho_ten_HS, So_xe
             </div>
             
             <div className="flex flex-col gap-4 mb-4">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-700">Xem lớp:</span>
                    <select 
                        className="p-2 border border-slate-300 rounded-lg text-sm bg-white"
                        value={selectedClassForStudent}
                        onChange={(e) => setSelectedClassForStudent(e.target.value)}
                    >
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                <div className="flex gap-2">
                    <input 
                        className="flex-1 p-2 border border-slate-300 rounded-lg text-sm"
                        placeholder="Thêm thủ công tên học sinh..."
                        value={newStudentName}
                        onChange={(e) => setNewStudentName(e.target.value)}
                    />
                    <button onClick={handleAddStudent} className="bg-blue-600 text-white px-4 rounded-lg font-bold text-sm">Thêm</button>
                </div>
             </div>

             <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0">
                        <tr>
                            <th className="px-4 py-3">ID</th>
                            <th className="px-4 py-3">Họ và tên</th>
                            <th className="px-4 py-3 text-right">Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.filter(s => s.classId === selectedClassForStudent).map(s => (
                            <tr key={s.id} className="border-b last:border-0 hover:bg-slate-50">
                                <td className="px-4 py-3 font-medium text-slate-400 text-xs">{s.id}</td>
                                <td className="px-4 py-3 font-medium text-slate-700">{s.name}</td>
                                <td className="px-4 py-3 text-right">
                                    <button onClick={() => handleDeleteStudent(s.id)} className="text-red-500 hover:text-red-700">
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
          </div>
      )}

      {/* CRITERIA VIOLATION TAB */}
      {activeSubTab === 'CRITERIA_VIOLATION' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
             <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-slate-800">Cấu hình Vi Phạm</h3>
                <div>
                     <input type="file" ref={csvViolationInputRef} onChange={handleImportViolationCriteria} accept=".csv" className="hidden" />
                     <button onClick={() => csvViolationInputRef.current?.click()} className="flex items-center gap-1 text-sm bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200 font-bold border border-green-200">
                         <Upload size={16} /> Import CSV
                     </button>
                 </div>
             </div>

             <div className="bg-red-50 p-2 rounded text-xs text-red-800 mb-4 border border-red-100">
                <strong>Format CSV:</strong> Hang_muc (Cá nhân/Tập thể), Loai_loi, Diem_tru <br/>
                <em>VD: Cá nhân, Đi học muộn, 5</em>
             </div>

             <div className="flex gap-2 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <input 
                   className="flex-[2] p-2 border border-slate-300 rounded text-sm" 
                   placeholder="Tên lỗi vi phạm..."
                   value={newCriteriaContent}
                   onChange={e => setNewCriteriaContent(e.target.value)}
                />
                <input 
                   className="flex-1 p-2 border border-slate-300 rounded text-sm" 
                   placeholder="Điểm trừ" 
                   type="number"
                   value={newCriteriaPoints}
                   onChange={e => setNewCriteriaPoints(e.target.value)}
                />
                <button onClick={() => handleAddCriteria('MINUS')} className="bg-blue-600 text-white px-4 rounded font-bold text-sm">Thêm</button>
             </div>

             <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm text-left">
                   <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold sticky top-0">
                      <tr>
                         <th className="px-4 py-3">Nội dung</th>
                         <th className="px-4 py-3 w-24 text-right">Điểm trừ</th>
                         <th className="px-4 py-3 w-16 text-right">Xóa</th>
                      </tr>
                   </thead>
                   <tbody>
                      {criteria.filter(c => c.type === 'MINUS').map(c => (
                         <tr key={c.id} className="border-b last:border-0 hover:bg-slate-50">
                            <td className="px-4 py-3 text-slate-700 font-medium">{c.content}</td>
                            <td className="px-4 py-3 text-right text-red-600 font-bold">-{c.points}</td>
                            <td className="px-4 py-3 text-right">
                               <button onClick={() => handleDeleteCriteria(c.id)} className="text-slate-400 hover:text-red-600"><Trash2 size={16}/></button>
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
      )}

      {/* CRITERIA ACHIEVEMENT TAB */}
      {activeSubTab === 'CRITERIA_ACHIEVEMENT' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
             <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-slate-800">Cấu hình Thành Tích</h3>
                <div>
                     <input type="file" ref={csvAchievementInputRef} onChange={handleImportAchievementCriteria} accept=".csv" className="hidden" />
                     <button onClick={() => csvAchievementInputRef.current?.click()} className="flex items-center gap-1 text-sm bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200 font-bold border border-green-200">
                         <Upload size={16} /> Import CSV
                     </button>
                 </div>
             </div>

             <div className="bg-green-50 p-2 rounded text-xs text-green-800 mb-4 border border-green-100">
                <strong>Format CSV:</strong> Noi_dung, Diem_cong <br/>
                <em>VD: Nhặt được của rơi, 20</em>
             </div>

             <div className="flex gap-2 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <input 
                   className="flex-[2] p-2 border border-slate-300 rounded text-sm" 
                   placeholder="Tên thành tích..."
                   value={newCriteriaContent}
                   onChange={e => setNewCriteriaContent(e.target.value)}
                />
                <input 
                   className="flex-1 p-2 border border-slate-300 rounded text-sm" 
                   placeholder="Điểm cộng" 
                   type="number"
                   value={newCriteriaPoints}
                   onChange={e => setNewCriteriaPoints(e.target.value)}
                />
                <button onClick={() => handleAddCriteria('PLUS')} className="bg-blue-600 text-white px-4 rounded font-bold text-sm">Thêm</button>
             </div>

             <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm text-left">
                   <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold sticky top-0">
                      <tr>
                         <th className="px-4 py-3">Nội dung</th>
                         <th className="px-4 py-3 w-24 text-right">Điểm cộng</th>
                         <th className="px-4 py-3 w-16 text-right">Xóa</th>
                      </tr>
                   </thead>
                   <tbody>
                      {criteria.filter(c => c.type === 'PLUS').map(c => (
                         <tr key={c.id} className="border-b last:border-0 hover:bg-slate-50">
                            <td className="px-4 py-3 text-slate-700 font-medium">{c.content}</td>
                            <td className="px-4 py-3 text-right text-green-600 font-bold">+{c.points}</td>
                            <td className="px-4 py-3 text-right">
                               <button onClick={() => handleDeleteCriteria(c.id)} className="text-slate-400 hover:text-red-600"><Trash2 size={16}/></button>
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
      )}

      {/* ACCOUNTS TAB */}
      {activeSubTab === 'ACCOUNTS' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
             <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-slate-800">Quản lý Tài khoản</h3>
                <div>
                     <input type="file" ref={csvAccountInputRef} onChange={handleImportAccountsCSV} accept=".csv" className="hidden" />
                     <button onClick={() => csvAccountInputRef.current?.click()} className="flex items-center gap-1 text-sm bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200 font-bold border border-green-200">
                         <Upload size={16} /> Import CSV
                     </button>
                 </div>
             </div>

             <div className="bg-indigo-50 p-2 rounded text-xs text-indigo-800 mb-4 border border-indigo-100">
                <strong>Format CSV Tài khoản:</strong> Ho_ten, Username, Password, Lop, Role <br/>
                <em>VD: Nguyen Van A, admin, 123456, 10A1, ADMIN</em><br/>
             </div>

             <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                 <input className="p-2 border rounded text-sm" placeholder="Họ tên" value={newUserFullName} onChange={e=>setNewUserFullName(e.target.value)} />
                 <input className="p-2 border rounded text-sm" placeholder="Username/Email" value={newUserUsername} onChange={e=>setNewUserUsername(e.target.value)} />
                 <input className="p-2 border rounded text-sm" type="password" placeholder="Mật khẩu" value={newUserPassword} onChange={e=>setNewUserPassword(e.target.value)} />
                 <select className="p-2 border rounded text-sm bg-white" value={newUserRole} onChange={e=>setNewUserRole(e.target.value)}>
                     {Object.entries(roleConfigs).map(([key, config]) => (
                         <option key={key} value={key}>{config.label}</option>
                     ))}
                 </select>
                 <div className="flex gap-2">
                    <select className="flex-1 p-2 border rounded text-sm bg-white" value={newUserClass} onChange={e=>setNewUserClass(e.target.value)}>
                        <option value="">- Chọn Lớp -</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button onClick={handleAddUser} className="bg-blue-600 text-white px-3 rounded font-bold"><Plus size={18}/></button>
                 </div>
             </div>

             <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold sticky top-0">
                        <tr>
                            <th className="px-4 py-3">Họ tên</th>
                            <th className="px-4 py-3">Username</th>
                            <th className="px-4 py-3">Vai trò</th>
                            <th className="px-4 py-3">Lớp</th>
                            <th className="px-4 py-3 text-right">Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => {
                            const config = roleConfigs[u.role] || roleConfigs['GUEST'] || { color: 'gray', label: u.role };
                            return (
                                <tr key={u.id} className="border-b last:border-0 hover:bg-slate-50">
                                    <td className="px-4 py-3 font-medium text-slate-700">{u.name} {u.id === 'U1' && <span className="text-[10px] bg-blue-100 text-blue-600 px-1 rounded ml-1">DEFAULT</span>}</td>
                                    <td className="px-4 py-3 text-slate-500">{u.username}</td>
                                    <td className="px-4 py-3">
                                        <span className={`text-[10px] px-2 py-1 rounded font-bold bg-${config.color}-100 text-${config.color}-700`}>
                                            {config.label}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-500">{u.className || '-'}</td>
                                    <td className="px-4 py-3 text-right flex justify-end gap-2">
                                        <button onClick={() => handleEditUserClick(u)} className="text-slate-400 hover:text-blue-600"><Edit size={16}/></button>
                                        {u.id !== 'U1' && <button onClick={() => handleDeleteUser(u.id)} className="text-slate-400 hover:text-red-600"><Trash2 size={16}/></button>}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
             </div>
          </div>
      )}
      
      {renderEditUserModal()}
    </div>
  );
};

export default SettingsTab;
