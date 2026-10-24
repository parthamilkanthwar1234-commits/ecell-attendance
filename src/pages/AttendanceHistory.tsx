import { useState, useMemo } from 'react';
import {
  History,
  Calendar as CalendarIcon,
  Search,
  Filter,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  User,
  Layers,
  FileSpreadsheet
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AttendanceStatus, EventCategory } from '../types';
import { formatDate, getStatusBgColor, getStatusLabel, exportToCSV } from '../lib/utils';
import Modal from '../components/ui/Modal';

const EVENT_CATEGORIES: EventCategory[] = [
  'Weekly Meeting',
  'E-Summit',
  'Workshop',
  'Hackathon',
  'Recruitment',
  'Sponsorship Meeting',
  'Event Management',
  'General E-Cell Work',
  'Other',
];

const STATUS_OPTIONS: AttendanceStatus[] = ['present', 'absent', 'late', 'excused'];

export default function AttendanceHistory() {
  const { state, addToast } = useApp();
  const { members, sessions, records } = state;

  // View switch: Table vs Calendar
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState('ALL');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Calendar month state
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(null);

  // Departments list
  const departments = useMemo(() => {
    return Array.from(new Set(members.map((m) => m.department)));
  }, [members]);

  // Joined records
  const joinedRecords = useMemo(() => {
    const memberMap = new Map(members.map((m) => [m.id, m]));
    const sessionMap = new Map(sessions.map((s) => [s.id, s]));

    return records.map((r) => ({
      ...r,
      member: memberMap.get(r.member_id),
      session: sessionMap.get(r.session_id),
    }));
  }, [records, members, sessions]);

  // Filtered list
  const filteredRecords = useMemo(() => {
    return joinedRecords
      .filter((item) => {
        if (!item.member || !item.session) return false;

        // Search term (member name, session name, remarks)
        const matchSearch =
          searchTerm === '' ||
          item.member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.member.member_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.session.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (item.remarks && item.remarks.toLowerCase().includes(searchTerm.toLowerCase()));

        // Member
        const matchMember = selectedMember === 'ALL' || item.member.id === selectedMember;

        // Department
        const matchDept = selectedDept === 'ALL' || item.member.department === selectedDept;

        // Category
        const matchCat = selectedCategory === 'ALL' || item.session.category === selectedCategory;

        // Status
        const matchStatus = selectedStatus === 'ALL' || item.status === selectedStatus;

        // Date range
        let matchDate = true;
        if (startDate) {
          matchDate = matchDate && item.session.date >= startDate;
        }
        if (endDate) {
          matchDate = matchDate && item.session.date <= endDate;
        }

        return matchSearch && matchMember && matchDept && matchCat && matchStatus && matchDate;
      })
      .sort((a, b) => {
        const dateA = a.session ? new Date(a.session.date).getTime() : 0;
        const dateB = b.session ? new Date(b.session.date).getTime() : 0;
        return dateB - dateA;
      });
  }, [
    joinedRecords,
    searchTerm,
    selectedMember,
    selectedDept,
    selectedCategory,
    selectedStatus,
    startDate,
    endDate,
  ]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) {
      addToast({ type: 'error', title: 'Export Failed', message: 'No records to export.' });
      return;
    }

    const exportData = filteredRecords.map((r) => ({
      'Session Date': r.session?.date || '',
      'Session Name': r.session?.name || '',
      Category: r.session?.category || '',
      'Member ID': r.member?.member_id || '',
      'Member Name': r.member?.name || '',
      Department: r.member?.department || '',
      Role: r.member?.role || '',
      Status: r.status.toUpperCase(),
      Remarks: r.remarks || '',
    }));

    exportToCSV(exportData, 'ecell_attendance_history');
    addToast({
      type: 'success',
      title: 'Export Complete',
      message: `Exported ${exportData.length} records to CSV.`,
    });
  };

  // Calendar logic
  const calendarYear = currentCalendarDate.getFullYear();
  const calendarMonth = currentCalendarDate.getMonth(); // 0-indexed

  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay(); // 0 is Sunday

  // Sessions by date map
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, typeof sessions>();
    sessions.forEach((s) => {
      const arr = map.get(s.date) || [];
      arr.push(s);
      map.set(s.date, arr);
    });
    return map;
  }, [sessions]);

  // Records for selected calendar date
  const selectedDaySessions = useMemo(() => {
    if (!selectedCalendarDay) return [];
    return sessions.filter((s) => s.date === selectedCalendarDay);
  }, [sessions, selectedCalendarDay]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Attendance History</h1>
          <p className="text-sm text-gray-400 mt-1">
            Browse complete audit logs, apply custom multi-dimensional filters, or inspect via calendar
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* View toggle */}
          <div className="inline-flex rounded-xl p-1 bg-dark-card border border-dark-border">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-accent-primary text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Table View
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'calendar'
                  ? 'bg-accent-primary text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Calendar View
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-light border border-accent-primary/30 font-semibold text-xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {viewMode === 'table' ? (
        <>
          {/* Filters Bar */}
          <div className="bg-dark-card border border-dark-border rounded-xl p-4 shadow-sm space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search name, remarks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-accent-primary transition-colors"
                />
              </div>

              {/* Member */}
              <div>
                <select
                  value={selectedMember}
                  onChange={(e) => setSelectedMember(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary transition-colors cursor-pointer"
                >
                  <option value="ALL">All Members ({members.length})</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.member_id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Department */}
              <div>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary transition-colors cursor-pointer"
                >
                  <option value="ALL">All Domains ({departments.length})</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary transition-colors cursor-pointer"
                >
                  <option value="ALL">All Categories</option>
                  {EVENT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Second row of filters: Status & Date range */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-dark-border/60">
              <div>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary transition-colors cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  {STATUS_OPTIONS.map((st) => (
                    <option key={st} value={st}>
                      {getStatusLabel(st)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 whitespace-nowrap">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 whitespace-nowrap">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary"
                />
              </div>
            </div>
          </div>

          {/* Results Summary & Table */}
          <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden shadow-sm">
            <div className="p-3 bg-dark-bg/60 border-b border-dark-border flex items-center justify-between text-xs text-gray-400">
              <span>Showing {filteredRecords.length} records</span>
              {(searchTerm ||
                selectedMember !== 'ALL' ||
                selectedDept !== 'ALL' ||
                selectedCategory !== 'ALL' ||
                selectedStatus !== 'ALL' ||
                startDate ||
                endDate) && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedMember('ALL');
                    setSelectedDept('ALL');
                    setSelectedCategory('ALL');
                    setSelectedStatus('ALL');
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="text-accent-light hover:underline"
                >
                  Reset all filters
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-dark-bg text-gray-400 uppercase tracking-wider border-b border-dark-border">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Session Name</th>
                    <th className="px-4 py-3">Member</th>
                    <th className="px-4 py-3">Domain</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        No attendance records match your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-dark-hover/40 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-gray-300">
                          {r.session ? formatDate(r.session.date) : 'N/A'}
                        </td>
                        <td className="px-4 py-3 font-semibold text-white">
                          <div>{r.session?.name}</div>
                          <div className="text-[10px] text-gray-500">{r.session?.category}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{r.member?.name}</div>
                          <div className="text-[10px] text-gray-500">{r.member?.member_id}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-400">{r.member?.department}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${getStatusBgColor(
                              r.status
                            )}`}
                          >
                            {getStatusLabel(r.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 max-w-xs truncate">
                          {r.remarks || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Calendar View */
        <div className="bg-dark-card border border-dark-border rounded-xl p-6 shadow-sm space-y-4">
          {/* Calendar Month Navigation */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">
              {currentCalendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  setCurrentCalendarDate(
                    new Date(calendarYear, calendarMonth - 1, 1)
                  )
                }
                className="p-2 rounded-lg bg-dark-bg border border-dark-border text-gray-300 hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCurrentCalendarDate(new Date())}
                className="px-3 py-1.5 rounded-lg bg-dark-bg border border-dark-border text-xs text-gray-300 hover:text-white"
              >
                Today
              </button>
              <button
                onClick={() =>
                  setCurrentCalendarDate(
                    new Date(calendarYear, calendarMonth + 1, 1)
                  )
                }
                className="p-2 rounded-lg bg-dark-bg border border-dark-border text-gray-300 hover:text-white"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-gray-400 pb-2 border-b border-dark-border">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          {/* Calendar Day Grid */}
          <div className="grid grid-cols-7 gap-2">
            {/* Empty boxes for days before first of month */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-24 p-2 rounded-lg bg-dark-bg/30 border border-transparent" />
            ))}

            {/* Days of current month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(
                dayNum
              ).padStart(2, '0')}`;
              const daySessions = sessionsByDate.get(dateStr) || [];
              const hasSessions = daySessions.length > 0;
              const isSelected = selectedCalendarDay === dateStr;

              return (
                <div
                  key={dateStr}
                  onClick={() => setSelectedCalendarDay(dateStr)}
                  className={`min-h-24 p-2 rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-accent-primary/20 border-accent-primary'
                      : hasSessions
                      ? 'bg-dark-bg border-accent-primary/40 hover:border-accent-primary'
                      : 'bg-dark-bg/60 border-dark-border hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold ${
                        hasSessions ? 'text-white' : 'text-gray-500'
                      }`}
                    >
                      {dayNum}
                    </span>
                    {hasSessions && (
                      <span className="w-2 h-2 rounded-full bg-accent-light" />
                    )}
                  </div>

                  <div className="space-y-1 mt-1">
                    {daySessions.map((s) => (
                      <div
                        key={s.id}
                        className="text-[10px] p-1 rounded bg-accent-primary/20 text-accent-light truncate font-medium"
                        title={s.name}
                      >
                        {s.name}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Details below calendar when day selected */}
          {selectedCalendarDay && (
            <div className="mt-6 p-4 rounded-xl bg-dark-bg border border-dark-border space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-accent-light" />
                  Events on {formatDate(selectedCalendarDay)} ({selectedDaySessions.length})
                </h3>
                <button
                  onClick={() => setSelectedCalendarDay(null)}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  Close
                </button>
              </div>

              {selectedDaySessions.length === 0 ? (
                <p className="text-xs text-gray-500">No sessions scheduled on this date.</p>
              ) : (
                <div className="space-y-3">
                  {selectedDaySessions.map((session) => {
                    const sessionRecs = records.filter((r) => r.session_id === session.id);
                    const present = sessionRecs.filter((r) => r.status === 'present').length;
                    const late = sessionRecs.filter((r) => r.status === 'late').length;
                    const absent = sessionRecs.filter((r) => r.status === 'absent').length;

                    return (
                      <div
                        key={session.id}
                        className="p-3 bg-dark-card border border-dark-border rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] px-2 py-0.5 rounded bg-accent-primary/10 text-accent-light font-bold">
                              {session.category}
                            </span>
                            <span className="font-semibold text-white text-sm">{session.name}</span>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {session.start_time} - {session.end_time} · {session.location}
                          </div>
                        </div>

                        <div className="text-xs text-right">
                          <span className="text-status-success font-bold">{present} Present</span> ·{' '}
                          <span className="text-status-late font-bold">{late} Late</span> ·{' '}
                          <span className="text-status-absent font-bold">{absent} Absent</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
