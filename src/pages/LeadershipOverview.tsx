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
  FileSpreadsheet,
  Search,
  Check,
  X,
  MapPin,
  Users,
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
  'Core Leads',
];

export default function LeadershipOverview() {
  const navigate = useNavigate();
  const { state, addToast, getSessionMoM } = useApp();
  const { sessions, records, members } = state;

  const [selectedDomainFilter, setSelectedDomainFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Completed' | 'Scheduled'>('ALL');

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
    const completionRate =
      completedSessions.length > 0
        ? Math.round((published / completedSessions.length) * 100)
        : 100;

    return { published, drafts, pending, completionRate };
  }, [completedSessions, getSessionMoM]);

  // Domain-wise aggregated table data
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

  // Filtered sessions list for drill-down
  const drillDownSessions = useMemo(() => {
    return sessions
      .filter((s) => {
        if (selectedDomainFilter !== 'ALL' && s.domain !== selectedDomainFilter) {
          return false;
        }
        if (statusFilter === 'Completed' && s.status !== 'Completed') {
          return false;
        }
        if (statusFilter === 'Scheduled' && s.status !== 'Scheduled') {
          return false;
        }
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchName = s.name.toLowerCase().includes(q);
          const matchDomain = s.domain.toLowerCase().includes(q);
          const matchLoc = (s.location || '').toLowerCase().includes(q);
          if (!matchName && !matchDomain && !matchLoc) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sessions, selectedDomainFilter, statusFilter, searchTerm]);

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

    exportToCSV(data, 'ecell_leadership_executive_summary');
    addToast({
      type: 'success',
      title: 'Executive Report Downloaded',
      message: 'Generated complete cross-domain leadership summary CSV.',
    });
  };

  return (
    <div className="space-y-6">
      {/* ─── PAGE HEADER ──────────────────────────────────────────────────────── */}
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
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-primary hover:bg-blue-600 text-white font-semibold text-sm transition-colors cursor-pointer shadow-lg shadow-blue-500/20 self-start sm:self-auto"
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>Export Executive Summary</span>
        </button>
      </div>

      {/* ─── 5 TOP KPI CARDS ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-dark-card border border-dark-border rounded-xl p-5 shadow-sm hover:border-dark-hover transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
              Total Sessions
            </span>
            <Calendar className="h-5 w-5 text-accent-light" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-3">{sessions.length}</div>
          <p className="text-xs text-gray-500 mt-1">Scheduled & conducted</p>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-xl p-5 shadow-sm hover:border-dark-hover transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
              Completed
            </span>
            <CheckCircle2 className="h-5 w-5 text-status-success" />
          </div>
          <div className="text-3xl font-extrabold text-status-success mt-3">
            {completedSessions.length}
          </div>
          <p className="text-xs text-gray-500 mt-1">Attendance recorded</p>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-xl p-5 shadow-sm hover:border-dark-hover transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
              Avg Attendance
            </span>
            <TrendingUp className="h-5 w-5 text-accent-light" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-3">{overallAvgAttendance}%</div>
          <p className="text-xs text-gray-500 mt-1">Cross-domain average</p>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-xl p-5 shadow-sm hover:border-dark-hover transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
              MoM Compliance
            </span>
            <FileText className="h-5 w-5 text-status-late" />
          </div>
          <div className="text-3xl font-extrabold text-status-late mt-3">
            {momStats.completionRate}%
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {momStats.published} of {completedSessions.length} uploaded
            {momStats.drafts > 0 && ` (${momStats.drafts} drafts)`}
          </p>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-xl p-5 shadow-sm hover:border-dark-hover transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
              Upcoming
            </span>
            <Clock className="h-5 w-5 text-blue-400" />
          </div>
          <div className="text-3xl font-extrabold text-blue-400 mt-3">{upcomingSessions.length}</div>
          <p className="text-xs text-gray-500 mt-1">Scheduled on calendar</p>
        </div>
      </div>

      {/* ─── DOMAIN-WISE COMPARISON TABLE ────────────────────────────────────────── */}
      <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-dark-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Layers className="h-5 w-5 text-accent-light" />
              <span>Domain Performance & Governance Matrix</span>
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Click any domain row to filter sessions and inspect documentation
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-400">
              Active Filter:{' '}
              <span className="text-white font-bold bg-dark-bg px-2.5 py-1 rounded-lg border border-dark-border">
                {selectedDomainFilter}
              </span>
            </div>
            {selectedDomainFilter !== 'ALL' && (
              <button
                onClick={() => setSelectedDomainFilter('ALL')}
                className="text-xs text-accent-light hover:underline font-semibold cursor-pointer"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-dark-bg text-gray-400 uppercase tracking-wider text-xs border-b border-dark-border">
              <tr>
                <th className="p-4">Domain Vertical</th>
                <th className="p-4 text-center">Team Size</th>
                <th className="p-4 text-center">Sessions Conducted</th>
                <th className="p-4 text-center">Average Attendance</th>
                <th className="p-4 text-center">MoM Uploaded</th>
                <th className="p-4 text-center">MoM Pending</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {domainSummaries.map((row) => {
                const isSelected = selectedDomainFilter === row.domain;
                return (
                  <tr
                    key={row.domain}
                    onClick={() =>
                      setSelectedDomainFilter(isSelected ? 'ALL' : row.domain)
                    }
                    className={`hover:bg-dark-hover/60 cursor-pointer transition-colors ${
                      isSelected ? 'bg-accent-primary/10' : ''
                    }`}
                  >
                    <td className="p-4 font-bold text-white">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            isSelected ? 'bg-accent-primary' : 'bg-gray-600'
                          }`}
                        />
                        <span>{row.domain}</span>
                      </div>
                    </td>
                    <td className="p-4 text-center text-gray-300 font-medium">
                      {row.membersCount}
                    </td>
                    <td className="p-4 text-center font-semibold text-white">
                      {row.sessionsConducted}
                    </td>
                    <td className="p-4 text-center">
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
                    <td className="p-4 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <span className="px-2.5 py-1 rounded-full bg-status-success/15 text-status-success font-bold text-xs">
                          {row.momUploaded}
                        </span>
                        {row.momDraft > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-bold text-[11px]">
                            +{row.momDraft} Draft
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      {row.momPending > 0 ? (
                        <span className="px-2.5 py-1 rounded-full bg-status-late/15 text-status-late font-bold text-xs">
                          {row.momPending} Pending
                        </span>
                      ) : (
                        <span className="text-gray-500 font-medium text-xs">None</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <span className="inline-flex items-center text-accent-light text-xs font-semibold hover:underline">
                        {isSelected ? 'Filtered' : 'Filter Sessions'}
                        <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── DRILL DOWN SESSIONS ROSTER ────────────────────────────────────────── */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white uppercase tracking-wider">
              Sessions Scope: {selectedDomainFilter} ({drillDownSessions.length})
            </h3>
            <p className="text-sm text-gray-400 mt-0.5">
              Click any session to open its comprehensive Attendance & MoM Details page
            </p>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px]">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search sessions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-primary"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-sm text-white focus:outline-none focus:border-accent-primary cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="Completed">Completed</option>
              <option value="Scheduled">Scheduled</option>
            </select>

            {selectedDomainFilter !== 'ALL' && (
              <button
                onClick={() => setSelectedDomainFilter('ALL')}
                className="text-xs text-accent-light hover:underline font-semibold"
              >
                Show All Domains
              </button>
            )}
          </div>
        </div>

        {drillDownSessions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-sm">No sessions match the current filter or search criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {drillDownSessions.map((s) => {
              const mom = getSessionMoM(s.id);
              const isCompleted = s.status === 'Completed';

              return (
                <div
                  key={s.id}
                  onClick={() => navigate(`/sessions/${s.id}`)}
                  className="p-5 bg-dark-bg border border-dark-border hover:border-accent-primary/60 rounded-xl transition-all cursor-pointer flex flex-col justify-between group shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-accent-primary/10 text-accent-light">
                        {s.domain}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1 ${
                          mom
                            ? mom.is_draft
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-status-success/15 text-status-success border border-status-success/30'
                            : isCompleted
                            ? 'bg-status-late/15 text-status-late border border-status-late/30'
                            : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                        }`}
                      >
                        {mom ? (
                          mom.is_draft ? (
                            <span>MoM Draft</span>
                          ) : (
                            <>
                              <Check className="h-3 w-3" />
                              <span>MoM Uploaded</span>
                            </>
                          )
                        ) : isCompleted ? (
                          <>
                            <Clock className="h-3 w-3" />
                            <span>MoM Pending</span>
                          </>
                        ) : (
                          <span>Scheduled</span>
                        )}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-white group-hover:text-accent-light transition-colors">
                      {s.name}
                    </h4>
                    <p className="text-sm text-gray-400 mt-1.5 flex items-center gap-2 flex-wrap">
                      <span>{formatDate(s.date)}</span>
                      <span>·</span>
                      <span>
                        {s.start_time} - {s.end_time}
                      </span>
                      {s.location && (
                        <>
                          <span>·</span>
                          <span className="truncate max-w-[200px]" title={s.location}>
                            {s.location}
                          </span>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-dark-border flex items-center justify-between text-xs text-gray-400">
                    <span>Type: {s.session_type}</span>
                    <span className="text-accent-light font-semibold group-hover:underline flex items-center gap-1">
                      <span>Inspect Details</span>
                      <ChevronRight className="h-4 w-4" />
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
