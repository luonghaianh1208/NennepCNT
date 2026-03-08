
import React, { useState, useMemo } from 'react';
import { Award, TrendingUp, ThumbsDown, ThumbsUp, AlertCircle, Link2, Users, Download } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Violation } from '../types';
import { calculateScore, safeParseImages, formatDateDisplay, getUniqueWeeksCount, getEarliestViolationDate, getLatestViolationDate, isDateInRange, getYearWeekKey, exportToExcel } from '../utils';
import { useAppStore } from '../contexts/AppContext';

interface ClassDetailTabProps {
  setViewingViolation: (v: Violation | null) => void;
}

const ClassDetailTab: React.FC<ClassDetailTabProps> = ({ setViewingViolation }) => {
  const { currentUser, classes, violations, criteria, students, timeConfigs } = useAppStore();

  const [selectedClassId, setSelectedClassId] = useState('');

  const isRestrictedUser = (currentUser.role === 'TEACHER' || currentUser.role === 'RED_FLAG' || currentUser.role === 'DISCIPLINE') && currentUser.className;
  
  const targetClassId = isRestrictedUser 
      ? currentUser.className 
      : (selectedClassId || classes[0]?.id || '');

  const cls = classes.find(c => c.id === targetClassId);

  const clsViolations = useMemo(() => {
     if (!targetClassId) return [];
     return violations
        .filter(v => v.classId === targetClassId)
        .sort((a,b) => b.timestamp - a.timestamp);
  }, [violations, targetClassId]);

  const { chartData, totalWeeksCount } = useMemo(() => {
      const configuredWeeks = timeConfigs
          .filter(c => c.type === 'WEEK')
          .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

      if (configuredWeeks.length > 0) {
          const data = configuredWeeks.map(config => {
              const violationsInScope = clsViolations.filter(v => 
                  isDateInRange(v.date, config.startDate, config.endDate)
              );

              const score = calculateScore(violationsInScope, 500, 1, false);

              return {
                  name: config.name,
                  fullLabel: `${config.name} (${formatDateDisplay(config.startDate)} - ${formatDateDisplay(config.endDate)})`,
                  score: score,
                  key: config.id
              };
          });

          return { 
              chartData: data, 
              totalWeeksCount: configuredWeeks.length
          };
      } else {
          const minDate = getEarliestViolationDate(violations);
          const maxDate = getLatestViolationDate(violations);
          const weeksCount = getUniqueWeeksCount(minDate, maxDate);
          
          const keys: string[] = [];
          const current = new Date(minDate);
          const day = current.getDay() || 7; 
          current.setDate(current.getDate() - day + 1);
          const endDate = new Date(maxDate);
          
          while (current <= endDate || getYearWeekKey(current) === getYearWeekKey(endDate)) {
              keys.push(getYearWeekKey(new Date(current)));
              current.setDate(current.getDate() + 7);
          }

          const data = keys.map(weekKey => {
              const weekNum = parseInt(weekKey.split('-W')[1]);
              const violationsInWeek = clsViolations.filter(v => getYearWeekKey(new Date(v.date)) === weekKey);
              const score = calculateScore(violationsInWeek, 500, 1, false);
              return {
                  name: `T${weekNum}`,
                  fullLabel: `Tuần ${weekNum} (Auto)`,
                  score: score,
                  key: weekKey
              };
          });

          return { chartData: data, totalWeeksCount: weeksCount };
      }
  }, [timeConfigs, clsViolations, violations]);

  if (!cls) {
      return (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <AlertCircle size={48} className="mb-2 opacity-50"/>
              <p>Chưa có dữ liệu lớp học.</p>
          </div>
      );
  }

  const gradeClasses = classes.filter(c => c.grade === cls.grade);
  const gradeRankings = gradeClasses.map(c => {
      const cViolations = violations.filter(v => v.classId === c.id);
      
      let score = 0;
      const configuredWeeks = timeConfigs.filter(tc => tc.type === 'WEEK');
      if (configuredWeeks.length > 0) {
          const validViolations = cViolations.filter(v => 
              configuredWeeks.some(week => isDateInRange(v.date, week.startDate, week.endDate))
          );
          score = calculateScore(validViolations, 500, totalWeeksCount, true);
      } else {
          score = calculateScore(cViolations, 500, totalWeeksCount, true);
      }

      return { id: c.id, avgScore: score };
  }).sort((a, b) => b.avgScore - a.avgScore);

  const myRank = gradeRankings.findIndex(r => r.id === targetClassId) + 1;
  const myStats = gradeRankings.find(r => r.id === targetClassId);
  
  const minusViolations = clsViolations.filter(v => v.points > 0);
  const plusViolations = clsViolations.filter(v => v.points < 0);

  const studentViolationStats = useMemo(() => {
      const classStudents = students.filter(s => s.classId === targetClassId);
      const stats = classStudents.map(s => {
          const studentMinus = minusViolations.filter(v => v.studentId === s.id && v.classId === targetClassId);
          const totalMinusPoints = studentMinus.reduce((acc, v) => acc + v.points, 0);
          return {
              student: s,
              count: studentMinus.length,
              totalPoints: totalMinusPoints
          };
      });
      return stats.filter(s => s.count > 0).sort((a, b) => b.count - a.count);
  }, [students, targetClassId, minusViolations]);

  const handleExportTopStudents = () => {
    if (studentViolationStats.length === 0) {
        alert("Không có dữ liệu học sinh vi phạm để xuất.");
        return;
    }
    const header = ["STT", "Học sinh", "Lớp", "Số lượt vi phạm", "Tổng điểm trừ"];
    const data = studentViolationStats.map((stat, idx) => [
        idx + 1,
        stat.student.name,
        cls.name,
        stat.count,
        stat.totalPoints
    ]);
    exportToExcel([header, ...data], `Top_VP_${cls.name}_${new Date().toISOString().slice(0,10)}`);
  };

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
             <div className="text--[10px] text-blue-200 mt-1">Tính theo cấu hình tuần</div>
           </div>
        </div>
        
        <div className="bg-white border-l-4 border-l-green-500 rounded-xl shadow-sm p-4">
           <div className="text-slate-500 text-xs font-bold uppercase mb-1 flex items-center gap-1"><TrendingUp size={14} /> Tổng Điểm</div>
           <div className="text-3xl font-black text-slate-800">{myStats?.avgScore?.toFixed(2)}</div>
           <div className="text-xs text-slate-400 mt-1">Trên tổng {totalWeeksCount} tuần cấu hình</div>
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
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
         <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
             <div className="flex items-center gap-2 text-slate-800 font-bold">
                <Users size={20} className="text-red-500"/> 
                <h3>Học sinh vi phạm nhiều</h3>
             </div>
             {studentViolationStats.length > 0 && (
                <button onClick={handleExportTopStudents} className="flex items-center gap-1 text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-3 py-1.5 rounded-lg transition-colors text-xs font-bold" title="Xuất file Excel">
                    <Download size={14} /> Xuất Excel
                </button>
             )}
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
                  const studentName = v.studentId 
                      ? (students.find(s => s.id === v.studentId && s.classId === v.classId)?.name || 'Học sinh không tồn tại') 
                      : 'Tập thể';

                  return (
                    <div 
                        key={v.id} 
                        onClick={() => setViewingViolation(v)}
                        className="bg-white p-3 rounded-lg border border-red-100 shadow-sm flex flex-col items-start gap-2 cursor-pointer hover:bg-red-50 hover:border-red-200 transition-colors"
                    >
                      <div className="w-full flex justify-between items-start">
                        <div>
                           <div className="font-medium text-slate-800 text-sm">{criteria.find(c => c.id === v.criteriaId)?.content}</div>
                           <div className="text-xs text-slate-500 mt-1">{formatDateDisplay(v.date)} • {studentName}</div>
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
                  const studentName = v.studentId 
                      ? (students.find(s => s.id === v.studentId && s.classId === v.classId)?.name || 'Học sinh không tồn tại') 
                      : 'Tập thể';

                  return (
                    <div 
                        key={v.id} 
                        onClick={() => setViewingViolation(v)}
                        className="bg-white p-3 rounded-lg border border-green-100 shadow-sm flex flex-col items-start gap-2 cursor-pointer hover:bg-green-50 hover:border-green-200 transition-colors"
                    >
                      <div className="w-full flex justify-between items-start">
                        <div>
                           <div className="font-medium text-slate-800 text-sm">{criteria.find(c => c.id === v.criteriaId)?.content}</div>
                           <div className="text-xs text-slate-500 mt-1">{formatDateDisplay(v.date)} • {studentName}</div>
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
