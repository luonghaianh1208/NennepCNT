
import React, { useState, useMemo } from 'react';
import { Trophy } from 'lucide-react';
import { TimeConfig, Violation, ClassEntity } from '../types';
import { getWeekNumber, getUniqueWeeksCount, calculateScore } from '../utils';

interface RankingTabProps {
  violations: Violation[];
  classes: ClassEntity[];
  timeConfigs: TimeConfig[];
}

const RankingTab: React.FC<RankingTabProps> = ({ violations, classes, timeConfigs }) => {
  const [rankingGradeTab, setRankingGradeTab] = useState<'10' | '11' | '12'>('10');
  const [rankingFilterMode, setRankingFilterMode] = useState<'WEEK' | 'MONTH' | 'SEMESTER'>('WEEK');
  const [rankingFilterWeek, setRankingFilterWeek] = useState(`${new Date().getFullYear()}-W${getWeekNumber(new Date())}`);
  const [rankingFilterConfigId, setRankingFilterConfigId] = useState<string>('M10');

  const rankingData = useMemo(() => {
    const baseScore = 500;
    let relevantViolations = violations;
    let weeksCount = 1;
    let isRangeMode = false;

    if (rankingFilterMode === 'WEEK') {
      relevantViolations = violations.filter(v => {
        const d = new Date(v.date);
        const w = getWeekNumber(d);
        const y = d.getFullYear();
        const [fY, fW] = rankingFilterWeek.split('-W');
        return parseInt(fY) === y && parseInt(fW) === w;
      });
    } else {
      isRangeMode = true;
      const config = timeConfigs.find(c => c.id === rankingFilterConfigId);
      if (config) {
        relevantViolations = violations.filter(v => v.date >= config.startDate && v.date <= config.endDate);
        weeksCount = getUniqueWeeksCount(config.startDate, config.endDate);
      } else {
        relevantViolations = [];
      }
    }

    const targetClasses = classes.filter(c => c.grade.toString() === rankingGradeTab);
    const stats = targetClasses.map(cls => {
      const clsViolations = relevantViolations.filter(v => v.classId === cls.id);
      const totalScore = calculateScore(clsViolations, baseScore, weeksCount, isRangeMode);
      return { ...cls, totalViolations: clsViolations.length, score: totalScore };
    });

    return stats.sort((a, b) => b.score - a.score);
  }, [violations, classes, rankingGradeTab, rankingFilterMode, rankingFilterWeek, rankingFilterConfigId, timeConfigs]);

  let timeLabel = '';
  if (rankingFilterMode === 'WEEK') {
    timeLabel = `Tuần ${rankingFilterWeek.split('-W')[1]} - Năm ${rankingFilterWeek.split('-W')[0]}`;
  } else {
    const config = timeConfigs.find(c => c.id === rankingFilterConfigId);
    timeLabel = config ? `${config.name} (${config.startDate} đến ${config.endDate})` : 'Chưa chọn thời gian';
  }

  return (
    <div className="pb-20 space-y-6">
      <div className="bg-gradient-to-r from-blue-800 to-indigo-900 text-white border-none rounded-xl p-4 shadow-sm">
        <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
          <Trophy className="text-yellow-400" /> Bảng Vàng Thi Đua
        </h2>
        <p className="text-blue-100 text-sm opacity-90">{timeLabel}</p>
      </div>

      <div className="flex bg-white rounded-xl p-1 shadow-sm border border-slate-200">
         {['10', '11', '12'].map((g) => (
           <button key={g} onClick={() => setRankingGradeTab(g as '10'|'11'|'12')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${rankingGradeTab === g ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
             Khối {g}
           </button>
         ))}
      </div>

      <div className="flex gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
         <select className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-sm outline-none font-medium" value={rankingFilterMode} onChange={(e) => setRankingFilterMode(e.target.value as any)}>
           <option value="WEEK">Theo Tuần</option>
           <option value="MONTH">Theo Tháng</option>
           <option value="SEMESTER">Theo Học kỳ</option>
         </select>
         {rankingFilterMode === 'WEEK' ? (
           <input type="week" className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-sm outline-none font-medium flex-1" value={rankingFilterWeek} onChange={(e) => setRankingFilterWeek(e.target.value)} />
         ) : (
           <select className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-sm outline-none font-medium flex-1" value={rankingFilterConfigId} onChange={(e) => setRankingFilterConfigId(e.target.value)}>
             {timeConfigs.filter(c => c.type === rankingFilterMode).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
           </select>
         )}
      </div>

      {rankingData.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 items-end mb-6">
          {rankingData.slice(0, 3).map((item, index) => (
            <div key={item.id} className={`${index === 0 ? 'order-2' : index === 1 ? 'order-1' : 'order-3'} flex flex-col items-center`}>
              <div className="mb-2 text-center"><Trophy className={`w-8 h-8 mx-auto ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-slate-400' : 'text-orange-600'} drop-shadow-sm`} fill="currentColor" /></div>
              <div className={`w-full rounded-t-xl border-t-4 shadow-sm flex flex-col items-center justify-end pb-4 ${index === 0 ? 'h-40 border-yellow-400 bg-yellow-50' : index === 1 ? 'h-32 border-slate-300 bg-slate-50' : 'h-28 border-orange-300 bg-orange-50'}`}>
                <span className="text-xl font-black text-slate-800">{item.name}</span>
                <span className="text-sm font-semibold text-blue-600">{item.score}đ</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 text-slate-400 italic">Chưa có dữ liệu xếp hạng</div>
      )}

      <div className="space-y-2">
        {rankingData.slice(3).map((item, index) => (
          <div key={item.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold">{index + 4}</span>
              <span className="font-bold text-slate-700">{item.name}</span>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-xs text-slate-400 text-right"><div>{item.totalViolations} lỗi</div><div>GV: {item.homeroomTeacher}</div></div>
              <span className="font-bold text-blue-600 w-12 text-right">{item.score}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RankingTab;
