import {
  Member,
  AttendanceSession,
  AttendanceRecord,
  AppSettings,
  UserAccount,
  MeetingMinutes,
  AuditLog,
  ECellDomain,
} from '../types';

export const DOMAINS: ECellDomain[] = [
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

// ─── THE 9 CORE COMMITTEE LEADS (EXCLUSIVE MEMBERS) ──────────────────────────
export const CORE_LEADS: Array<{
  name: string;
  designation: string;
  username: string;
  domain: ECellDomain;
  role: 'master_admin' | 'president' | 'general_secretary' | 'lead_admin';
  phone: string;
}> = [
  {
    name: 'Parth Amilkanthwar',
    designation: 'Finance Management Lead / Master Admin',
    username: 'parth.amilkanthwar',
    domain: 'Finance Management',
    role: 'master_admin',
    phone: '+91 98220 11001',
  },
  {
    name: 'Sarthak Mehta',
    designation: 'President',
    username: 'sarthak.mehta',
    domain: 'General E-Cell / Core Committee',
    role: 'president',
    phone: '+91 98220 11002',
  },
  {
    name: 'Yashraj Ghate',
    designation: 'General Secretary',
    username: 'yashraj.ghate',
    domain: 'General E-Cell / Core Committee',
    role: 'general_secretary', // Same rights as President
    phone: '+91 98220 11003',
  },
  {
    name: 'Ayush Deshmukh',
    designation: 'Event Production & Curation Lead',
    username: 'ayush.deshmukh',
    domain: 'Event Production & Curation',
    role: 'lead_admin',
    phone: '+91 98220 11004',
  },
  {
    name: 'Aryan Ingale',
    designation: 'Public Relations & Marketing Lead',
    username: 'aryan.ingale',
    domain: 'Public Relations & Marketing',
    role: 'lead_admin',
    phone: '+91 98220 11005',
  },
  {
    name: 'Gargee Waghmare',
    designation: 'Graphics Design Lead',
    username: 'gargee.waghmare',
    domain: 'Graphics Design',
    role: 'lead_admin',
    phone: '+91 98220 11006',
  },
  {
    name: 'Samarth Dhatrak',
    designation: 'Technical & Data Management Lead',
    username: 'samarth.dhatrak',
    domain: 'Technical & Data Management',
    role: 'lead_admin',
    phone: '+91 98220 11007',
  },
  {
    name: 'Vanshika Thakare',
    designation: 'Content Development Lead',
    username: 'vanshika.thakare',
    domain: 'Content Development',
    role: 'lead_admin',
    phone: '+91 98220 11008',
  },
  {
    name: 'Rohan Kalokhe',
    designation: 'Social Media Lead',
    username: 'rohan.kalokhe',
    domain: 'Social Media',
    role: 'lead_admin',
    phone: '+91 98220 11009',
  },
];

// Simple common password for all leads for easy login and hosting
export const DEFAULT_PASSWORD = 'ecell@123';

export function generateAllMembers(): Member[] {
  const now = new Date().toISOString();

  // ONLY the 9 Core Committee Leads (clean slate, no fake members)
  return CORE_LEADS.map((lead, i) => ({
    id: `lead-${lead.username}`,
    member_id: `EC-CORE-${String(i + 1).padStart(2, '0')}`,
    name: lead.name,
    email: `${lead.username}@ecell.jspmrscoe.in`,
    phone: lead.phone,
    department: lead.domain,
    role:
      lead.role === 'master_admin'
        ? 'Master Admin'
        : lead.role === 'president'
        ? 'President'
        : lead.role === 'general_secretary'
        ? 'General Secretary'
        : 'Domain Lead',
    joining_date: '2026-07-01',
    status: 'active',
    username: lead.username,
    created_at: now,
    updated_at: now,
  }));
}

export function generateUserAccounts(): UserAccount[] {
  const now = new Date().toISOString();

  return CORE_LEADS.map((lead) => ({
    id: `user-${lead.username}`,
    full_name: lead.name,
    username: lead.username,
    role: lead.role,
    domain: lead.domain,
    email: `${lead.username}@ecell.jspmrscoe.in`,
    password: DEFAULT_PASSWORD,
    status: 'active',
    must_change_password: false,
    temp_password: DEFAULT_PASSWORD,
    last_login: new Date().toISOString(),
    created_at: now,
  }));
}

// Clean production slate: NO past fake meetings
export function generateDemoSessions(): AttendanceSession[] {
  return [];
}

export function generateMinutesOfMeeting(): MeetingMinutes[] {
  return [];
}

export function generateAttendanceRecords(): AttendanceRecord[] {
  return [];
}

export function generateAuditLogs(): AuditLog[] {
  return [
    {
      id: 'audit-init-001',
      actor_id: 'user-parth.amilkanthwar',
      actor_name: 'Parth Amilkanthwar',
      actor_role: 'master_admin',
      action_type: 'SESSION_CREATED',
      entity_type: 'SYSTEM' as any,
      entity_id: 'system-init',
      new_value: 'System initialized for E-Cell RSCOE with 9 Core Committee accounts',
      timestamp: new Date().toISOString(),
    },
  ];
}

export function generateDefaultSettings(): AppSettings {
  return {
    id: 'default',
    org_name: 'E-CELL | ATTENDANCE',
    org_subtitle: 'Entrepreneurship Cell · JSPM RSCOE, Pune',
    low_attendance_threshold: 75,
    departments: [...DOMAINS],
    default_view: 'dashboard',
    member_login_enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
