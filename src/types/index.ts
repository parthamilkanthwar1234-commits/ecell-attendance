export type UserRole = 'master_admin' | 'president' | 'general_secretary' | 'lead_admin' | 'co_lead' | 'member';

export type ECellDomain =
  | 'Event Production & Curation'
  | 'Public Relations & Marketing'
  | 'Finance Management'
  | 'Graphics Design'
  | 'Technical & Data Management'
  | 'Content Development'
  | 'Social Media'
  | 'General E-Cell / Core Committee'
  | 'All Domains'
  | 'Unassigned';

export type MemberRole = 'Master Admin' | 'President' | 'General Secretary' | 'Domain Lead' | 'Domain Co-Lead' | 'Member';

export type EventCategory = string;

export type SessionType =
  | 'Domain Meeting'
  | 'Core Committee Meeting'
  | 'General Body Meeting'
  | 'Event Planning'
  | 'E-Summit Meeting'
  | 'Sponsorship Meeting'
  | 'Workshop'
  | 'Other';

export type SessionStatus = 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface ActionItem {
  id: string;
  task: string;
  assigned_to_name: string;
  due_date: string;
  status: 'Pending' | 'In Progress' | 'Completed';
}

export interface MeetingMinutes {
  id: string;
  session_id: string;
  document_name: string;
  document_type: string; // 'digital' | 'pdf' | 'docx' | 'doc' | 'txt'
  document_size: string;
  document_url?: string;
  summary: string;
  action_items: ActionItem[];
  notes?: string;

  // Official E-Cell RSCOE MoM Format Fields
  domain?: string;
  date?: string;
  time?: string;
  venue?: string;
  conducted_by?: string;
  prepared_by?: string;

  attendance_present?: string;
  attendance_absent?: string;

  agenda_discussion?: string[];
  key_decisions?: string[];
  updates_requirements?: string[];

  next_meeting_date?: string;
  next_meeting_agenda?: string;
  next_meeting_prepared_by?: string;
  verified_by?: string;

  uploaded_by: string;
  uploaded_by_name: string;
  uploaded_at: string;
  updated_at: string;
  version: number;
}

export interface Member {
  id: string;
  member_id: string;
  name: string;
  email: string;
  phone: string;
  department: ECellDomain;
  role: MemberRole;
  joining_date: string;
  status: 'active' | 'inactive';
  username?: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceSession {
  id: string;
  name: string;
  session_type: SessionType;
  domain: ECellDomain;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  description: string;
  status: SessionStatus;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  category?: string;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  member_id: string;
  status: AttendanceStatus;
  remarks: string;
  marked_by: string;
  marked_by_name?: string;
  created_at: string;
  updated_at: string;
  member?: Member;
  session?: AttendanceSession;
}

export interface AuditLog {
  id: string;
  actor_id: string;
  actor_name: string;
  actor_role: UserRole;
  action_type:
    | 'ATTENDANCE_MARKED'
    | 'ATTENDANCE_EDITED'
    | 'ATTENDANCE_RESTORED'
    | 'MOM_UPLOADED'
    | 'MOM_REPLACED'
    | 'SESSION_CREATED'
    | 'SESSION_UPDATED'
    | 'ROLE_CHANGED'
    | 'PASSWORD_RESET'
    | 'MEMBER_ADDED';
  entity_type: 'ATTENDANCE' | 'SESSION' | 'MOM' | 'USER' | 'MEMBER';
  entity_id: string;
  session_id?: string;
  session_name?: string;
  member_id?: string;
  member_name?: string;
  previous_value?: string;
  new_value: string;
  reason?: string;
  timestamp: string;
}

export interface UserAccount {
  id: string;
  full_name: string;
  username: string;
  role: UserRole;
  domain: ECellDomain;
  email: string;
  password?: string;
  status: 'active' | 'disabled';
  must_change_password?: boolean;
  temp_password?: string;
  last_login?: string;
  created_at: string;
}

export interface AppSettings {
  id: string;
  org_name: string;
  org_subtitle: string;
  low_attendance_threshold: number;
  departments: ECellDomain[];
  default_view: 'dashboard' | 'attendance' | 'leadership';
  member_login_enabled: boolean;
  domain_mom_scribes?: Partial<Record<ECellDomain, string>>;
  created_at: string;
  updated_at: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
  duration?: number;
}
