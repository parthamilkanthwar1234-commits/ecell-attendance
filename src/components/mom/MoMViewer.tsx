import React from 'react';
import {
  Printer,
  Copy,
  Edit3,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  FileText,
  UserCheck,
  ShieldCheck,
  Download,
} from 'lucide-react';
import { MeetingMinutes, AttendanceSession } from '../../types';
import { useApp } from '../../context/AppContext';

interface MoMViewerProps {
  mom: MeetingMinutes;
  session: AttendanceSession;
  canEdit: boolean;
  onEdit: () => void;
}

export const MoMViewer: React.FC<MoMViewerProps> = ({
  mom,
  session,
  canEdit,
  onEdit,
}) => {
  const { addToast } = useApp();

  const handlePrint = () => {
    window.print();
  };

  const handleCopyText = () => {
    const text = `
=========================================
E-CELL RSCOE - MINUTES OF MEETING
=========================================
1. MEETING DETAILS:
Domain: ${mom.domain || session.domain}
Date: ${mom.date || session.date}
Time: ${mom.time || `${session.start_time} - ${session.end_time}`}
Venue: ${mom.venue || session.location}
Conducted by: ${mom.conducted_by || session.created_by_name}
Prepared by: ${mom.prepared_by || mom.uploaded_by_name}

2. ATTENDANCE:
Present: ${mom.attendance_present || 'N/A'}
Absent: ${mom.attendance_absent || 'N/A'}

3. AGENDA & DISCUSSION:
${(mom.agenda_discussion && mom.agenda_discussion.length > 0)
  ? mom.agenda_discussion.map((item, i) => `${i + 1}. ${item}`).join('\n')
  : mom.summary || 'N/A'}

4. KEY DECISIONS:
${(mom.key_decisions && mom.key_decisions.length > 0)
  ? mom.key_decisions.map((d) => `• ${d}`).join('\n')
  : 'None recorded'}

5. ACTION ITEMS:
${(mom.action_items && mom.action_items.length > 0)
  ? mom.action_items.map((a, i) => `${i + 1}. ${a.task} | Assigned: ${a.assigned_to_name} | Deadline: ${a.due_date} | Status: ${a.status}`).join('\n')
  : 'None recorded'}

6. UPDATES / REQUIREMENTS:
${(mom.updates_requirements && mom.updates_requirements.length > 0)
  ? mom.updates_requirements.map((u) => `• ${u}`).join('\n')
  : 'None recorded'}

7. NEXT MEETING:
Date: ${mom.next_meeting_date || 'TBD'}
Agenda: ${mom.next_meeting_agenda || 'TBD'}
Prepared by: ${mom.next_meeting_prepared_by || mom.prepared_by || mom.uploaded_by_name}
Verified by: ${mom.verified_by || 'Domain Lead / Master Admin'}
=========================================
    `.trim();

    navigator.clipboard.writeText(text);
    addToast({
      type: 'success',
      title: 'MoM Copied',
      message: 'Minutes of Meeting copied to clipboard in clean text format.',
    });
  };

  const presentList = mom.attendance_present
    ? mom.attendance_present.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const absentList = mom.attendance_absent
    ? mom.attendance_absent.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <div className="space-y-4">
      {/* Action Toolbar (Hidden during browser print) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-dark-bg/80 border border-dark-border rounded-xl print:hidden">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-status-success animate-pulse" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Official Document (v{mom.version || 1})
          </span>
          <span className="text-[11px] text-gray-400">
            Recorded by <strong className="text-gray-200">{mom.prepared_by || mom.uploaded_by_name}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleCopyText}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-card hover:bg-dark-hover border border-dark-border text-xs text-gray-300 hover:text-white transition-colors cursor-pointer"
            title="Copy as formatted text"
          >
            <Copy className="h-3.5 w-3.5 text-accent-light" />
            <span>Copy Text</span>
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-card hover:bg-dark-hover border border-dark-border text-xs text-gray-300 hover:text-white transition-colors cursor-pointer shadow-sm"
            title="Print or Save as PDF"
          >
            <Printer className="h-3.5 w-3.5 text-amber-400" />
            <span>Print / Save PDF</span>
          </button>

          {canEdit && (
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent-primary hover:bg-blue-600 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Edit MoM</span>
            </button>
          )}
        </div>
      </div>

      {/* ════════════ OFFICIAL DOCUMENT CONTAINER (Template Format) ════════════ */}
      <div
        id="official-mom-document"
        className="relative bg-[#11141b] border-2 border-[#2b3342] rounded-xl p-6 sm:p-8 shadow-2xl text-gray-100 font-sans overflow-hidden print:border-black print:bg-white print:text-black print:p-0 print:m-0 print:shadow-none"
      >
        {/* Subtle Watermark (Matches official format) */}
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden opacity-[0.04] print:opacity-[0.06]"
        >
          <span className="text-8xl sm:text-9xl font-black tracking-widest -rotate-45 whitespace-nowrap text-white print:text-black">
            E-CELL RSCOE
          </span>
        </div>

        {/* ─── OFFICIAL HEADER ─── */}
        <div className="border-2 border-[#333e50] print:border-black rounded-lg p-3 sm:p-4 mb-6 relative z-10 bg-black/40 print:bg-transparent">
          <div className="grid grid-cols-[80px_1fr_90px] sm:grid-cols-[100px_1fr_110px] items-center gap-3">
            {/* Left RSCOE Logo */}
            <div className="flex items-center justify-center">
              <img
                src="/rscoe-logo.png"
                alt="JSPM RSCOE Emblem"
                className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>

            {/* Center College Header */}
            <div className="text-center space-y-0.5">
              <h4 className="text-[11px] sm:text-xs font-semibold tracking-wider text-gray-300 print:text-gray-800 uppercase">
                JSPM'S
              </h4>
              <h2 className="text-xs sm:text-sm md:text-base font-extrabold text-white print:text-black tracking-tight leading-tight">
                Rajarshi Shahu College of Engineering
              </h2>
              <p className="text-[10px] sm:text-[11px] font-medium text-gray-300 print:text-gray-700">
                Tathawade, Pune
              </p>
              <p className="text-[9px] sm:text-[10px] italic text-gray-400 print:text-gray-600">
                (An Autonomous Institute affiliated to SPPU, Pune)
              </p>
            </div>

            {/* Right E-Cell Logo Banner */}
            <div className="flex items-center justify-center">
              <img
                src="/ecell-logo-banner.png"
                alt="E-Cell RSCOE Banner"
                className="w-18 h-18 sm:w-24 sm:h-24 object-contain drop-shadow"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          </div>
        </div>

        {/* ─── DOCUMENT TITLE ─── */}
        <div className="text-center mb-6 relative z-10">
          <h1 className="text-xl sm:text-2xl font-black text-white print:text-black tracking-wider uppercase font-serif">
            E-CELL RSCOE
          </h1>
          <h3 className="text-xs sm:text-sm font-extrabold tracking-widest text-amber-500 print:text-amber-700 uppercase mt-0.5">
            MINUTES OF MEETING
          </h3>
        </div>

        {/* ─── 1. MEETING DETAILS ─── */}
        <section className="mb-6 relative z-10">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-400 print:text-black border-b border-[#2b3342] print:border-black pb-1 mb-2">
            1. MEETING DETAILS
          </h4>
          <div className="bg-[#171c26] print:bg-transparent border border-[#2e3748] print:border-black rounded-lg p-3 sm:p-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
              <div className="flex items-baseline">
                <span className="font-bold text-gray-300 print:text-black w-28 flex-shrink-0">Domain:</span>
                <span className="text-white print:text-black font-semibold underline underline-offset-4 decoration-gray-600">
                  {mom.domain || session.domain}
                </span>
              </div>
              <div className="flex items-baseline">
                <span className="font-bold text-gray-300 print:text-black w-24 flex-shrink-0">Date:</span>
                <span className="text-white print:text-black font-mono underline underline-offset-4 decoration-gray-600">
                  {mom.date || session.date}
                </span>
              </div>
              <div className="flex items-baseline">
                <span className="font-bold text-gray-300 print:text-black w-28 flex-shrink-0">Time:</span>
                <span className="text-white print:text-black font-mono underline underline-offset-4 decoration-gray-600">
                  {mom.time || `${session.start_time} - ${session.end_time}`}
                </span>
              </div>
              <div className="flex items-baseline">
                <span className="font-bold text-gray-300 print:text-black w-24 flex-shrink-0">Venue:</span>
                <span className="text-white print:text-black underline underline-offset-4 decoration-gray-600">
                  {mom.venue || session.location || 'Conference Room'}
                </span>
              </div>
              <div className="flex items-baseline">
                <span className="font-bold text-gray-300 print:text-black w-28 flex-shrink-0">Conducted by:</span>
                <span className="text-white print:text-black font-medium underline underline-offset-4 decoration-gray-600">
                  {mom.conducted_by || session.created_by_name}
                </span>
              </div>
              <div className="flex items-baseline">
                <span className="font-bold text-gray-300 print:text-black w-24 flex-shrink-0">Prepared by:</span>
                <span className="text-white print:text-black font-medium underline underline-offset-4 decoration-gray-600">
                  {mom.prepared_by || mom.uploaded_by_name}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 2. ATTENDANCE ─── */}
        <section className="mb-6 relative z-10 text-xs">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-400 print:text-black border-b border-[#2b3342] print:border-black pb-1 mb-2">
            2. ATTENDANCE
          </h4>
          <div className="space-y-2 bg-[#171c26] print:bg-transparent border border-[#2e3748] print:border-black rounded-lg p-3 sm:p-4">
            <div>
              <span className="font-bold text-status-success print:text-black mr-2">
                Present ({presentList.length}):
              </span>
              <span className="text-gray-200 print:text-black leading-relaxed">
                {mom.attendance_present || 'No attendance records attached.'}
              </span>
            </div>
            <div className="pt-2 border-t border-[#262f3e] print:border-gray-300">
              <span className="font-bold text-status-absent print:text-black mr-2">
                Absent ({absentList.length}):
              </span>
              <span className="text-gray-200 print:text-black leading-relaxed">
                {mom.attendance_absent || 'None (100% Attendance)'}
              </span>
            </div>
          </div>
        </section>

        {/* ─── 3. AGENDA & DISCUSSION ─── */}
        <section className="mb-6 relative z-10 text-xs">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-400 print:text-black border-b border-[#2b3342] print:border-black pb-1 mb-2">
            3. AGENDA & DISCUSSION
          </h4>
          <div className="bg-[#171c26] print:bg-transparent border border-[#2e3748] print:border-black rounded-lg p-3 sm:p-4">
            {mom.agenda_discussion && mom.agenda_discussion.length > 0 ? (
              <ol className="list-decimal list-inside space-y-2 text-gray-200 print:text-black">
                {mom.agenda_discussion.map((item, idx) => (
                  <li key={idx} className="leading-relaxed pl-1">
                    <span className="font-medium text-white print:text-black">{item}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-gray-300 print:text-black leading-relaxed whitespace-pre-line">
                {mom.summary || 'Discussion items not recorded.'}
              </p>
            )}
          </div>
        </section>

        {/* ─── 4. KEY DECISIONS ─── */}
        <section className="mb-6 relative z-10 text-xs">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-400 print:text-black border-b border-[#2b3342] print:border-black pb-1 mb-2">
            4. KEY DECISIONS
          </h4>
          <div className="bg-[#171c26] print:bg-transparent border border-[#2e3748] print:border-black rounded-lg p-3 sm:p-4">
            {mom.key_decisions && mom.key_decisions.length > 0 ? (
              <ul className="list-disc list-inside space-y-2 text-gray-200 print:text-black">
                {mom.key_decisions.map((decision, idx) => (
                  <li key={idx} className="leading-relaxed pl-1">
                    <span className="font-medium text-white print:text-black">{decision}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400 italic">No specific key decisions recorded.</p>
            )}
          </div>
        </section>

        {/* ─── 5. ACTION ITEMS ─── */}
        <section className="mb-6 relative z-10 text-xs">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-400 print:text-black border-b border-[#2b3342] print:border-black pb-1 mb-2">
            5. ACTION ITEMS
          </h4>
          <div className="border border-[#2e3748] print:border-black rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#1e2533] print:bg-gray-200 text-gray-200 print:text-black uppercase font-bold border-b border-[#2e3748] print:border-black">
                <tr>
                  <th className="p-2.5 sm:p-3 w-12 text-center border-r border-[#2e3748] print:border-black">#</th>
                  <th className="p-2.5 sm:p-3 border-r border-[#2e3748] print:border-black">Task</th>
                  <th className="p-2.5 sm:p-3 border-r border-[#2e3748] print:border-black">Assigned To</th>
                  <th className="p-2.5 sm:p-3 border-r border-[#2e3748] print:border-black">Deadline</th>
                  <th className="p-2.5 sm:p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2e3748] print:divide-black bg-[#171c26] print:bg-transparent">
                {mom.action_items && mom.action_items.length > 0 ? (
                  mom.action_items.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td className="p-2.5 text-center font-mono text-gray-400 print:text-black border-r border-[#2e3748] print:border-black">
                        {idx + 1}
                      </td>
                      <td className="p-2.5 font-medium text-white print:text-black border-r border-[#2e3748] print:border-black">
                        {item.task}
                      </td>
                      <td className="p-2.5 text-gray-300 print:text-black border-r border-[#2e3748] print:border-black">
                        {item.assigned_to_name}
                      </td>
                      <td className="p-2.5 font-mono text-gray-300 print:text-black border-r border-[#2e3748] print:border-black">
                        {item.due_date}
                      </td>
                      <td className="p-2.5 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase print:border print:border-black ${
                            item.status === 'Completed'
                              ? 'bg-status-success/20 text-status-success print:bg-transparent print:text-black'
                              : item.status === 'In Progress'
                              ? 'bg-blue-500/20 text-blue-400 print:bg-transparent print:text-black'
                              : 'bg-amber-500/20 text-status-late print:bg-transparent print:text-black'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-gray-400 italic">
                      No actionable items assigned.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ─── 6. UPDATES / REQUIREMENTS ─── */}
        <section className="mb-6 relative z-10 text-xs">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-400 print:text-black border-b border-[#2b3342] print:border-black pb-1 mb-2">
            6. UPDATES / REQUIREMENTS
          </h4>
          <div className="bg-[#171c26] print:bg-transparent border border-[#2e3748] print:border-black rounded-lg p-3 sm:p-4">
            {mom.updates_requirements && mom.updates_requirements.length > 0 ? (
              <ul className="list-disc list-inside space-y-2 text-gray-200 print:text-black">
                {mom.updates_requirements.map((req, idx) => (
                  <li key={idx} className="leading-relaxed pl-1">
                    <span className="font-medium text-white print:text-black">{req}</span>
                  </li>
                ))}
              </ul>
            ) : mom.notes ? (
              <p className="text-gray-300 print:text-black leading-relaxed whitespace-pre-line">
                {mom.notes}
              </p>
            ) : (
              <p className="text-gray-400 italic">No specific domain requirements or updates noted.</p>
            )}
          </div>
        </section>

        {/* ─── 7. NEXT MEETING ─── */}
        <section className="mb-6 relative z-10 text-xs">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-400 print:text-black border-b border-[#2b3342] print:border-black pb-1 mb-2">
            7. NEXT MEETING
          </h4>
          <div className="bg-[#171c26] print:bg-transparent border border-[#2e3748] print:border-black rounded-lg p-3 sm:p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="font-bold text-gray-300 print:text-black block mb-1">Date:</span>
                <span className="text-white print:text-black font-mono underline underline-offset-4 decoration-gray-600">
                  {mom.next_meeting_date || 'To be scheduled'}
                </span>
              </div>
              <div>
                <span className="font-bold text-gray-300 print:text-black block mb-1">Agenda:</span>
                <span className="text-white print:text-black underline underline-offset-4 decoration-gray-600">
                  {mom.next_meeting_agenda || 'Review progress on action items & event deliverables'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ─── SIGNATURES / VERIFICATION FOOTER ─── */}
        <div className="pt-6 border-t border-[#333e50] print:border-black relative z-10 text-xs">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
            <div>
              <p className="font-bold text-gray-400 print:text-black mb-1">Prepared by:</p>
              <div className="border-b border-gray-500 w-48 sm:w-56 pb-1">
                <span className="font-semibold text-white print:text-black">
                  {mom.next_meeting_prepared_by || mom.prepared_by || mom.uploaded_by_name}
                </span>
              </div>
              <p className="text-[10px] text-gray-500 print:text-gray-600 mt-1">Domain Scribe / Lead</p>
            </div>

            <div>
              <p className="font-bold text-gray-400 print:text-black mb-1">Verified by:</p>
              <div className="border-b border-gray-500 w-48 sm:w-56 pb-1">
                <span className="font-semibold text-white print:text-black">
                  {mom.verified_by || 'Parth Amilkanthwar (Master Admin)'}
                </span>
              </div>
              <p className="text-[10px] text-gray-500 print:text-gray-600 mt-1">Domain Lead / Master Admin</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
