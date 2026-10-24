import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Download,
  Eye,
  ChevronRight,
  TrendingUp,
  UserCheck,
  Building
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatDate, getStatusBgColor, getStatusLabel } from '../lib/utils';

export default function MyDomain() {
  const navigate = useNavigate();
  const { state, addToast } = useApp();
  const { user } = state.auth;
  const userDomain = user?.domain || 'Event Production & Curation';

  // Find linked member profile if any
  const linkedMember = useMemo(() => {
    return state.members.find(
      (m) =>
        m.username === user?.username ||
        m.name.toLowerCase() === user?.full_name.toLowerCase() ||
        m.department === userDomain
    );
  }, [state.members, user, userDomain]);

  // Sessions relevant to user's domain: their domain OR All Domains
  const relevantSessions = useMemo(() => {
    return state.sessions
      .filter(
        (s) =>
          s.domain === userDomain ||
          s.domain === 'All Domains' ||
          s.domain === 'General E-Cell / Core Committee'
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [state.sessions, userDomain]);

  const upcomingSessions = useMemo(
    () => relevantSessions.filter((s) => s.status === 'Scheduled'),
    [relevantSessions]
  );
  const completedSessions = useMemo(
    () => relevantSessions.filter((s) => s.status === 'Completed'),
    [relevantSessions]
  );

  // User's attendance records for relevant sessions
  const userAttendanceRecords = useMemo(() => {
    if (!linkedMember) return [];
    return state.records.filter((r) => r.member_id === linkedMember.id);
  }, [state.records, linkedMember]);

  const userAttendanceMap = useMemo(() => {
    return new Map(userAttendanceRecords.map((r) => [r.session_id, r]));
  }, [userAttendanceRecords]);

  // Attendance Rate calculation
  const personalAttendanceStats = useMemo(() => {
    const applicable = userAttendanceRecords.filter((r) => r.status !== 'excused');
    const attended = applicable.filter((r) => r.status === 'present' || r.status === 'late').length;
    const pct = applicable.length > 0 ? Math.round((attended / applicable.length) * 100) : 0;
    return {
      total: userAttendanceRecords.length,
      attended,
      missed: userAttendanceRecords.filter((r) => r.status === 'absent').length,
      pct,
    };
  }, [userAttendanceRecords]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-accent-primary/10 text-accent-light border border-accent-primary/20">
              {userDomain}
            </span>
            <span className="text-xs text-gray-400">AY 2026–27 Vertical Roster</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">My Domain Workspace</h1>
          <p className="text-sm text-gray-400 mt-1">
            Track scheduled domain sessions, verify personal attendance, and access official Minutes of Meeting
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-3 bg-dark-bg rounded-xl border border-dark-border text-right">
            <span className="text-[11px] text-gray-400 block uppercase font-semibold">
              Personal Attendance
            </span>
            <span
              className={`text-2xl font-black ${
                personalAttendanceStats.pct >= 75
                  ? 'text-status-success'
                  : personalAttendanceStats.pct >= 50
                  ? 'text-status-late'
                  : 'text-status-absent'
              }`}
            >
              {personalAttendanceStats.pct}%
            </span>
          </div>
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-dark-card border border-dark-border rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-semibold uppercase">Upcoming Domain Meets</span>
            <Calendar className="h-5 w-5 text-blue-400" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-3">{upcomingSessions.length}</div>
          <p className="text-xs text-gray-500 mt-1">Scheduled on calendar</p>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-semibold uppercase">Sessions Attended</span>
            <CheckCircle2 className="h-5 w-5 text-status-success" />
          </div>
          <div className="text-3xl font-extrabold text-status-success mt-3">
            {personalAttendanceStats.attended}
          </div>
          <p className="text-xs text-gray-500 mt-1">Out of {completedSessions.length} sessions</p>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-semibold uppercase">Domain MoMs Available</span>
            <FileText className="h-5 w-5 text-accent-light" />
          </div>
          <div className="text-3xl font-extrabold text-accent-light mt-3">
            {state.momDocuments.filter((m) =>
              relevantSessions.some((s) => s.id === m.session_id)
            ).length}
          </div>
          <p className="text-xs text-gray-500 mt-1">Official meeting minutes</p>
        </div>
      </div>

      {/* ─── UPCOMING SESSIONS ──────────────────────────────────────────────────── */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-400" />
          <span>Upcoming Sessions for {userDomain}</span>
        </h2>

        {upcomingSessions.length === 0 ? (
          <p className="text-xs text-gray-500 p-4 bg-dark-bg rounded-lg border border-dark-border text-center">
            No upcoming sessions scheduled for your domain at this moment.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {upcomingSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => navigate(`/sessions/${session.id}`)}
                className="p-4 bg-dark-bg border border-dark-border hover:border-accent-primary/60 rounded-xl transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-accent-primary/10 text-accent-light">
                      {session.domain}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-500/15 text-blue-400">
                      SCHEDULED
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white group-hover:text-accent-light transition-colors">
                    {session.name}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDate(session.date)} · {session.start_time} - {session.end_time} · {session.location}
                  </p>
                </div>

                <div className="mt-3 pt-3 border-t border-dark-border flex items-center justify-between text-xs text-gray-500">
                  <span>Type: {session.session_type}</span>
                  <span className="text-accent-light font-semibold flex items-center gap-1 group-hover:underline">
                    <span>View Agenda</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── COMPLETED MEETINGS & ATTENDANCE STATUS ROSTER ───────────────────────── */}
      <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-dark-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-status-success" />
              <span>Completed Meeting History & MoM</span>
            </h2>
            <p className="text-xs text-gray-400">
              Verify your attendance record and read the executive meeting minutes
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-dark-bg text-gray-400 uppercase tracking-wider border-b border-dark-border">
              <tr>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Session Name</th>
                <th className="p-3.5">Scope</th>
                <th className="p-3.5">Your Attendance</th>
                <th className="p-3.5">Minutes of Meeting</th>
                <th className="p-3.5 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {completedSessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-500">
                    No completed sessions recorded yet.
                  </td>
                </tr>
              ) : (
                completedSessions.map((s) => {
                  const rec = userAttendanceMap.get(s.id);
                  const mom = state.momDocuments.find((m) => m.session_id === s.id);

                  return (
                    <tr
                      key={s.id}
                      onClick={() => navigate(`/sessions/${s.id}`)}
                      className="hover:bg-dark-hover/40 cursor-pointer transition-colors"
                    >
                      <td className="p-3.5 whitespace-nowrap text-gray-300">
                        {formatDate(s.date)}
                      </td>
                      <td className="p-3.5 font-bold text-white">
                        <div>{s.name}</div>
                        <div className="text-[10px] text-gray-500">{s.location}</div>
                      </td>
                      <td className="p-3.5 text-gray-400">
                        <span className="px-2 py-0.5 rounded-md bg-dark-bg border border-dark-border">
                          {s.domain}
                        </span>
                      </td>
                      <td className="p-3.5">
                        {rec ? (
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${getStatusBgColor(
                              rec.status
                            )}`}
                          >
                            {getStatusLabel(rec.status)}
                          </span>
                        ) : (
                          <span className="text-gray-500">Not Applicable</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        {mom ? (
                          <div className="flex items-center gap-1.5 text-accent-light font-semibold">
                            <FileText className="h-3.5 w-3.5" />
                            <span className="truncate max-w-[140px]">{mom.document_name}</span>
                          </div>
                        ) : (
                          <span className="text-status-late text-[11px] font-medium">Pending</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        <span className="inline-flex items-center text-accent-light font-semibold">
                          <span>Inspect</span>
                          <ChevronRight className="h-3.5 w-3.5 ml-1" />
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
