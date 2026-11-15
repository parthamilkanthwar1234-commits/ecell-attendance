import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  TrendingUp,
  Calendar,
  MapPin,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Activity,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { AttendanceStatus } from '../types';
import { formatDate, getStatusBgColor, getStatusLabel } from '../lib/utils';

// ─── Recharts shared style constants ─────────────────────────────────────────

const CHART_GRID_STROKE = '#1E2330';
const CHART_TICK_FILL = '#9CA3AF';
const CHART_TICK_FONTSIZE = 12;
const CHART_TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: '#151922',
  border: '1px solid #1E2330',
  borderRadius: '8px',
  color: '#fff',
};
const ACCENT_BLUE = '#2563EB';

// ─── Stat‑card color map ─────────────────────────────────────────────────────

const COLOR_MAP: Record<string, { bg: string; text: string; iconBg: string }> = {
  blue: {
    bg: 'bg-accent-primary/10',
    text: 'text-accent-light',
    iconBg: 'bg-accent-primary/20',
  },
  green: {
    bg: 'bg-status-success/10',
    text: 'text-status-success',
    iconBg: 'bg-status-success/20',
  },
  red: {
    bg: 'bg-status-absent/10',
    text: 'text-status-absent',
    iconBg: 'bg-status-absent/20',
  },
  amber: {
    bg: 'bg-status-late/10',
    text: 'text-status-late',
    iconBg: 'bg-status-late/20',
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const {
    state: { members, sessions, records, settings },
    getMemberAttendancePercentage,
    getOverallAttendancePercentage,
  } = useApp();

  // Active members
  const activeMembers = useMemo(
    () => members.filter((m) => m.status === 'active'),
    [members],
  );

  // Latest completed session & its records
  const latestSession = useMemo(() => {
    const completed = sessions
      .filter((s) => s.status.toLowerCase() === 'completed')
      .sort((a, b) => b.date.localeCompare(a.date));
    return completed[0] ?? null;
  }, [sessions]);

  const latestRecords = useMemo(() => {
    if (!latestSession) return [];
    return records.filter((r) => r.session_id === latestSession.id);
  }, [records, latestSession]);

  // Today's counts
  const countByStatus = (status: AttendanceStatus) =>
    latestRecords.filter((r) => r.status === status).length;

  const presentToday = countByStatus('present');
  const absentToday = countByStatus('absent');
  const lateToday = countByStatus('late');
  const overallPct = getOverallAttendancePercentage();

  // Upcoming sessions
  const upcomingSessions = useMemo(
    () =>
      sessions
        .filter((s) => s.status.toLowerCase() === 'scheduled' || s.status.toLowerCase() === 'upcoming')
        .sort((a, b) => a.date.localeCompare(b.date)),
    [sessions],
  );

  // Recent activity – last 10 records sorted by created_at desc, enriched
  const recentActivity = useMemo(() => {
    return [...records]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 10)
      .map((r) => ({
        ...r,
        memberName:
          members.find((m) => m.id === r.member_id)?.name ?? 'Unknown',
        sessionName:
          sessions.find((s) => s.id === r.session_id)?.name ?? 'Unknown',
        sessionDate:
          sessions.find((s) => s.id === r.session_id)?.date ?? '',
      }));
  }, [records, members, sessions]);

  // Low attendance members
  const lowAttendanceMembers = useMemo(() => {
    const threshold = settings.low_attendance_threshold ?? 75;
    return activeMembers
      .map((m) => ({
        ...m,
        percentage: getMemberAttendancePercentage(m.id),
      }))
      .filter(
        (m) => m.percentage !== null && m.percentage < threshold,
      )
      .sort((a, b) => (a.percentage ?? 0) - (b.percentage ?? 0));
  }, [activeMembers, getMemberAttendancePercentage, settings.low_attendance_threshold]);

  // ── Weekly bar chart data (last 7 completed sessions) ──────────────────────

  const weeklyChartData = useMemo(() => {
    const completedSorted = sessions
      .filter((s) => s.status.toLowerCase() === 'completed')
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7);

    return completedSorted.map((session) => {
      const sessionRecords = records.filter(
        (r) => r.session_id === session.id,
      );
      const applicable = sessionRecords.filter((r) => r.status !== 'excused');
      const attended = applicable.filter(
        (r) => r.status === 'present' || r.status === 'late',
      ).length;
      const pct = applicable.length > 0 ? Math.round((attended / applicable.length) * 100) : 0;
      return {
        name: formatDate(session.date, 'MMM dd'),
        sessionName: session.name,
        percentage: pct,
      };
    });
  }, [sessions, records]);

  // ── Monthly trend line/area chart data ─────────────────────────────────────

  const monthlyChartData = useMemo(() => {
    const completedSessions = sessions.filter((s) => s.status.toLowerCase() === 'completed');
    const grouped: Record<string, { total: number; attended: number }> = {};

    completedSessions.forEach((session) => {
      const monthKey = formatDate(session.date, 'MMM yyyy');
      const sessionRecords = records.filter(
        (r) => r.session_id === session.id,
      );
      const applicable = sessionRecords.filter((r) => r.status !== 'excused');
      const attended = applicable.filter(
        (r) => r.status === 'present' || r.status === 'late',
      ).length;

      if (!grouped[monthKey]) {
        grouped[monthKey] = { total: 0, attended: 0 };
      }
      grouped[monthKey].total += applicable.length;
      grouped[monthKey].attended += attended;
    });

    return Object.entries(grouped).map(([month, { total, attended }]) => ({
      name: month,
      percentage: total > 0 ? Math.round((attended / total) * 100) : 0,
    }));
  }, [sessions, records]);

  // Today's attendance table – enriched
  const todayAttendanceRows = useMemo(() => {
    return latestRecords
      .map((r) => {
        const member = members.find((m) => m.id === r.member_id);
        return member
          ? { name: member.name, department: member.department, status: r.status }
          : null;
      })
      .filter(Boolean) as {
      name: string;
      department: string;
      status: AttendanceStatus;
    }[];
  }, [latestRecords, members]);

  // ── Stat cards definition ──────────────────────────────────────────────────

  const statCards: {
    title: string;
    value: string | number;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }[] = [
    {
      title: 'Total Members',
      value: activeMembers.length,
      icon: Users,
      color: 'blue',
    },
    {
      title: 'Present Today',
      value: presentToday,
      icon: UserCheck,
      color: 'green',
    },
    {
      title: 'Absent Today',
      value: absentToday,
      icon: UserX,
      color: 'red',
    },
    {
      title: 'Late Today',
      value: lateToday,
      icon: Clock,
      color: 'amber',
    },
    {
      title: 'Overall Attendance',
      value: overallPct !== null ? `${overallPct}%` : '—',
      icon: TrendingUp,
      color: 'blue',
    },
  ];

  // ── Category badge colors ──────────────────────────────────────────────────

  const categoryColor = (cat: string): string => {
    const map: Record<string, string> = {
      'Weekly Meeting': 'bg-accent-primary/15 text-accent-light',
      'E-Summit': 'bg-status-excused/15 text-status-excused',
      Workshop: 'bg-status-late/15 text-status-late',
      Hackathon: 'bg-status-success/15 text-status-success',
      Recruitment: 'bg-pink-500/15 text-pink-400',
      'Sponsorship Meeting': 'bg-cyan-500/15 text-cyan-400',
      'Event Management': 'bg-orange-500/15 text-orange-400',
      'General E-Cell Work': 'bg-teal-500/15 text-teal-400',
      Other: 'bg-gray-500/15 text-gray-400',
    };
    return map[cat] ?? map['Other'];
  };

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-400">
          Welcome back! Here&apos;s your attendance overview.
        </p>
      </div>

      {/* ── 1. Top Stats Row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {statCards.map((card) => {
          const palette = COLOR_MAP[card.color] ?? COLOR_MAP.blue;
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="rounded-xl border border-dark-border bg-dark-card p-4 transition-colors hover:border-dark-hover"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                  {card.title}
                </p>
                <div className={`rounded-lg p-2 ${palette.iconBg}`}>
                  <Icon className={`h-4 w-4 ${palette.text}`} />
                </div>
              </div>
              <p className={`mt-3 text-2xl font-bold ${palette.text}`}>
                {card.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── 2. Two‑column layout ─────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left column (~60 %) */}
        <div className="space-y-6 lg:col-span-3">
          {/* a) Today's Attendance Summary */}
          <div className="rounded-xl border border-dark-border bg-dark-card">
            <div className="flex items-center justify-between border-b border-dark-border px-5 py-4">
              <h2 className="text-sm font-semibold">
                Today&apos;s Attendance Summary
              </h2>
              <Link
                to="/attendance-history"
                className="flex items-center gap-1 text-xs font-medium text-accent-light hover:text-accent-primary transition-colors"
              >
                View All <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {todayAttendanceRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Calendar className="mb-2 h-8 w-8" />
                <p className="text-sm">No attendance records yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-dark-border text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-5 py-3 font-medium">Name</th>
                      <th className="px-5 py-3 font-medium">Department</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayAttendanceRows.slice(0, 8).map((row, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-dark-border/50 last:border-0 hover:bg-dark-hover/40 transition-colors"
                      >
                        <td className="px-5 py-3 font-medium">{row.name}</td>
                        <td className="px-5 py-3 text-gray-400">
                          {row.department}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusBgColor(
                              row.status,
                            )}`}
                          >
                            {getStatusLabel(row.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* b) Weekly Attendance Overview Chart */}
          <div className="rounded-xl border border-dark-border bg-dark-card p-5">
            <h2 className="mb-4 text-sm font-semibold">
              Weekly Attendance Overview
            </h2>
            {weeklyChartData.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-gray-500 text-sm">
                No session data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={weeklyChartData}
                  margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={CHART_GRID_STROKE}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: CHART_TICK_FILL, fontSize: CHART_TICK_FONTSIZE }}
                    axisLine={{ stroke: CHART_GRID_STROKE }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: CHART_TICK_FILL, fontSize: CHART_TICK_FONTSIZE }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 100]}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    cursor={{ fill: 'rgba(37, 99, 235, 0.08)' }}
                    formatter={(value: any) => [`${value}%`, 'Attendance']}
                    labelFormatter={(_label: any, payload: any) =>
                      payload?.[0]?.payload?.sessionName ?? String(_label ?? '')
                    }
                  />
                  <Bar
                    dataKey="percentage"
                    fill={ACCENT_BLUE}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={44}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Right column (~40 %) */}
        <div className="space-y-6 lg:col-span-2">
          {/* a) Upcoming Events */}
          <div className="rounded-xl border border-dark-border bg-dark-card">
            <div className="flex items-center justify-between border-b border-dark-border px-5 py-4">
              <h2 className="text-sm font-semibold">Upcoming Events</h2>
              <Link
                to="/meetings"
                className="flex items-center gap-1 text-xs font-medium text-accent-light hover:text-accent-primary transition-colors"
              >
                View All <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-dark-border/60">
              {upcomingSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                  <Calendar className="mb-2 h-7 w-7" />
                  <p className="text-sm">No upcoming events</p>
                </div>
              ) : (
                upcomingSessions.map((session) => (
                  <div
                    key={session.id}
                    className="px-5 py-3.5 hover:bg-dark-hover/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {session.name}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(session.date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {session.location}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${categoryColor(
                          session.category,
                        )}`}
                      >
                        {session.category}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* b) Recent Activity */}
          <div className="rounded-xl border border-dark-border bg-dark-card">
            <div className="border-b border-dark-border px-5 py-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Activity className="h-4 w-4 text-accent-light" />
                Recent Activity
              </h2>
            </div>
            <div className="divide-y divide-dark-border/60">
              {recentActivity.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-gray-500 text-sm">
                  No recent activity
                </div>
              ) : (
                recentActivity.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-dark-hover/40 transition-colors"
                  >
                    <span
                      className={`inline-block shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${getStatusBgColor(
                        item.status,
                      )}`}
                    >
                      {getStatusLabel(item.status)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {item.memberName}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {item.sessionName}
                        {item.sessionDate &&
                          ` · ${formatDate(item.sessionDate, 'MMM dd')}`}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* c) Low Attendance Alert */}
          <div className="rounded-xl border border-dark-border bg-dark-card">
            <div className="border-b border-dark-border px-5 py-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4 text-status-late" />
                Low Attendance Alert
              </h2>
            </div>
            {lowAttendanceMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1 py-10 text-status-success">
                <CheckCircle2 className="h-7 w-7" />
                <p className="text-sm font-medium">
                  All members above threshold
                </p>
              </div>
            ) : (
              <div className="divide-y divide-dark-border/60">
                {lowAttendanceMembers.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between px-5 py-3 hover:bg-dark-hover/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{m.name}</p>
                      <p className="truncate text-xs text-gray-500">
                        {m.department}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-status-absent">
                      {m.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. Monthly Attendance Trend ──────────────────────────────────────── */}
      <div className="rounded-xl border border-dark-border bg-dark-card p-5">
        <h2 className="mb-4 text-sm font-semibold">
          Monthly Attendance Trend
        </h2>
        {monthlyChartData.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-gray-500 text-sm">
            No monthly data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart
              data={monthlyChartData}
              margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
            >
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT_BLUE} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={ACCENT_BLUE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={CHART_GRID_STROKE}
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fill: CHART_TICK_FILL, fontSize: CHART_TICK_FONTSIZE }}
                axisLine={{ stroke: CHART_GRID_STROKE }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: CHART_TICK_FILL, fontSize: CHART_TICK_FONTSIZE }}
                axisLine={false}
                tickLine={false}
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(value: any) => [`${value}%`, 'Avg Attendance']}
              />
              <Area
                type="monotone"
                dataKey="percentage"
                stroke={ACCENT_BLUE}
                strokeWidth={2}
                fill="url(#areaGradient)"
                dot={{ r: 4, fill: ACCENT_BLUE, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: ACCENT_BLUE, strokeWidth: 2, stroke: '#fff' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
