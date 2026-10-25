import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  Tag,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Upload,
  Download,
  Eye,
  RefreshCw,
  Plus,
  ArrowLeft,
  Save,
  Shield,
  Layers,
  Check,
  AlertCircle,
  FileSpreadsheet,
  Trash2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  AttendanceRecord,
  AttendanceStatus,
  MeetingMinutes,
  ActionItem,
  SessionStatus
} from '../types';
import { formatDate, getStatusBgColor, getStatusLabel, exportToCSV } from '../lib/utils';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';

export default function SessionDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    state,
    dispatch,
    addToast,
    isMasterAdmin,
    isPresident,
    isGeneralSecretary,
    canManageSession,
    canDeleteSession,
    canUploadMoM,
    syncFromCloud,
    getApplicableMembersForSession,
    getSessionMoM,
  } = useApp();

  const session = state.sessions.find((s) => s.id === id);
  const momDoc = id ? getSessionMoM(id) : undefined;

  const existingRecords = useMemo(() => {
    if (!session) return [];
    return state.records.filter((r) => r.session_id === session.id);
  }, [state.records, session]);

  // Combine roster members and any existing record members so all records are always visible
  const applicableMembers = useMemo(() => {
    if (!session) return [];
    const fromRoster = getApplicableMembersForSession(session);
    const recordMemberIds = new Set(existingRecords.map((r) => r.member_id));
    const extraMembers = state.members.filter(
      (m) => recordMemberIds.has(m.id) && !fromRoster.some((r) => r.id === m.id)
    );
    return [...fromRoster, ...extraMembers];
  }, [session, getApplicableMembersForSession, existingRecords, state.members]);

  const [attendanceMap, setAttendanceMap] = useState<
    Record<string, { status: AttendanceStatus; remarks: string }>
  >({});

  // Reliably sync attendance map whenever records or applicable members change
  useEffect(() => {
    const map: Record<string, { status: AttendanceStatus; remarks: string }> = {};
    const existingMap = new Map(existingRecords.map((r) => [r.member_id, r]));

    applicableMembers.forEach((member) => {
      const rec = existingMap.get(member.id);
      if (rec) {
        map[member.id] = { status: rec.status, remarks: rec.remarks || '' };
      } else {
        map[member.id] = { status: 'absent', remarks: '' };
      }
    });
    setAttendanceMap(map);
  }, [existingRecords, applicableMembers]);

  const [isSyncing, setIsSyncing] = useState(false);
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);

  // Automatically fetch latest cloud attendance records on mount
  useEffect(() => {
    syncFromCloud();
  }, [syncFromCloud]);

  // Modals
  const [isMoMModalOpen, setIsMoMModalOpen] = useState(false);
  const [isViewMoMModalOpen, setIsViewMoMModalOpen] = useState(false);
  const [isConfirmSaveOpen, setIsConfirmSaveOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [auditReason, setAuditReason] = useState('');

  // MoM Upload Form State
  const [momForm, setMomForm] = useState({
    document_name: '',
    document_type: 'pdf',
    document_size: '1.2 MB',
    summary: '',
    notes: '',
    action_items_text: '',
  });

  if (!session) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-xl p-12 text-center max-w-xl mx-auto my-12">
        <h2 className="text-xl font-bold text-white mb-2">Session Not Found</h2>
        <p className="text-sm text-gray-400 mb-6">The requested meeting session does not exist or has been removed.</p>
        <button
          onClick={() => navigate('/sessions')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-accent-primary rounded-lg text-sm text-white font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Sessions</span>
        </button>
      </div>
    );
  }

  const userCanManage = canManageSession(session);
  const userCanUploadMoM = canUploadMoM(session);

  // Status Change Handlers
  const handleStatusChange = (memberId: string, status: AttendanceStatus) => {
    if (!userCanManage) return;
    setAttendanceMap((prev) => ({
      ...prev,
      [memberId]: { ...prev[memberId], status },
    }));
  };

  const handleRemarksChange = (memberId: string, remarks: string) => {
    if (!userCanManage) return;
    setAttendanceMap((prev) => ({
      ...prev,
      [memberId]: { ...prev[memberId], remarks },
    }));
  };

  // Bulk set
  const handleBulkSet = (status: AttendanceStatus) => {
    if (!userCanManage) return;
    const updated: Record<string, { status: AttendanceStatus; remarks: string }> = {};
    applicableMembers.forEach((m) => {
      updated[m.id] = {
        status,
        remarks: attendanceMap[m.id]?.remarks || '',
      };
    });
    setAttendanceMap(updated);
  };

  // Live Statistics
  const stats = useMemo(() => {
    const list = applicableMembers.map((m) => attendanceMap[m.id]?.status || 'absent');
    const present = list.filter((s) => s === 'present').length;
    const late = list.filter((s) => s === 'late').length;
    const absent = list.filter((s) => s === 'absent').length;
    const excused = list.filter((s) => s === 'excused').length;
    const applicable = present + late + absent;
    const percentage = applicable > 0 ? Math.round(((present + late) / applicable) * 100) : 0;

    return {
      totalExpected: applicableMembers.length,
      present,
      late,
      absent,
      excused,
      percentage,
    };
  }, [applicableMembers, attendanceMap]);

  // Save Attendance to Store & Sync to Supabase Cloud
  const handleSaveAttendance = async () => {
    if (!session) return;
    setIsSavingAttendance(true);

    const newRecords: AttendanceRecord[] = applicableMembers.map((member) => {
      const entry = attendanceMap[member.id] || { status: 'present', remarks: '' };
      return {
        id: `rec-${session.id}-${member.id}`,
        session_id: session.id,
        member_id: member.id,
        status: entry.status,
        remarks: entry.remarks,
        marked_by: state.auth.user?.username || 'admin',
        marked_by_name: state.auth.user?.full_name || 'Admin Lead',
        created_at: session.created_at,
        updated_at: new Date().toISOString(),
      };
    });

    try {
      // 1. Directly commit records and session status to Supabase Cloud
      if (isSupabaseConfigured() && supabase) {
        const { error: recErr } = await supabase.from('records').upsert(newRecords);
        if (recErr) console.error('Cloud records upsert error:', recErr);

        if (session.status !== 'Completed') {
          const { error: sessErr } = await supabase.from('sessions').update({
            status: 'Completed',
            completed_at: new Date().toISOString(),
          }).eq('id', session.id);
          if (sessErr) console.error('Cloud session update error:', sessErr);
        }
      }

      // 2. Dispatch local store updates
      dispatch({
        type: 'SAVE_ATTENDANCE',
        payload: {
          records: newRecords,
          auditReason: auditReason || 'Attendance updated via session details page',
        },
      });

      if (session.status !== 'Completed') {
        dispatch({
          type: 'UPDATE_SESSION',
          payload: {
            ...session,
            status: 'Completed',
            completed_at: new Date().toISOString(),
          },
        });
      }

      // 3. Immediately refresh and sync
      await syncFromCloud();

      addToast({
        type: 'success',
        title: 'Attendance Saved & Cloud Synced',
        message: `Updated records for ${newRecords.length} members in "${session.name}" across all devices.`,
      });
    } catch (err) {
      console.error('Error saving attendance:', err);
      addToast({
        type: 'error',
        title: 'Save Failed',
        message: 'Could not sync attendance with cloud. Please check network.',
      });
    } finally {
      setIsSavingAttendance(false);
      setIsConfirmSaveOpen(false);
      setAuditReason('');
    }
  };

  // Open MoM Form
  const handleOpenMoMModal = () => {
    if (momDoc) {
      setMomForm({
        document_name: momDoc.document_name,
        document_type: momDoc.document_type,
        document_size: momDoc.document_size,
        summary: momDoc.summary,
        notes: momDoc.notes || '',
        action_items_text: momDoc.action_items.map((a) => `${a.task} [${a.assigned_to_name}]`).join('\n'),
      });
    } else {
      setMomForm({
        document_name: `${session.name.replace(/[^a-zA-Z0-9]/g, '_')}_MoM.pdf`,
        document_type: 'pdf',
        document_size: '1.4 MB',
        summary: `Minutes of the meeting conducted for ${session.name} under domain ${session.domain}. Discussed operational timeline, deliverables, and resource allocation.`,
        notes: 'Meeting concluded with consensus on all agenda points.',
        action_items_text: 'Review stage layout design [Ayush Deshmukh]\nPrepare budget estimation table [Parth Amilkanthwar]',
      });
    }
    setIsMoMModalOpen(true);
  };

  // Save MoM
  const handleSaveMoM = (e: React.FormEvent) => {
    e.preventDefault();
    if (!momForm.document_name.trim() || !momForm.summary.trim()) {
      addToast({ type: 'error', title: 'Error', message: 'Document name and summary are required.' });
      return;
    }

    // Parse action items
    const actionItems: ActionItem[] = momForm.action_items_text
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .map((line, idx) => {
        const match = line.match(/(.*?)\[(.*?)\]/);
        return {
          id: `act-${Date.now()}-${idx}`,
          task: match ? match[1].trim() : line.trim(),
          assigned_to_name: match ? match[2].trim() : 'Unassigned',
          due_date: formatDate(session.date),
          status: 'Pending',
        };
      });

    const newMoM: MeetingMinutes = {
      id: momDoc?.id || `mom-${session.id}`,
      session_id: session.id,
      document_name: momForm.document_name,
      document_type: momForm.document_type,
      document_size: momForm.document_size,
      summary: momForm.summary,
      notes: momForm.notes,
      action_items: actionItems,
      uploaded_by: state.auth.user?.username || 'admin',
      uploaded_by_name: state.auth.user?.full_name || 'Domain Lead',
      uploaded_at: momDoc?.uploaded_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: (momDoc?.version || 0) + 1,
    };

    if (momDoc) {
      dispatch({ type: 'UPDATE_MOM', payload: newMoM });
      addToast({ type: 'success', title: 'MoM Updated', message: 'New version of Minutes of Meeting saved.' });
    } else {
      dispatch({ type: 'ADD_MOM', payload: newMoM });
      addToast({ type: 'success', title: 'MoM Uploaded', message: 'Official meeting document successfully attached.' });
    }

    setIsMoMModalOpen(false);
  };

  // Delete session handler (Only session creator or Master Admin)
  const handleDeleteSession = async () => {
    if (!session) return;
    if (!canDeleteSession(session)) {
      addToast({
        type: 'error',
        title: 'Access Denied',
        message: 'Only the session creator or Master Admin can delete this session.',
      });
      return;
    }

    const sessId = session.id;
    const sessName = session.name;
    dispatch({ type: 'DELETE_SESSION', payload: sessId });

    if (isSupabaseConfigured() && supabase) {
      await supabase.from('sessions').delete().eq('id', sessId);
      await supabase.from('records').delete().eq('session_id', sessId);
    }
    await syncFromCloud();

    addToast({
      type: 'info',
      title: 'Session Removed',
      message: `"${sessName}" and related records removed from cloud.`,
    });
    navigate('/sessions');
  };

  return (
    <div className="space-y-6">
      {/* Back button and page title bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl bg-dark-card border border-dark-border text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="Go Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-accent-primary/10 text-accent-light border border-accent-primary/20">
                {session.domain}
              </span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                  session.status === 'Completed'
                    ? 'bg-status-success/15 text-status-success'
                    : session.status === 'In Progress'
                    ? 'bg-status-late/15 text-status-late'
                    : session.status === 'Cancelled'
                    ? 'bg-status-absent/15 text-status-absent'
                    : 'bg-blue-500/15 text-blue-400'
                }`}
              >
                {session.status.toUpperCase()}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight mt-1">
              {session.name}
            </h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {canDeleteSession(session) && (
            <button
              onClick={() => setIsDeleteConfirmOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 font-semibold text-xs transition-colors cursor-pointer"
              title="Delete this session (Session Creator / Master Admin)"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete Session</span>
            </button>
          )}

          {userCanUploadMoM && (
            <button
              onClick={handleOpenMoMModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-primary hover:bg-blue-600 text-white font-semibold text-xs transition-colors cursor-pointer shadow-lg shadow-blue-500/20"
            >
              {momDoc ? <RefreshCw className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
              <span>{momDoc ? 'Replace MoM' : 'Upload MoM'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── SECTION A: SESSION OVERVIEW ────────────────────────────────────────── */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
          <Layers className="h-4 w-4 text-accent-light" />
          <span>Section A: Session Overview</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-3 bg-dark-bg rounded-lg border border-dark-border">
            <span className="text-xs text-gray-500 block mb-1">Session Type</span>
            <span className="text-sm font-semibold text-white">{session.session_type}</span>
          </div>

          <div className="p-3 bg-dark-bg rounded-lg border border-dark-border">
            <span className="text-xs text-gray-500 block mb-1">Date & Time</span>
            <span className="text-sm font-semibold text-white">
              {formatDate(session.date)} ({session.start_time} - {session.end_time})
            </span>
          </div>

          <div className="p-3 bg-dark-bg rounded-lg border border-dark-border">
            <span className="text-xs text-gray-500 block mb-1">Meeting Location</span>
            <span className="text-sm font-semibold text-white truncate block" title={session.location}>
              {session.location}
            </span>
          </div>

          <div className="p-3 bg-dark-bg rounded-lg border border-dark-border">
            <span className="text-xs text-gray-500 block mb-1">Created By</span>
            <span className="text-sm font-semibold text-white">
              {session.created_by_name || session.created_by}
            </span>
          </div>
        </div>

        {session.description && (
          <div className="mt-4 pt-4 border-t border-dark-border">
            <span className="text-xs text-gray-500 block mb-1 font-semibold uppercase">
              Agenda & Scope
            </span>
            <p className="text-sm text-gray-300 leading-relaxed bg-dark-bg p-3 rounded-lg border border-dark-border">
              {session.description}
            </p>
          </div>
        )}
      </div>

      {/* ─── SECTION B: ATTENDANCE ──────────────────────────────────────────────── */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <Users className="h-4 w-4 text-accent-light" />
              <span>Section B: Attendance Records</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Targeted roster: {session.domain} ({applicableMembers.length} members expected)
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={async () => {
                setIsSyncing(true);
                const ok = await syncFromCloud();
                setIsSyncing(false);
                addToast({
                  type: ok ? 'success' : 'info',
                  title: ok ? 'Cloud Synced' : 'Sync Notice',
                  message: ok ? 'Attendance sheet refreshed from Supabase Cloud.' : 'Running with local storage.',
                });
              }}
              disabled={isSyncing}
              className="px-2.5 py-1.5 rounded-lg bg-dark-bg hover:bg-dark-hover text-gray-300 text-xs font-semibold cursor-pointer border border-dark-border inline-flex items-center gap-1.5"
              title="Click to fetch latest attendance from other devices"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-accent-light ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Sync Cloud</span>
            </button>

            <button
              onClick={() => {
                const data = applicableMembers.map((m, idx) => ({
                  '#': idx + 1,
                  'Member ID': m.member_id,
                  'Name': m.name,
                  'Domain': m.department,
                  'Status': (attendanceMap[m.id]?.status || 'absent').toUpperCase(),
                  'Remarks': attendanceMap[m.id]?.remarks || '',
                  'Session Name': session.name,
                  'Session Date': session.date,
                }));
                exportToCSV(data, `${session.name.replace(/\s+/g, '_')}_attendance`);
                addToast({
                  type: 'success',
                  title: 'Attendance Exported',
                  message: `Exported attendance sheet for ${session.name}.`,
                });
              }}
              className="px-2.5 py-1.5 rounded-lg bg-dark-bg hover:bg-dark-hover text-gray-300 text-xs font-semibold cursor-pointer border border-dark-border inline-flex items-center gap-1.5"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-accent-light" />
              <span>Export CSV</span>
            </button>

            {userCanManage && (
              <>
                <button
                  onClick={() => handleBulkSet('present')}
                  className="px-2.5 py-1.5 rounded-lg bg-status-success/15 hover:bg-status-success/25 text-status-success text-xs font-semibold cursor-pointer border border-status-success/30"
                >
                  All Present
                </button>
                <button
                  onClick={() => handleBulkSet('absent')}
                  className="px-2.5 py-1.5 rounded-lg bg-status-absent/15 hover:bg-status-absent/25 text-status-absent text-xs font-semibold cursor-pointer border border-status-absent/30"
                >
                  All Absent
                </button>
              </>
            )}
          </div>
        </div>

        {/* Attendance Statistics Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center">
          <div className="p-3 bg-dark-bg rounded-lg border border-dark-border">
            <span className="text-[11px] text-gray-400 block">Expected</span>
            <span className="text-lg font-bold text-white">{stats.totalExpected}</span>
          </div>
          <div className="p-3 bg-dark-bg rounded-lg border border-status-success/30">
            <span className="text-[11px] text-status-success block">Present</span>
            <span className="text-lg font-bold text-status-success">{stats.present}</span>
          </div>
          <div className="p-3 bg-dark-bg rounded-lg border border-status-late/30">
            <span className="text-[11px] text-status-late block">Late</span>
            <span className="text-lg font-bold text-status-late">{stats.late}</span>
          </div>
          <div className="p-3 bg-dark-bg rounded-lg border border-status-absent/30">
            <span className="text-[11px] text-status-absent block">Absent</span>
            <span className="text-lg font-bold text-status-absent">{stats.absent}</span>
          </div>
          <div className="p-3 bg-dark-bg rounded-lg border border-status-excused/30">
            <span className="text-[11px] text-status-excused block">Excused</span>
            <span className="text-lg font-bold text-status-excused">{stats.excused}</span>
          </div>
          <div className="p-3 bg-dark-bg rounded-lg border border-accent-primary/40 col-span-2 sm:col-span-1">
            <span className="text-[11px] text-accent-light block">Attendance</span>
            <span className="text-lg font-bold text-accent-light">{stats.percentage}%</span>
          </div>
        </div>

        {/* Read-only banner if user is President or Member */}
        {!userCanManage && (
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300 flex items-center gap-2">
            <Shield className="h-4 w-4 flex-shrink-0" />
            <span>
              You are currently viewing attendance in read-only mode according to your account permissions.
            </span>
          </div>
        )}

        {/* Attendance Roster Table */}
        <div className="overflow-x-auto border border-dark-border rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-dark-bg text-gray-400 uppercase tracking-wider border-b border-dark-border">
              <tr>
                <th className="p-3 w-10 text-center">#</th>
                <th className="p-3">Member Name</th>
                <th className="p-3">Domain</th>
                <th className="p-3">Status</th>
                <th className="p-3">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {applicableMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-500">
                    No members currently assigned to {session.domain}. Assign members to include them.
                  </td>
                </tr>
              ) : (
                applicableMembers.map((member, index) => {
                  const currentStatus = attendanceMap[member.id]?.status || 'present';
                  const currentRemarks = attendanceMap[member.id]?.remarks || '';

                  return (
                    <tr key={member.id} className="hover:bg-dark-hover/40 transition-colors">
                      <td className="p-3 text-center text-gray-500 font-medium">{index + 1}</td>
                      <td className="p-3 font-semibold text-white">
                        <div>{member.name}</div>
                        <div className="text-[10px] text-gray-500">{member.member_id} · {member.role}</div>
                      </td>
                      <td className="p-3 text-gray-400">{member.department}</td>
                      <td className="p-3">
                        {userCanManage ? (
                          <div className="inline-flex rounded-lg p-0.5 bg-dark-bg border border-dark-border gap-1">
                            <button
                              type="button"
                              onClick={() => handleStatusChange(member.id, 'present')}
                              className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${
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
                              className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${
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
                              className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${
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
                              className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${
                                currentStatus === 'excused'
                                  ? 'bg-status-excused text-white'
                                  : 'text-gray-400 hover:text-white'
                              }`}
                            >
                              Excused
                            </button>
                          </div>
                        ) : (
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${getStatusBgColor(currentStatus)}`}>
                            {getStatusLabel(currentStatus)}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {userCanManage ? (
                          <input
                            type="text"
                            value={currentRemarks}
                            onChange={(e) => handleRemarksChange(member.id, e.target.value)}
                            placeholder="Add remarks..."
                            className="w-full max-w-xs px-2.5 py-1 bg-dark-bg border border-dark-border rounded text-xs text-white placeholder-gray-600 focus:outline-none focus:border-accent-primary"
                          />
                        ) : (
                          <span className="text-gray-400">{currentRemarks || '-'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Save Bar */}
        {userCanManage && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-dark-border">
            <span className="text-xs text-gray-400">
              Changes will be recorded in the official audit trail.
            </span>
            <button
              onClick={() => setIsConfirmSaveOpen(true)}
              disabled={isSavingAttendance}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-accent-primary hover:bg-blue-600 disabled:opacity-50 text-white font-semibold text-xs shadow-lg shadow-blue-500/20 cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>{isSavingAttendance ? 'Saving & Syncing...' : 'Save & Update Attendance'}</span>
            </button>
          </div>
        )}
      </div>

      {/* ─── SECTION C: MINUTES OF MEETING (MoM) ─────────────────────────────────── */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
            <FileText className="h-4 w-4 text-accent-light" />
            <span>Section C: Minutes of Meeting (MoM)</span>
          </h2>

          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
              momDoc
                ? 'bg-status-success/15 text-status-success border border-status-success/30'
                : 'bg-status-late/15 text-status-late border border-status-late/30'
            }`}
          >
            {momDoc ? 'MoM Uploaded' : 'MoM Pending'}
          </span>
        </div>

        {momDoc ? (
          <div className="p-4 bg-dark-bg rounded-xl border border-dark-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-primary/20 text-accent-light flex items-center justify-center font-bold text-xs uppercase">
                  {momDoc.document_type}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{momDoc.document_name}</h3>
                  <p className="text-xs text-gray-500">
                    {momDoc.document_size} · Uploaded by {momDoc.uploaded_by_name} on{' '}
                    {formatDate(momDoc.uploaded_at)} (v{momDoc.version})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsViewMoMModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-card hover:bg-dark-hover border border-dark-border text-gray-200 text-xs font-semibold cursor-pointer"
                >
                  <Eye className="h-3.5 w-3.5 text-accent-light" />
                  <span>View Summary</span>
                </button>
                <button
                  onClick={() =>
                    addToast({
                      type: 'success',
                      title: 'Download Started',
                      message: `Downloading ${momDoc.document_name}...`,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-light text-xs font-semibold cursor-pointer border border-accent-primary/30"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download File</span>
                </button>
                {userCanUploadMoM && (
                  <button
                    onClick={handleOpenMoMModal}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-card hover:bg-dark-hover border border-dark-border text-gray-300 text-xs font-semibold cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Replace</span>
                  </button>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-dark-border space-y-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider block">
                Executive Meeting Summary
              </span>
              <p className="text-xs text-gray-300 leading-relaxed">{momDoc.summary}</p>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center bg-dark-bg rounded-xl border border-dashed border-dark-border space-y-3">
            <div className="inline-flex p-3 rounded-full bg-dark-card">
              <FileText className="h-6 w-6 text-gray-500" />
            </div>
            <p className="text-xs text-gray-400">
              MoM has not been uploaded yet for this session.
            </p>
            {userCanUploadMoM ? (
              <button
                onClick={handleOpenMoMModal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-primary hover:bg-blue-600 text-white font-semibold text-xs cursor-pointer shadow-lg shadow-blue-500/20"
              >
                <Upload className="h-4 w-4" />
                <span>Upload Minutes of Meeting</span>
              </button>
            ) : (
              <p className="text-[11px] text-gray-500">
                The domain lead will upload the official document post meeting.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ─── SECTION D: ACTION ITEMS ─────────────────────────────────────────────── */}
      {momDoc && momDoc.action_items && momDoc.action_items.length > 0 && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-accent-light" />
            <span>Section D: Meeting Action Items ({momDoc.action_items.length})</span>
          </h2>

          <div className="space-y-2">
            {momDoc.action_items.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-dark-bg rounded-lg border border-dark-border flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      item.status === 'Completed'
                        ? 'bg-status-success'
                        : item.status === 'In Progress'
                        ? 'bg-status-late'
                        : 'bg-gray-500'
                    }`}
                  />
                  <div>
                    <span className="text-xs font-semibold text-white block">{item.task}</span>
                    <span className="text-[10px] text-gray-500">
                      Assigned to: {item.assigned_to_name} · Due: {item.due_date}
                    </span>
                  </div>
                </div>

                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    item.status === 'Completed'
                      ? 'bg-status-success/15 text-status-success'
                      : item.status === 'In Progress'
                      ? 'bg-status-late/15 text-status-late'
                      : 'bg-dark-card text-gray-400'
                  }`}
                >
                  {item.status.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Saving Attendance */}
      <Modal
        isOpen={isConfirmSaveOpen}
        onClose={() => setIsConfirmSaveOpen(false)}
        title="Confirm Attendance Record Update"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-300">
            You are about to save attendance for {stats.totalExpected} members in "{session.name}".
            Please specify an optional reason for the audit log:
          </p>
          <input
            type="text"
            value={auditReason}
            onChange={(e) => setAuditReason(e.target.value)}
            placeholder="e.g. Regular meeting completion or official leave correction"
            className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-accent-primary"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setIsConfirmSaveOpen(false)}
              className="px-3 py-1.5 rounded-lg bg-dark-bg border border-dark-border text-gray-400 text-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAttendance}
              disabled={isSavingAttendance}
              className="px-4 py-1.5 rounded-lg bg-accent-primary hover:bg-blue-600 disabled:opacity-50 text-white font-semibold text-xs cursor-pointer shadow-lg shadow-blue-500/20"
            >
              {isSavingAttendance ? 'Syncing to Cloud...' : 'Confirm & Save to Cloud'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Upload MoM Modal */}
      <Modal
        isOpen={isMoMModalOpen}
        onClose={() => setIsMoMModalOpen(false)}
        title={momDoc ? 'Replace Minutes of Meeting' : 'Upload Minutes of Meeting (MoM)'}
        size="lg"
      >
        <form onSubmit={handleSaveMoM} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">
                Document File Name *
              </label>
              <input
                type="text"
                required
                value={momForm.document_name}
                onChange={(e) => setMomForm({ ...momForm, document_name: e.target.value })}
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">
                Supported File Format
              </label>
              <select
                value={momForm.document_type}
                onChange={(e) => setMomForm({ ...momForm, document_type: e.target.value })}
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary"
              >
                <option value="pdf">PDF Document (.pdf)</option>
                <option value="docx">Microsoft Word (.docx)</option>
                <option value="doc">Microsoft Word (.doc)</option>
                <option value="txt">Plain Text (.txt)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-400 mb-1">
                Meeting Executive Summary *
              </label>
              <textarea
                rows={3}
                required
                value={momForm.summary}
                onChange={(e) => setMomForm({ ...momForm, summary: e.target.value })}
                placeholder="Key decisions, discussions, and outcomes..."
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary resize-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-400 mb-1">
                Action Items (1 per line, format: Task description [Assigned Member Name])
              </label>
              <textarea
                rows={3}
                value={momForm.action_items_text}
                onChange={(e) => setMomForm({ ...momForm, action_items_text: e.target.value })}
                placeholder="Finalize sponsor deliverables [Parth Amilkanthwar]"
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary resize-none font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-dark-border">
            <button
              type="button"
              onClick={() => setIsMoMModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-dark-bg border border-dark-border text-gray-300 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-accent-primary hover:bg-blue-600 text-white font-semibold text-xs cursor-pointer shadow-lg shadow-blue-500/20"
            >
              {momDoc ? 'Replace MoM Document' : 'Upload Document'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View MoM Modal */}
      {momDoc && (
        <Modal
          isOpen={isViewMoMModalOpen}
          onClose={() => setIsViewMoMModalOpen(false)}
          title={`MoM: ${momDoc.document_name}`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="p-3 bg-dark-bg rounded-lg border border-dark-border text-xs text-gray-400 flex items-center justify-between">
              <span>Uploaded by {momDoc.uploaded_by_name}</span>
              <span>Version {momDoc.version}</span>
            </div>

            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Summary</h4>
              <p className="text-xs text-gray-300 leading-relaxed bg-dark-bg p-3 rounded-lg border border-dark-border">
                {momDoc.summary}
              </p>
            </div>

            {momDoc.notes && (
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Notes</h4>
                <p className="text-xs text-gray-300 bg-dark-bg p-3 rounded-lg border border-dark-border">
                  {momDoc.notes}
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Delete Session Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleDeleteSession}
        title="Delete Session"
        message={`Are you sure you want to permanently delete session "${session.name}"? This action cannot be undone and will delete all attendance records taken for this meeting.`}
        confirmLabel="Delete Session"
        variant="danger"
      />
    </div>
  );
}
