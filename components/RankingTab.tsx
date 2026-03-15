
import React, { useState, useMemo, useEffect } from 'react';
import { Trophy, Download, X, FileSpreadsheet, Layers } from 'lucide-react';
import { Violation } from '../types';
import { calculateScore, getEarliestViolationDate, getLatestViolationDate, formatDateDisplay, exportToExcel, computeRankingContext } from '../utils';
import { useAppStore } from '../contexts/AppContext';
import { useModal } from '../contexts/ModalContext';

const RankingTab: React.FC = () => {
  const { classes, violations, criteria, timeConfigs, roleConfigs } = useAppStore();
  const { showToast } = useModal();

  const [rankingGradeTab, setRankingGradeTab] = useState<'10' | '11' | '12'>('10');
  const [rankingFilterMode, setRankingFilterMode] = useState<'WEEK' | 'MONTH' | 'SEMESTER' | 'ALL'>('ALL');
  const [rankingFilterConfigId, setRankingFilterConfigId] = useState<string>('');
  
  // State cho Modal chọn xuất Excel
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
     if (rankingFilterMode !== 'ALL') {
        const availableConfigs = timeConfigs.filter(c => c.type === rankingFilterMode);
        const currentIsValid = availableConfigs.find(c => c.id === rankingFilterConfigId);
        if (!currentIsValid && availableConfigs.length > 0) {
            setRankingFilterConfigId(availableConfigs[0].id);
        }
     }
  }, [rankingFilterMode, timeConfigs, rankingFilterConfigId]);

  // Logic tính toán dữ liệu hiển thị (dùng shared util — single source of truth)
  const rankingData = useMemo(() => {
    const baseScore = 500;
    const { relevantViolations, weeksCount, isRangeMode } = computeRankingContext(
      violations, timeConfigs, rankingFilterMode, rankingFilterConfigId
    );

    const targetClasses = classes.filter(c => c.grade.toString() === rankingGradeTab);

    const stats = targetClasses.map(cls => {
      const clsViolations = relevantViolations.filter(v => v.classId === cls.id);
      const violationCount = clsViolations.filter(v => v.points > 0).length;
      const totalScore = calculateScore(clsViolations, baseScore, weeksCount, isRangeMode);
      return { ...cls, totalViolations: violationCount, score: totalScore };
    });

    const sorted = stats.sort((a, b) => b.score - a.score);
    return sorted.map((item, index) => {
      let rank = index + 1;
      if (index > 0 && item.score === sorted[index - 1].score) {
        let firstIndex = index;
        while (firstIndex > 0 && sorted[firstIndex - 1].score === item.score) firstIndex--;
        rank = firstIndex + 1;
      }
      return { ...item, rank };
    });
  }, [violations, classes, rankingGradeTab, rankingFilterMode, rankingFilterConfigId, timeConfigs]);

  let timeLabel = '';
  if (rankingFilterMode === 'ALL') {
      const min = getEarliestViolationDate(violations);
      timeLabel = `Toàn bộ dữ liệu (${formatDateDisplay(min.toISOString())} - Nay)`;
  } else {
    const config = timeConfigs.find(c => c.id === rankingFilterConfigId);
    timeLabel = config ? `${config.name} (${formatDateDisplay(config.startDate)} - ${formatDateDisplay(config.endDate)})` : 'Vui lòng chọn mốc thời gian';
  }

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
      return ''; 
  };

  // --- LOGIC XUẤT EXCEL ---

  const handleOpenExportModal = () => {
      if (violations.length === 0 && rankingFilterMode === 'ALL') {
          return showToast('Hệ thống chưa có dữ liệu vi phạm nào.', 'error');
          return;
      }
      setShowExportModal(true);
  };

  const processExport = (scope: 'CURRENT' | 'ALL') => {
      const baseScore = 500;

      // ✅ Dùng shared util — nhất quán 100% với rankingData
      const { relevantViolations, weeksCount, isRangeMode, periodStr } = computeRankingContext(
        violations, timeConfigs, rankingFilterMode, rankingFilterConfigId
      );

      let periodLabel = periodStr;
      if (!periodLabel) {
        // fallback label khi ALL mode không có tuần cấu hình
        const minDate = getEarliestViolationDate(violations);
        periodLabel = `Toàn thời gian (${formatDateDisplay(minDate.toISOString())} - Nay)`;
      }

      // 2. Xác định danh sách lớp cần xuất
      let targetClasses = [];
      if (scope === 'CURRENT') {
          targetClasses = classes.filter(c => c.grade.toString() === rankingGradeTab);
      } else {
          targetClasses = classes; // Lấy toàn bộ lớp
      }

      if (targetClasses.length === 0) {
          return showToast('Không tìm thấy dữ liệu lớp học.', 'error');
          return;
      }

      // 3. Tính điểm sơ bộ cho tất cả các lớp đích
      const stats = targetClasses.map(cls => {
          const clsViolations = relevantViolations.filter(v => v.classId === cls.id);
          
          // CHỈ ĐẾM LỖI (points > 0) CHO FILE EXCEL
          const violationCount = clsViolations.filter(v => v.points > 0).length;
          
          const totalScore = calculateScore(clsViolations, baseScore, weeksCount, isRangeMode);
          return { 
              ...cls, 
              totalViolations: violationCount, 
              score: totalScore 
          };
      });

      // 4. Sắp xếp & Xếp hạng (LOGIC MỚI: Xếp hạng riêng theo từng khối nếu chọn ALL)
      let rankedData: any[] = [];

      if (scope === 'CURRENT') {
          // Chỉ 1 khối: Xếp hạng bình thường
          const sorted = stats.sort((a, b) => b.score - a.score);
          rankedData = sorted.map((item, index) => {
              let rank = index + 1;
              if (index > 0 && item.score === sorted[index - 1].score) {
                  let firstIndex = index;
                  while(firstIndex > 0 && sorted[firstIndex - 1].score === item.score) {
                      firstIndex--;
                  }
                  rank = firstIndex + 1;
              }
              return { ...item, rank };
          });
      } else {
          // Toàn trường: Gom nhóm theo khối, xếp hạng riêng từng khối rồi gộp lại
          const grades = [10, 11, 12]; // Ưu tiên thứ tự 10 -> 11 -> 12
          
          grades.forEach(grade => {
              const gradeStats = stats.filter(s => s.grade === grade);
              if (gradeStats.length > 0) {
                  const sorted = gradeStats.sort((a, b) => b.score - a.score);
                  const rankedGradeStats = sorted.map((item, index) => {
                      let rank = index + 1;
                      if (index > 0 && item.score === sorted[index - 1].score) {
                          let firstIndex = index;
                          while(firstIndex > 0 && sorted[firstIndex - 1].score === item.score) {
                              firstIndex--;
                          }
                          rank = firstIndex + 1;
                      }
                      return { ...item, rank };
                  });
                  rankedData = [...rankedData, ...rankedGradeStats];
              }
          });
      }

      // 5. Xuất file
      const header = ["Thứ hạng", "Lớp", "GVCN", "Khối", "Tổng điểm", "Tổng số lỗi (lượt)", "Khoảng thời gian"];
      const rows = rankedData.map(item => [
          item.rank,
          item.name,
          item.homeroomTeacher || '',
          item.grade,
          item.score,
          item.totalViolations,
          periodStr
      ]);

      const scopeName = scope === 'CURRENT' ? `Khoi_${rankingGradeTab}` : `Toan_Truong`;
      const fileName = `Bang_Xep_Hang_${scopeName}_${new Date().toISOString().slice(0,10)}`;
      
      exportToExcel([header, ...rows], fileName);
      setShowExportModal(false);
  };

  const top3 = rankingData.slice(0, 3);
  const podiumOrder = [1, 0, 2]; 

  return (
    <div className="pb-20 space-y-6 relative">
      {/* --- EXPORT MODAL --- */}
      {showExportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                          <Download size={20} className="text-green-600"/> Xuất Báo Cáo
                      </h3>
                      <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-slate-600">
                          <X size={20} />
                      </button>
                  </div>
                  <div className="p-6 space-y-3">
                      <p className="text-sm text-slate-600 mb-2">Bạn muốn xuất bảng xếp hạng cho phạm vi nào?</p>
                      
                      <button 
                        onClick={() => processExport('CURRENT')}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all font-bold text-left"
                      >
                          <div className="bg-blue-200 p-2 rounded-lg"><Layers size={20}/></div>
                          <div>
                              <div className="text-sm">Chỉ Khối {rankingGradeTab}</div>
                              <div className="text-[10px] font-normal opacity-70">Xuất dữ liệu khối đang xem</div>
                          </div>
                      </button>

                      <button 
                        onClick={() => processExport('ALL')}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-all font-bold text-left"
                      >
                          <div className="bg-indigo-200 p-2 rounded-lg"><FileSpreadsheet size={20}/></div>
                          <div>
                              <div className="text-sm">Toàn Trường (3 Khối)</div>
                              <div className="text-[10px] font-normal opacity-70">Gộp nhưng xếp hạng riêng từng khối</div>
                          </div>
                      </button>
                  </div>
              </div>
          </div>
      )}

      <div className="bg-gradient-to-r from-blue-800 to-indigo-900 text-white border-none rounded-xl p-4 shadow-sm flex justify-between items-start">
        <div>
            <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
            <Trophy className="text-yellow-400" /> Bảng Vàng Thi Đua
            </h2>
            <p className="text-blue-100 text-sm opacity-90">{timeLabel}</p>
        </div>
      </div>

      <div className="flex bg-white rounded-xl p-1 shadow-sm border border-slate-200">
         {['10', '11', '12'].map((g) => (
           <button key={g} onClick={() => setRankingGradeTab(g as '10'|'11'|'12')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${rankingGradeTab === g ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
             Khối {g}
           </button>
         ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
         <div className="flex flex-1 gap-2 flex-col sm:flex-row">
            <select 
                className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-sm outline-none font-medium w-full sm:w-auto" 
                value={rankingFilterMode} 
                onChange={(e) => setRankingFilterMode(e.target.value as any)}
            >
            <option value="ALL">Toàn thời gian (Tất cả)</option>
            <option value="WEEK">Theo Tuần (Cấu hình)</option>
            <option value="MONTH">Theo Tháng</option>
            <option value="SEMESTER">Theo Học kỳ</option>
            </select>
            
            {rankingFilterMode === 'ALL' ? (
                <div className="flex-1 px-2 py-2 text-sm text-slate-500 italic bg-slate-50 border border-slate-300 rounded-lg">Dữ liệu tổng hợp từ toàn bộ Database</div>
            ) : (
            <select 
                    className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-2 text-sm outline-none font-medium flex-1 w-full" 
                    value={rankingFilterConfigId} 
                    onChange={(e) => setRankingFilterConfigId(e.target.value)}
            >
                {timeConfigs.filter(c => c.type === rankingFilterMode).length === 0 && <option value="">Chưa có cấu hình</option>}
                {timeConfigs.filter(c => c.type === rankingFilterMode).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            )}
         </div>

         <button 
            onClick={handleOpenExportModal}
            className="flex items-center justify-center gap-2 bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-bold shadow hover:bg-green-700 transition-colors whitespace-nowrap"
         >
            <Download size={16} /> Xuất Excel
         </button>
      </div>

      {rankingData.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 items-end mb-6 px-2">
          {podiumOrder.map(idx => {
              const item = top3[idx];
              if (!item) return <div key={idx} className="w-full"></div>;
              
              const isCenter = idx === 0; 
              const isLeft = idx === 1;   
              const isRight = idx === 2;  

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
