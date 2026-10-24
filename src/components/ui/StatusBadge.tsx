import type { AttendanceStatus } from '../../types';

interface StatusBadgeProps {
  status: AttendanceStatus;
}

const badgeStyles: Record<AttendanceStatus, string> = {
  present: 'bg-status-success/15 text-status-success',
  absent: 'bg-status-absent/15 text-status-absent',
  late: 'bg-status-late/15 text-status-late',
  excused: 'bg-status-excused/15 text-status-excused',
};

const labelMap: Record<AttendanceStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  excused: 'Excused',
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide ${badgeStyles[status]}`}
    >
      {labelMap[status]}
    </span>
  );
}
