
import React, { useMemo } from 'react';
const DashboardCharts = React.lazy(() => import('./DashboardCharts'));
import { AlertTriangle, Star, TrendingDown, TrendingUp, Activity, Users, Award, Calendar } from 'lucide-react';
import { useAppStore } from '../contexts/AppContext';
import { getLocalDateString, isDateInRange, formatDateDisplay, calculateScore } from '../utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Lấy khoảng [startDate, endDate] của tuần ISO chứa ngày `date` */
function getWeekRange(date: Date): { start: string; end: string } {
  const d = new Date(date);
  const day = d.getDay() === 0 ? 7 : d.getDay(); // Mon=1 … Sun=7
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (x: Date) => getLocalDateString(x);
  return { start: fmt(monday), end: fmt(sunday) };
}

const DashboardTab: React.FC = () => {
  const { violations, classes, criteria, students, timeConfigs, schoolSettings } = useAppStore();

  const today = getLocalDateString();

  // ── Tuần hiện tại & tuần trước theo cấu hình (nếu có), fallback ISO ───────
  const { thisWeekConfig, prevWeekConfig } = useMemo(() => {
    const sortedWeeks = [...timeConfigs.filter(c => c.type === 'WEEK')]
      .sort((a, b) => b.startDate.localeCompare(a.startDate));

    // Tìm tuần đang chứa hôm nay
    const thisIdx = sortedWeeks.findIndex(w => isDateInRange(today, w.startDate, w.endDate));

    if (thisIdx !== -1) {
      return {
        thisWeekConfig: sortedWeeks[thisIdx],
        prevWeekConfig: sortedWeeks[thisIdx + 1] ?? null,
      };
    }

    // Fallback: tuần ISO gần nhất
    const latest = sortedWeeks[0] ?? null;
    const second = sortedWeeks[1] ?? null;
    return { thisWeekConfig: latest, prevWeekConfig: second };
  }, [timeConfigs, today]);

  // ── Lấy range từ config hoặc fallback ISO week ───────────────────────────
  const thisWeekRange = useMemo(() => {
    if (thisWeekConfig) return { start: thisWeekConfig.startDate, end: thisWeekConfig.endDate, label: thisWeekConfig.name };
    const r = getWeekRange(new Date());
    return { ...r, label: 'Tuần này' };
  }, [thisWeekConfig]);

  const prevWeekRange = useMemo(() => {
    if (prevWeekConfig) return { start: prevWeekConfig.startDate, end: prevWeekConfig.endDate, label: prevWeekConfig.name };
    const prevMonday = new Date();
    prevMonday.setDate(prevMonday.getDate() - 7);
    const r = getWeekRange(prevMonday);
    return { ...r, label: 'Tuần trước' };
  }, [prevWeekConfig]);

  // ── Tính các số liệu ──────────────────────────────────────────────────────
  const todayViolations = useMemo(() =>
    violations.filter(v => v.date === today && v.points > 0), [violations, today]);

  const todayAchievements = useMemo(() =>
    violations.filter(v => v.date === today && v.points < 0), [violations, today]);

  const thisWeekViolations = useMemo(() =>
    violations.filter(v => v.points > 0 && isDateInRange(v.date, thisWeekRange.start, thisWeekRange.end)),
    [violations, thisWeekRange]);

  const prevWeekViolations = useMemo(() =>
    violations.filter(v => v.points > 0 && isDateInRange(v.date, prevWeekRange.start, prevWeekRange.end)),
    [violations, prevWeekRange]);

  const thisWeekAchievements = useMemo(() =>
    violations.filter(v => v.points < 0 && isDateInRange(v.date, thisWeekRange.start, thisWeekRange.end)),
    [violations, thisWeekRange]);

  const prevWeekAchievements = useMemo(() =>
    violations.filter(v => v.points < 0 && isDateInRange(v.date, prevWeekRange.start, prevWeekRange.end)),
    [violations, prevWeekRange]);

  const violationDelta = thisWeekViolations.length - prevWeekViolations.length;
  const achievementDelta = thisWeekAchievements.length - prevWeekAchievements.length;

  // ── Top tiêu chí vi phạm nhiều nhất tuần này ─────────────────────────────
  const topCriteria = useMemo(() => {
    const map = new Map<string, number>();
    thisWeekViolations.forEach(v => map.set(v.criteriaId, (map.get(v.criteriaId) || 0) + 1));
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({
        name: criteria.find(c => c.id === id)?.content?.substring(0, 20) + '…' || id,
        count,
      }));
  }, [thisWeekViolations, criteria]);

  // ── Bar chart: Vi phạm theo khối ────────────────────────────────────────
  const byGradeData = useMemo(() => {
    return schoolSettings.grades.map(grade => {
      const gradeClasses = classes.filter(c => String(c.grade) === grade);
      const gradeIds = new Set(gradeClasses.map(c => c.id));
      const thisCount = thisWeekViolations.filter(v => gradeIds.has(v.classId)).length;
      const prevCount = prevWeekViolations.filter(v => gradeIds.has(v.classId)).length;
      return { name: `Khối ${grade}`, 'Tuần này': thisCount, 'Tuần trước': prevCount };
    });
  }, [classes, thisWeekViolations, prevWeekViolations, schoolSettings.grades]);

  // ── Radar: Top lớp theo điểm tuần này ────────────────────────────────────
  const radarData = useMemo(() => {
    return classes.map(cls => {
      const clsV = thisWeekViolations.filter(v => v.classId === cls.id);
      const clsA = thisWeekAchievements.filter(v => v.classId === cls.id);
      const score = calculateScore([...clsV, ...clsA], schoolSettings.baseScore, 1, false);
      return { subject: cls.name, score, fullMark: schoolSettings.baseScore };
    }).sort((a, b) => b.score - a.score).slice(0, 8); // top 8 lớp cho radar dễ đọc
  }, [classes, thisWeekViolations, thisWeekAchievements, schoolSettings.baseScore]);

  // ── Recent violations hôm nay ─────────────────────────────────────────────
  const recentToday = useMemo(() =>
    [...todayViolations].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5),
    [todayViolations]);

  // ─── UI helpers ──────────────────────────────────────────────────────────
  const DeltaBadge = ({ delta, inverted = false }: { delta: number; inverted?: boolean }) => {
    const good = inverted ? delta < 0 : delta < 0;
    const neutral = delta === 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-full ${
        neutral ? 'bg-slate-100 text-slate-500' :
        good ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
      }`}>
        {neutral ? '—' : good
          ? <><TrendingDown size={11} />{Math.abs(delta)}</>
          : <><TrendingUp size={11} />+{delta}</>
        }
        <span className="font-normal opacity-75">vs tuần trước</span>
      </span>
    );
  };

  return (
    <div className="space-y-4 pb-24">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-red-700 to-red-900 text-white rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/5 rounded-full" />
        <div className="absolute -right-2 bottom-0 w-20 h-20 bg-white/5 rounded-full" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1 text-yellow-300 text-xs font-bold uppercase tracking-widest">
            <Activity size={13} /> Tổng quan hôm nay
          </div>
          <p className="text-white/80 text-sm">{formatDateDisplay(today)}</p>
          <p className="text-yellow-200 text-xs mt-2">
            Kỳ: {thisWeekRange.label} ({formatDateDisplay(thisWeekRange.start)} – {formatDateDisplay(thisWeekRange.end)})
          </p>
        </div>
      </div>

      {/* ── STAT CARDS ROW 1 ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {/* Hôm nay */}
        <div className="bg-white rounded-xl border border-red-100 p-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-3 right-3 text-red-100"><AlertTriangle size={28} /></div>
          <div className="text-xs font-bold text-red-500 uppercase mb-1">Vi phạm hôm nay</div>
          <div className="text-4xl font-black text-red-600">{todayViolations.length}</div>
          <div className="text-xs text-slate-500 mt-1">{todayViolations.filter(v => v.studentId).length} cá nhân · {todayViolations.filter(v => !v.studentId).length} tập thể</div>
        </div>

        <div className="bg-white rounded-xl border border-green-100 p-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-3 right-3 text-green-100"><Star size={28} /></div>
          <div className="text-xs font-bold text-green-500 uppercase mb-1">Thành tích hôm nay</div>
          <div className="text-4xl font-black text-green-600">{todayAchievements.length}</div>
          <div className="text-xs text-slate-500 mt-1">{todayAchievements.filter(v => v.studentId).length} cá nhân · {todayAchievements.filter(v => !v.studentId).length} tập thể</div>
        </div>
      </div>

      {/* ── STAT CARDS ROW 2 (tuần) ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Calendar size={12} /> Vi phạm tuần</div>
          <div className="text-3xl font-black text-slate-800">{thisWeekViolations.length}</div>
          <div className="mt-1.5"><DeltaBadge delta={violationDelta} /></div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Award size={12} /> Thành tích tuần</div>
          <div className="text-3xl font-black text-slate-800">{thisWeekAchievements.length}</div>
          <div className="mt-1.5"><DeltaBadge delta={achievementDelta} inverted /></div>
        </div>
      </div>

      {/* ── BIỂU ĐỒ (nạp sau để số liệu hiện ngay) ────────────────────────── */}
      <React.Suspense
        fallback={<div className="h-44 bg-white rounded-xl border border-slate-200 animate-pulse" />}
      >
        <DashboardCharts
          byGradeData={byGradeData}
          radarData={radarData}
          thisWeekLabel={thisWeekRange.label}
          prevWeekLabel={prevWeekRange.label}
        />
      </React.Suspense>

      {/* ── TOP TIÊU CHÍ VI PHẠM ────────────────────────────────────────── */}
      {topCriteria.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="font-bold text-slate-700 mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-orange-500" />
            Lỗi vi phạm nhiều nhất tuần này
          </div>
          <div className="space-y-2">
            {topCriteria.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${
                  idx === 0 ? 'bg-red-600 text-white' :
                  idx === 1 ? 'bg-red-400 text-white' :
                  idx === 2 ? 'bg-orange-400 text-white' : 'bg-slate-100 text-slate-500'
                }`}>{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-700 truncate">{item.name}</div>
                  <div className="h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full transition-all"
                      style={{ width: `${Math.round((item.count / topCriteria[0].count) * 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-black text-red-600 flex-shrink-0">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── VI PHẠM GẦN NHẤT HÔM NAY ────────────────────────────────────── */}
      {recentToday.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="font-bold text-slate-700 mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            Vi phạm vừa ghi nhận hôm nay
          </div>
          <div className="space-y-2">
            {recentToday.map(v => {
              const cls = classes.find(c => c.id === v.classId);
              const stu = students.find(s => s.id === v.studentId && s.classId === v.classId);
              const cri = criteria.find(c => c.id === v.criteriaId);
              return (
                <div key={v.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-red-50 border border-red-100">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800">{cls?.name} {stu ? `— ${stu.name}` : '(Tập thể)'}</div>
                    <div className="text-xs text-slate-500 truncate">{cri?.content}</div>
                  </div>
                  <span className="font-bold text-red-600 text-sm flex-shrink-0">-{v.points}đ</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state khi chưa có dữ liệu hôm nay */}
      {violations.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <Activity size={48} strokeWidth={1} className="mx-auto mb-3 opacity-40" />
          <p className="font-semibold">Chưa có dữ liệu</p>
          <p className="text-sm mt-1">Dữ liệu sẽ hiển thị sau khi có vi phạm được ghi nhận.</p>
        </div>
      )}
    </div>
  );
};

export default DashboardTab;
