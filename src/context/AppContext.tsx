import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import {
  Member,
  AttendanceSession,
  AttendanceRecord,
  AppSettings,
  ToastMessage,
  UserAccount,
  MeetingMinutes,
  AuditLog,
  ECellDomain,
  UserRole,
  MemberRole,
} from '../types';
import {
  generateAllMembers,
  generateUserAccounts,
  generateDemoSessions,
  generateAttendanceRecords,
  generateMinutesOfMeeting,
  generateAuditLogs,
  generateDefaultSettings,
  DEFAULT_PASSWORD,
} from '../lib/demoData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Storage keys bumped for clean production slate (only 9 core leads, 0 past sessions)
const STORAGE_KEYS = {
  MEMBERS_V3: 'ecell_members_v3_clean',
  SESSIONS_V3: 'ecell_sessions_v3_clean',
  RECORDS_V3: 'ecell_records_v3_clean',
  MOM_V3: 'ecell_mom_v3_clean',
  AUDIT_V3: 'ecell_audit_v3_clean',
  ACCOUNTS_V4: 'ecell_accounts_v4_unique', // Bumped to V4 with unique passwords for all leads
  SETTINGS_V3: 'ecell_settings_v3_clean',
  AUTH_V4: 'ecell_auth_v4_strict', // Bumped to V4: requires explicit login, no auto-login
};

interface AuthState {
  isAuthenticated: boolean;
  user: UserAccount | null;
}

export interface AppState {
  members: Member[];
  sessions: AttendanceSession[];
  records: AttendanceRecord[];
  momDocuments: MeetingMinutes[];
  auditLogs: AuditLog[];
  userAccounts: UserAccount[];
  settings: AppSettings;
  auth: AuthState;
  toasts: ToastMessage[];
  sidebarOpen: boolean;
}

type Action =
  | { type: 'SET_MEMBERS'; payload: Member[] }
  | { type: 'ADD_MEMBER'; payload: Member }
  | { type: 'UPDATE_MEMBER'; payload: Member }
  | { type: 'DELETE_MEMBER'; payload: string }
  | { type: 'SET_SESSIONS'; payload: AttendanceSession[] }
  | { type: 'ADD_SESSION'; payload: AttendanceSession }
  | { type: 'UPDATE_SESSION'; payload: AttendanceSession }
  | { type: 'DELETE_SESSION'; payload: string }
  | { type: 'SET_RECORDS'; payload: AttendanceRecord[] }
  | { type: 'SAVE_ATTENDANCE'; payload: { records: AttendanceRecord[]; auditReason?: string } }
  | { type: 'RESTORE_RECORD'; payload: { recordId: string; previousStatus: AttendanceRecord['status'] } }
  | { type: 'ADD_MOM'; payload: MeetingMinutes }
  | { type: 'UPDATE_MOM'; payload: MeetingMinutes }
  | { type: 'DELETE_MOM'; payload: string }
  | { type: 'SET_MOMS'; payload: MeetingMinutes[] }
  | { type: 'ADD_AUDIT_LOG'; payload: AuditLog }
  | { type: 'UPDATE_USER_ACCOUNT'; payload: UserAccount }
  | { type: 'ADD_USER_ACCOUNT'; payload: UserAccount }
  | { type: 'SET_USER_ACCOUNTS'; payload: UserAccount[] }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<AppSettings> }
  | { type: 'LOGIN'; payload: UserAccount }
  | { type: 'LOGOUT' }
  | { type: 'ADD_TOAST'; payload: ToastMessage }
  | { type: 'REMOVE_TOAST'; payload: string }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SIDEBAR'; payload: boolean };

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error(`Error loading ${key}:`, e);
  }
  return fallback;
}

