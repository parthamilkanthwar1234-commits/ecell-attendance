import React, { useState, useEffect, useMemo, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  QrCode,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Lock,
  Unlock,
  Users,
  Clock,
  MapPin,
  RefreshCw,
  Download,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import Modal from '../ui/Modal';
import { AttendanceSession, AttendanceRecord } from '../../types';
import { useApp } from '../../context/AppContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

interface SessionQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: AttendanceSession;
}

export const SessionQRModal: React.FC<SessionQRModalProps> = ({
  isOpen,
  onClose,
  session,
}) => {
  const { state, syncFromCloud, addToast } = useApp();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [qrToken, setQrToken] = useState(() => `${session.id.slice(-6)}-${Date.now().toString(36)}`);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  // Generate Direct Check-In URL
  const checkinUrl = useMemo(() => {
    const origin = window.location.origin;
    return `${origin}/checkin?session=${session.id}&token=${qrToken}${isLocked ? '&locked=true' : ''}`;
  }, [session.id, qrToken, isLocked]);

  // Live Check-in Stats
  const sessionRecords = useMemo(() => {
    return state.records.filter((r) => r.session_id === session.id);
  }, [state.records, session.id]);

  const qrCheckedInCount = useMemo(() => {
    return sessionRecords.filter(
      (r) => r.status === 'present' && (r.remarks?.toLowerCase().includes('qr') || r.marked_by !== 'admin')
    ).length;
  }, [sessionRecords]);

  const totalPresentCount = useMemo(() => {
    return sessionRecords.filter((r) => r.status === 'present' || r.status === 'late').length;
  }, [sessionRecords]);

  // Auto-poll Supabase while QR modal is open so lead sees live attendee check-ins in real time
  useEffect(() => {
    if (!isOpen || !isSupabaseConfigured() || !supabase) return;

    const interval = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('records')
          .select('*')
          .eq('session_id', session.id);
        if (data && data.length > 0) {
          syncFromCloud();
        }
      } catch (err) {
        console.error('QR polling error:', err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isOpen, session.id, syncFromCloud]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(checkinUrl);
    setCopied(true);
    addToast({
      type: 'success',
      title: 'Check-In Link Copied',
      message: 'Direct meeting check-in link copied to clipboard.',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    if (!qrRef.current) return;
    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    const downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    downloadLink.download = `QR_${session.name.replace(/[^a-zA-Z0-9]/g, '_')}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(svgUrl);

    addToast({
      type: 'info',
      title: 'QR Code Downloaded',
      message: 'High-res SVG QR code downloaded for printing or display.',
    });
  };

  const handleRegenerateToken = () => {
    const newToken = `${session.id.slice(-6)}-${Date.now().toString(36)}`;
    setQrToken(newToken);
    addToast({
      type: 'info',
      title: 'QR Code Regenerated',
      message: 'Security token refreshed. Old QR codes are now invalidated.',
    });
  };

  const content = (
    <div className={`space-y-6 ${isFullscreen ? 'p-8 max-w-2xl mx-auto' : ''}`}>
      {/* Session Header Card */}
      <div className="bg-dark-bg p-4 rounded-xl border border-dark-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-primary/20 text-accent-light border border-accent-primary/30">
              {session.domain}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300">
              {session.session_type}
            </span>
          </div>
          <h3 className="text-base font-bold text-white tracking-tight">{session.name}</h3>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mt-1">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-gray-500" />
              {session.date} ({session.start_time} - {session.end_time})
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-gray-500" />
              {session.location}
            </span>
          </div>
        </div>

        {/* Live Attendance Counter */}
        <div className="flex items-center gap-3 bg-dark-card px-4 py-2.5 rounded-lg border border-dark-border">
          <div className="w-3 h-3 rounded-full bg-status-success animate-pulse" />
          <div>
            <div className="text-xs text-gray-400 font-medium">Live Present</div>
            <div className="text-lg font-black text-white leading-tight">
              {totalPresentCount}{' '}
              <span className="text-xs font-normal text-status-success">
                ({qrCheckedInCount} via QR)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Canvas */}
      <div className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-2xl relative border-4 border-gray-200">
        {isLocked ? (
          <div className="py-16 text-center space-y-3">
            <div className="p-4 bg-status-absent/15 text-status-absent rounded-full inline-flex">
              <Lock className="h-10 w-10" />
            </div>
            <h4 className="text-lg font-bold text-gray-900">QR Check-In Is Locked</h4>
            <p className="text-xs text-gray-600 max-w-xs mx-auto">
              The organizer has locked this session's attendance. No new scans are accepted.
            </p>
            <button
              onClick={() => setIsLocked(false)}
              className="mt-2 px-4 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-semibold hover:bg-gray-800"
            >
              Unlock QR Code
            </button>
          </div>
        ) : (
          <div ref={qrRef} className="flex flex-col items-center">
            <QRCodeSVG
              value={checkinUrl}
              size={isFullscreen ? 320 : 240}
              level="H"
              includeMargin={true}
              imageSettings={{
                src: '/rscoe-logo.png',
                x: undefined,
                y: undefined,
                height: 40,
                width: 40,
                opacity: 1,
                excavate: true,
              }}
            />
            <div className="mt-2 text-center">
              <span className="text-[11px] font-bold tracking-wider text-gray-800 uppercase block">
                E-Cell JSPM RSCOE · Live Check-In
              </span>
              <span className="text-[10px] text-gray-500 font-medium block">
                Scan with phone camera or E-Cell portal scanner
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Instructions & Security Notice */}
      <div className="p-3 bg-dark-bg border border-dark-border rounded-xl flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-accent-light shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-semibold text-white">How members mark attendance:</p>
          <p className="text-gray-400">
            1. Members scan this QR using their phone camera (Google Lens / iPhone Camera) or the <strong>Scan QR</strong> tab inside the portal.
          </p>
          <p className="text-gray-400">
            2. Attendance is instantly verified against their active login and saved to cloud.
          </p>
          <p className="text-gray-400">
            3. If anyone cannot scan, domain leads can still manually mark them <strong>Present</strong> anytime below.
          </p>
        </div>
      </div>

      {/* Control Buttons Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-dark-border">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLocked(!isLocked)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              isLocked
                ? 'bg-status-success/20 text-status-success hover:bg-status-success/30'
                : 'bg-dark-bg border border-dark-border text-gray-300 hover:text-white'
            }`}
            title={isLocked ? 'Unlock QR Code' : 'Lock QR Code'}
          >
            {isLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            <span>{isLocked ? 'Unlock QR' : 'Lock QR'}</span>
          </button>

          <button
            onClick={handleRegenerateToken}
            className="px-3 py-2 rounded-lg bg-dark-bg border border-dark-border text-gray-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Refresh Security Token"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Refresh Token</span>
          </button>

          <button
            onClick={handleDownloadQR}
            className="px-3 py-2 rounded-lg bg-dark-bg border border-dark-border text-gray-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Download QR SVG"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Download</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="px-3 py-2 rounded-lg bg-dark-bg border border-dark-border text-gray-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copied ? <Check className="h-4 w-4 text-status-success" /> : <Copy className="h-4 w-4" />}
            <span>{copied ? 'Copied!' : 'Copy Link'}</span>
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="px-4 py-2 rounded-lg bg-accent-primary hover:bg-blue-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-blue-500/20"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Project Fullscreen'}</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0B0D10]/95 backdrop-blur-md overflow-y-auto flex flex-col justify-center items-center p-4 sm:p-8">
        <div className="w-full max-w-2xl bg-dark-card border border-dark-border rounded-2xl p-6 sm:p-8 shadow-2xl relative">
          <button
            onClick={() => setIsFullscreen(false)}
            className="absolute top-4 right-4 p-2 rounded-xl bg-dark-bg text-gray-400 hover:text-white border border-dark-border cursor-pointer"
            title="Close Fullscreen"
          >
            <Minimize2 className="h-5 w-5" />
          </button>
          {content}
        </div>
      </div>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Meeting Attendance QR Code"
      size="xl"
    >
      {content}
    </Modal>
  );
};
