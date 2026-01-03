
import React, { useState, useMemo } from 'react';
import { Award, TrendingUp, ThumbsDown, ThumbsUp, AlertCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { User, ClassEntity, Violation, Student, Criteria } from '../types';
import { calculateScore, getWeekNumber, safeParseImages } from '../utils';

interface ClassDetailTabProps {
  currentUser: User;
  classes: ClassEntity[];
  violations: Violation[];
  criteria: Criteria[];
  students: Student[];
}

const ClassDetailTab: React.FC<ClassDetailTabProps> = ({ currentUser, classes, violations, criteria, students }) => {
  const [selectedClassId, setSelectedClassId] = useState('');

  const targetClassId = (currentUser.role === 'TEACHER' || currentUser.role === 'RED_FLAG' || currentUser.role === 'DISCIPLINE') && currentUser.className 
      ? currentUser.className 
      : (selectedClassId || classes[0]?.id || '');

  const cls = classes.find(c => c.id === targetClassId);

  if (!cls) {
      return (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <AlertCircle size={48} className="mb-2 opacity-50"/>
              <p>Chưa có dữ liệu lớp học.</p>
          </div>
      );
  }

  const gradeClasses = classes.filter(c => c.grade === cls.grade);
  const allWeeks = Array.from(new Set(violations.map(v => getWeekNumber(new Date(v.date)))));
  const totalWeeks = Math.max(1, allWeeks.length); 

  const gradeRankings = gradeClasses.map(c => {
      const cViolations = violations.filter(v => v.classId === c.id);
      const score = calculateScore(cViolations, 500, totalWeeks, true);
      return { id: c.id, avgScore: score };
  }).sort((a, b) => b.avgScore - a.avgScore);

  const myRank = gradeRankings.findIndex(r => r.id === targetClassId) + 1;
  const myStats = gradeRankings.find(r => r.id === targetClassId);
  
  const clsViolations = violations.filter(v => v.classId === targetClassId).sort((a,b) => b.timestamp - a.timestamp);
  const minusViolations = clsViolations.filter(v => v.points > 0);
  const plusViolations = clsViolations.filter(v => v.points < 0);

  // Tính toán dữ liệu thực tế cho biểu đồ
  const chartData = useMemo(() => {
    // 1. Lấy tất cả các tuần có dữ liệu của lớp này
    
    // Nếu không có violation nào, ta vẫn hiển thị ít nhất 1 điểm (500)
    if (clsViolations.length === 0) {
       return [{ name: 'Tuần này', score: 500 }];
    }

    const uniqueWeeks = Array.from(new Set(clsViolations.map(v => {
       const d = new Date(v.date);
       return getWeekNumber(d) as number;
    }))).sort((a: number, b: number) => a - b);

    // Tính điểm cho từng tuần
    const data = uniqueWeeks.map(weekNum => {
       const violationsInWeek = clsViolations.filter(v => getWeekNumber(new Date(v.date)) === weekNum);
       const weekScore = calculateScore(violationsInWeek, 500, 1, false); // Điểm tuần đó = 500 - trừ + cộng
       return {
          name: `Tuần ${weekNum}`,
          score: weekScore
       };
    });

    // Nếu ít hơn 3 điểm dữ liệu, thêm các điểm mặc định 500 cho đẹp biểu đồ
    if (data.length < 3) {
       const lastWeek = (uniqueWeeks[uniqueWeeks.length - 1] || getWeekNumber(new Date())) as number;
       if (data.length === 0) data.push({ name: `Tuần ${lastWeek}`, score: 500 });
       // Prepend previous weeks
       for (let i = 1; i <= 3 - data.length; i++) {
          data.unshift({ name: `Tuần ${lastWeek - i}`, score: 500 });
       }
    }
    
    // Giới hạn hiển thị 5 tuần gần nhất
    return data.slice(-5);
  }, [clsViolations]);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
         {(currentUser.role === 'ADMIN' || currentUser.role === 'LEADER') ? (
           <select className="bg-white border border-blue-200 text-blue-900 font-bold rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500" value={targetClassId} onChange={(e) => setSelectedClassId(e.target.value)}>
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
           </div>
        </div>
        
        <div className="bg-white border-l-4 border-l-green-500 rounded-xl shadow-sm p-4">
           <div className="text-slate-500 text-xs font-bold uppercase mb-1 flex items-center gap-1"><TrendingUp size={14} /> Điểm TB Tuần</div>
           <div className="text-3xl font-black text-slate-800">{myStats?.avgScore?.toFixed(2)}</div>
           <div className="text-xs text-slate-400 mt-1">Tính trên toàn bộ dữ liệu</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
         <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-700 bg-slate-50/50 -mx-4 -mt-4 mb-4">Biểu đồ biến động điểm số (Theo Tuần)</div>
         <div className="h-60 w-full text-xs">
           <ResponsiveContainer width="100%" height="100%">
             <LineChart data={chartData}>
               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
               <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
               <YAxis domain={['auto', 'auto']} hide />
               <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
               <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
             </LineChart>
           </ResponsiveContainer>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <div className="space-y-3">
            <div className="flex items-center gap-2 text-red-700 font-bold uppercase text-sm border-b border-red-200 pb-2"><ThumbsDown size={18} /> Lịch sử Vi Phạm</div>
            <div className="space-y-2">
              {minusViolations.length > 0 ? minusViolations.map(v => {
                  const images = safeParseImages(v.images);
                  return (
                    <div key={v.id} className="bg-white p-3 rounded-lg border border-red-100 shadow-sm flex flex-col items-start gap-2">
                      <div className="w-full flex justify-between items-start">
                        <div>
                           <div className="font-medium text-slate-800 text-sm">{criteria.find(c => c.id === v.criteriaId)?.content}</div>
                           <div className="text-xs text-slate-500 mt-1">{v.date} • {v.studentId ? students.find(s=>s.id===v.studentId)?.name : 'Tập thể'}</div>
                        </div>
                        <div className="font-bold text-red-600">-{v.points}</div>
                      </div>
                      {images.length > 0 && (
                          <div className="flex gap-1 overflow-x-auto w-full">
                              {images.map((img, idx) => (
                                  <img key={idx} src={img} className="h-10 w-10 object-cover rounded border" alt="evidence"/>
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
                    <div key={v.id} className="bg-white p-3 rounded-lg border border-green-100 shadow-sm flex flex-col items-start gap-2">
                      <div className="w-full flex justify-between items-start">
                        <div>
                           <div className="font-medium text-slate-800 text-sm">{criteria.find(c => c.id === v.criteriaId)?.content}</div>
                           <div className="text-xs text-slate-500 mt-1">{v.date} • {v.studentId ? students.find(s=>s.id===v.studentId)?.name : 'Tập thể'}</div>
                        </div>
                        <div className="font-bold text-green-600">+{Math.abs(v.points)}</div>
                      </div>
                      {images.length > 0 && (
                          <div className="flex gap-1 overflow-x-auto w-full">
                              {images.map((img, idx) => (
                                  <img key={idx} src={img} className="h-10 w-10 object-cover rounded border" alt="evidence"/>
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
