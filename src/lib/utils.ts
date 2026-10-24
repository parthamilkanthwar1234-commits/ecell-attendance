import { format } from 'date-fns';
import { AttendanceRecord, AttendanceStatus } from '../types';

export function formatDate(date: string, fmt: string = 'MMM dd, yyyy'): string {
  try {
    return format(new Date(date), fmt);
  } catch {
    return date;
  }
}

export function getStatusColor(status: AttendanceStatus): string {
  switch (status) {
    case 'present': return 'text-status-success';
    case 'absent': return 'text-status-absent';
    case 'late': return 'text-status-late';
    case 'excused': return 'text-status-excused';
  }
}

export function getStatusBgColor(status: AttendanceStatus): string {
  switch (status) {
    case 'present': return 'bg-status-success/15 text-status-success';
    case 'absent': return 'bg-status-absent/15 text-status-absent';
    case 'late': return 'bg-status-late/15 text-status-late';
    case 'excused': return 'bg-status-excused/15 text-status-excused';
  }
}

export function getStatusLabel(status: AttendanceStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function calculateAttendancePercentage(records: AttendanceRecord[]): number | null {
  const applicable = records.filter(r => r.status !== 'excused');
  if (applicable.length === 0) return null;
  const attended = applicable.filter(r => r.status === 'present' || r.status === 'late').length;
  return Math.round((attended / applicable.length) * 100);
}

export function generateId(prefix: string = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function exportToCSV(data: Record<string, unknown>[], filename: string): void {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = String(row[header] ?? '');
        // Escape commas and quotes
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
