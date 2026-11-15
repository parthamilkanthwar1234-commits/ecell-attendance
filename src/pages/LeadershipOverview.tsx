import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Crown,
  Calendar,
  CheckCircle2,
  TrendingUp,
  FileText,
  Clock,
  Layers,
  ChevronRight,
  Filter,
  FileSpreadsheet,
  AlertCircle,
  MapPin,
  Users,
  Search,
  Zap,
  Check,
  X,
  ArrowUpRight,
  Sparkles,
  BarChart3,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ECellDomain, AttendanceSession } from '../types';
import { formatDate, exportToCSV } from '../lib/utils';

const PRIMARY_DOMAINS: ECellDomain[] = [
  'Event Production & Curation',
  'Public Relations & Marketing',
  'Finance Management',
  'Graphics Design',
  'Technical & Data Management',
  'Content Development',
  'Social Media',
  'Core Leads',
];

export default function LeadershipOverview() {
  const navigate = useNavigate();
  const { state, addToast, getSessionMoM } = useApp();
  const { sessions, records, members } = state;

  const [selectedDomainFilter, setSelectedDomainFilter] = useState<string>('ALL');
  const [sessionSearchTerm, setSessionSearchTerm] = useState<string>('');
  const [sessionStatusFilter, setSessionStatusFilter] = useState<'ALL' | 'Completed' | 'Scheduled' | 'Random'>('ALL');
  const [matrixQuickFilter, setMatrixQuickFilter] = useState<'ALL' | 'NEEDS_MOM' | 'HIGH_ATTENDANCE' | 'CORE'>('ALL');

  // Overall Statistics
  const completedSessions = useMemo(
    () => sessions.filter((s) => s.status === 'Completed'),
    [sessions]
  );
  const upcomingSessions = useMemo(
    () => sessions.filter((s) => s.status === 'Scheduled'),
    [sessions]
  );

  const overallAvgAttendance = useMemo(() => {
    const applicable = records.filter((r) => r.status !== 'excused');
    if (applicable.length === 0) return 0;
    const attended = applicable.filter((r) => r.status === 'present' || r.status === 'late').length;
    return Math.round((attended / applicable.length) * 100);
  }, [records]);

  // Accurate MoM counts using getSessionMoM (handles both cloud momDocuments & description-embedded MoMs)
  const momStats = useMemo(() => {
    let published = 0;
    let drafts = 0;
    completedSessions.forEach((s) => {
      const mom = getSessionMoM(s.id);
      if (mom) {
        if (mom.is_draft) {
          drafts++;
        } else {
          published++;
        }
      }
    });
    const pending = Math.max(0, completedSessions.length - (published + drafts));
    const completionRate = completedSessions.length > 0
      ? Math.round((published / completedSessions.length) * 100)
      : 100;

    return { published, drafts, pending, completionRate };
  }, [completedSessions, getSessionMoM]);

  // Domain-wise aggregated matrix data
  const domainSummaries = useMemo(() => {
    return PRIMARY_DOMAINS.map((domain) => {
      // Sessions belonging to this domain (or All Domains that impact it)
      const domainSessions = sessions.filter(
        (s) => s.domain === domain || (s.domain === 'All Domains' && s.status === 'Completed')
      );
      const conducted = domainSessions.filter((s) => s.status === 'Completed');

      // Attendance records for members in this domain
      const domainMemberIds = new Set(
        members
          .filter((m) =>
            domain === 'Core Leads'
              ? m.department === 'Core Leads' ||
                m.role === 'Domain Lead' ||
                m.role === 'Domain Co-Lead' ||
                m.role === 'Master Admin' ||
                m.role === 'President' ||
                m.role === 'General Secretary'
              : m.department === domain
          )
          .map((m) => m.id)
      );

      const domainRecords = records.filter(
        (r) =>
          domainMemberIds.has(r.member_id) &&
          conducted.some((s) => s.id === r.session_id) &&
          r.status !== 'excused'
      );

      const attended = domainRecords.filter(
        (r) => r.status === 'present' || r.status === 'late'
      ).length;

      const avgAttendance =
        domainRecords.length > 0 ? Math.round((attended / domainRecords.length) * 100) : 0;

      // MoM counts with getSessionMoM
      const conductedDomainOnly = sessions.filter(
        (s) => s.domain === domain && s.status === 'Completed'
      );
      let publishedMoM = 0;
      let draftMoM = 0;
      conductedDomainOnly.forEach((s) => {
        const mom = getSessionMoM(s.id);
        if (mom) {
          if (mom.is_draft) draftMoM++;
          else publishedMoM++;
        }
      });
      const pendingMoM = Math.max(0, conductedDomainOnly.length - (publishedMoM + draftMoM));

      return {
        domain,
        sessionsConducted: conducted.length,
        avgAttendance,
        momUploaded: publishedMoM,
        momDraft: draftMoM,
        momPending: pendingMoM,
        membersCount: domainMemberIds.size,
      };
    });
  }, [sessions, records, members, getSessionMoM]);

  // Filtered matrix rows based on quick filter
  const filteredMatrixRows = useMemo(() => {
    return domainSummaries.filter((d) => {
      if (matrixQuickFilter === 'NEEDS_MOM') return d.momPending > 0;
      if (matrixQuickFilter === 'HIGH_ATTENDANCE') return d.avgAttendance >= 85;
      if (matrixQuickFilter === 'CORE') return d.domain === 'Core Leads';
      return true;
    });
  }, [domainSummaries, matrixQuickFilter]);

  // Filtered sessions list for drill-down
  const drillDownSessions = useMemo(() => {
    return sessions
      .filter((s) => {
        // Domain filter
        if (selectedDomainFilter !== 'ALL' && s.domain !== selectedDomainFilter) {
          return false;
        }
        // Status filter
        if (sessionStatusFilter === 'Completed' && s.status !== 'Completed') return false;
        if (sessionStatusFilter === 'Scheduled' && s.status !== 'Scheduled') return false;
        if (sessionStatusFilter === 'Random' && s.session_type !== 'Random Meeting' && !s.is_random_meeting) return false;

        // Search term
        if (sessionSearchTerm.trim()) {
          const q = sessionSearchTerm.toLowerCase();
          const matchName = s.name.toLowerCase().includes(q);
          const matchDomain = s.domain.toLowerCase().includes(q);
          const matchLocation = (s.location || '').toLowerCase().includes(q);
          if (!matchName && !matchDomain && !matchLocation) return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sessions, selectedDomainFilter, sessionStatusFilter, sessionSearchTerm]);

  // Helper for single session attendance percentage
  const getSessionAttendanceStats = (sessionId: string) => {
    const sRecs = records.filter((r) => r.session_id === sessionId);
    if (sRecs.length === 0) return null;
    const present = sRecs.filter((r) => r.status === 'present' || r.status === 'late').length;
    const total = sRecs.length;
    const pct = total > 0 ? Math.round((present / total) * 100) : 0;
    return { present, total, pct };
  };

  // Export Executive Report
  const handleExportExecutiveReport = () => {
    const data = domainSummaries.map((d) => ({
      Domain: d.domain,
      'Members Count': d.membersCount,
      'Sessions Conducted': d.sessionsConducted,
      'Average Attendance (%)': `${d.avgAttendance}%`,
      'MoM Published': d.momUploaded,
      'MoM Drafts': d.momDraft,
      'MoM Pending': d.momPending,
    }));

    exportToCSV(data, 'ecell_executive_governance_report');
    addToast({
      type: 'success',
      title: 'Executive Report Downloaded',
      message: 'Generated complete cross-domain governance summary CSV.',
    });
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* ─── 1. EXECUTIVE HEADER BANNER ────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#131722] via-[#10141d] to-[#0d1017] border border-[#212738] p-6 sm:p-7 shadow-xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-blue-500/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-80 h-80 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[11px] font-bold tracking-wide uppercase">
                <Crown className="h-3.5 w-3.5 text-amber-400" />
                <span>Executive Command · Central Leadership</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-semibold">
                <Sparkles className="h-3 w-3" />
                <span>Live Intelligence</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Leadership Overview & Governance
            </h1>
            <p className="text-sm text-gray-400 max-w-2xl leading-relaxed">
              Real-time cross-domain attendance performance, session verification compliance, and official Minutes of Meeting governance for President, General Secretary & Master Admin.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto flex-wrap">
            <button
              onClick={handleExportExecutiveReport}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs transition-all duration-200 cursor-pointer shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
              title="Download executive governance summary report (CSV)"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Export Executive Summary</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── 2. FIVE PREMIUM KPI METRIC CARDS ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Sessions */}
        <div className="relative overflow-hidden rounded-2xl bg-[#121622] border border-[#1e2538] hover:border-blue-500/40 p-5 transition-all duration-200 shadow-sm group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Total Sessions</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white tracking-tight">{sessions.length}</div>
          <div className="flex items-center justify-between text-[11px] text-gray-400 mt-2 pt-2 border-t border-[#1b2131]">
            <span>Scheduled & conducted</span>
            <span className="text-blue-400 font-semibold">8 Domains</span>
          </div>
        </div>

        {/* Completed Sessions */}
        <div className="relative overflow-hidden rounded-2xl bg-[#121622] border border-[#1e2538] hover:border-status-success/40 p-5 transition-all duration-200 shadow-sm group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Completed</span>
            <div className="w-9 h-9 rounded-xl bg-status-success/10 border border-status-success/20 flex items-center justify-center text-status-success group-hover:scale-105 transition-transform">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-status-success tracking-tight">
            {completedSessions.length}
          </div>
          <div className="flex items-center justify-between text-[11px] text-gray-400 mt-2 pt-2 border-t border-[#1b2131]">
            <span>Attendance logged</span>
            <span className="text-status-success font-semibold">
              {sessions.length > 0 ? Math.round((completedSessions.length / sessions.length) * 100) : 0}% of total
            </span>
          </div>
        </div>

        {/* Average Attendance */}
        <div className="relative overflow-hidden rounded-2xl bg-[#121622] border border-[#1e2538] hover:border-cyan-500/40 p-5 transition-all duration-200 shadow-sm group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Avg Attendance</span>
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white tracking-tight">{overallAvgAttendance}%</div>
          <div className="mt-2 space-y-1 pt-2 border-t border-[#1b2131]">
            <div className="w-full bg-[#1b2131] rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  overallAvgAttendance >= 80 ? 'bg-status-success' : 'bg-status-late'
                }`}
                style={{ width: `${overallAvgAttendance}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-400 text-right">Across all meetings</p>
          </div>
        </div>

        {/* MoM Compliance */}
        <div className="relative overflow-hidden rounded-2xl bg-[#121622] border border-[#1e2538] hover:border-amber-500/40 p-5 transition-all duration-200 shadow-sm group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">MoM Compliance</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-400 tracking-tight">{momStats.completionRate}%</span>
            {momStats.drafts > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                +{momStats.drafts} drafts
              </span>
            )}
          </div>
          <div className="flex items-center justify-between text-[11px] text-gray-400 mt-2 pt-2 border-t border-[#1b2131]">
            <span>{momStats.published} published</span>
            <span className={momStats.pending > 0 ? 'text-status-late font-semibold' : 'text-status-success font-semibold'}>
              {momStats.pending} pending
            </span>
          </div>
        </div>

        {/* Upcoming Sessions */}
        <div className="relative overflow-hidden rounded-2xl bg-[#121622] border border-[#1e2538] hover:border-purple-500/40 p-5 transition-all duration-200 shadow-sm group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Upcoming</span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-purple-400 tracking-tight">{upcomingSessions.length}</div>
          <div className="flex items-center justify-between text-[11px] text-gray-400 mt-2 pt-2 border-t border-[#1b2131]">
            <span>Next on calendar</span>
            <span className="text-purple-300 font-semibold">Active Pipeline</span>
          </div>
        </div>
      </div>

      {/* ─── 3. DOMAIN PERFORMANCE & GOVERNANCE MATRIX (TABLE) ──────────────────── */}
      <div className="rounded-2xl bg-[#121622] border border-[#1e2538] overflow-hidden shadow-lg">
        {/* Table Header Bar with Filters */}
        <div className="p-5 border-b border-[#1e2538] flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#141926]/50">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-400" />
              <span>Domain Performance & Governance Matrix</span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Click any domain row to focus the session roster below and inspect documentation
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Filter Chips */}
            <div className="inline-flex rounded-xl bg-[#0e111a] border border-[#1e2538] p-1 gap-1 text-[11px]">
              <button
                onClick={() => setMatrixQuickFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-colors ${
                  matrixQuickFilter === 'ALL'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                All Verticals
              </button>
              <button
                onClick={() => setMatrixQuickFilter('NEEDS_MOM')}
                className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-colors ${
                  matrixQuickFilter === 'NEEDS_MOM'
                    ? 'bg-amber-500 text-black font-bold'
                    : 'text-gray-400 hover:text-amber-400'
                }`}
              >
                MoM Attention
              </button>
              <button
                onClick={() => setMatrixQuickFilter('HIGH_ATTENDANCE')}
                className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-colors ${
                  matrixQuickFilter === 'HIGH_ATTENDANCE'
                    ? 'bg-status-success text-white'
                    : 'text-gray-400 hover:text-status-success'
                }`}
              >
                High Attendance (≥85%)
              </button>
            </div>

            {selectedDomainFilter !== 'ALL' && (
              <button
                onClick={() => setSelectedDomainFilter('ALL')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 font-semibold text-xs hover:bg-blue-500/20 transition-colors cursor-pointer"
              >
                <span>Filter: {selectedDomainFilter}</span>
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Matrix Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0e121b] text-gray-400 uppercase tracking-wider font-semibold border-b border-[#1e2538]">
              <tr>
                <th className="p-4">Domain Vertical</th>
                <th className="p-4 text-center">Team Size</th>
                <th className="p-4 text-center">Sessions Held</th>
                <th className="p-4 text-center">Avg Attendance</th>
                <th className="p-4 text-center">MoM Published</th>
                <th className="p-4 text-center">MoM Status</th>
                <th className="p-4 text-center">Governance State</th>
                <th className="p-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1b2131]">
              {filteredMatrixRows.map((row) => {
                const isSelected = selectedDomainFilter === row.domain;
                const isCore = row.domain === 'Core Leads';

                return (
                  <tr
                    key={row.domain}
                    onClick={() =>
                      setSelectedDomainFilter(isSelected ? 'ALL' : row.domain)
                    }
                    className={`cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-600/15 border-l-4 border-l-blue-500'
                        : 'hover:bg-[#161c2b]/70'
                    }`}
                  >
                    {/* Domain Vertical */}
                    <td className="p-4">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                            isSelected
                              ? 'bg-blue-400 ring-4 ring-blue-500/20'
                              : isCore
                              ? 'bg-purple-400'
                              : 'bg-gray-500'
                          }`}
                        />
                        <div>
                          <div className="font-bold text-white text-xs flex items-center gap-1.5">
                            <span>{row.domain}</span>
                            {isCore && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                CORE
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-500 mt-0.5">
                            {row.membersCount} active members
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Team Size */}
                    <td className="p-4 text-center">
                      <span className="font-mono text-gray-300 font-semibold">{row.membersCount}</span>
                    </td>

                    {/* Sessions Held */}
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#181f2f] text-white font-bold font-mono">
                        {row.sessionsConducted}
                      </span>
                    </td>

                    {/* Avg Attendance with Mini Progress Bar */}
                    <td className="p-4 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span
                          className={`font-bold font-mono text-xs ${
                            row.avgAttendance >= 85
                              ? 'text-status-success'
                              : row.avgAttendance >= 70
                              ? 'text-status-late'
                              : row.avgAttendance > 0
                              ? 'text-status-absent'
                              : 'text-gray-500'
                          }`}
                        >
                          {row.avgAttendance > 0 ? `${row.avgAttendance}%` : 'N/A'}
                        </span>
                        {row.avgAttendance > 0 && (
                          <div className="w-16 bg-[#181f2f] rounded-full h-1 mt-1 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                row.avgAttendance >= 85
                                  ? 'bg-status-success'
                                  : row.avgAttendance >= 70
                                  ? 'bg-status-late'
                                  : 'bg-status-absent'
                              }`}
                              style={{ width: `${row.avgAttendance}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </td>

                    {/* MoM Published */}
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-status-success/15 border border-status-success/30 text-status-success font-bold font-mono">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>{row.momUploaded}</span>
                      </span>
                    </td>

                    {/* MoM Status (Draft / Pending) */}
                    <td className="p-4 text-center">
                      {row.momPending > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-status-late/15 border border-status-late/30 text-status-late font-bold font-mono">
                          <AlertCircle className="h-3 w-3" />
                          <span>{row.momPending} Pending</span>
                        </span>
                      ) : row.momDraft > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold font-mono">
                          <span>{row.momDraft} Draft</span>
                        </span>
                      ) : (
                        <span className="text-gray-500 font-medium">None Pending</span>
                      )}
                    </td>

                    {/* Governance State Badge */}
                    <td className="p-4 text-center">
                      {row.sessionsConducted === 0 ? (
                        <span className="text-[10px] text-gray-500">No Meetings</span>
                      ) : row.momPending === 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-status-success/15 text-status-success border border-status-success/20">
                          <Check className="h-2.5 w-2.5" />
                          <span>100% Compliant</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-status-late border border-amber-500/20">
                          <Clock className="h-2.5 w-2.5" />
                          <span>Needs Action</span>
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="p-4 text-right">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold ${
                          isSelected
                            ? 'text-blue-400 font-bold'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        <span>{isSelected ? 'Viewing' : 'Inspect'}</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── 4. DRILL DOWN SESSIONS ROSTER ────────────────────────────────────── */}
      <div className="rounded-2xl bg-[#121622] border border-[#1e2538] p-5 sm:p-6 shadow-lg space-y-5">
        {/* Controls Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#1e2538]">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-extrabold text-white tracking-tight">
                Sessions Roster
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 font-bold text-xs">
                {drillDownSessions.length} sessions
              </span>
              {selectedDomainFilter !== 'ALL' && (
                <span className="px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 font-bold text-xs">
                  Domain: {selectedDomainFilter}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">
              Click any session card below to open its comprehensive Attendance Sheet & Minutes of Meeting (MoM)
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-500" />
              <input
                type="text"
                value={sessionSearchTerm}
                onChange={(e) => setSessionSearchTerm(e.target.value)}
                placeholder="Search meeting name..."
                className="w-full pl-9 pr-3 py-1.5 bg-[#0e121b] border border-[#1e2538] rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
              {sessionSearchTerm && (
                <button
                  onClick={() => setSessionSearchTerm('')}
                  className="absolute right-2.5 top-2.5 text-gray-500 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Status Pills */}
            <div className="inline-flex rounded-xl bg-[#0e121b] border border-[#1e2538] p-1 gap-1 text-[11px]">
              {(['ALL', 'Completed', 'Scheduled', 'Random'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSessionStatusFilter(tab)}
                  className={`px-3 py-1 rounded-lg font-semibold cursor-pointer transition-colors ${
                    sessionStatusFilter === tab
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tab === 'ALL' ? 'All Types' : tab === 'Random' ? 'Random Meetings' : tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sessions Card Grid */}
        {drillDownSessions.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-[#1e2538] rounded-xl space-y-2">
            <Calendar className="h-8 w-8 text-gray-600 mx-auto" />
            <h4 className="text-sm font-bold text-white">No sessions match your filter criteria</h4>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              Try resetting the search bar or changing the active domain filter above.
            </p>
            {selectedDomainFilter !== 'ALL' && (
              <button
                onClick={() => setSelectedDomainFilter('ALL')}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold cursor-pointer"
              >
                Reset Domain Filter
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {drillDownSessions.map((session) => {
              const mom = getSessionMoM(session.id);
              const isCompleted = session.status === 'Completed';
              const isRandomMeeting = session.session_type === 'Random Meeting' || !!session.is_random_meeting;
              const attendanceStats = getSessionAttendanceStats(session.id);

              return (
                <div
                  key={session.id}
                  onClick={() => navigate(`/sessions/${session.id}`)}
                  className="p-5 rounded-2xl bg-[#141824] border border-[#20273a] hover:border-blue-500/60 hover:bg-[#161c2b] transition-all duration-200 cursor-pointer flex flex-col justify-between group shadow-sm hover:shadow-lg hover:shadow-blue-500/5 relative overflow-hidden"
                >
                  <div className="space-y-3">
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-blue-500/10 border border-blue-500/25 text-blue-400">
                          {session.domain}
                        </span>
                        {isRandomMeeting && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                            <Zap className="h-2.5 w-2.5 text-purple-400" />
                            <span>Random Meeting</span>
                          </span>
                        )}
                      </div>

                      {/* MoM Status Badge */}
                      {mom ? (
                        mom.is_draft ? (
                          <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center gap-1">
                            <AlertCircle className="h-2.5 w-2.5" />
                            <span>MoM Draft</span>
                          </span>
                        ) : (
                          <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-status-success/15 border border-status-success/30 text-status-success flex items-center gap-1">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            <span>MoM Uploaded</span>
                          </span>
                        )
                      ) : isCompleted ? (
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-status-late/15 border border-status-late/30 text-status-late flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          <span>MoM Pending</span>
                        </span>
                      ) : (
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-blue-500/15 border border-blue-500/30 text-blue-400">
                          Scheduled
                        </span>
                      )}
                    </div>

                    {/* Title & Timing */}
                    <div>
                      <h4 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                        {session.name}
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-2 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-gray-500" />
                          <span>{formatDate(session.date)}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-gray-500" />
                          <span>{session.start_time} - {session.end_time}</span>
                        </span>
                        <span className="flex items-center gap-1 truncate max-w-[160px]" title={session.location}>
                          <MapPin className="h-3 w-3 text-gray-500" />
                          <span className="truncate">{session.location}</span>
                        </span>
                      </div>
                    </div>

                    {/* Attendance snippet (if available) */}
                    {attendanceStats && (
                      <div className="flex items-center justify-between p-2 rounded-xl bg-[#0e121c] border border-[#1b2233] text-[11px]">
                        <span className="text-gray-400 flex items-center gap-1.5">
                          <Users className="h-3 w-3 text-gray-500" />
                          <span>Turnout: <strong>{attendanceStats.present}</strong> / {attendanceStats.total} members</span>
                        </span>
                        <span
                          className={`font-bold font-mono ${
                            attendanceStats.pct >= 80
                              ? 'text-status-success'
                              : attendanceStats.pct >= 60
                              ? 'text-status-late'
                              : 'text-status-absent'
                          }`}
                        >
                          {attendanceStats.pct}% attendance
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="mt-4 pt-3 border-t border-[#1e2538] flex items-center justify-between text-xs text-gray-500">
                    <span className="text-[11px] text-gray-400">Type: {session.session_type}</span>
                    <span className="text-blue-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1 text-[11px]">
                      <span>Inspect Details</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
