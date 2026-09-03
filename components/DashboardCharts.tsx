import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend,
} from 'recharts';
import { Activity, Users } from 'lucide-react';

// Tách riêng phần biểu đồ để recharts (~400KB) không nằm trong gói mở app đầu tiên.
// DashboardTab nạp component này bằng React.lazy — số liệu hiện ngay, biểu đồ vẽ sau.

interface Props {
  byGradeData: any[];
  radarData: any[];
  thisWeekLabel: string;
  prevWeekLabel: string;
}

const tooltipStyle = {
  borderRadius: 10,
  border: 'none',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  fontSize: 12,
};

const DashboardCharts: React.FC<Props> = ({ byGradeData, radarData, thisWeekLabel, prevWeekLabel }) => (
  <>
    {/* ── BAR CHART: VI PHẠM THEO KHỐI ─────────────────────────────────── */}
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="font-bold text-slate-700 mb-3 flex items-center gap-2">
        <Users size={16} className="text-red-500" />
        Vi phạm theo khối — {thisWeekLabel} vs {prevWeekLabel}
      </div>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={byGradeData} barGap={4} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} width={24} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f8fafc' }} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Tuần này" fill="#ef4444" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Tuần trước" fill="#fca5a5" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>

    {/* ── RADAR: ĐIỂM SỐ CÁC LỚP ──────────────────────────────────────── */}
    {radarData.length >= 3 && (
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="font-bold text-slate-700 mb-1 flex items-center gap-2">
          <Activity size={16} className="text-blue-500" />
          Điểm thi đua các lớp — {thisWeekLabel}
        </div>
        <p className="text-xs text-slate-500 mb-3">Top 8 lớp (điểm cao = ít vi phạm nhất)</p>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 10 }} />
              <PolarRadiusAxis angle={30} domain={[0, 500]} tick={false} axisLine={false} />
              <Radar name="Điểm" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, 'Điểm']} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    )}
  </>
);

export default DashboardCharts;
