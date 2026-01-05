
import React, { useState, useMemo } from 'react';
import { Award, TrendingUp, ThumbsDown, ThumbsUp, AlertCircle, Link2, Users } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { User, ClassEntity, Violation, Student, Criteria } from '../types';
import { calculateScore, getWeekNumber, safeParseImages, formatDateDisplay, getYearWeekKey, getUniqueWeeksCount, getEarliestViolationDate, getLatestViolationDate } from '../utils';

interface ClassDetailTabProps {
  currentUser: User;
  classes: ClassEntity[];
  violations: Violation[];
  criteria: Criteria[];
  students: Student[];
  setViewingViolation: (v: Violation | null) => void;
}

const ClassDetailTab: React.FC<ClassDetailTabProps> = ({ currentUser, classes, violations, criteria, students, setViewingViolation }) => {
  const [selectedClassId, setSelectedClassId] = useState('');

  const isRestrictedUser = (currentUser.role === 'TEACHER' || currentUser.role === 'RED_FLAG' || currentUser.role === 'DISCIPLINE') && currentUser.className;
  
  const targetClassId = isRestrictedUser 
      ? currentUser.className 
      : (selectedClassId || classes[0]?.id || '');

  const cls = classes.find(c => c.id === targetClassId);

  // 1. FILTER VIOLATIONS: Get ALL violations for this class, NO DATE RESTRICTION.
  // This satisfies "lấy toàn bộ dữ liệu từ database".
  const clsViolations = useMemo(() => {
     if (!targetClassId) return [];
     return violations
        .filter(v => v.classId === targetClassId)
        .sort((a,b) => b.timestamp - a.timestamp);
  }, [violations, targetClassId]);

  // 2. DYNAMIC TIMELINE FOR CHART & RANKING
  // Calculate total timeline based on ALL violations in the system to ensure correct average
  const { allWeeksKeys, totalWeeksCount } = useMemo(() => {
      // Find range of all data in system
      const minDate = getEarliestViolationDate(violations);
      const maxDate = getLatestViolationDate(violations);
      
      const weeksCount = getUniqueWeeksCount(minDate, maxDate);

      // Keys for Chart
      const keys: string[] = [];
      const current = new Date(minDate);
      const day = current.getDay() || 7; 
      current.setDate(current.getDate() - day + 1); // Monday
      const endDate = new Date(maxDate);
      
      while (current <= endDate || getYearWeekKey(current) === getYearWeekKey(endDate)) {
          keys.push(getYearWeekKey(new Date(current)));
          current.setDate(current.getDate() + 7);
      }

      return { allWeeksKeys: keys, totalWeeksCount: weeksCount };
  }, [violations]);

  if (!cls) {
      return (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <AlertCircle size={48} className="mb-2 opacity-50"/>
              <p>Chưa có dữ liệu lớp học.</p>
          </div>
      );
  }

  // 3. RANKING LOGIC (GLOBAL / ALL TIME)
  // Calculate ranking based on ALL data
  const gradeClasses = classes.filter(c => c.grade === cls.grade);
  const gradeRankings = gradeClasses.map(c => {
      // Get all violations for class c
      const cViolations = violations.filter(v => v.classId === c.id);
      const score = calculateScore(cViolations, 500, totalWeeksCount, true);
      return { id: c.id, avgScore: score };
  }).sort((a, b) => b.avgScore - a.avgScore);

  const myRank = gradeRankings.findIndex(r => r.id === targetClassId) + 1;
  const myStats = gradeRankings.find(r => r.id === targetClassId);
  
  const minusViolations = clsViolations.filter(v => v.points > 0);
  const plusViolations = clsViolations.filter(v => v.points < 0);

  // 4. STUDENT STATISTICS (STRICT MATCHING)
  // Fix "Lẫn học sinh": Only iterate students who are strictly in this class.
  const studentViolationStats = useMemo(() => {
      // 1. Get List of Students officially in this class
      const classStudents = students.filter(s => s.classId === targetClassId);
      
      // 2. Map data - Strictly check studentId matches
      const stats = classStudents.map(s => {
          // Count only violations that reference this specific student ID
          const studentMinus = minusViolations.filter(v => v.studentId === s.id);
          const totalMinusPoints = studentMinus.reduce((acc, v) => acc + v.points, 0);
          return {
              student: s,
              count: studentMinus.length,
              totalPoints: totalMinusPoints
          };
      });

      // 3. Filter only those with violations
      return stats.filter(s => s.count > 0).sort((a, b) => b.count - a.count);
  }, [students, targetClassId, minusViolations]);

  // 5. CHART DATA
  const chartData = useMemo(() => {
    return allWeeksKeys.map(weekKey => {
        const weekNum = parseInt(weekKey.split('-W')[1]);
        const violationsInWeek = clsViolations.filter(v => getYearWeekKey(new Date(v.date)) === weekKey);
        // Single week score (weeksCount = 1)
        const score = calculateScore(violationsInWeek, 500, 1, false);

        return {
            name: `T${weekNum}`,
            fullLabel: `Tuần ${weekNum}`,
            score: score,
            key: weekKey
        };
    });
  }, [allWeeksKeys, clsViolations]);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
         {!isRestrictedUser ? (
           <select className="bg-white border border-blue-200 text-blue-900 font-bold rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px]" value={targetClassId} onChange={(e) => setSelectedClassId(e.target.value)}>
             {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
           </select>
         ) : (
           <h2 className="text-xl font-bold text-blue-900">Lớp: {cls.name}</h2>
         )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl shadow-sm p-4 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-20"><Award size={64} /></div>
           <div className="relative z-10">
             <div className="text-blue-100 text-xs font-bold uppercase mb-1">Thứ hạng (Khối {cls.grade})</div>
             <div className="text-4xl font-black flex items-end gap-2">#{myRank}<span className="text-base font-normal text-blue-200 mb-1">/ {gradeClasses.length}</span></div>
             <div className="text-[10px] text-blue-200 mt-1">Tính theo ĐTB toàn bộ dữ liệu</div>
           </div>
        </div>
        
        <div className="bg-white border-l-4 border-l-green-500 rounded-xl shadow-sm p-4">
           <div className="text-slate-500 text-xs font-bold uppercase mb-1 flex items-center gap-1"><TrendingUp size={14} /> Điểm TB (Tổng)</div>
           <div className="text-3xl font-black text-slate-800">{myStats?.avgScore?.toFixed(2)}</div>
           <div className="text-xs text-slate-400 mt-1">Trên tổng {totalWeeksCount} tuần dữ liệu</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
         <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700 bg-slate-50/50 -mx-4 -mt-4 mb-4">Biểu đồ biến động điểm số</div>
         <div className="h-60 w-full text-xs">
           <ResponsiveContainer width="100%" height="100%">
             <LineChart data={chartData}>
               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
               <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} interval="preserveStartEnd" minTickGap={20} />
               <YAxis domain={[0, 520]} hide />
               <Tooltip 
                 labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                 itemStyle={{ color: '#3b82f6' }}
                 formatter={(value: number) => [value, 'Điểm']}
                 labelFormatter={(label, payload) => {
                     if (payload && payload.length > 0) {
                         return payload[0].payload.fullLabel || label;
                     }
                     return label;
                 }}
                 contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} 
               />
               <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={3} dot={{r: 3, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
             </LineChart>
           </ResponsiveContainer>
         </div>
      </div>
      
      {/* THỐNG KÊ HỌC SINH VI PHẠM */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
         <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold border-b border-slate-100 pb-2">
             <Users size={20} className="text-red-500"/> 
             <h3>Học sinh vi phạm nhiều (Dành cho GVCN)</h3>
         </div>
         {studentViolationStats.length > 0 ? (
             <div className="max-h-60 overflow-y-auto pr-1">
                 <table className="w-full text-sm">
                     <thead className="bg-slate-50 text-xs text-slate-500 font-bold uppercase sticky top-0">
                         <tr>
                             <th className="px-2 py-2 text-left">Học sinh</th>
                             <th className="px-2 py-2 text-center">Số lượt</th>
                             <th className="px-2 py-2 text-right">Tổng trừ</th>
                         </tr>
                     </thead>
                     <tbody>
                         {studentViolationStats.map((stat, idx) => (
                             <tr key={stat.student.id} className="border-b last:border-0 hover:bg-slate-50">
                                 <td className="px-2 py-2 font-medium text-slate-700">
                                     <div className="flex items-center gap-2">
                                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${idx < 3 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>{idx + 1}</span>
                                        {stat.student.name}
                                     </div>
                                 </td>
                                 <td className="px-2 py-2 text-center font-bold text-slate-600">{stat.count}</td>
                                 <td className="px-2 py-2 text-right font-bold text-red-600">-{stat.totalPoints}</td>
                             </tr>
                         ))}
                     </tbody>
                 </table>
             </div>
         ) : (
             <div className="text-center py-6 text-slate-400 italic text-sm">Chưa có học sinh nào bị ghi nhận lỗi vi phạm.</div>
         )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <div className="space-y-3">
            <div className="flex items-center gap-2 text-red-700 font-bold uppercase text-sm border-b border-red-200 pb-2"><ThumbsDown size={18} /> Lịch sử Vi Phạm</div>
            <div className="space-y-2">
              {minusViolations.length > 0 ? minusViolations.map(v => {
                  const images = safeParseImages(v.images);
                  return (
                    <div 
                        key={v.id} 
                        onClick={() => setViewingViolation(v)}
                        className="bg-white p-3 rounded-lg border border-red-100 shadow-sm flex flex-col items-start gap-2 cursor-pointer hover:bg-red-50 hover:border-red-200 transition-colors"
                    >
                      <div className="w-full flex justify-between items-start">
                        <div>
                           <div className="font-medium text-slate-800 text-sm">{criteria.find(c => c.id === v.criteriaId)?.content}</div>
                           <div className="text-xs text-slate-500 mt-1">{formatDateDisplay(v.date)} • {v.studentId ? students.find(s=>s.id===v.studentId)?.name : 'Tập thể'}</div>
                        </div>
                        <div className="font-bold text-red-600">-{v.points}</div>
                      </div>
                      
                      {images.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-1">
                              {images.map((img, idx) => (
                                   <a 
                                      key={idx} 
                                      href={img} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()} 
                                      className="flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded border border-blue-200 transition-colors"
                                  >
                                      <Link2 size={12} /> 
                                      <span>Ảnh {images.length > 1 ? idx + 1 : ''}</span>
                                  </a>
                              ))}
                          </div>
                      )}
                    </div>
                  );
              }) : <div className="text-center py-8 text-slate-400 text-sm bg-slate-50 rounded-lg border border-dashed border-slate-200">Không có vi phạm nào</div>}
            </div>
         </div>

         <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-700 font-bold uppercase text-sm border-b border-green-200 pb-2"><ThumbsUp size={18} /> Lịch sử Thành Tích</div>
            <div className="space-y-2">
              {plusViolations.length > 0 ? plusViolations.map(v => {
                  const images = safeParseImages(v.images);
                  return (
                    <div 
                        key={v.id} 
                        onClick={() => setViewingViolation(v)}
                        className="bg-white p-3 rounded-lg border border-green-100 shadow-sm flex flex-col items-start gap-2 cursor-pointer hover:bg-green-50 hover:border-green-200 transition-colors"
                    >
                      <div className="w-full flex justify-between items-start">
                        <div>
                           <div className="font-medium text-slate-800 text-sm">{criteria.find(c => c.id === v.criteriaId)?.content}</div>
                           <div className="text-xs text-slate-500 mt-1">{formatDateDisplay(v.date)} • {v.studentId ? students.find(s=>s.id===v.studentId)?.name : 'Tập thể'}</div>
                        </div>
                        <div className="font-bold text-green-600">+{Math.abs(v.points)}</div>
                      </div>
                      
                      {images.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-1">
                              {images.map((img, idx) => (
                                   <a 
                                      key={idx} 
                                      href={img} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()} 
                                      className="flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded border border-blue-200 transition-colors"
                                  >
                                      <Link2 size={12} /> 
                                      <span>Ảnh {images.length > 1 ? idx + 1 : ''}</span>
                                  </a>
                              ))}
                          </div>
                      )}
                    </div>
                  );
              }) : <div className="text-center py-8 text-slate-400 text-sm bg-slate-50 rounded-lg border border-dashed border-slate-200">Chưa có thành tích nào</div>}
            </div>
         </div>
      </div>
    </div>
  );
};

export default ClassDetailTab;
