import { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Users,
  Award,
  AlertTriangle,
  Calendar,
  PieChart as PieIcon,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  Filter
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { useApp } from '../context/AppContext';
import { exportToCSV, formatDate } from '../lib/utils';

const CHART_GRID_STROKE = '#1E2330';
const CHART_TICK_FILL = '#9CA3AF';
const CHART_TICK_FONTSIZE = 12;
const CHART_TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: '#151922',
  border: '1px solid #1E2330',
  borderRadius: '8px',
  color: '#fff',
};

const PIE_COLORS = {
  present: '#22C55E',
  late: '#F59E0B',
  absent: '#EF4444',
  excused: '#8B5CF6',
};

export default function AnalyticsReports() {
  const { state, addToast } = useApp();
  const { members, sessions, records, settings } = state;

  // Date range filter
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Filter sessions and records by selected date range
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (startDate && s.date < startDate) return false;
      if (endDate && s.date > endDate) return false;
      return true;
    });
  }, [sessions, startDate, endDate]);

  const filteredSessionIds = useMemo(() => {
    return new Set(filteredSessions.map((s) => s.id));
  }, [filteredSessions]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => filteredSessionIds.has(r.session_id));
  }, [records, filteredSessionIds]);

  // Overall Attendance Rate
  const overallStats = useMemo(() => {
    const applicable = filteredRecords.filter((r) => r.status !== 'excused');
    const attended = applicable.filter((r) => r.status === 'present' || r.status === 'late').length;
    const pct = applicable.length > 0 ? Math.round((attended / applicable.length) * 100) : 0;

    const presentCount = filteredRecords.filter((r) => r.status === 'present').length;
    const lateCount = filteredRecords.filter((r) => r.status === 'late').length;
    const absentCount = filteredRecords.filter((r) => r.status === 'absent').length;
    const excusedCount = filteredRecords.filter((r) => r.status === 'excused').length;

    return {
      pct,
      totalSessions: filteredSessions.length,
      totalRecords: filteredRecords.length,
      presentCount,
      lateCount,
      absentCount,
      excusedCount,
    };
  }, [filteredRecords, filteredSessions]);

  // Status Distribution Data for Pie Chart
  const statusPieData = useMemo(() => {
    return [
      { name: 'Present', value: overallStats.presentCount, color: PIE_COLORS.present },
      { name: 'Late', value: overallStats.lateCount, color: PIE_COLORS.late },
      { name: 'Absent', value: overallStats.absentCount, color: PIE_COLORS.absent },
      { name: 'Excused', value: overallStats.excusedCount, color: PIE_COLORS.excused },
    ];
  }, [overallStats]);

  // Domain-wise comparison
  const domainComparison = useMemo(() => {
    const map = new Map<string, { present: number; late: number; absent: number; total: number }>();

    // Map each member to domain
    const memberDomainMap = new Map(members.map((m) => [m.id, m.department]));

    filteredRecords.forEach((r) => {
      if (r.status === 'excused') return;
      const dept = memberDomainMap.get(r.member_id) || 'Unknown';
      const curr = map.get(dept) || { present: 0, late: 0, absent: 0, total: 0 };
      if (r.status === 'present') curr.present += 1;
      else if (r.status === 'late') curr.late += 1;
      else if (r.status === 'absent') curr.absent += 1;
      curr.total += 1;
      map.set(dept, curr);
    });

    return Array.from(map.entries()).map(([dept, data]) => {
      const percentage =
        data.total > 0 ? Math.round(((data.present + data.late) / data.total) * 100) : 0;
      return {
        department: dept,
        percentage,
        total: data.total,
        present: data.present,
        late: data.late,
        absent: data.absent,
      };
    }).sort((a, b) => b.percentage - a.percentage);
  }, [filteredRecords, members]);

  // Member-wise attendance ranking
  const memberRanking = useMemo(() => {
    return members
      .map((member) => {
        const memRecs = filteredRecords.filter((r) => r.member_id === member.id);
        const applicable = memRecs.filter((r) => r.status !== 'excused');
        const attended = applicable.filter((r) => r.status === 'present' || r.status === 'late').length;
        const pct = applicable.length > 0 ? Math.round((attended / applicable.length) * 100) : null;

        return {
          id: member.id,
          member_id: member.member_id,
          name: member.name,
          department: member.department,
          percentage: pct,
          attended,
          total: applicable.length,
          present: memRecs.filter((r) => r.status === 'present').length,
          late: memRecs.filter((r) => r.status === 'late').length,
          absent: memRecs.filter((r) => r.status === 'absent').length,
          excused: memRecs.filter((r) => r.status === 'excused').length,
        };
      })
      .sort((a, b) => (b.percentage ?? -1) - (a.percentage ?? -1));
  }, [members, filteredRecords]);

  // Top Attendees & Low Attendees
  const topPerformers = useMemo(() => {
    return memberRanking.slice(0, 5);
  }, [memberRanking]);

  const lowAttendees = useMemo(() => {
    return memberRanking.filter(
      (m) => m.percentage !== null && m.percentage < settings.low_attendance_threshold
    );
  }, [memberRanking, settings.low_attendance_threshold]);

  // Monthly trends
  const monthlyTrends = useMemo(() => {
    const monthMap = new Map<string, { present: number; late: number; total: number }>();

    const sessionDateMap = new Map(filteredSessions.map((s) => [s.id, s.date]));

    filteredRecords.forEach((r) => {
      if (r.status === 'excused') return;
      const dateStr = sessionDateMap.get(r.session_id);
      if (!dateStr) return;
      const monthKey = dateStr.slice(0, 7); // yyyy-MM
      const curr = monthMap.get(monthKey) || { present: 0, late: 0, total: 0 };
      if (r.status === 'present') curr.present += 1;
      if (r.status === 'late') curr.late += 1;
      curr.total += 1;
      monthMap.set(monthKey, curr);
    });

    return Array.from(monthMap.entries())
      .map(([month, data]) => {
        const pct = data.total > 0 ? Math.round(((data.present + data.late) / data.total) * 100) : 0;
        return {
          month,
          attendance: pct,
        };
      })
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredRecords, filteredSessions]);

  // Export functions
  const handleExportMemberSummary = () => {
    const data = memberRanking.map((m) => ({
      'Member ID': m.member_id,
      Name: m.name,
      Domain: m.department,
      'Attendance Rate (%)': m.percentage !== null ? m.percentage : 'N/A',
      Present: m.present,
      Late: m.late,
      Absent: m.absent,
      Excused: m.excused,
      'Total Applicable': m.total,
    }));
    exportToCSV(data, 'ecell_member_attendance_report');
    addToast({ type: 'success', title: 'Export Complete', message: 'Member attendance report downloaded.' });
  };

  const handleExportSessionSummary = () => {
    const data = filteredSessions.map((s) => {
      const sRecs = records.filter((r) => r.session_id === s.id);
      const present = sRecs.filter((r) => r.status === 'present').length;
      const late = sRecs.filter((r) => r.status === 'late').length;
      const absent = sRecs.filter((r) => r.status === 'absent').length;
      const excused = sRecs.filter((r) => r.status === 'excused').length;
      const applicable = present + late + absent;
      const pct = applicable > 0 ? Math.round(((present + late) / applicable) * 100) : 'N/A';

      return {
        'Session ID': s.id,
        'Session Name': s.name,
        Date: s.date,
        Category: s.category,
        Location: s.location,
        'Attendance %': pct,
        Present: present,
        Late: late,
        Absent: absent,
        Excused: excused,
      };
    });
    exportToCSV(data, 'ecell_session_attendance_report');
    addToast({ type: 'success', title: 'Export Complete', message: 'Session attendance report downloaded.' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Analytics & Reports</h1>
          <p className="text-sm text-gray-400 mt-1">
            In-depth statistical reporting, domain comparisons, and CSV export suites
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleExportMemberSummary}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-accent-primary hover:bg-blue-600 text-white font-semibold text-xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Member Report CSV</span>
          </button>
          <button
            onClick={handleExportSessionSummary}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-dark-card hover:bg-dark-hover text-gray-200 border border-dark-border font-semibold text-xs transition-colors cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Session Report CSV</span>
          </button>
        </div>
      </div>

      {/* Date Range Bar */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-300">
          <Filter className="h-4 w-4 text-accent-light" />
          <span>Date Range Filter:</span>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary"
          />
          <span className="text-xs text-gray-500">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary"
          />
          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="text-xs text-accent-light hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-dark-card border border-dark-border rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-semibold uppercase">Overall Attendance</span>
            <TrendingUp className="h-5 w-5 text-accent-light" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-3">{overallStats.pct}%</div>
          <p className="text-xs text-gray-500 mt-1">Across all team domains</p>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-semibold uppercase">Sessions Tracked</span>
            <Calendar className="h-5 w-5 text-accent-light" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-3">{overallStats.totalSessions}</div>
          <p className="text-xs text-gray-500 mt-1">In current filter scope</p>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-semibold uppercase">Top Performers</span>
            <Award className="h-5 w-5 text-status-success" />
          </div>
          <div className="text-3xl font-extrabold text-status-success mt-3">
            {memberRanking.filter((m) => (m.percentage ?? 0) >= 85).length}
          </div>
          <p className="text-xs text-gray-500 mt-1">Members above 85% attendance</p>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-semibold uppercase">Below Threshold</span>
            <AlertTriangle className="h-5 w-5 text-status-absent" />
          </div>
          <div className="text-3xl font-extrabold text-status-absent mt-3">{lowAttendees.length}</div>
          <p className="text-xs text-gray-500 mt-1">&lt; {settings.low_attendance_threshold}% attendance threshold</p>
        </div>
      </div>

      {/* Two Column Section: Domain Comparison & Attendance Status Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Domain Comparison Bar Chart */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-5">
          <h3 className="text-base font-bold text-white mb-1">Domain-wise Attendance (%)</h3>
          <p className="text-xs text-gray-400 mb-4">Comparison across the 7 E-Cell domains</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={domainComparison}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fill: CHART_TICK_FILL, fontSize: CHART_TICK_FONTSIZE }}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="department"
                  tick={{ fill: CHART_TICK_FILL, fontSize: 10 }}
                  width={110}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(val: any) => [`${val}%`, 'Attendance']}
                />
                <Bar dataKey="percentage" fill="#2563EB" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution Pie Chart */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-5">
          <h3 className="text-base font-bold text-white mb-1">Attendance Distribution</h3>
          <p className="text-xs text-gray-400 mb-4">Breakdown of all recorded sessions by status</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => <span className="text-xs text-gray-300">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Monthly Trends Area Chart */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-5">
        <h3 className="text-base font-bold text-white mb-1">Monthly Attendance Trend</h3>
        <p className="text-xs text-gray-400 mb-4">Average attendance timeline</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
              <XAxis dataKey="month" tick={{ fill: CHART_TICK_FILL, fontSize: CHART_TICK_FONTSIZE }} />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: CHART_TICK_FILL, fontSize: CHART_TICK_FONTSIZE }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(val: any) => [`${val}%`, 'Attendance Rate']}
              />
              <Line
                type="monotone"
                dataKey="attendance"
                stroke="#60A5FA"
                strokeWidth={3}
                dot={{ r: 5, fill: '#2563EB' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Two Column: Top Attendance vs Low Attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Attendees */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-5">
          <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
            <Award className="h-4 w-4 text-status-success" />
            Highest Attendance Members
          </h3>
          <p className="text-xs text-gray-400 mb-4">Top 5 consistent members</p>
          <div className="space-y-3">
            {topPerformers.map((m, idx) => (
              <div
                key={m.id}
                className="flex items-center justify-between p-3 rounded-lg bg-dark-bg border border-dark-border"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 text-center text-xs font-bold text-accent-light">
                    #{idx + 1}
                  </span>
                  <div>
                    <div className="font-semibold text-white text-xs">{m.name}</div>
                    <div className="text-[10px] text-gray-500">
                      {m.department} · {m.member_id}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-bold text-status-success text-sm">
                    {m.percentage !== null ? `${m.percentage}%` : 'N/A'}
                  </span>
                  <div className="text-[10px] text-gray-400">
                    {m.attended} / {m.total} sessions
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low Attendance Alert */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-5">
          <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-status-absent" />
            Members Below Threshold (&lt; {settings.low_attendance_threshold}%)
          </h3>
          <p className="text-xs text-gray-400 mb-4">Attention required for low attendance</p>
          <div className="space-y-3">
            {lowAttendees.length === 0 ? (
              <div className="p-4 rounded-lg bg-status-success/10 border border-status-success/20 text-status-success text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>Great news! All members meet or exceed the {settings.low_attendance_threshold}% threshold.</span>
              </div>
            ) : (
              lowAttendees.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-dark-bg border border-status-absent/30"
                >
                  <div>
                    <div className="font-semibold text-white text-xs">{m.name}</div>
                    <div className="text-[10px] text-gray-500">
                      {m.department} · {m.member_id}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-status-absent text-sm">
                      {m.percentage !== null ? `${m.percentage}%` : 'N/A'}
                    </span>
                    <div className="text-[10px] text-status-absent">
                      Missed {m.absent} sessions
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
