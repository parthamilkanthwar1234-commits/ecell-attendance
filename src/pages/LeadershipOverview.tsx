import { useState, useMemo } from 'react';
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
  Download,
  AlertCircle,
  FileSpreadsheet
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ECellDomain } from '../types';
import { formatDate, exportToCSV } from '../lib/utils';

const PRIMARY_DOMAINS: ECellDomain[] = [
  'Event Production & Curation',
  'Public Relations & Marketing',
  'Finance Management',
  'Graphics Design',
  'Technical & Data Management',
  'Content Development',
  'Social Media',
];

export default function LeadershipOverview() {
  const navigate = useNavigate();
  const { state, addToast } = useApp();
  const { sessions, records, momDocuments, members } = state;

  const [selectedDomainFilter, setSelectedDomainFilter] = useState<string>('ALL');

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

  const momUploadedCount = useMemo(() => {
    const completedIds = new Set(completedSessions.map((s) => s.id));
    return momDocuments.filter((m) => completedIds.has(m.session_id)).length;
  }, [completedSessions, momDocuments]);

  const momCompletionRate = useMemo(() => {
    if (completedSessions.length === 0) return 100;
    return Math.round((momUploadedCount / completedSessions.length) * 100);
  }, [momUploadedCount, completedSessions]);

  // Domain-wise aggregated table data
  const domainSummaries = useMemo(() => {
    const momSessionIds = new Set(momDocuments.map((m) => m.session_id));

    return PRIMARY_DOMAINS.map((domain) => {
      // Sessions belonging to this domain (or All Domains that impact it)
      const domainSessions = sessions.filter(
        (s) => s.domain === domain || (s.domain === 'All Domains' && s.status === 'Completed')
      );
      const conducted = domainSessions.filter((s) => s.status === 'Completed');

      // Attendance records for members in this domain
      const domainMemberIds = new Set(
        members.filter((m) => m.department === domain).map((m) => m.id)
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

      // MoM counts
      const conductedDomainOnly = sessions.filter(
        (s) => s.domain === domain && s.status === 'Completed'
      );
      const uploaded = conductedDomainOnly.filter((s) => momSessionIds.has(s.id)).length;
      const pending = Math.max(0, conductedDomainOnly.length - uploaded);

      return {
        domain,
        sessionsConducted: conducted.length,
        avgAttendance,
        momUploaded: uploaded,
        momPending: pending,
        membersCount: domainMemberIds.size,
      };
    });
  }, [sessions, records, momDocuments, members]);

  // Filtered sessions list for drill-down
  const drillDownSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (selectedDomainFilter === 'ALL') return true;
      return s.domain === selectedDomainFilter;
    });
  }, [sessions, selectedDomainFilter]);

  // Export Executive Report
  const handleExportExecutiveReport = () => {
    const data = domainSummaries.map((d) => ({
      Domain: d.domain,
      'Members Count': d.membersCount,
      'Sessions Conducted': d.sessionsConducted,
      'Average Attendance (%)': `${d.avgAttendance}%`,
      'MoM Uploaded': d.momUploaded,
      'MoM Pending': d.momPending,
    }));

    exportToCSV(data, 'ecell_president_executive_summary');
    addToast({
      type: 'success',
      title: 'Executive Report Downloaded',
      message: 'Generated complete cross-domain leadership summary CSV.',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-status-late border border-amber-500/20">
              <Crown className="h-4 w-4" />
            </span>
            <span className="text-xs uppercase tracking-wider text-gray-400 font-bold">
              Central Leadership · President, General Secretary & Master Admin
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight mt-1">
            Leadership Overview
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Cross-domain participation tracking, meeting governance, and documentation compliance
          </p>
        </div>

        <button
          onClick={handleExportExecutiveReport}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-primary hover:bg-blue-600 text-white font-semibold text-xs transition-colors cursor-pointer shadow-lg shadow-blue-500/20 self-start sm:self-auto"
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>Export Executive Summary</span>
        </button>
      </div>

      {/* 5 Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-dark-card border border-dark-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-semibold uppercase">Total Sessions</span>
            <Calendar className="h-5 w-5 text-accent-light" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-3">{sessions.length}</div>
          <p className="text-[11px] text-gray-500 mt-1">Scheduled & conducted</p>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-semibold uppercase">Completed</span>
            <CheckCircle2 className="h-5 w-5 text-status-success" />
          </div>
          <div className="text-3xl font-extrabold text-status-success mt-3">
            {completedSessions.length}
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Attendance recorded</p>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-semibold uppercase">Avg Attendance</span>
            <TrendingUp className="h-5 w-5 text-accent-light" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-3">{overallAvgAttendance}%</div>
          <p className="text-[11px] text-gray-500 mt-1">Cross-domain average</p>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-semibold uppercase">MoM Compliance</span>
            <FileText className="h-5 w-5 text-status-late" />
          </div>
          <div className="text-3xl font-extrabold text-status-late mt-3">{momCompletionRate}%</div>
          <p className="text-[11px] text-gray-500 mt-1">
            {momUploadedCount} of {completedSessions.length} uploaded
          </p>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-semibold uppercase">Upcoming</span>
            <Clock className="h-5 w-5 text-blue-400" />
          </div>
          <div className="text-3xl font-extrabold text-blue-400 mt-3">{upcomingSessions.length}</div>
          <p className="text-[11px] text-gray-500 mt-1">Scheduled on calendar</p>
        </div>
      </div>

      {/* ─── DOMAIN-WISE COMPARISON TABLE ────────────────────────────────────────── */}
      <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-dark-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-accent-light" />
              <span>Domain Performance & Governance Matrix</span>
            </h2>
            <p className="text-xs text-gray-400">
              Click any domain row to filter sessions and inspect documentation
            </p>
          </div>

          <div className="text-xs text-gray-500">
            Active Filter: <span className="text-white font-bold">{selectedDomainFilter}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-dark-bg text-gray-400 uppercase tracking-wider border-b border-dark-border">
              <tr>
                <th className="p-3.5">Domain Vertical</th>
                <th className="p-3.5 text-center">Team Size</th>
                <th className="p-3.5 text-center">Sessions Conducted</th>
                <th className="p-3.5 text-center">Average Attendance</th>
                <th className="p-3.5 text-center">MoM Uploaded</th>
                <th className="p-3.5 text-center">MoM Pending</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {domainSummaries.map((row) => (
                <tr
                  key={row.domain}
                  onClick={() =>
                    setSelectedDomainFilter(
                      selectedDomainFilter === row.domain ? 'ALL' : row.domain
                    )
                  }
                  className={`hover:bg-dark-hover/50 cursor-pointer transition-colors ${
                    selectedDomainFilter === row.domain ? 'bg-accent-primary/10' : ''
                  }`}
                >
                  <td className="p-3.5 font-bold text-white flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        selectedDomainFilter === row.domain
                          ? 'bg-accent-primary'
                          : 'bg-gray-600'
                      }`}
                    />
                    <span>{row.domain}</span>
                  </td>
                  <td className="p-3.5 text-center text-gray-300">{row.membersCount}</td>
                  <td className="p-3.5 text-center font-semibold text-white">
                    {row.sessionsConducted}
                  </td>
                  <td className="p-3.5 text-center">
                    <span
                      className={`font-bold ${
                        row.avgAttendance >= 75
                          ? 'text-status-success'
                          : row.avgAttendance >= 50
                          ? 'text-status-late'
                          : 'text-status-absent'
                      }`}
                    >
                      {row.avgAttendance > 0 ? `${row.avgAttendance}%` : 'N/A'}
                    </span>
                  </td>
                  <td className="p-3.5 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-status-success/15 text-status-success font-bold">
                      {row.momUploaded}
                    </span>
                  </td>
                  <td className="p-3.5 text-center">
                    {row.momPending > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-status-late/15 text-status-late font-bold">
                        {row.momPending} Pending
                      </span>
                    ) : (
                      <span className="text-gray-500 font-medium">None</span>
                    )}
                  </td>
                  <td className="p-3.5 text-right">
                    <span className="inline-flex items-center text-accent-light text-[11px] font-semibold">
                      {selectedDomainFilter === row.domain ? 'Filtered' : 'Filter Sessions'}
                      <ChevronRight className="h-3 w-3 ml-1" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── DRILL DOWN SESSIONS ROSTER ────────────────────────────────────────── */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Sessions Scope: {selectedDomainFilter} ({drillDownSessions.length})
            </h3>
            <p className="text-xs text-gray-500">
              Click any session to open its comprehensive Attendance & MoM Details page
            </p>
          </div>

          {selectedDomainFilter !== 'ALL' && (
            <button
              onClick={() => setSelectedDomainFilter('ALL')}
              className="text-xs text-accent-light hover:underline"
            >
              Show All Domains
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {drillDownSessions.map((s) => {
            const mom = state.momDocuments.find((m) => m.session_id === s.id);
            const isCompleted = s.status === 'Completed';

            return (
              <div
                key={s.id}
                onClick={() => navigate(`/sessions/${s.id}`)}
                className="p-4 bg-dark-bg border border-dark-border hover:border-accent-primary/60 rounded-xl transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-accent-primary/10 text-accent-light">
                      {s.domain}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        mom
                          ? 'bg-status-success/15 text-status-success'
                          : isCompleted
                          ? 'bg-status-late/15 text-status-late'
                          : 'bg-blue-500/15 text-blue-400'
                      }`}
                    >
                      {mom ? 'MoM Uploaded' : isCompleted ? 'MoM Pending' : 'Upcoming'}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-white group-hover:text-accent-light transition-colors">
                    {s.name}
                  </h4>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDate(s.date)} · {s.start_time} - {s.end_time} · {s.location}
                  </p>
                </div>

                <div className="mt-3 pt-3 border-t border-dark-border flex items-center justify-between text-xs text-gray-500">
                  <span>Type: {s.session_type}</span>
                  <span className="text-accent-light font-semibold group-hover:underline flex items-center gap-1">
                    <span>Inspect</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
