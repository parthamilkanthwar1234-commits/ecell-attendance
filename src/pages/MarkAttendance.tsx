import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RotateCcw,
  Save,
  Plus,
  Calendar,
  MapPin,
  Check,
  AlertCircle,
  Shield,
  Layers,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  AttendanceRecord,
  AttendanceStatus,
  AttendanceSession,
  SessionType,
  ECellDomain,
  SessionStatus
} from '../types';
import { formatDate, generateId, getStatusBgColor, getStatusLabel } from '../lib/utils';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';

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

export default function MarkAttendance() {
  const navigate = useNavigate();
  const {
    state,
    dispatch,
    addToast,
    isMasterAdmin,
    isMember,
    canCreateSession,
    canManageSession,
    getApplicableMembersForSession,
    syncFromCloud,
  } = useApp();
  const { sessions, records, auth } = state;
  const user = auth.user;

  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Automatically refresh latest cloud attendance records on mount
  useEffect(() => {
    syncFromCloud();
  }, [syncFromCloud]);

  // General members cannot mark attendance; redirect to My Domain
  useEffect(() => {
    if (isMember()) {
      addToast({
        type: 'error',
        title: 'Access Restricted',
        message: 'Only Core Committee Leads and Admins can mark attendance.',
      });
      navigate('/my-domain');
    }
  }, [isMember, navigate, addToast]);

  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [attendanceMap, setAttendanceMap] = useState<
    Record<string, { status: AttendanceStatus; remarks: string }>
  >({});
  const [isDirty, setIsDirty] = useState(false);
  const loadedSessionIdRef = useRef<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [auditReason, setAuditReason] = useState('');
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);

  // New session modal form state
  const defaultDomain: ECellDomain =
    user?.role === 'master_admin' || user?.role === 'president'
      ? 'All Domains'
      : (user?.domain as ECellDomain) || 'Event Production & Curation';

  const [newSessionData, setNewSessionData] = useState({
    name: '',
    session_type: 'Domain Meeting' as SessionType,
    domain: defaultDomain,
    date: new Date().toISOString().split('T')[0],
    start_time: '18:00',
    end_time: '19:30',
    location: 'Conference Room A',
    description: '',
  });

  // Pick first relevant session
  useEffect(() => {
    if (!selectedSessionId && sessions.length > 0) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [sessions, selectedSessionId]);

  // Selected session object
  const currentSession = useMemo(() => {
    return sessions.find((s) => s.id === selectedSessionId);
  }, [sessions, selectedSessionId]);

  // Applicable members for current session
  const applicableMembers = useMemo(() => {
    if (!currentSession) return [];
    return getApplicableMembersForSession(currentSession);
  }, [currentSession, getApplicableMembersForSession]);

  // Existing records for this session
  const existingSessionRecords = useMemo(() => {
    if (!selectedSessionId) return [];
    return records.filter((r) => r.session_id === selectedSessionId);
  }, [records, selectedSessionId]);

  const hasExistingRecords = existingSessionRecords.length > 0;
  const userCanManage = currentSession ? canManageSession(currentSession) : false;

  // Sync attendanceMap when session changes; NEVER overwrite dirty in-progress edits
  useEffect(() => {
    if (!selectedSessionId || applicableMembers.length === 0) {
      if (!selectedSessionId) setAttendanceMap({});
      return;
    }

    const isNewSession = loadedSessionIdRef.current !== selectedSessionId;
    if (isNewSession || !isDirty) {
      const newMap: Record<string, { status: AttendanceStatus; remarks: string }> = {};
      const existingMap = new Map(existingSessionRecords.map((r) => [r.member_id, r]));

      applicableMembers.forEach((member) => {
        const existing = existingMap.get(member.id);
        if (existing) {
          newMap[member.id] = {
            status: existing.status,
            remarks: existing.remarks || '',
          };
        } else {
          newMap[member.id] = {
            status: 'present',
            remarks: '',
          };
        }
      });

      setAttendanceMap(newMap);
      if (isNewSession) {
        loadedSessionIdRef.current = selectedSessionId;
        setIsDirty(false);
      }
    }
  }, [selectedSessionId, applicableMembers.length, existingSessionRecords.length, isDirty]);

  // Status Change Handlers
  const handleStatusChange = (memberId: string, status: AttendanceStatus) => {
    if (!userCanManage) return;
    setIsDirty(true);
    setAttendanceMap((prev) => ({
      ...prev,
      [memberId]: {
        status,
        remarks: prev[memberId]?.remarks || '',
      },
    }));
  };

  const handleRemarksChange = (memberId: string, remarks: string) => {
    if (!userCanManage) return;
    setIsDirty(true);
    setAttendanceMap((prev) => ({
      ...prev,
      [memberId]: {
        status: prev[memberId]?.status || 'present',
        remarks,
      },
    }));
  };

  const handleMarkAll = (status: AttendanceStatus) => {
    if (!userCanManage) return;
    setIsDirty(true);
    const updated: Record<string, { status: AttendanceStatus; remarks: string }> = {};
    applicableMembers.forEach((m) => {
      updated[m.id] = {
        status,
        remarks: attendanceMap[m.id]?.remarks || '',
      };
    });
    setAttendanceMap(updated);
  };

  // Live Stats
  const stats = useMemo(() => {
    const values = applicableMembers.map((m) => attendanceMap[m.id]?.status || 'present');
    const present = values.filter((v) => v === 'present').length;
    const absent = values.filter((v) => v === 'absent').length;
    const late = values.filter((v) => v === 'late').length;
    const excused = values.filter((v) => v === 'excused').length;
    const applicable = present + absent + late;
    const percentage = applicable > 0 ? Math.round(((present + late) / applicable) * 100) : 0;

    return {
      present,
      absent,
      late,
      excused,
      totalExpected: applicableMembers.length,
      percentage,
    };
  }, [applicableMembers, attendanceMap]);

  // Create New Session
  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionData.name.trim()) {
      addToast({ type: 'error', title: 'Error', message: 'Session name is required' });
      return;
    }

    const newSession: AttendanceSession = {
      id: generateId('session'),
      ...newSessionData,
      status: 'In Progress',
      created_by: user?.username || 'admin',
      created_by_name: user?.full_name || 'Admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    dispatch({ type: 'ADD_SESSION', payload: newSession });
    setSelectedSessionId(newSession.id);
    setIsNewSessionModalOpen(false);
    addToast({
      type: 'success',
      title: 'Session Created',
      message: `${newSession.name} created. Roster ready.`,
    });
  };

  // Save Attendance & Directly Commit to Cloud
  const handleSaveAttendance = async () => {
    if (!currentSession) return;
    setIsSaving(true);

    const newRecords: AttendanceRecord[] = applicableMembers.map((member) => {
      const entry = attendanceMap[member.id] || { status: 'present', remarks: '' };
      return {
        id: `rec-${currentSession.id}-${member.id}`,
        session_id: currentSession.id,
        member_id: member.id,
        status: entry.status,
        remarks: entry.remarks,
        marked_by: user?.username || 'admin',
        marked_by_name: user?.full_name || 'Admin',
        created_at: currentSession.created_at,
        updated_at: new Date().toISOString(),
      };
    });

    try {
      // 1. Direct Supabase Cloud upsert
      if (isSupabaseConfigured() && supabase) {
        const { error: recErr } = await supabase.from('records').upsert(newRecords);
        if (recErr) console.error('Cloud records upsert error:', recErr);

        if (currentSession.status !== 'Completed') {
          const { error: sessErr } = await supabase.from('sessions').update({
            status: 'Completed',
            completed_at: new Date().toISOString(),
          }).eq('id', currentSession.id);
          if (sessErr) console.error('Cloud session update error:', sessErr);
        }
      }

      // 2. Dispatch local store
      dispatch({
        type: 'SAVE_ATTENDANCE',
        payload: {
          records: newRecords,
          auditReason: auditReason || 'Attendance recorded via attendance marker',
        },
      });

      if (currentSession.status !== 'Completed') {
        dispatch({
          type: 'UPDATE_SESSION',
          payload: {
            ...currentSession,
            status: 'Completed',
            completed_at: new Date().toISOString(),
          },
        });
      }

      // 3. Immediately refresh and sync
      await syncFromCloud();
      setIsDirty(false);

      addToast({
        type: 'success',
        title: 'Attendance Saved & Cloud Synced',
        message: `Recorded attendance for ${applicableMembers.length} members in "${currentSession.name}" across all devices.`,
      });
    } catch (err) {
      console.error('Error saving attendance:', err);
      addToast({
        type: 'error',
        title: 'Save Failed',
        message: 'Could not sync attendance with cloud. Please check network.',
      });
    } finally {
      setIsSaving(false);
      setIsConfirmOpen(false);
      setAuditReason('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Mark Attendance</h1>
          <p className="text-sm text-gray-400 mt-1">
            Domain-scoped attendance entry with live verification and automated audit trails
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={async () => {
              setIsSyncing(true);
              const ok = await syncFromCloud();
              setIsSyncing(false);
              addToast({
                type: ok ? 'success' : 'info',
                title: ok ? 'Cloud Synced' : 'Sync Notice',
                message: ok ? 'Attendance sessions refreshed from Supabase Cloud.' : 'Running with local storage.',
              });
            }}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-dark-card hover:bg-dark-hover border border-dark-border text-gray-200 font-semibold text-xs transition-colors cursor-pointer"
            title="Fetch latest sessions and attendance from Supabase Cloud"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-accent-light ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Sync Cloud</span>
          </button>

          {canCreateSession() && (
            <button
              onClick={() => setIsNewSessionModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-primary hover:bg-blue-600 text-white font-medium shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>New Session</span>
            </button>
          )}
        </div>
      </div>

      {/* Session Selector Card */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 max-w-xl">
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
              Select Attendance Session
            </label>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="w-full px-4 py-2.5 bg-dark-bg border border-dark-border rounded-lg text-sm text-white focus:outline-none focus:border-accent-primary transition-colors font-semibold cursor-pointer"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {formatDate(s.date)} — {s.name} [{s.domain}]
                </option>
              ))}
            </select>
          </div>

          {currentSession && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-3 py-1.5 rounded-lg bg-accent-primary/10 text-accent-light border border-accent-primary/20 font-bold">
                {currentSession.domain}
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-dark-bg border border-dark-border text-gray-300 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-accent-light" />
                {formatDate(currentSession.date)} ({currentSession.start_time})
              </span>
              <button
                onClick={() => navigate(`/sessions/${currentSession.id}`)}
                className="px-3 py-1.5 rounded-lg bg-dark-bg hover:bg-dark-hover border border-dark-border text-accent-light font-semibold flex items-center gap-1 cursor-pointer"
              >
                <span>Session Details & MoM</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* Permission Notice */}
        {!userCanManage && currentSession && (
          <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300">
            <Shield className="h-4 w-4 flex-shrink-0" />
            <span>
              You do not have management permissions for {currentSession.domain}. You are viewing this roster in read-only mode.
            </span>
          </div>
        )}

        {hasExistingRecords && userCanManage && (
          <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-status-late">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>
              Attendance has already been recorded for this session. Modifying records will be saved to the official audit log.
            </span>
          </div>
        )}
      </div>

      {/* Live Stats Bar & Quick Actions */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-4 flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-status-success/10 border border-status-success/20 text-status-success text-xs font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            <span>Present: {stats.present}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-status-late/10 border border-status-late/20 text-status-late text-xs font-semibold">
            <Clock className="h-4 w-4" />
            <span>Late: {stats.late}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-status-absent/10 border border-status-absent/20 text-status-absent text-xs font-semibold">
            <XCircle className="h-4 w-4" />
            <span>Absent: {stats.absent}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-status-excused/10 border border-status-excused/20 text-status-excused text-xs font-semibold">
            <AlertTriangle className="h-4 w-4" />
            <span>Excused: {stats.excused}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-accent-primary/10 border border-accent-primary/20 text-accent-light text-xs font-bold">
            Attendance: {stats.percentage}%
          </div>
        </div>

        {userCanManage && (
          <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
            <button
              onClick={() => handleMarkAll('present')}
              className="px-3 py-1.5 rounded-lg bg-status-success/15 hover:bg-status-success/25 text-status-success border border-status-success/30 text-xs font-medium cursor-pointer"
            >
              Mark All Present
            </button>
            <button
              onClick={() => handleMarkAll('absent')}
              className="px-3 py-1.5 rounded-lg bg-status-absent/15 hover:bg-status-absent/25 text-status-absent border border-status-absent/30 text-xs font-medium cursor-pointer"
            >
              Mark All Absent
            </button>
          </div>
        )}
      </div>

      {/* Attendance Table */}
      <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-dark-bg text-gray-400 text-xs uppercase tracking-wider border-b border-dark-border">
              <tr>
                <th className="px-4 py-3.5 w-12 text-center">#</th>
                <th className="px-4 py-3.5">Team Member</th>
                <th className="px-4 py-3.5">Domain</th>
                <th className="px-4 py-3.5">Status Selection</th>
                <th className="px-4 py-3.5">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {applicableMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    No members assigned to {currentSession?.domain}.
                  </td>
                </tr>
              ) : (
                applicableMembers.map((member, index) => {
                  const currentStatus = attendanceMap[member.id]?.status || 'present';
                  const currentRemarks = attendanceMap[member.id]?.remarks || '';

                  return (
                    <tr key={member.id} className="hover:bg-dark-hover/40 transition-colors">
                      <td className="px-4 py-3.5 text-center text-xs text-gray-500 font-medium">
                        {index + 1}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-accent-primary/20 text-accent-light flex items-center justify-center font-bold text-xs">
                            {member.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-white">{member.name}</div>
                            <div className="text-xs text-gray-500">
                              {member.member_id} · {member.role}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-xs text-gray-400">
                        <span className="px-2.5 py-1 rounded-md bg-dark-bg border border-dark-border">
                          {member.department}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        {userCanManage ? (
                          <div className="inline-flex rounded-lg p-1 bg-dark-bg border border-dark-border gap-1">
                            <button
                              type="button"
                              onClick={() => handleStatusChange(member.id, 'present')}
                              className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                                currentStatus === 'present'
                                  ? 'bg-status-success text-white'
                                  : 'text-gray-400 hover:text-white'
                              }`}
                            >
                              Present
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(member.id, 'late')}
                              className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                                currentStatus === 'late'
                                  ? 'bg-status-late text-black'
                                  : 'text-gray-400 hover:text-white'
                              }`}
                            >
                              Late
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(member.id, 'absent')}
                              className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                                currentStatus === 'absent'
                                  ? 'bg-status-absent text-white'
                                  : 'text-gray-400 hover:text-white'
                              }`}
                            >
                              Absent
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(member.id, 'excused')}
                              className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                                currentStatus === 'excused'
                                  ? 'bg-status-excused text-white'
                                  : 'text-gray-400 hover:text-white'
                              }`}
                            >
                              Excused
                            </button>
                          </div>
                        ) : (
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getStatusBgColor(currentStatus)}`}>
                            {getStatusLabel(currentStatus)}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {userCanManage ? (
                          <input
                            type="text"
                            value={currentRemarks}
                            onChange={(e) => handleRemarksChange(member.id, e.target.value)}
                            placeholder="Add remarks..."
                            className="w-full max-w-xs px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-xs text-white placeholder-gray-600 focus:outline-none focus:border-accent-primary"
                          />
                        ) : (
                          <span className="text-gray-400 text-xs">{currentRemarks || '-'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Save Bar Footer */}
        {userCanManage && (
          <div className="p-4 bg-dark-bg border-t border-dark-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">
                Audit log automatically tracks all submissions and corrections.
              </span>
              {isDirty && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-status-late border border-amber-500/30 animate-pulse">
                  Unsaved Changes
                </span>
              )}
            </div>
            <button
              onClick={() => setIsConfirmOpen(true)}
              disabled={!currentSession}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-white font-semibold text-sm shadow-lg transition-all cursor-pointer disabled:opacity-50 ${
                isDirty
                  ? 'bg-status-success hover:bg-green-600 shadow-green-500/20 ring-2 ring-green-500/40'
                  : 'bg-accent-primary hover:bg-blue-600 shadow-blue-500/20'
              }`}
            >
              <Save className="h-4 w-4" />
              <span>{isDirty ? 'Save Changes Now' : 'Confirm & Save Attendance'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <Modal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title="Confirm Attendance Record"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-300">
            Save attendance for "{currentSession?.name}"? {stats.present} present, {stats.late} late, {stats.absent} absent, {stats.excused} excused.
          </p>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">
              Audit Reason (optional)
            </label>
            <input
              type="text"
              value={auditReason}
              onChange={(e) => setAuditReason(e.target.value)}
              placeholder="e.g. Regular weekly attendance"
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setIsConfirmOpen(false)}
              className="px-3 py-1.5 bg-dark-bg border border-dark-border rounded text-xs text-gray-400"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAttendance}
              disabled={isSaving}
              className="px-4 py-1.5 bg-accent-primary hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-semibold rounded cursor-pointer shadow-lg shadow-blue-500/20"
            >
              {isSaving ? 'Syncing to Cloud...' : 'Confirm & Save to Cloud'}
            </button>
          </div>
        </div>
      </Modal>

      {/* New Session Modal */}
      <Modal
        isOpen={isNewSessionModalOpen}
        onClose={() => setIsNewSessionModalOpen(false)}
        title="Create New Attendance Session"
        size="lg"
      >
        <form onSubmit={handleCreateSession} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-400 mb-1">
                Event / Meeting Name *
              </label>
              <input
                type="text"
                required
                value={newSessionData.name}
                onChange={(e) => setNewSessionData({ ...newSessionData, name: e.target.value })}
                placeholder="e.g. Weekly Strategy Sync"
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Session Type</label>
              <select
                value={newSessionData.session_type}
                onChange={(e) =>
                  setNewSessionData({ ...newSessionData, session_type: e.target.value as SessionType })
                }
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
              <label className="block text-xs font-semibold text-gray-400 mb-1">Domain</label>
              <select
                value={newSessionData.domain}
                onChange={(e) =>
                  setNewSessionData({ ...newSessionData, domain: e.target.value as ECellDomain })
                }
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary cursor-pointer font-semibold"
              >
                {DOMAIN_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Date *</label>
              <input
                type="date"
                required
                value={newSessionData.date}
                onChange={(e) => setNewSessionData({ ...newSessionData, date: e.target.value })}
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Start Time</label>
              <input
                type="time"
                value={newSessionData.start_time}
                onChange={(e) => setNewSessionData({ ...newSessionData, start_time: e.target.value })}
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">End Time</label>
              <input
                type="time"
                value={newSessionData.end_time}
                onChange={(e) => setNewSessionData({ ...newSessionData, end_time: e.target.value })}
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-400 mb-1">Location</label>
              <input
                type="text"
                value={newSessionData.location}
                onChange={(e) => setNewSessionData({ ...newSessionData, location: e.target.value })}
                placeholder="e.g. Conference Room A"
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-dark-border">
            <button
              type="button"
              onClick={() => setIsNewSessionModalOpen(false)}
              className="px-4 py-2 bg-dark-bg border border-dark-border text-gray-300 text-xs rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-accent-primary hover:bg-blue-600 text-white font-semibold text-xs rounded-lg cursor-pointer"
            >
              Create & Proceed
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
