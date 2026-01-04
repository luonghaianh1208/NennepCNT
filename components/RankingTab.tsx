
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

    // Sort descending by score
    const sorted = stats.sort((a, b) => b.score - a.score);

    // Calculate Dense Rank (1, 1, 3, 4, 4, 6...)
    // Logic: Nếu điểm bằng người trước -> hạng bằng người trước.
    // Nếu điểm khác -> hạng bằng (index + 1).
    return sorted.map((item, index) => {
        let rank = index + 1;
        if (index > 0 && item.score === sorted[index - 1].score) {
            // Find the first index with this score
            let firstIndex = index;
            while(firstIndex > 0 && sorted[firstIndex - 1].score === item.score) {
                firstIndex--;
            }
            rank = firstIndex + 1;
        }
        return { ...item, rank };
    });

  }, [violations, classes, rankingGradeTab, rankingFilterMode, rankingFilterWeek, rankingFilterConfigId, timeConfigs]);

  let timeLabel = '';
  if (rankingFilterMode === 'WEEK') {
    timeLabel = `Tuần ${rankingFilterWeek.split('-W')[1]} - Năm ${rankingFilterWeek.split('-W')[0]}`;
  } else {
    const config = timeConfigs.find(c => c.id === rankingFilterConfigId);
    timeLabel = config ? `${config.name} (${config.startDate} đến ${config.endDate})` : 'Chưa chọn thời gian';
  }

  // Helper to get podium color based on Rank
  const getRankColor = (rank: number) => {
      if (rank === 1) return 'text-yellow-500';
      if (rank === 2) return 'text-slate-400';
      if (rank === 3) return 'text-orange-600';
      return 'text-slate-700';
  };
  
  const getPodiumBg = (rank: number) => {
      if (rank === 1) return 'border-yellow-400 bg-yellow-50 h-40';
      if (rank === 2) return 'border-slate-300 bg-slate-50 h-32';
      if (rank === 3) return 'border-orange-300 bg-orange-50 h-28';
      return ''; // Should not happen for podium
  };

  // Podium Logic: Take top 3 ITEMS (could be Rank 1, 1, 3 or 1, 2, 2 etc)
  // Need to be careful about visual arrangement (2nd - 1st - 3rd)
  const top3 = rankingData.slice(0, 3);
  
  // Arrange for podium display: Left(Index 1), Center(Index 0), Right(Index 2)
  const podiumOrder = [1, 0, 2]; 

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
        <div className="grid grid-cols-3 gap-2 items-end mb-6 px-2">
          {podiumOrder.map(idx => {
              const item = top3[idx];
              if (!item) return <div key={idx} className="w-full"></div>;
              
              const isCenter = idx === 0; // Rank 1 visual position
              const isLeft = idx === 1;   // Rank 2 visual position
              const isRight = idx === 2;  // Rank 3 visual position

              return (
                <div key={item.id} className={`${isCenter ? 'order-2' : isLeft ? 'order-1' : 'order-3'} flex flex-col items-center`}>
                  <div className="mb-2 text-center">
                      <Trophy className={`w-8 h-8 mx-auto ${getRankColor(item.rank)} drop-shadow-sm`} fill="currentColor" />
                      <div className={`text-xs font-bold mt-1 ${getRankColor(item.rank)}`}>Hạng {item.rank}</div>
                  </div>
                  <div className={`w-full rounded-t-xl border-t-4 shadow-sm flex flex-col items-center justify-end pb-4 ${getPodiumBg(item.rank)}`}>
                    <span className="text-xl font-black text-slate-800">{item.name}</span>
                    <span className="text-sm font-semibold text-blue-600">{item.score}đ</span>
                  </div>
                </div>
              );
          })}
        </div>
      ) : (
        <div className="text-center py-10 text-slate-400 italic">Chưa có dữ liệu xếp hạng</div>
      )}

      <div className="space-y-2">
        {rankingData.slice(3).map((item) => (
          <div key={item.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-sm font-bold border border-slate-200">
                  {item.rank}
              </span>
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