function saveToStorage(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Error saving ${key}:`, e);
  }
}

function initializeState(): AppState {
  const initialMembers = generateAllMembers();
  const initialAccounts = generateUserAccounts();
  const initialSessions = generateDemoSessions();
  const initialRecords = generateAttendanceRecords();
  const initialMoMs = generateMinutesOfMeeting();
  const initialAudits = generateAuditLogs();
  const initialSettings = generateDefaultSettings();

  const members = loadFromStorage(STORAGE_KEYS.MEMBERS_V3, initialMembers);
  const userAccounts = loadFromStorage(STORAGE_KEYS.ACCOUNTS_V4, initialAccounts);
  const sessions = loadFromStorage(STORAGE_KEYS.SESSIONS_V3, initialSessions);
  const records = loadFromStorage(STORAGE_KEYS.RECORDS_V3, initialRecords);
  const momDocuments = loadFromStorage(STORAGE_KEYS.MOM_V3, initialMoMs);
  const auditLogs = loadFromStorage(STORAGE_KEYS.AUDIT_V3, initialAudits);
  const settings = loadFromStorage(STORAGE_KEYS.SETTINGS_V3, initialSettings);

  // Ensure Vanshika Thakare and Ayush Deshmukh are upgraded to Master Admin in stored data
  const upgradedAccounts = userAccounts.map((acc) => {
    if (acc.username === 'vanshika.thakare' || acc.username === 'ayush.deshmukh') {
      return { ...acc, role: 'master_admin' as UserRole };
    }
    return acc;
  });

  const upgradedMembers = members.map((m) => {
    if (m.username === 'vanshika.thakare' || m.username === 'ayush.deshmukh') {
      return { ...m, role: 'Master Admin' as MemberRole };
    }
    return m;
  });

  // Clear any legacy auth/account keys to refresh unique lead passwords and prevent automatic logins
  try {
    localStorage.removeItem('ecell_auth');
    localStorage.removeItem('ecell_auth_v2');
    localStorage.removeItem('ecell_auth_v3');
    localStorage.removeItem('ecell_auth_v3_clean');
    localStorage.removeItem('ecell_accounts');
    localStorage.removeItem('ecell_accounts_v2');
    localStorage.removeItem('ecell_accounts_v3');
    localStorage.removeItem('ecell_accounts_v3_clean');
  } catch (e) {
    // ignore
  }

  // Strict initial auth state: NOT authenticated by default, requires manual login
  const auth = loadFromStorage<AuthState>(STORAGE_KEYS.AUTH_V4, {
    isAuthenticated: false,
    user: null,
  });

  if (auth.user && (auth.user.username === 'vanshika.thakare' || auth.user.username === 'ayush.deshmukh')) {
    auth.user = { ...auth.user, role: 'master_admin' };
  }

  return {
    members: upgradedMembers,
    sessions,
    records,
    momDocuments,
    auditLogs,
    userAccounts: upgradedAccounts,
    settings,
    auth,
    toasts: [],
    sidebarOpen: true,
  };
}

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_MEMBERS':
      return { ...state, members: action.payload };

    case 'ADD_MEMBER':
      if (isSupabaseConfigured() && supabase) {
        supabase.from('members').upsert([action.payload]).then(({ error }) => {
          if (error) console.error('Cloud member upsert error:', error);
        });
      }
      return { ...state, members: [...state.members, action.payload] };

    case 'UPDATE_MEMBER':
      if (isSupabaseConfigured() && supabase) {
        supabase.from('members').upsert([action.payload]).then(({ error }) => {
          if (error) console.error('Cloud member update error:', error);
        });
      }
      return {
        ...state,
        members: state.members.map((m) =>
          m.id === action.payload.id ? action.payload : m
        ),
      };

    case 'DELETE_MEMBER':
      if (isSupabaseConfigured() && supabase) {
        supabase.from('members').delete().eq('id', action.payload).then();
        supabase.from('records').delete().eq('member_id', action.payload).then();
      }
      return {
        ...state,
        members: state.members.filter((m) => m.id !== action.payload),
        records: state.records.filter((r) => r.member_id !== action.payload),
      };

    case 'SET_SESSIONS':
      return { ...state, sessions: action.payload };

    case 'ADD_SESSION':
      if (isSupabaseConfigured() && supabase) {
        supabase.from('sessions').upsert([action.payload]).then(({ error }) => {
          if (error) console.error('Cloud session upsert error:', error);
        });
      }
      return { ...state, sessions: [action.payload, ...state.sessions] };

    case 'UPDATE_SESSION':
      if (isSupabaseConfigured() && supabase) {
        supabase.from('sessions').upsert([action.payload]).then(({ error }) => {
          if (error) console.error('Cloud session update error:', error);
        });
      }
      return {
        ...state,
        sessions: state.sessions.map((s) =>
          s.id === action.payload.id ? action.payload : s
        ),
      };

    case 'DELETE_SESSION':
      if (isSupabaseConfigured() && supabase) {
        supabase.from('sessions').delete().eq('id', action.payload).then();
        supabase.from('records').delete().eq('session_id', action.payload).then();
      }
      return {
        ...state,
        sessions: state.sessions.filter((s) => s.id !== action.payload),
        records: state.records.filter((r) => r.session_id !== action.payload),
        momDocuments: state.momDocuments.filter((m) => m.session_id !== action.payload),
      };

    case 'SET_RECORDS':
      return { ...state, records: action.payload };

    case 'SAVE_ATTENDANCE': {
      const { records: newRecords, auditReason } = action.payload;
      if (newRecords.length === 0) return state;
      if (isSupabaseConfigured() && supabase) {
        supabase.from('records').upsert(newRecords).then();
      }

      const sessionId = newRecords[0].session_id;
      const targetSession = state.sessions.find((s) => s.id === sessionId);

      const newAuditEntries: AuditLog[] = [];
      const now = new Date().toISOString();
      const existingMap = new Map(
        state.records.filter((r) => r.session_id === sessionId).map((r) => [r.member_id, r])
      );

      const memberMap = new Map(state.members.map((m) => [m.id, m]));

      newRecords.forEach((rec) => {
        const prev = existingMap.get(rec.member_id);
        if (prev && prev.status !== rec.status) {
          const member = memberMap.get(rec.member_id);
          newAuditEntries.push({
            id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            actor_id: state.auth.user?.id || 'unknown',
            actor_name: state.auth.user?.full_name || 'System User',
            actor_role: state.auth.user?.role || 'lead_admin',
            action_type: 'ATTENDANCE_EDITED',
            entity_type: 'ATTENDANCE',
            entity_id: rec.id,
            session_id: sessionId,
            session_name: targetSession?.name,
            member_id: rec.member_id,
            member_name: member?.name,
            previous_value: prev.status,
            new_value: rec.status,
            reason: auditReason || rec.remarks || 'Attendance corrected by lead',
            timestamp: now,
          });
        }
      });

      const remainingRecords = state.records.filter((r) => r.session_id !== sessionId);

      return {
        ...state,
        records: [...remainingRecords, ...newRecords],
        auditLogs: [...newAuditEntries, ...state.auditLogs],
      };
    }

    case 'RESTORE_RECORD': {
      const { recordId, previousStatus } = action.payload;
      const updatedRecords = state.records.map((r) =>
        r.id === recordId ? { ...r, status: previousStatus, updated_at: new Date().toISOString() } : r
      );

      const targetRecord = state.records.find((r) => r.id === recordId);
      const member = state.members.find((m) => m.id === targetRecord?.member_id);
      const session = state.sessions.find((s) => s.id === targetRecord?.session_id);

      const restoreAudit: AuditLog = {
        id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        actor_id: state.auth.user?.id || 'unknown',
        actor_name: state.auth.user?.full_name || 'Master Admin',
        actor_role: 'master_admin',
        action_type: 'ATTENDANCE_RESTORED',
        entity_type: 'ATTENDANCE',
        entity_id: recordId,
        session_id: session?.id,
        session_name: session?.name,
        member_id: member?.id,
        member_name: member?.name,
        previous_value: targetRecord?.status,
        new_value: previousStatus,
        reason: 'Restored from audit log by Master Admin',
        timestamp: new Date().toISOString(),
      };

      return {
        ...state,
        records: updatedRecords,
        auditLogs: [restoreAudit, ...state.auditLogs],
      };
    }

    case 'ADD_MOM': {
      const audit: AuditLog = {
        id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        actor_id: state.auth.user?.id || 'unknown',
        actor_name: state.auth.user?.full_name || 'System User',
        actor_role: state.auth.user?.role || 'lead_admin',
        action_type: 'MOM_UPLOADED',
        entity_type: 'MOM',
        entity_id: action.payload.id,
        session_id: action.payload.session_id,
        new_value: `Uploaded MoM document: ${action.payload.document_name}`,
        timestamp: new Date().toISOString(),
      };

      return {
        ...state,
        momDocuments: [action.payload, ...state.momDocuments.filter((m) => m.session_id !== action.payload.session_id)],
        auditLogs: [audit, ...state.auditLogs],
      };
    }

    case 'UPDATE_MOM': {
      const audit: AuditLog = {
        id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        actor_id: state.auth.user?.id || 'unknown',
        actor_name: state.auth.user?.full_name || 'System User',
        actor_role: state.auth.user?.role || 'lead_admin',
        action_type: 'MOM_REPLACED',
        entity_type: 'MOM',
        entity_id: action.payload.id,
        session_id: action.payload.session_id,
        new_value: `Replaced MoM document: ${action.payload.document_name} (v${action.payload.version})`,
        timestamp: new Date().toISOString(),
      };

      return {
        ...state,
        momDocuments: state.momDocuments.map((m) =>
          m.id === action.payload.id ? action.payload : m
        ),
        auditLogs: [audit, ...state.auditLogs],
      };
    }

    case 'DELETE_MOM':
      return {
        ...state,
        momDocuments: state.momDocuments.filter((m) => m.id !== action.payload),
      };

    case 'SET_MOMS': {
      const map = new Map<string, MeetingMinutes>();
      state.momDocuments.forEach((m) => map.set(m.session_id, m));
      action.payload.forEach((m) => map.set(m.session_id, m));
      return {
        ...state,
        momDocuments: Array.from(map.values()),
      };
    }

    case 'ADD_AUDIT_LOG':
      return { ...state, auditLogs: [action.payload, ...state.auditLogs] };

    case 'UPDATE_USER_ACCOUNT': {
      const updatedAccounts = state.userAccounts.map((u) =>
        u.id === action.payload.id ? action.payload : u
      );
      return {
        ...state,
        userAccounts: updatedAccounts,
        auth:
          state.auth.user?.id === action.payload.id
            ? { ...state.auth, user: action.payload }
            : state.auth,
      };
    }

    case 'ADD_USER_ACCOUNT':
      return { ...state, userAccounts: [...state.userAccounts, action.payload] };

    case 'SET_USER_ACCOUNTS':
      return { ...state, userAccounts: action.payload };

    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: { ...state.settings, ...action.payload, updated_at: new Date().toISOString() },
      };

    case 'LOGIN':
      return {
        ...state,
        auth: { isAuthenticated: true, user: action.payload },
      };

    case 'LOGOUT':
      return {
        ...state,
        auth: { isAuthenticated: false, user: null },
      };

    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, action.payload] };

    case 'REMOVE_TOAST':
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.payload),
      };

    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen };

    case 'SET_SIDEBAR':
      return { ...state, sidebarOpen: action.payload };

    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  isPrimaryMasterAdmin: () => boolean;
  isMasterAdmin: () => boolean;
  isPresident: () => boolean;
  isGeneralSecretary: () => boolean;
  isLeadAdmin: () => boolean;
  isCoLead: () => boolean;
  isMoMScribe: () => boolean;
  isMember: () => boolean;
  canManageSession: (session: AttendanceSession) => boolean;
  canDeleteSession: (session: AttendanceSession) => boolean;
  canCreateSession: () => boolean;
  canMarkAttendanceForDomain: (domain: ECellDomain) => boolean;
  canUploadMoM: (session: AttendanceSession) => boolean;
  canViewSession: (session: AttendanceSession) => boolean;
  canAddMemberToDomain: (domain: ECellDomain) => boolean;
  canEditMember: (member: Member) => boolean;
  canDeleteMember: (member: Member) => boolean;
  isLeadMember: (member: Member) => boolean;
  isSelf: (member: Member) => boolean;
  syncFromCloud: () => Promise<boolean>;
  getApplicableMembersForSession: (session: AttendanceSession) => Member[];
  getMemberAttendancePercentage: (memberId: string) => number | null;
  getOverallAttendancePercentage: (domainFilter?: ECellDomain | 'ALL') => number | null;
  getSessionMoM: (sessionId: string) => MeetingMinutes | undefined;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, undefined, initializeState);

  // Persistence to localStorage
  // Cloud synchronization with Supabase (real-time & multi-device sync)
  const syncFromCloud = useCallback(async (): Promise<boolean> => {
    if (!isSupabaseConfigured() || !supabase) return false;

    try {
      const [sessRes, recRes, memRes] = await Promise.all([
        supabase.from('sessions').select('*'),
        supabase.from('records').select('*'),
        supabase.from('members').select('*'),
      ]);

      if (sessRes.data) {
        dispatch({ type: 'SET_SESSIONS', payload: sessRes.data });

        // Extract cloud-synced MoM documents attached to sessions
        const cloudMoMs: MeetingMinutes[] = [];
        sessRes.data.forEach((sess: any) => {
          if (sess.description && sess.description.startsWith('__ECELL_MOM__:')) {
            try {
              const parsed = JSON.parse(sess.description.substring('__ECELL_MOM__:'.length));
              cloudMoMs.push(parsed);
            } catch (e) {
              console.warn('Could not parse cloud MoM:', e);
            }
          }
        });
        if (cloudMoMs.length > 0) {
          dispatch({ type: 'SET_MOMS', payload: cloudMoMs });
        }
      }

      if (memRes.data && memRes.data.length > 0) {
        // Merge cloud members with default core leads so none are lost
        const initialCore = generateAllMembers();
        const cloudMemberIds = new Set(memRes.data.map((m: any) => m.id));
        const mergedMembers: Member[] = [...memRes.data];
        initialCore.forEach((coreMember) => {
          if (!cloudMemberIds.has(coreMember.id)) {
            mergedMembers.push(coreMember);
          }
        });
        dispatch({ type: 'SET_MEMBERS', payload: mergedMembers });

        // Synchronize User Accounts so every cloud member has a valid login across all devices
        const coreAccounts = generateUserAccounts();
        const coreUsernames = new Set(coreAccounts.map((a) => a.username.toLowerCase()));
        const allAccounts: UserAccount[] = [...coreAccounts];

        mergedMembers.forEach((member) => {
          const uname = (member.username || member.name.toLowerCase().replace(/\s+/g, '.')).trim();
          if (!coreUsernames.has(uname)) {
            allAccounts.push({
              id: `user-${member.id}`,
              full_name: member.name,
              username: uname,
              role:
                member.role === 'Domain Lead'
                  ? 'lead_admin'
                  : member.role === 'Domain Co-Lead'
                  ? 'co_lead'
                  : member.role === 'President'
                  ? 'president'
                  : member.role === 'General Secretary'
                  ? 'general_secretary'
                  : member.role === 'Master Admin'
                  ? 'master_admin'
                  : 'member',
              domain: member.department,
              email: member.email,
              password: DEFAULT_PASSWORD,
              temp_password: DEFAULT_PASSWORD,
              status: member.status === 'inactive' ? 'disabled' : 'active',
              must_change_password: false,
              created_at: member.created_at || new Date().toISOString(),
            });
            coreUsernames.add(uname);
          }
        });
        dispatch({ type: 'SET_USER_ACCOUNTS', payload: allAccounts });
      } else {
        // Seed cloud database with initial 9 core leads if cloud is empty
        const initialCore = generateAllMembers();
        supabase.from('members').upsert(initialCore).then();
      }

      if (recRes.data) {
        dispatch({ type: 'SET_RECORDS', payload: recRes.data });
      }
      return true;
    } catch (err) {
      console.warn('Supabase sync notice:', err);
      return false;
    }
  }, []);

  useEffect(() => {
    syncFromCloud();

    // Subscribe to Supabase Realtime channel for instant cross-device multi-client updates
    let channel: any = null;
    if (isSupabaseConfigured() && supabase) {
      channel = supabase
        .channel('ecell-live-sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'members' },
          () => {
            syncFromCloud();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'sessions' },
          () => {
            syncFromCloud();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'records' },
          () => {
            syncFromCloud();
          }
        )
        .subscribe();
    }

    // Auto-sync when window gains focus or on background interval
    const handleFocus = () => syncFromCloud();
    window.addEventListener('focus', handleFocus);
    const interval = setInterval(syncFromCloud, 8000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [syncFromCloud]);

  // Local Persistence (Direct Supabase mutations are executed on specific actions to prevent write storms)
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.MEMBERS_V3, state.members);
  }, [state.members]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.SESSIONS_V3, state.sessions);
  }, [state.sessions]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.RECORDS_V3, state.records);
  }, [state.records]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.MOM_V3, state.momDocuments);
  }, [state.momDocuments]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.AUDIT_V3, state.auditLogs);
  }, [state.auditLogs]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.ACCOUNTS_V4, state.userAccounts);
  }, [state.userAccounts]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.SETTINGS_V3, state.settings);
  }, [state.settings]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.AUTH_V4, state.auth);
  }, [state.auth]);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 7)}`;
    dispatch({ type: 'ADD_TOAST', payload: { ...toast, id } });
    setTimeout(() => {
      dispatch({ type: 'REMOVE_TOAST', payload: id });
    }, toast.duration || 4000);
  }, []);

  const user = state.auth.user;

  // Primary Master Admin is Parth Amilkanthwar (founder & root owner)
  const isPrimaryMasterAdmin = useCallback(() => {
    return user?.role === 'master_admin' && user?.username === 'parth.amilkanthwar';
  }, [user]);

  // Master Admin access includes Parth Amilkanthwar, Vanshika Thakare, and Ayush Deshmukh
  const isMasterAdmin = useCallback(() => {
    if (!user) return false;
    return (
      user.role === 'master_admin' ||
      user.username === 'parth.amilkanthwar' ||
      user.username === 'vanshika.thakare' ||
      user.username === 'ayush.deshmukh'
    );
  }, [user]);

  // General Secretary has the exact same rights as President
  const isPresident = useCallback(() => {
    return user?.role === 'president' || user?.role === 'general_secretary';
  }, [user]);

  const isGeneralSecretary = useCallback(() => {
    return user?.role === 'general_secretary';
  }, [user]);

  const isLeadAdmin = useCallback(() => {
    return user?.role === 'lead_admin' || user?.role === 'co_lead';
  }, [user]);

  const isCoLead = useCallback(() => {
    return user?.role === 'co_lead';
  }, [user]);

  const isMember = useCallback(() => {
    return user?.role === 'member';
  }, [user]);

  // Check if a member is a Core Committee Lead or Co-Lead
  const isLeadMember = useCallback((m: Member): boolean => {
    const coreUsernames = [
      'parth.amilkanthwar',
      'sarthak.mehta',
      'yashraj.ghate',
      'ayush.deshmukh',
      'aryan.ingale',
      'gargee.waghmare',
      'samarth.dhatrak',
      'vanshika.thakare',
      'rohan.kalokhe',
    ];
    return (
      m.role !== 'Member' ||
      m.id.startsWith('lead-') ||
      m.member_id.startsWith('EC-CORE-') ||
      coreUsernames.includes(m.username || '')
    );
  }, []);

  // Check if member is the currently authenticated user
  const isSelf = useCallback(
    (m: Member): boolean => {
      if (!user) return false;
      return (
        (!!m.username && user.username.toLowerCase() === m.username.toLowerCase()) ||
        (!!m.email && user.email.toLowerCase() === m.email.toLowerCase()) ||
        user.full_name.toLowerCase() === m.name.toLowerCase()
      );
    },
    [user]
  );

  // Master Admin can edit anyone (except only Parth can edit Parth's profile); Each user can edit their OWN profile; Leads can edit Co-Leads & members of their own domain; Co-Leads can edit members of their own domain
  const canEditMember = useCallback(
    (targetMember: Member) => {
      if (!user) return false;
      if (isMasterAdmin()) {
        // Protect Parth Amilkanthwar's profile so only Parth himself can edit it
        if (targetMember.username === 'parth.amilkanthwar' && user.username !== 'parth.amilkanthwar') {
          return false;
        }
        return true;
      }
      if (isSelf(targetMember)) return true;
      if (isLeadMember(targetMember)) {
        // Domain Lead can edit Domain Co-Lead in their vertical
        if (
          user.role === 'lead_admin' &&
          user.domain === targetMember.department &&
          targetMember.role === 'Domain Co-Lead'
        ) {
          return true;
        }
        return false;
      }
      if (user.role === 'lead_admin' || user.role === 'co_lead') {
        return user.domain === targetMember.department && targetMember.role === 'Member';
      }
      return false;
    },
    [user, isMasterAdmin, isSelf, isLeadMember]
  );

  // ONLY Master Admin can remove core leads; Leads can remove Co-Leads & members of their domain; Co-Leads can remove members of their domain
  const canDeleteMember = useCallback(
    (targetMember: Member) => {
      if (!user) return false;
      if (isSelf(targetMember)) return false;
      if (isLeadMember(targetMember)) {
        if (!isMasterAdmin()) {
          // Domain Lead can remove Domain Co-Lead in their vertical
          if (
            user.role === 'lead_admin' &&
            user.domain === targetMember.department &&
            targetMember.role === 'Domain Co-Lead'
          ) {
            return true;
          }
          return false;
        }
        if (targetMember.username === 'parth.amilkanthwar' || targetMember.role === 'Master Admin') {
          return false;
        }
        return true;
      }
      if (isMasterAdmin()) return true;
      if (user.role === 'lead_admin' || user.role === 'co_lead') {
        return user.domain === targetMember.department && targetMember.role === 'Member';
      }
      return false;
    },
    [user, isMasterAdmin, isSelf, isLeadMember]
  );

  // Can user add a member to a domain?
  const canAddMemberToDomain = useCallback(
    (targetDomain: ECellDomain) => {
      if (!user) return false;
      if (user.role === 'master_admin') return true;
      if (user.role === 'president' || user.role === 'general_secretary') return true;
      if (user.role === 'lead_admin' || user.role === 'co_lead') {
        return user.domain === targetDomain;
      }
      return false;
    },
    [user]
  );

  const canMarkAttendanceForDomain = useCallback(
    (domain: ECellDomain) => {
      if (!user) return false;
      if (user.role === 'master_admin') return true;
      if (user.role === 'president' || user.role === 'general_secretary') return false; // Read-only by default
      if (user.role === 'lead_admin' || user.role === 'co_lead') {
        if (domain === 'All Domains') return true;
        if (domain === 'General E-Cell / Core Committee') return true;
        return user.domain === domain;
      }
      return false;
    },
    [user]
  );

  const canManageSession = useCallback(
    (session: AttendanceSession) => {
      if (!user) return false;
      if (user.role === 'master_admin') return true;
      if (user.role === 'president' || user.role === 'general_secretary') return false;
      if (user.role === 'lead_admin' || user.role === 'co_lead') {
        if (session.domain === 'All Domains') return true;
        if (session.domain === 'General E-Cell / Core Committee') return true;
        return user.domain === session.domain;
      }
      return false;
    },
    [user]
  );

  const canDeleteSession = useCallback(
    (session: AttendanceSession): boolean => {
      if (!user) return false;
      if (isMasterAdmin()) return true;
      const isCreator =
        (!!session.created_by && session.created_by.toLowerCase() === user.username.toLowerCase()) ||
        (!!session.created_by_name && session.created_by_name.toLowerCase() === user.full_name.toLowerCase()) ||
        session.created_by === user.id;
      return Boolean(isCreator);
    },
    [user, isMasterAdmin]
  );

  const canCreateSession = useCallback((): boolean => {
    if (!user) return false;
    if (user.role === 'member') return false;
    return true;
  }, [user]);

  const canUploadMoM = useCallback(
    (session: AttendanceSession) => {
      if (!user) return false;
      if (user.role === 'master_admin') return true;
      if (user.role === 'president' || user.role === 'general_secretary') return false;
      if (user.role === 'lead_admin' || user.role === 'co_lead') {
        if (session.domain === 'All Domains') return true;
        if (session.domain === 'General E-Cell / Core Committee') return true;
        return user.domain === session.domain;
      }

      // Check configured domain scribe in settings
      const assignedScribe = state.settings.domain_mom_scribes?.[session.domain];
      if (assignedScribe) {
        if (
          user.username.toLowerCase() === assignedScribe.toLowerCase() ||
          user.full_name.toLowerCase() === assignedScribe.toLowerCase()
        ) {
          return true;
        }
      }

      // Guaranteed MoM Scribes designated by user:
      // 1. Finance Management: Ovee Pawar (ovee.pawar)
      if (
        (user.username.toLowerCase() === 'ovee.pawar' || user.full_name.toLowerCase().includes('ovee')) &&
        (session.domain === 'Finance Management' || session.domain === 'All Domains')
      ) {
        return true;
      }

      // 2. Event Production & Curation: Ayush Gosavi (ayush.gosavi)
      if (
        (user.username.toLowerCase() === 'ayush.gosavi' || user.full_name.toLowerCase().includes('gosavi')) &&
        (session.domain === 'Event Production & Curation' || session.domain === 'All Domains')
      ) {
        return true;
      }

      return false;
    },
    [user, state.settings.domain_mom_scribes]
  );

  const isMoMScribe = useCallback(() => {
    if (!user) return false;
    if (
      user.username.toLowerCase() === 'ovee.pawar' ||
      user.full_name.toLowerCase().includes('ovee') ||
      user.username.toLowerCase() === 'ayush.gosavi' ||
      user.full_name.toLowerCase().includes('gosavi')
    ) {
      return true;
    }
    const scribes = Object.values(state.settings.domain_mom_scribes || {});
    return scribes.some(
      (s) =>
        s &&
        (s.toLowerCase() === user.username.toLowerCase() ||
          s.toLowerCase() === user.full_name.toLowerCase())
    );
  }, [user, state.settings.domain_mom_scribes]);

  const canViewSession = useCallback(
    (session: AttendanceSession) => {
      if (!user) return false;
      if (
        user.role === 'master_admin' ||
        user.role === 'president' ||
        user.role === 'general_secretary'
      )
        return true;
      if (session.domain === 'All Domains') return true;
      if (user.role === 'lead_admin' || user.role === 'co_lead') {
        if (session.domain === 'General E-Cell / Core Committee') return true;
        return user.domain === session.domain;
      }
      return user.domain === session.domain;
    },
    [user]
  );

  const getApplicableMembersForSession = useCallback(
    (session: AttendanceSession): Member[] => {
      if (session.domain === 'All Domains') {
        return state.members;
      }
      if (session.domain === 'General E-Cell / Core Committee') {
        return state.members.filter(
          (m) =>
            m.role === 'Master Admin' ||
            m.role === 'President' ||
            m.role === 'General Secretary' ||
            m.role === 'Domain Lead' ||
            m.role === 'Domain Co-Lead'
        );
      }
      // Domain specific: filter members assigned to this domain
      const domainMembers = state.members.filter((m) => m.department === session.domain);
      if (domainMembers.length === 0) {
        return state.members.filter(
          (m) => m.department === session.domain || m.name.includes(session.created_by_name)
        );
      }
      return domainMembers;
    },
    [state.members]
  );

  const getSessionMoM = useCallback(
    (sessionId: string) => {
      return state.momDocuments.find((m) => m.session_id === sessionId);
    },
    [state.momDocuments]
  );

  const getMemberAttendancePercentage = useCallback(
    (memberId: string) => {
      const memberRecords = state.records.filter((r) => r.member_id === memberId);
      const applicableRecords = memberRecords.filter((r) => r.status !== 'excused');
      if (applicableRecords.length === 0) return null;
      const attended = applicableRecords.filter(
        (r) => r.status === 'present' || r.status === 'late'
      ).length;
      return Math.round((attended / applicableRecords.length) * 100);
    },
    [state.records]
  );

  const getOverallAttendancePercentage = useCallback(
    (domainFilter?: ECellDomain | 'ALL') => {
      let filteredRecords = state.records;

      if (domainFilter && domainFilter !== 'ALL') {
        const domainMemberIds = new Set(
          state.members.filter((m) => m.department === domainFilter).map((m) => m.id)
        );
        filteredRecords = state.records.filter((r) => domainMemberIds.has(r.member_id));
      }

      const applicable = filteredRecords.filter((r) => r.status !== 'excused');
      if (applicable.length === 0) return null;
      const attended = applicable.filter(
        (r) => r.status === 'present' || r.status === 'late'
      ).length;
      return Math.round((attended / applicable.length) * 100);
    },
    [state.records, state.members]
  );

  return (
    <AppContext.Provider
      value={{
        state,
        dispatch,
        addToast,
        isPrimaryMasterAdmin,
        isMasterAdmin,
        isPresident,
        isGeneralSecretary,
        isLeadAdmin,
        isCoLead,
        isMoMScribe,
        isMember,
        canManageSession,
        canDeleteSession,
        canCreateSession,
        canMarkAttendanceForDomain,
        canUploadMoM,
        canViewSession,
        canAddMemberToDomain,
        canEditMember,
        canDeleteMember,
        isLeadMember,
        isSelf,
        syncFromCloud,
        getApplicableMembersForSession,
        getSessionMoM,
        getMemberAttendancePercentage,
        getOverallAttendancePercentage,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
