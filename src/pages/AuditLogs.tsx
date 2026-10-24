import { useState, useMemo } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  RotateCcw,
  Clock,
  User,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatDate, exportToCSV } from '../lib/utils';
import { AttendanceStatus } from '../types';

export default function AuditLogs() {
  const { state, dispatch, addToast, isMasterAdmin } = useApp();
  const { auditLogs } = state;

  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const matchSearch =
        searchTerm === '' ||
        log.actor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.member_name && log.member_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.session_name && log.session_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.reason && log.reason.toLowerCase().includes(searchTerm.toLowerCase())) ||
        log.new_value.toLowerCase().includes(searchTerm.toLowerCase());

      const matchAction = actionFilter === 'ALL' || log.action_type === actionFilter;

      return matchSearch && matchAction;
    });
  }, [auditLogs, searchTerm, actionFilter]);

  // Restore Attendance Action
  const handleRestore = (log: typeof auditLogs[0]) => {
    if (!isMasterAdmin()) {
      addToast({ type: 'error', title: 'Unauthorized', message: 'Only Master Admin Parth can restore records.' });
      return;
    }

    if (!log.previous_value || !log.entity_id) {
      addToast({ type: 'error', title: 'Cannot Restore', message: 'No prior status recorded for this entry.' });
      return;
    }

    dispatch({
      type: 'RESTORE_RECORD',
      payload: {
        recordId: log.entity_id,
        previousStatus: log.previous_value as AttendanceStatus,
      },
    });

    addToast({
      type: 'success',
      title: 'Attendance Record Restored',
      message: `Restored ${log.member_name || 'member'}'s status back to ${log.previous_value.toUpperCase()}.`,
    });
  };

  const handleExportAuditCSV = () => {
    const data = filteredLogs.map((l) => ({
      Timestamp: l.timestamp,
      'Actor Name': l.actor_name,
      'Actor Role': l.actor_role,
      Action: l.action_type,
      Session: l.session_name || '-',
      Member: l.member_name || '-',
      'Previous Status': l.previous_value || '-',
      'New Status': l.new_value,
      Reason: l.reason || '-',
    }));
    exportToCSV(data, 'ecell_attendance_audit_log');
    addToast({ type: 'success', title: 'Audit Trail Exported', message: 'Downloaded audit logs to CSV.' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-red-500/10 text-status-absent border border-red-500/20">
              <ShieldAlert className="h-4 w-4" />
            </span>
            <span className="text-xs uppercase tracking-wider text-gray-400 font-bold">
              Security & Compliance · Master Admin Only
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight mt-1">
            Attendance Audit Trail
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Cryptographically tracked audit history of attendance corrections, MoM uploads, and role changes
          </p>
        </div>

        <button
          onClick={handleExportAuditCSV}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-dark-card hover:bg-dark-hover border border-dark-border text-gray-200 font-semibold text-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <FileSpreadsheet className="h-4 w-4 text-accent-light" />
          <span>Export Audit Log CSV</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by actor, member, session, reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-accent-primary"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary cursor-pointer w-full sm:w-auto"
          >
            <option value="ALL">All Event Types</option>
            <option value="ATTENDANCE_EDITED">Attendance Edited</option>
            <option value="ATTENDANCE_RESTORED">Attendance Restored</option>
            <option value="ATTENDANCE_MARKED">Attendance Marked</option>
            <option value="MOM_UPLOADED">MoM Uploaded</option>
            <option value="MOM_REPLACED">MoM Replaced</option>
            <option value="ROLE_CHANGED">Role Changed</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden shadow-sm">
        <div className="p-3 bg-dark-bg/60 border-b border-dark-border text-xs text-gray-400 flex items-center justify-between">
          <span>Showing {filteredLogs.length} audit entries</span>
          <span className="text-[11px] text-gray-500">Immutable ledger log</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-dark-bg text-gray-400 uppercase tracking-wider border-b border-dark-border">
              <tr>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">Authorizing User</th>
                <th className="p-3.5">Event Type</th>
                <th className="p-3.5">Target Session / Member</th>
                <th className="p-3.5">State Transition</th>
                <th className="p-3.5">Reason / Justification</th>
                <th className="p-3.5 text-right">Master Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    No audit records match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const canRestoreThis =
                    log.action_type === 'ATTENDANCE_EDITED' &&
                    log.previous_value &&
                    isMasterAdmin();

                  return (
                    <tr key={log.id} className="hover:bg-dark-hover/40 transition-colors">
                      <td className="p-3.5 whitespace-nowrap text-gray-400 font-mono text-[11px]">
                        {formatDate(log.timestamp, 'yyyy-MM-dd HH:mm:ss')}
                      </td>

                      <td className="p-3.5">
                        <div className="font-bold text-white">{log.actor_name}</div>
                        <div className="text-[10px] text-gray-500 uppercase">{log.actor_role}</div>
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            log.action_type === 'ATTENDANCE_EDITED'
                              ? 'bg-status-late/15 text-status-late border border-status-late/30'
                              : log.action_type === 'ATTENDANCE_RESTORED'
                              ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                              : log.action_type === 'MOM_UPLOADED' || log.action_type === 'MOM_REPLACED'
                              ? 'bg-status-success/15 text-status-success border border-status-success/30'
                              : 'bg-dark-bg text-gray-300'
                          }`}
                        >
                          {log.action_type.replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td className="p-3.5 font-medium text-white max-w-xs">
                        {log.session_name && <div>{log.session_name}</div>}
                        {log.member_name && (
                          <div className="text-gray-400 text-[11px]">
                            Member: {log.member_name}
                          </div>
                        )}
                        {!log.session_name && !log.member_name && (
                          <div className="text-gray-500">{log.new_value}</div>
                        )}
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        {log.previous_value ? (
                          <div className="flex items-center gap-1.5 font-mono text-[11px]">
                            <span className="text-status-absent font-bold uppercase">
                              {log.previous_value}
                            </span>
                            <span className="text-gray-500">→</span>
                            <span className="text-status-success font-bold uppercase">
                              {log.new_value}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[11px] truncate block max-w-[180px]">
                            {log.new_value}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-gray-400 max-w-xs truncate">
                        {log.reason || '-'}
                      </td>

                      <td className="p-3.5 text-right whitespace-nowrap">
                        {canRestoreThis ? (
                          <button
                            onClick={() => handleRestore(log)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-light border border-accent-primary/30 text-[11px] font-semibold cursor-pointer"
                            title="Restore previous attendance state"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>Restore</span>
                          </button>
                        ) : (
                          <span className="text-gray-600 text-[11px]">Locked</span>
                        )}
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
