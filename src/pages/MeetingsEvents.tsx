import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  Plus,
  Search,
  MapPin,
  Clock,
  Pencil,
  Trash2,
  ChevronRight,
  FileText,
  CheckCircle2,
  AlertCircle,
  LayoutGrid,
  List,
  Filter,
  Users,
  FileSpreadsheet,
  QrCode,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AttendanceSession, SessionType, ECellDomain, SessionStatus } from '../types';
import { formatDate, generateId, getStatusBgColor, getStatusLabel } from '../lib/utils';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { SessionQRModal } from '../components/qr/SessionQRModal';

const DOMAIN_OPTIONS: ECellDomain[] = [
  'Event Production & Curation',
  'Public Relations & Marketing',
  'Finance Management',
  'Graphics Design',
  'Technical & Data Management',
  'Content Development',
  'Social Media',
  'General E-Cell / Core Committee',
  'All Domains',
];

const SESSION_TYPES: SessionType[] = [
  'Domain Meeting',
  'Core Committee Meeting',
  'General Body Meeting',
  'Event Planning',
  'E-Summit Meeting',
  'Sponsorship Meeting',
  'Workshop',
  'Other',
];

export default function MeetingsEvents() {
  const navigate = useNavigate();
  const {
    state,
    dispatch,
    addToast,
    isMasterAdmin,
    canManageSession,
    canDeleteSession,
    canCreateSession,
    canViewSession,
    isMember,
    syncFromCloud,
    getSessionMoM,
  } = useApp();
  const { sessions, records, auth } = state;
  const user = auth.user;

  // View switch: Grid vs Table
  const [viewStyle, setViewStyle] = useState<'grid' | 'table'>('grid');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [momFilter, setMomFilter] = useState('ALL');

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<AttendanceSession | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<AttendanceSession | null>(null);
  const [selectedAttendanceSession, setSelectedAttendanceSession] = useState<AttendanceSession | null>(null);
  const [qrSession, setQrSession] = useState<AttendanceSession | null>(null);

  // Automatically refresh latest sessions and attendance from Supabase Cloud on mount
  useEffect(() => {
    syncFromCloud();
  }, [syncFromCloud]);

  const sessionAttendanceRecords = useMemo(() => {
    if (!selectedAttendanceSession) return [];
    const sessRecords = records.filter((r) => r.session_id === selectedAttendanceSession.id);
    const memberMap = new Map(state.members.map((m) => [m.id, m]));
    return sessRecords.map((r) => ({
      ...r,
      member: memberMap.get(r.member_id),
    }));
  }, [selectedAttendanceSession, records, state.members]);

  // Form State
  const defaultDomain: ECellDomain =
    user?.role === 'master_admin' || user?.role === 'president'
      ? 'All Domains'
      : (user?.domain as ECellDomain) || 'Event Production & Curation';

  const [formData, setFormData] = useState({
    name: '',
    session_type: 'Domain Meeting' as SessionType,
    domain: defaultDomain,
    date: new Date().toISOString().split('T')[0],
    start_time: '18:00',
    end_time: '19:30',
    location: 'Conference Room A',
    description: '',
    status: 'Scheduled' as SessionStatus,
  });

  const handleOpenAdd = () => {
    if (!canCreateSession()) {
      addToast({
        type: 'error',
        title: 'Access Restricted',
        message: 'Only Core Committee Leads and Admins can schedule sessions.',
      });
      return;
    }
    setEditingSession(null);
    setFormData({
      name: '',
      session_type: 'Domain Meeting',
      domain: defaultDomain,
      date: new Date().toISOString().split('T')[0],
      start_time: '18:00',
      end_time: '19:30',
      location: 'Conference Room A',
      description: '',
      status: 'Scheduled',
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (s: AttendanceSession, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canManageSession(s)) {
      addToast({
        type: 'error',
        title: 'Unauthorized',
        message: 'You can only edit sessions belonging to your assigned domain.',
      });
      return;
    }
    setEditingSession(s);
    setFormData({
      name: s.name,
      session_type: s.session_type,
      domain: s.domain,
      date: s.date,
      start_time: s.start_time,
      end_time: s.end_time,
      location: s.location,
      description: s.description && s.description.includes('__ECELL_MOM__:') ? s.description.split('__ECELL_MOM__:')[0].trim() : (s.description || ''),
      status: s.status,
    });
    setIsFormOpen(true);
  };

  const handleSaveSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      addToast({ type: 'error', title: 'Error', message: 'Session name is required' });
      return;
    }

    // Role verification for domain assignment
    if (!isMasterAdmin() && (user?.role === 'lead_admin' || user?.role === 'co_lead')) {
      if (
        formData.domain !== user.domain &&
        formData.domain !== 'All Domains' &&
        formData.domain !== 'General E-Cell / Core Committee'
      ) {
        addToast({
          type: 'error',
          title: 'Permission Denied',
          message: `Leads can only schedule meetings for their domain (${user.domain}).`,
        });
        return;
      }
    }

    if (editingSession) {
      let combinedDesc = formData.description;
      if (editingSession.description && editingSession.description.includes('__ECELL_MOM__:')) {
        const marker = '__ECELL_MOM__:';
        const momPart = editingSession.description.substring(editingSession.description.indexOf(marker));
        combinedDesc = formData.description.trim() ? `${formData.description.trim()}\n\n${momPart}` : momPart;
      }
      const updated: AttendanceSession = {
        ...editingSession,
        ...formData,
        description: combinedDesc,
        updated_at: new Date().toISOString(),
      };
      dispatch({ type: 'UPDATE_SESSION', payload: updated });
      addToast({ type: 'success', title: 'Session Updated', message: `${formData.name} updated.` });
    } else {
      const newSession: AttendanceSession = {
        id: generateId('session'),
        ...formData,
        created_by: user?.username || 'admin',
        created_by_name: user?.full_name || 'Admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      dispatch({ type: 'ADD_SESSION', payload: newSession });
      addToast({
        type: 'success',
        title: 'Session Created',
        message: `${formData.name} scheduled for ${formData.domain}.`,
      });
    }

    setIsFormOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!sessionToDelete) return;
    if (!canDeleteSession(sessionToDelete)) {
      addToast({
        type: 'error',
        title: 'Access Denied',
        message: 'Only the session creator or Master Admin can delete this session.',
      });
      setSessionToDelete(null);
      return;
    }
    const sessId = sessionToDelete.id;
    const sessName = sessionToDelete.name;
    dispatch({ type: 'DELETE_SESSION', payload: sessId });

    if (isSupabaseConfigured() && supabase) {
      await supabase.from('sessions').delete().eq('id', sessId);
      await supabase.from('records').delete().eq('session_id', sessId);
    }
    await syncFromCloud();

    addToast({
      type: 'info',
      title: 'Session Removed',
      message: `${sessName} and related records removed and synced to cloud.`,
    });
    setSessionToDelete(null);
  };

  // Current logged in member profile (for general member attendance lookup)
  const currentMember = useMemo(() => {
    if (!user) return null;
    return (
      state.members.find(
        (m) =>
          (m.username && m.username.toLowerCase() === user.username.toLowerCase()) ||
          (m.email && m.email.toLowerCase() === user.email.toLowerCase()) ||
          m.name.toLowerCase() === user.full_name.toLowerCase()
      ) || null
    );
  }, [state.members, user]);

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return sessions
      .filter((s) => {
        // General members only see meetings for their domain or all domains
        if (isMember() && !canViewSession(s)) {
          return false;
        }

        const cleanDesc = s.description && s.description.includes('__ECELL_MOM__:')
          ? s.description.split('__ECELL_MOM__:')[0].trim()
          : (s.description || '');

        const matchesSearch =
          s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
          cleanDesc.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesDomain = selectedDomain === 'ALL' || s.domain === selectedDomain;
        const matchesType = selectedType === 'ALL' || s.session_type === selectedType;
        const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;

        // MoM status
        const mom = getSessionMoM(s.id);
        let matchesMoM = true;
        if (momFilter === 'uploaded') matchesMoM = !!mom;
        if (momFilter === 'pending') matchesMoM = !mom && s.status === 'Completed';

        return matchesSearch && matchesDomain && matchesType && matchesStatus && matchesMoM;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sessions, isMember, canViewSession, searchTerm, selectedDomain, selectedType, statusFilter, momFilter, getSessionMoM]);

  // Session Stats Helper
  const getSessionStats = (sessionId: string) => {
    const sRecs = records.filter((r) => r.session_id === sessionId);
    const present = sRecs.filter((r) => r.status === 'present').length;
    const late = sRecs.filter((r) => r.status === 'late').length;
    const absent = sRecs.filter((r) => r.status === 'absent').length;
    const applicable = present + late + absent;
    const pct = applicable > 0 ? Math.round(((present + late) / applicable) * 100) : null;
    const attended = present + late;
    return { present, late, absent, attended, total: sRecs.length, pct };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Meetings & Events</h1>
          <p className="text-sm text-gray-400 mt-1">
            Browse domain-wise schedules, inspect attendance, and manage official Minutes of Meeting (MoM)
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* Grid vs Table View Switch */}
          <div className="inline-flex rounded-xl p-1 bg-dark-card border border-dark-border">
            <button
              onClick={() => setViewStyle('grid')}
              className={`p-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                viewStyle === 'grid' ? 'bg-accent-primary text-white' : 'text-gray-400 hover:text-white'
              }`}
              title="Card View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewStyle('table')}
              className={`p-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                viewStyle === 'table' ? 'bg-accent-primary text-white' : 'text-gray-400 hover:text-white'
              }`}
              title="Table View"
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          {canCreateSession() && (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-primary hover:bg-blue-600 text-white font-medium shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Create New Session</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search meetings, locations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-accent-primary"
            />
          </div>

          {/* Domain Filter */}
          <div>
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary cursor-pointer"
            >
              <option value="ALL">All Domains ({DOMAIN_OPTIONS.length})</option>
              {DOMAIN_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Session Type */}
          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary cursor-pointer"
            >
              <option value="ALL">All Session Types</option>
              {SESSION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* MoM Availability Filter */}
          <div>
            <select
              value={momFilter}
              onChange={(e) => setMomFilter(e.target.value)}
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary cursor-pointer"
            >
              <option value="ALL">All MoM Statuses</option>
              <option value="uploaded">MoM Uploaded</option>
              <option value="pending">MoM Pending (Completed)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─── CARD VIEW ──────────────────────────────────────────────────────────── */}
      {viewStyle === 'grid' ? (
        filteredSessions.length === 0 ? (
          <div className="bg-dark-card border border-dark-border rounded-xl p-12 text-center">
            <CalendarIcon className="h-8 w-8 text-gray-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">No sessions match your filter criteria</h3>
            <p className="text-xs text-gray-400 mt-1">Try resetting the domain or search filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSessions.map((session) => {
              const mom = getSessionMoM(session.id);
              const stats = getSessionStats(session.id);
              const userCanManage = canManageSession(session);

              return (
                <div
                  key={session.id}
                  onClick={() => navigate(`/sessions/${session.id}`)}
                  className="bg-dark-card border border-dark-border hover:border-accent-primary/60 rounded-xl p-5 transition-all duration-200 cursor-pointer group flex flex-col justify-between shadow-sm"
                >
                  <div>
                    {/* Top Badges */}
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-accent-primary/10 text-accent-light border border-accent-primary/20">
                        {session.domain}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            mom
                              ? 'bg-status-success/15 text-status-success border border-status-success/30'
                              : session.status === 'Completed'
                              ? 'bg-status-late/15 text-status-late border border-status-late/30'
                              : 'bg-blue-500/15 text-blue-400'
                          }`}
                        >
                          {mom ? 'MoM Uploaded' : session.status === 'Completed' ? 'MoM Pending' : session.status}
                        </span>

                        {userCanManage && (
                          <button
                            onClick={(e) => handleOpenEdit(session, e)}
                            className="p-1 rounded text-gray-400 hover:text-white transition-colors"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {userCanManage && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setQrSession(session);
                            }}
                            className="p-1 rounded text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                            title="Show Meeting Attendance QR (Leads Only)"
                          >
                            <QrCode className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {canDeleteSession(session) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSessionToDelete(session);
                            }}
                            className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                            title="Delete Session"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-white group-hover:text-accent-light transition-colors line-clamp-1">
                      {session.name}
                    </h3>
                    <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                      {session.session_type}
                    </p>

                    {/* Metadata */}
                    <div className="space-y-1.5 text-xs text-gray-400 my-3 pt-3 border-t border-dark-border/60">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-3.5 w-3.5 text-gray-500" />
                        <span>{formatDate(session.date)} ({session.start_time} - {session.end_time})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-gray-500" />
                        <span className="truncate">{session.location}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Footer */}
                  <div className="pt-3 border-t border-dark-border flex items-center justify-between text-xs gap-2">
                    {stats.total > 0 ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAttendanceSession(session);
                        }}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-status-success/15 hover:bg-status-success/25 border border-status-success/30 text-status-success font-bold text-[11px] cursor-pointer transition-colors"
                        title="Click to view meeting attendance sheet"
                      >
                        <Users className="h-3 w-3" />
                        <span>{stats.pct}% ({stats.attended}/{stats.total})</span>
                      </button>
                    ) : (
                      <span className="text-gray-500 text-[11px]">Attendance pending</span>
                    )}

                    <span className="inline-flex items-center gap-1 text-accent-light font-semibold text-[11px] group-hover:underline">
                      <span>Details & MoM</span>
                      <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* ─── TABLE VIEW ─────────────────────────────────────────────────────────── */
        <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-dark-bg text-gray-400 uppercase tracking-wider border-b border-dark-border">
                <tr>
                  <th className="p-3.5">Session Name</th>
                  <th className="p-3.5">Domain</th>
                  <th className="p-3.5">Date & Time</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Attendance</th>
                  <th className="p-3.5">MoM Status</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {filteredSessions.map((session) => {
                  const mom = getSessionMoM(session.id);
                  const stats = getSessionStats(session.id);
                  const userCanManage = canManageSession(session);

                  return (
                    <tr
                      key={session.id}
                      onClick={() => navigate(`/sessions/${session.id}`)}
                      className="hover:bg-dark-hover/40 cursor-pointer transition-colors"
                    >
                      <td className="p-3.5 font-bold text-white">
                        <div>{session.name}</div>
                        <div className="text-[10px] text-gray-500">{session.location}</div>
                      </td>
                      <td className="p-3.5 text-gray-300">
                        <span className="px-2 py-0.5 rounded bg-dark-bg border border-dark-border text-[11px]">
                          {session.domain}
                        </span>
                      </td>
                      <td className="p-3.5 whitespace-nowrap text-gray-400">
                        {formatDate(session.date)} ({session.start_time})
                      </td>
                      <td className="p-3.5 text-gray-300">{session.session_type}</td>
                      <td className="p-3.5">
                        {isMember() ? (
                          (() => {
                            const myRec = records.find(
                              (r) =>
                                r.session_id === session.id &&
                                currentMember &&
                                r.member_id === currentMember.id
                            );
                            if (myRec) {
                              return (
                                <span
                                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${getStatusBgColor(
                                    myRec.status
                                  )}`}
                                >
                                  {getStatusLabel(myRec.status)}
                                </span>
                              );
                            }
                            return (
                              <span className="text-gray-500 text-[11px]">
                                {session.status === 'Completed' ? 'Absent / Unrecorded' : 'Scheduled'}
                              </span>
                            );
                          })()
                        ) : stats.total > 0 ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAttendanceSession(session);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-status-success/15 border border-status-success/30 text-status-success font-bold text-xs hover:bg-status-success/25 transition-colors cursor-pointer"
                            title="Click to view full attendance sheet"
                          >
                            <Users className="h-3 w-3" />
                            <span>{stats.pct}% ({stats.attended}/{stats.total})</span>
                          </button>
                        ) : (
                          <span className="text-gray-500">Unrecorded</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            mom
                              ? 'bg-status-success/15 text-status-success'
                              : 'bg-status-late/15 text-status-late'
                          }`}
                        >
                          {mom ? 'MoM Uploaded' : 'MoM Pending'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {canDeleteSession(session) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSessionToDelete(session);
                              }}
                              className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                              title="Delete Session (Admin / Creator)"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {userCanManage && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setQrSession(session);
                              }}
                              className="p-1 rounded text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                              title="Show Live Meeting QR Code (Leads Only)"
                            >
                              <QrCode className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <span className="inline-flex items-center text-accent-light font-semibold">
                            <span>Details</span>
                            <ChevronRight className="h-3.5 w-3.5 ml-1" />
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Session Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingSession ? `Edit Session: ${editingSession.name}` : 'Create New Attendance Session'}
        size="lg"
      >
        <form onSubmit={handleSaveSession} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-400 mb-1">
                Session Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Budget Allocation Review"
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">
                Session Type *
              </label>
              <select
                value={formData.session_type}
                onChange={(e) => setFormData({ ...formData, session_type: e.target.value as SessionType })}
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary cursor-pointer"
              >
                {SESSION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">
                Target Domain Scope *
              </label>
              <select
                value={formData.domain}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value as ECellDomain })}
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary cursor-pointer font-semibold"
              >
                {DOMAIN_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-gray-500 mt-1 block">
                Determines which members will appear in the attendance roster.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Date *</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as SessionStatus })}
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary cursor-pointer"
              >
                <option value="Scheduled">Scheduled</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Start Time</label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">End Time</label>
              <input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-400 mb-1">Location</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g. Conference Room A / Seminar Hall 2"
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-400 mb-1">
                Meeting Description & Objectives
              </label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief agenda items or deliverables..."
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-dark-border">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 rounded-lg bg-dark-bg border border-dark-border text-gray-300 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-accent-primary hover:bg-blue-600 text-white font-semibold text-xs cursor-pointer shadow-lg shadow-blue-500/20"
            >
              {editingSession ? 'Save Changes' : 'Schedule Session'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Dialog */}
      <ConfirmDialog
        isOpen={!!sessionToDelete}
        onClose={() => setSessionToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Session"
        message={`Are you sure you want to remove "${sessionToDelete?.name}"? All associated attendance records and MoM will also be erased.`}
        confirmLabel="Delete Session"
        variant="danger"
      />

      {/* Quick Attendance Sheet Modal (Accessible to Master Admin, President, GS, and Domain Leads) */}
      {selectedAttendanceSession && (
        <Modal
          isOpen={!!selectedAttendanceSession}
          onClose={() => setSelectedAttendanceSession(null)}
          title={`Attendance Record: ${selectedAttendanceSession.name}`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="p-3 bg-dark-bg rounded-xl border border-dark-border flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-gray-400 block font-mono text-[11px]">
                  {formatDate(selectedAttendanceSession.date)} ({selectedAttendanceSession.start_time} - {selectedAttendanceSession.end_time})
                </span>
                <span className="font-bold text-accent-light">
                  Domain: {selectedAttendanceSession.domain}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigate(`/sessions/${selectedAttendanceSession.id}`);
                    setSelectedAttendanceSession(null);
                  }}
                  className="px-3 py-1.5 bg-accent-primary hover:bg-blue-600 text-white font-semibold rounded-lg text-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span>Full Session Page</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto border border-dark-border rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-dark-bg text-gray-400 uppercase tracking-wider border-b border-dark-border sticky top-0">
                  <tr>
                    <th className="p-2.5 w-10 text-center">#</th>
                    <th className="p-2.5">Member Name</th>
                    <th className="p-2.5">Domain</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border">
                  {sessionAttendanceRecords.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-gray-500">
                        No attendance records recorded for this session yet.
                      </td>
                    </tr>
                  ) : (
                    sessionAttendanceRecords.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-dark-hover/40 transition-colors">
                        <td className="p-2.5 text-center text-gray-500 font-mono">{idx + 1}</td>
                        <td className="p-2.5 font-bold text-white">
                          <div>{item.member?.name || item.marked_by_name}</div>
                          <div className="text-[10px] text-gray-500 font-mono">
                            {item.member?.member_id}
                          </div>
                        </td>
                        <td className="p-2.5 text-gray-400">{item.member?.department || selectedAttendanceSession.domain}</td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${getStatusBgColor(
                              item.status
                            )}`}
                          >
                            {getStatusLabel(item.status)}
                          </span>
                        </td>
                        <td className="p-2.5 text-gray-400">{item.remarks || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}
      {/* Session Attendance QR Code Modal */}
      {qrSession && (
        <SessionQRModal
          isOpen={!!qrSession}
          onClose={() => setQrSession(null)}
          session={qrSession}
        />
      )}
    </div>
  );
}
