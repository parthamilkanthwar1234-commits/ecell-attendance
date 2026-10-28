import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Zap,
  Save,
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  Users,
  Check,
  AlertCircle,
} from 'lucide-react';
import Modal from '../ui/Modal';
import { MeetingMinutes, ActionItem, AttendanceSession } from '../../types';
import { useApp } from '../../context/AppContext';

interface MoMEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: AttendanceSession;
  existingMoM?: MeetingMinutes;
  onSave: (mom: MeetingMinutes) => Promise<void>;
}

export const MoMEditorModal: React.FC<MoMEditorModalProps> = ({
  isOpen,
  onClose,
  session,
  existingMoM,
  onSave,
}) => {
  const { state, addToast } = useApp();
  const user = state.auth.user;

  // Form State matching all 7 sections of official template
  const [domain, setDomain] = useState(existingMoM?.domain || session.domain);
  const [date, setDate] = useState(existingMoM?.date || session.date);
  const [time, setTime] = useState(existingMoM?.time || `${session.start_time} - ${session.end_time}`);
  const [venue, setVenue] = useState(existingMoM?.venue || session.location || 'Conference Room A');
  const [conductedBy, setConductedBy] = useState(existingMoM?.conducted_by || session.created_by_name);
  const [preparedBy, setPreparedBy] = useState(existingMoM?.prepared_by || user?.full_name || 'Domain Scribe');

  const [attendancePresent, setAttendancePresent] = useState(existingMoM?.attendance_present || '');
  const [attendanceAbsent, setAttendanceAbsent] = useState(existingMoM?.attendance_absent || '');

  const [agendaDiscussion, setAgendaDiscussion] = useState<string[]>(
    existingMoM?.agenda_discussion && existingMoM.agenda_discussion.length > 0
      ? existingMoM.agenda_discussion
      : ['']
  );

  const [keyDecisions, setKeyDecisions] = useState<string[]>(
    existingMoM?.key_decisions && existingMoM.key_decisions.length > 0
      ? existingMoM.key_decisions
      : ['']
  );

  const [actionItems, setActionItems] = useState<ActionItem[]>(
    existingMoM?.action_items && existingMoM.action_items.length > 0
      ? existingMoM.action_items
      : [
          {
            id: `act-${Date.now()}-1`,
            task: '',
            assigned_to_name: '',
            due_date: session.date,
            status: 'Pending',
          },
        ]
  );

  const [updatesRequirements, setUpdatesRequirements] = useState<string[]>(
    existingMoM?.updates_requirements && existingMoM.updates_requirements.length > 0
      ? existingMoM.updates_requirements
      : ['']
  );

  const [nextMeetingDate, setNextMeetingDate] = useState(existingMoM?.next_meeting_date || '');
  const [nextMeetingAgenda, setNextMeetingAgenda] = useState(existingMoM?.next_meeting_agenda || '');
  const [verifiedBy, setVerifiedBy] = useState(existingMoM?.verified_by || 'Parth Amilkanthwar (Master Admin)');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state if existingMoM changes
  useEffect(() => {
    if (existingMoM) {
      setDomain(existingMoM.domain || session.domain);
      setDate(existingMoM.date || session.date);
      setTime(existingMoM.time || `${session.start_time} - ${session.end_time}`);
      setVenue(existingMoM.venue || session.location);
      setConductedBy(existingMoM.conducted_by || session.created_by_name);
      setPreparedBy(existingMoM.prepared_by || user?.full_name || 'Domain Scribe');
      setAttendancePresent(existingMoM.attendance_present || '');
      setAttendanceAbsent(existingMoM.attendance_absent || '');
      setAgendaDiscussion(
        existingMoM.agenda_discussion && existingMoM.agenda_discussion.length > 0
          ? existingMoM.agenda_discussion
          : ['']
      );
      setKeyDecisions(
        existingMoM.key_decisions && existingMoM.key_decisions.length > 0
          ? existingMoM.key_decisions
          : ['']
      );
      setActionItems(
        existingMoM.action_items && existingMoM.action_items.length > 0
          ? existingMoM.action_items
          : []
      );
      setUpdatesRequirements(
        existingMoM.updates_requirements && existingMoM.updates_requirements.length > 0
          ? existingMoM.updates_requirements
          : ['']
      );
      setNextMeetingDate(existingMoM.next_meeting_date || '');
      setNextMeetingAgenda(existingMoM.next_meeting_agenda || '');
      setVerifiedBy(existingMoM.verified_by || 'Parth Amilkanthwar (Master Admin)');
    }
  }, [existingMoM, session, user]);

  // One-Click Auto-Fill from Session Attendance
  const handleAutoFillFromSession = () => {
    const sessionRecords = state.records.filter((r) => r.session_id === session.id);
    const memberMap = new Map(state.members.map((m) => [m.id, m]));

    const presentNames: string[] = [];
    const absentNames: string[] = [];

    sessionRecords.forEach((r) => {
      const mem = memberMap.get(r.member_id);
      const name = mem ? mem.name : r.member_id;
      if (r.status === 'present' || r.status === 'late') {
        presentNames.push(name);
      } else if (r.status === 'absent') {
        absentNames.push(name);
      }
    });

    setDomain(session.domain);
    setDate(session.date);
    setTime(`${session.start_time} - ${session.end_time}`);
    setVenue(session.location || 'Conference Room A');
    setConductedBy(session.created_by_name || 'Domain Lead');
    if (user?.full_name) {
      setPreparedBy(user.full_name);
    }

    if (presentNames.length > 0) {
      setAttendancePresent(presentNames.join(', '));
    }
    if (absentNames.length > 0) {
      setAttendanceAbsent(absentNames.join(', '));
    } else if (presentNames.length > 0) {
      setAttendanceAbsent('None (100% Attendance)');
    }

    addToast({
      type: 'success',
      title: 'Auto-Filled from Session',
      message: `Loaded ${presentNames.length} present & ${absentNames.length} absent members.`,
    });
  };

  // Dynamic Array Helpers
  const handleAddPoint = (setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter((prev) => [...prev, '']);
  };

  const handleUpdatePoint = (
    index: number,
    val: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter((prev) => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
  };

  const handleRemovePoint = (
    index: number,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter((prev) => prev.filter((_, i) => i !== index));
  };

  // Action Items Table Helpers
  const handleAddActionItem = () => {
    setActionItems((prev) => [
      ...prev,
      {
        id: `act-${Date.now()}-${prev.length + 1}`,
        task: '',
        assigned_to_name: '',
        due_date: session.date,
        status: 'Pending',
      },
    ]);
  };

  const handleUpdateActionItem = (index: number, field: keyof ActionItem, value: any) => {
    setActionItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveActionItem = (index: number) => {
    setActionItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const cleanAgenda = agendaDiscussion.map((s) => s.trim()).filter(Boolean);
    const cleanDecisions = keyDecisions.map((s) => s.trim()).filter(Boolean);
    const cleanUpdates = updatesRequirements.map((s) => s.trim()).filter(Boolean);
    const cleanActionItems = actionItems.filter((a) => a.task.trim().length > 0);

    const newMoM: MeetingMinutes = {
      id: existingMoM?.id || `mom-${session.id}`,
      session_id: session.id,
      document_name: `${session.name.replace(/[^a-zA-Z0-9]/g, '_')}_Official_MoM.pdf`,
      document_type: 'digital',
      document_size: 'Formal Document',
      summary: cleanAgenda.length > 0 ? cleanAgenda.join('\n') : (session.description || 'Minutes recorded.'),
      notes: cleanUpdates.join('\n'),

      // Official Template Fields
      domain,
      date,
      time,
      venue,
      conducted_by: conductedBy,
      prepared_by: preparedBy,

      attendance_present: attendancePresent.trim(),
      attendance_absent: attendanceAbsent.trim(),

      agenda_discussion: cleanAgenda,
      key_decisions: cleanDecisions,
      action_items: cleanActionItems,
      updates_requirements: cleanUpdates,

      next_meeting_date: nextMeetingDate,
      next_meeting_agenda: nextMeetingAgenda,
      next_meeting_prepared_by: preparedBy,
      verified_by: verifiedBy,

      uploaded_by: user?.username || 'scribe',
      uploaded_by_name: preparedBy,
      uploaded_at: existingMoM?.uploaded_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: (existingMoM?.version || 0) + 1,
    };

    try {
      await onSave(newMoM);
      onClose();
    } catch (err) {
      console.error('Failed to save MoM:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={existingMoM ? 'Edit Minutes of Meeting (MoM)' : 'Create Official Minutes of Meeting (MoM)'}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6 text-xs max-h-[80vh] overflow-y-auto px-1 pr-2">
        {/* Banner with Auto-fill helper */}
        <div className="p-3.5 bg-accent-primary/10 border border-accent-primary/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-primary/20 flex items-center justify-center flex-shrink-0">
              <FileText className="h-4 w-4 text-accent-light" />
            </div>
            <div>
              <h4 className="font-bold text-white text-xs">Official E-Cell RSCOE MoM Format</h4>
              <p className="text-[11px] text-gray-300">
                Direct in-app format matching the official college Minutes of Meeting document.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAutoFillFromSession}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-primary hover:bg-blue-600 text-white font-semibold text-xs shadow transition-all cursor-pointer flex-shrink-0"
            title="Auto-fill session info and marked attendance"
          >
            <Zap className="h-3.5 w-3.5 text-yellow-300" />
            <span>Auto-fill from Session</span>
          </button>
        </div>

        {/* ─── SECTION 1: MEETING DETAILS ─── */}
        <div className="bg-dark-bg p-4 border border-dark-border rounded-xl space-y-3">
          <h4 className="font-extrabold uppercase tracking-wider text-amber-400 text-xs flex items-center gap-2">
            <span>1. Meeting Details</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 mb-1">Domain *</label>
              <input
                type="text"
                required
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-white focus:outline-none focus:border-accent-primary"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 mb-1">Date *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-white focus:outline-none focus:border-accent-primary"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 mb-1">Time *</label>
              <input
                type="text"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="e.g. 18:00 - 19:30"
                className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-white focus:outline-none focus:border-accent-primary"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 mb-1">Venue *</label>
              <input
                type="text"
                required
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="e.g. Room 302 / Incubation Center"
                className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-white focus:outline-none focus:border-accent-primary"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 mb-1">Conducted by *</label>
              <input
                type="text"
                required
                value={conductedBy}
                onChange={(e) => setConductedBy(e.target.value)}
                placeholder="Name of Lead / Moderator"
                className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-white focus:outline-none focus:border-accent-primary"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 mb-1">Prepared by (Scribe) *</label>
              <input
                type="text"
                required
                value={preparedBy}
                onChange={(e) => setPreparedBy(e.target.value)}
                placeholder="Name of Member / Scribe"
                className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-white focus:outline-none focus:border-accent-primary"
              />
            </div>
          </div>
        </div>

        {/* ─── SECTION 2: ATTENDANCE ─── */}
        <div className="bg-dark-bg p-4 border border-dark-border rounded-xl space-y-3">
          <h4 className="font-extrabold uppercase tracking-wider text-amber-400 text-xs flex items-center justify-between">
            <span>2. Attendance</span>
            <span className="text-[10px] text-gray-400 font-normal lowercase">comma-separated names</span>
          </h4>
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-status-success mb-1">
                Present Members
              </label>
              <textarea
                rows={2}
                value={attendancePresent}
                onChange={(e) => setAttendancePresent(e.target.value)}
                placeholder="Names of all present members (separated by commas)"
                className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-white focus:outline-none focus:border-accent-primary leading-relaxed"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-status-absent mb-1">
                Absent Members
              </label>
              <textarea
                rows={2}
                value={attendanceAbsent}
                onChange={(e) => setAttendanceAbsent(e.target.value)}
                placeholder="Names of absent members, or 'None (100% Attendance)'"
                className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-white focus:outline-none focus:border-accent-primary leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* ─── SECTION 3: AGENDA & DISCUSSION ─── */}
        <div className="bg-dark-bg p-4 border border-dark-border rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold uppercase tracking-wider text-amber-400 text-xs">
              3. Agenda & Discussion Points
            </h4>
            <button
              type="button"
              onClick={() => handleAddPoint(setAgendaDiscussion)}
              className="inline-flex items-center gap-1 text-[11px] text-accent-light hover:text-white font-semibold cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Point</span>
            </button>
          </div>
          <div className="space-y-2">
            {agendaDiscussion.map((point, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-5 text-center font-bold text-gray-400 flex-shrink-0">{idx + 1}.</span>
                <input
                  type="text"
                  value={point}
                  onChange={(e) => handleUpdatePoint(idx, e.target.value, setAgendaDiscussion)}
                  placeholder={`Discussion item ${idx + 1}...`}
                  className="flex-1 px-3 py-1.5 bg-dark-card border border-dark-border rounded-lg text-white focus:outline-none focus:border-accent-primary"
                />
                {agendaDiscussion.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemovePoint(idx, setAgendaDiscussion)}
                    className="p-1.5 text-gray-400 hover:text-status-absent transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ─── SECTION 4: KEY DECISIONS ─── */}
        <div className="bg-dark-bg p-4 border border-dark-border rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold uppercase tracking-wider text-amber-400 text-xs">
              4. Key Decisions
            </h4>
            <button
              type="button"
              onClick={() => handleAddPoint(setKeyDecisions)}
              className="inline-flex items-center gap-1 text-[11px] text-accent-light hover:text-white font-semibold cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Decision</span>
            </button>
          </div>
          <div className="space-y-2">
            {keyDecisions.map((decision, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-5 text-center font-black text-accent-light flex-shrink-0">•</span>
                <input
                  type="text"
                  value={decision}
                  onChange={(e) => handleUpdatePoint(idx, e.target.value, setKeyDecisions)}
                  placeholder={`Decision item ${idx + 1}...`}
                  className="flex-1 px-3 py-1.5 bg-dark-card border border-dark-border rounded-lg text-white focus:outline-none focus:border-accent-primary"
                />
                {keyDecisions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemovePoint(idx, setKeyDecisions)}
                    className="p-1.5 text-gray-400 hover:text-status-absent transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ─── SECTION 5: ACTION ITEMS ─── */}
        <div className="bg-dark-bg p-4 border border-dark-border rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold uppercase tracking-wider text-amber-400 text-xs">
              5. Action Items
            </h4>
            <button
              type="button"
              onClick={handleAddActionItem}
              className="inline-flex items-center gap-1 text-[11px] text-accent-light hover:text-white font-semibold cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Action Item</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {actionItems.map((item, idx) => (
              <div
                key={item.id || idx}
                className="p-3 bg-dark-card border border-dark-border rounded-lg grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
              >
                <div className="sm:col-span-5">
                  <label className="block text-[10px] text-gray-400 mb-0.5">Task</label>
                  <input
                    type="text"
                    value={item.task}
                    onChange={(e) => handleUpdateActionItem(idx, 'task', e.target.value)}
                    placeholder="Describe deliverable..."
                    className="w-full px-2.5 py-1 bg-dark-bg border border-dark-border rounded text-white focus:outline-none focus:border-accent-primary text-xs"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[10px] text-gray-400 mb-0.5">Assigned To</label>
                  <input
                    type="text"
                    value={item.assigned_to_name}
                    onChange={(e) => handleUpdateActionItem(idx, 'assigned_to_name', e.target.value)}
                    placeholder="Member Name"
                    className="w-full px-2.5 py-1 bg-dark-bg border border-dark-border rounded text-white focus:outline-none focus:border-accent-primary text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] text-gray-400 mb-0.5">Deadline</label>
                  <input
                    type="text"
                    value={item.due_date}
                    onChange={(e) => handleUpdateActionItem(idx, 'due_date', e.target.value)}
                    placeholder="YYYY-MM-DD"
                    className="w-full px-2.5 py-1 bg-dark-bg border border-dark-border rounded text-white focus:outline-none focus:border-accent-primary text-xs font-mono"
                  />
                </div>
                <div className="sm:col-span-2 flex items-center gap-1 pt-3 sm:pt-0">
                  <div className="flex-1">
                    <label className="block text-[10px] text-gray-400 mb-0.5">Status</label>
                    <select
                      value={item.status}
                      onChange={(e) => handleUpdateActionItem(idx, 'status', e.target.value)}
                      className="w-full px-2 py-1 bg-dark-bg border border-dark-border rounded text-white focus:outline-none focus:border-accent-primary text-[11px]"
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                  {actionItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveActionItem(idx)}
                      className="mt-3 p-1.5 text-gray-400 hover:text-status-absent transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── SECTION 6: UPDATES / REQUIREMENTS ─── */}
        <div className="bg-dark-bg p-4 border border-dark-border rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold uppercase tracking-wider text-amber-400 text-xs">
              6. Updates / Requirements
            </h4>
            <button
              type="button"
              onClick={() => handleAddPoint(setUpdatesRequirements)}
              className="inline-flex items-center gap-1 text-[11px] text-accent-light hover:text-white font-semibold cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Item</span>
            </button>
          </div>
          <div className="space-y-2">
            {updatesRequirements.map((req, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-5 text-center font-black text-amber-400 flex-shrink-0">•</span>
                <input
                  type="text"
                  value={req}
                  onChange={(e) => handleUpdatePoint(idx, e.target.value, setUpdatesRequirements)}
                  placeholder={`Requirement / Update item ${idx + 1}...`}
                  className="flex-1 px-3 py-1.5 bg-dark-card border border-dark-border rounded-lg text-white focus:outline-none focus:border-accent-primary"
                />
                {updatesRequirements.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemovePoint(idx, setUpdatesRequirements)}
                    className="p-1.5 text-gray-400 hover:text-status-absent transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ─── SECTION 7: NEXT MEETING & VERIFICATION ─── */}
        <div className="bg-dark-bg p-4 border border-dark-border rounded-xl space-y-3">
          <h4 className="font-extrabold uppercase tracking-wider text-amber-400 text-xs">
            7. Next Meeting & Verification
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 mb-1">Next Meeting Date</label>
              <input
                type="text"
                value={nextMeetingDate}
                onChange={(e) => setNextMeetingDate(e.target.value)}
                placeholder="e.g. 2026-11-04 or Next Wednesday"
                className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-white focus:outline-none focus:border-accent-primary"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 mb-1">Next Meeting Agenda</label>
              <input
                type="text"
                value={nextMeetingAgenda}
                onChange={(e) => setNextMeetingAgenda(e.target.value)}
                placeholder="e.g. Budget approval and final vendor confirmation"
                className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-white focus:outline-none focus:border-accent-primary"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 mb-1">Prepared by (Signature Name)</label>
              <input
                type="text"
                value={preparedBy}
                onChange={(e) => setPreparedBy(e.target.value)}
                className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-white focus:outline-none focus:border-accent-primary font-medium"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 mb-1">Verified by (Lead / Master Admin)</label>
              <input
                type="text"
                value={verifiedBy}
                onChange={(e) => setVerifiedBy(e.target.value)}
                className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-white focus:outline-none focus:border-accent-primary font-medium"
              />
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-dark-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-dark-card hover:bg-dark-hover border border-dark-border text-gray-300 text-xs transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-accent-primary hover:bg-blue-600 disabled:opacity-50 text-white font-semibold text-xs shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Save className="h-4 w-4" />
            <span>{isSubmitting ? 'Saving & Syncing...' : 'Save & Publish MoM'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
