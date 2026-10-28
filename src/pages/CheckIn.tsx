import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  MapPin,
  Calendar,
  Building,
  User,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  LogIn,
  RotateCw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AttendanceRecord, AttendanceSession, Member } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Helper to parse 24h ('16:00') and 12h ('04:00 PM')
function parseSessionDateTime(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || !timeStr) return null;
  try {
    const isPM = /pm/i.test(timeStr);
    const isAM = /am/i.test(timeStr);
    const cleanTime = timeStr.replace(/[^0-9:]/g, '').trim();
    const parts = cleanTime.split(':');
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1] ? parseInt(parts[1], 10) : 0;
    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return null;
    const d = new Date(year, month - 1, day, hours, minutes, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  } catch (e) {
    return null;
  }
}

export default function CheckIn() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { state, dispatch, addToast } = useApp();
  const sessionId = searchParams.get('session');
  const token = searchParams.get('token');
  const isLockedParam = searchParams.get('locked') === 'true';

  const [isProcessing, setIsProcessing] = useState(true);
  const [checkInStatus, setCheckInStatus] = useState<
    'idle' | 'success' | 'already_present' | 'not_eligible' | 'time_locked' | 'session_not_found' | 'locked' | 'error'
  >('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [checkedRecord, setCheckedRecord] = useState<AttendanceRecord | null>(null);

  const currentUser = state.auth.user;

  // Resolve Current Member Profile
  const currentMember = useMemo(() => {
    if (!currentUser) return null;
    return (
      state.members.find(
        (m) =>
          (m.username && m.username.toLowerCase() === currentUser.username.toLowerCase()) ||
          (m.email && m.email.toLowerCase() === currentUser.email.toLowerCase()) ||
          m.name.toLowerCase() === currentUser.full_name.toLowerCase()
      ) || null
    );
  }, [state.members, currentUser]);

  // Resolve Session from local state or fetch from Supabase
  const [session, setSession] = useState<AttendanceSession | null>(() => {
    return state.sessions.find((s) => s.id === sessionId) || null;
  });

  // Fetch session if not found locally
  useEffect(() => {
    const fetchSession = async () => {
      if (session || !sessionId) return;
      const foundLocal = state.sessions.find((s) => s.id === sessionId);
      if (foundLocal) {
        setSession(foundLocal);
        return;
      }

      if (isSupabaseConfigured() && supabase) {
        try {
          const { data } = await supabase
            .from('sessions')
            .select('*')
            .eq('id', sessionId)
            .single();
          if (data) {
            setSession(data as AttendanceSession);
          }
        } catch (err) {
          console.error('Error fetching session:', err);
        }
      }
    };
    fetchSession();
  }, [sessionId, session, state.sessions]);

  // Main Check-In Execution
  useEffect(() => {
    const processCheckIn = async () => {
      if (!sessionId) {
        setCheckInStatus('session_not_found');
        setStatusMessage('Invalid check-in link. No meeting ID specified.');
        setIsProcessing(false);
        return;
      }

      if (!state.auth.isAuthenticated || !currentUser) {
        setIsProcessing(false);
        return;
      }

      if (!session) {
        // Wait briefly for session resolution
        return;
      }

      if (isLockedParam) {
        setCheckInStatus('locked');
        setStatusMessage('Attendance for this session has been locked by the meeting coordinator.');
        setIsProcessing(false);
        return;
      }

      const memberId = currentMember?.id || currentUser.id;
      const memberDomain = currentMember?.department || currentUser.domain;

      // Executive privilege: Master Admin, President, and General Secretary can scan across all domains
      const isExecutiveOrMaster =
        currentUser.role === 'master_admin' ||
        currentUser.role === 'president' ||
        currentUser.role === 'general_secretary';

      // 1. Time Window Check (must have reached scheduled start time, unless executive/master admin)
      const sessionStart = parseSessionDateTime(session.date, session.start_time);
      if (sessionStart && new Date() < sessionStart && !isExecutiveOrMaster) {
        setCheckInStatus('time_locked');
        setStatusMessage(
          `Meeting attendance is not yet active. This meeting is scheduled for ${session.date} starting at ${session.start_time}. Check-in will open when the meeting begins.`
        );
        setIsProcessing(false);
        return;
      }

      // 2. Strict Domain Check
      // Other domains members CANNOT scan the QR of another domain. Only Master Admins, President, and GS can do that.
      const isAllDomainsSession =
        session.domain === 'All Domains' || session.domain === 'General E-Cell / Core Committee';

      const isDomainAuthorized = isAllDomainsSession || isExecutiveOrMaster || memberDomain === session.domain;

      if (!isDomainAuthorized) {
        setCheckInStatus('not_eligible');
        setStatusMessage(
          `Cross-Domain Scan Blocked: This meeting is strictly for members of "${session.domain}". You are registered under "${memberDomain}". Only Master Admins, President, and General Secretary can scan attendance across other domains.`
        );
        setIsProcessing(false);
        return;
      }

      // 3. Check Existing Attendance Record
      const existingRec = state.records.find(
        (r) => r.session_id === session.id && r.member_id === memberId
      );

      if (existingRec && (existingRec.status === 'present' || existingRec.status === 'late')) {
        setCheckedRecord(existingRec);
        setCheckInStatus('already_present');
        setStatusMessage('Your attendance for this meeting has already been confirmed as Present.');
        setIsProcessing(false);
        return;
      }

      // 4. Create & Commit Attendance Record
      const newRecord: AttendanceRecord = {
        id: `rec-${session.id}-${memberId}`,
        session_id: session.id,
        member_id: memberId,
        status: 'present',
        remarks: 'Self-checkin via Meeting QR',
        marked_by: currentUser.username || currentUser.email || 'qr-self',
        marked_by_name: currentUser.full_name || 'Self Check-in',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      try {
        if (isSupabaseConfigured() && supabase) {
          const { error } = await supabase.from('records').upsert(newRecord);
          if (error) console.error('Cloud QR record upsert error:', error);
        }

        dispatch({
          type: 'SAVE_ATTENDANCE',
          payload: {
            records: [newRecord],
            auditReason: `QR Check-In by ${currentUser.full_name}`,
          },
        });

        setCheckedRecord(newRecord);
        setCheckInStatus('success');
        setStatusMessage('Attendance verified and marked as Present.');
        addToast({
          type: 'success',
          title: 'QR Check-In Verified',
          message: `Attendance marked Present for ${session.name}!`,
        });
      } catch (err) {
        console.error('Check-in error:', err);
        setCheckInStatus('error');
        setStatusMessage('Could not save attendance to cloud. Please contact your domain lead.');
      } finally {
        setIsProcessing(false);
      }
    };

    processCheckIn();
  }, [sessionId, session, currentUser, currentMember, state.auth.isAuthenticated, isLockedParam]);

  // If user is NOT logged in, show clean prompt with 1-click login
  if (!state.auth.isAuthenticated || !currentUser) {
    const redirectTarget = `/checkin?session=${sessionId || ''}${token ? `&token=${token}` : ''}${isLockedParam ? '&locked=true' : ''}`;

    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-dark-card border border-dark-border rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center mx-auto text-accent-light">
            <ShieldCheck className="h-8 w-8" />
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent-light px-2.5 py-1 rounded-full bg-accent-primary/10 border border-accent-primary/20">
              E-Cell RSCOE Attendance Portal
            </span>
            <h2 className="text-xl font-extrabold text-white mt-2">Meeting Attendance Check-In</h2>
            <p className="text-xs text-gray-400 mt-1">
              Please log in to your E-Cell account on this device to verify and register your attendance.
            </p>
          </div>

          {session && (
            <div className="p-4 bg-dark-bg rounded-xl border border-dark-border text-left space-y-2">
              <span className="text-[10px] font-bold text-accent-light px-2 py-0.5 rounded bg-accent-primary/10">
                {session.domain}
              </span>
              <h3 className="text-sm font-bold text-white">{session.name}</h3>
              <div className="text-[11px] text-gray-400 flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" />
                <span>{session.date} ({session.start_time} - {session.end_time})</span>
              </div>
            </div>
          )}

          <button
            onClick={() => navigate(`/login?redirect=${encodeURIComponent(redirectTarget)}`)}
            className="w-full py-3 px-4 rounded-xl bg-accent-primary hover:bg-blue-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20 cursor-pointer"
          >
            <LogIn className="h-4 w-4" />
            <span>Log In to Check In</span>
          </button>
        </div>
      </div>
    );
  }

  // Processing View
  if (isProcessing) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-dark-card border border-dark-border rounded-2xl p-8 text-center space-y-4">
          <RotateCw className="h-10 w-10 text-accent-light animate-spin mx-auto" />
          <h2 className="text-base font-bold text-white">Verifying Meeting Attendance...</h2>
          <p className="text-xs text-gray-400">
            Checking domain eligibility and synchronizing with Supabase Cloud.
          </p>
        </div>
      </div>
    );
  }

  // Result Card Views
  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-dark-card border border-dark-border rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Success State */}
        {checkInStatus === 'success' && (
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-status-success/15 border border-status-success/30 flex items-center justify-center mx-auto text-status-success">
              <CheckCircle2 className="h-10 w-10 animate-bounce" />
            </div>
            <div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-status-success/15 text-status-success uppercase tracking-wider">
                Attendance Recorded
              </span>
              <h2 className="text-xl font-extrabold text-white mt-1">You're Marked Present!</h2>
              <p className="text-xs text-gray-400 mt-1">
                Your attendance has been officially verified and cloud-synced to the meeting roster.
              </p>
            </div>
          </div>
        )}

        {/* Already Present State */}
        {checkInStatus === 'already_present' && (
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-400">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 uppercase tracking-wider">
                Already Verified
              </span>
              <h2 className="text-xl font-extrabold text-white mt-1">Already Checked In</h2>
              <p className="text-xs text-gray-400 mt-1">{statusMessage}</p>
            </div>
          </div>
        )}

        {/* Cross-Domain Blocked State */}
        {checkInStatus === 'not_eligible' && (
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-status-absent/15 border border-status-absent/30 flex items-center justify-center mx-auto text-status-absent">
              <ShieldAlert className="h-10 w-10" />
            </div>
            <div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-status-absent/15 text-status-absent uppercase tracking-wider">
                Cross-Domain Blocked
              </span>
              <h2 className="text-xl font-extrabold text-white mt-1">Domain Restriction</h2>
              <p className="text-xs text-gray-300 mt-2 bg-dark-bg p-3 rounded-xl border border-dark-border text-left leading-relaxed">
                {statusMessage}
              </p>
            </div>
          </div>
        )}

        {/* Time-Locked State */}
        {checkInStatus === 'time_locked' && (
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
              <Clock className="h-10 w-10 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 uppercase tracking-wider">
                Meeting Not Started
              </span>
              <h2 className="text-xl font-extrabold text-white mt-1">Check-In Opens at Meeting Time</h2>
              <p className="text-xs text-gray-400 mt-1">{statusMessage}</p>
            </div>
          </div>
        )}

        {/* Manually Locked State */}
        {checkInStatus === 'locked' && (
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
              <AlertTriangle className="h-10 w-10" />
            </div>
            <div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 uppercase tracking-wider">
                Check-In Closed
              </span>
              <h2 className="text-xl font-extrabold text-white mt-1">QR Code Is Locked</h2>
              <p className="text-xs text-gray-400 mt-1">{statusMessage}</p>
            </div>
          </div>
        )}

        {/* Session Not Found */}
        {checkInStatus === 'session_not_found' && (
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-gray-500/15 border border-gray-500/30 flex items-center justify-center mx-auto text-gray-400">
              <AlertTriangle className="h-10 w-10" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white mt-1">Meeting Not Found</h2>
              <p className="text-xs text-gray-400 mt-1">{statusMessage}</p>
            </div>
          </div>
        )}

        {/* Member & Session Detail Card */}
        {session && (
          <div className="p-4 bg-dark-bg rounded-xl border border-dark-border space-y-3 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-dark-border">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-accent-primary/20 text-accent-light flex items-center justify-center font-bold text-[10px]">
                  {currentUser.full_name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-white">{currentUser.full_name}</div>
                  <div className="text-[10px] text-gray-500">
                    Domain: <span className="text-accent-light">{currentMember?.department || currentUser.domain}</span>
                  </div>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-dark-card border border-dark-border text-gray-300 font-mono">
                {currentMember?.member_id || currentUser.username}
              </span>
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="text-white font-semibold text-sm">{session.name}</div>
              <div className="flex items-center gap-2 text-gray-400">
                <Building className="h-3.5 w-3.5 text-gray-500" />
                <span>Host Domain: <strong className="text-white">{session.domain}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <Calendar className="h-3.5 w-3.5 text-gray-500" />
                <span>{session.date} ({session.start_time} - {session.end_time})</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <MapPin className="h-3.5 w-3.5 text-gray-500" />
                <span>{session.location}</span>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
          {session && (
            <Link
              to={`/sessions/${session.id}`}
              className="w-full sm:flex-1 py-2.5 px-3 rounded-xl bg-dark-bg hover:bg-dark-border border border-dark-border text-gray-300 hover:text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <span>View Meeting Page</span>
            </Link>
          )}

          <Link
            to="/dashboard"
            className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-accent-primary hover:bg-blue-600 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20"
          >
            <span>Go to Dashboard</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
