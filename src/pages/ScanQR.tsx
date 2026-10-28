import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  QrCode,
  Camera,
  RefreshCw,
  AlertCircle,
  Flashlight,
  CheckCircle2,
  ArrowLeft,
  Upload,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function ScanQR() {
  const navigate = useNavigate();
  const { addToast } = useApp();
  const [scannerStarted, setScannerStarted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Initialize and list cameras
  useEffect(() => {
    let isMounted = true;

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!isMounted) return;
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer back camera on mobile phones
          const backCam = devices.find((d) =>
            d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear') || d.label.toLowerCase().includes('environment')
          );
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        } else {
          setErrorMsg('No camera detected on this device. You can still scan via your phone camera or upload a QR image.');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Camera access error:', err);
        setErrorMsg('Camera access was denied or is unavailable. Please grant camera permission in your browser settings.');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Start Scanner
  useEffect(() => {
    if (!selectedCameraId) return;

    const qrElementId = 'reader-viewport';
    const html5QrCode = new Html5Qrcode(qrElementId, {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      verbose: false,
    });
    scannerRef.current = html5QrCode;

    const qrConfig = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
    };

    html5QrCode
      .start(
        selectedCameraId,
        qrConfig,
        (decodedText) => {
          // Success Callback
          handleDecodedPayload(decodedText);
        },
        () => {
          // Failure callback for individual frames — ignore
        }
      )
      .then(() => {
        setScannerStarted(true);
        setErrorMsg('');
        // Check torch capabilities
        try {
          const track = html5QrCode.getRunningTrackCameraCapabilities();
          if (track && 'torch' in track) {
            setHasTorch(true);
          }
        } catch (e) {
          // Torch unsupported
        }
      })
      .catch((err) => {
        console.error('Failed to start scanner:', err);
        setScannerStarted(false);
        setErrorMsg('Could not open camera stream. Make sure no other app is using your camera.');
      });

    return () => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop().then(() => html5QrCode.clear()).catch((e) => console.error(e));
      }
    };
  }, [selectedCameraId]);

  // Handle Scanned Result
  const handleDecodedPayload = (payload: string) => {
    // Stop scanning immediately upon detection
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop().catch((e) => console.error(e));
    }

    addToast({
      type: 'info',
      title: 'QR Code Detected',
      message: 'Processing meeting check-in...',
    });

    try {
      // Check if it's a URL
      if (payload.includes('/checkin')) {
        const urlObj = new URL(payload, window.location.origin);
        navigate(`${urlObj.pathname}${urlObj.search}`);
        return;
      }

      // Check if it's raw JSON with session ID
      if (payload.startsWith('{') && payload.endsWith('}')) {
        const parsed = JSON.parse(payload);
        if (parsed.session_id || parsed.session) {
          navigate(`/checkin?session=${parsed.session_id || parsed.session}`);
          return;
        }
      }

      // Fallback: treat as raw session ID
      if (payload.startsWith('session-')) {
        navigate(`/checkin?session=${payload}`);
        return;
      }

      // Unknown URL or code
      navigate(`/checkin?session=${encodeURIComponent(payload)}`);
    } catch (e) {
      navigate(`/checkin?session=${encodeURIComponent(payload)}`);
    }
  };

  // File Upload Fallback
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const html5QrCode = new Html5Qrcode('reader-viewport');

    html5QrCode
      .scanFile(file, true)
      .then((decodedText) => {
        handleDecodedPayload(decodedText);
      })
      .catch((err) => {
        addToast({
          type: 'error',
          title: 'QR Not Detected in Image',
          message: 'Could not read a valid meeting QR code from the selected image.',
        });
      });
  };

  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextTorch = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch } as any],
      });
      setTorchOn(nextTorch);
    } catch (err) {
      console.warn('Torch toggle failed:', err);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl bg-dark-card border border-dark-border text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Scan Meeting QR</h1>
            <p className="text-xs text-gray-400">
              Point your camera at the meeting attendance QR code projected on screen
            </p>
          </div>
        </div>
      </div>

      {/* Camera Viewport Container */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden space-y-4">
        {/* Error message banner */}
        {errorMsg && (
          <div className="p-3 bg-status-absent/10 border border-status-absent/20 rounded-xl text-xs text-status-absent flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{errorMsg}</p>
              <p className="text-gray-400 mt-1">
                Tip: You can also scan using your phone's default camera app (Google Lens / iPhone Camera) without opening this tab!
              </p>
            </div>
          </div>
        )}

        {/* Viewport Box */}
        <div className="relative rounded-xl overflow-hidden bg-black aspect-square max-w-sm mx-auto flex items-center justify-center border-2 border-dashed border-dark-border">
          <div id="reader-viewport" className="w-full h-full" />

          {/* Scanner Overlay Visuals */}
          {scannerStarted && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-60 h-60 border-2 border-accent-primary/80 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                {/* Corner Accents */}
                <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-accent-light rounded-tl" />
                <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-accent-light rounded-tr" />
                <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-accent-light rounded-bl" />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-accent-light rounded-br" />

                {/* Animated Laser Scan Line */}
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-accent-light to-transparent animate-pulse absolute top-1/2 -translate-y-1/2" />
              </div>
            </div>
          )}
        </div>

        {/* Controls Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {cameras.length > 1 && (
            <select
              value={selectedCameraId}
              onChange={(e) => setSelectedCameraId(e.target.value)}
              className="px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary"
            >
              {cameras.map((c, idx) => (
                <option key={c.id} value={c.id}>
                  {c.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          )}

          {hasTorch && (
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                torchOn
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-dark-bg text-gray-400 border border-dark-border hover:text-white'
              }`}
            >
              <Flashlight className="h-4 w-4" />
              <span>{torchOn ? 'Torch On' : 'Torch Off'}</span>
            </button>
          )}

          {/* Upload QR from Gallery option */}
          <label className="px-3 py-2 rounded-lg bg-dark-bg hover:bg-dark-border border border-dark-border text-xs text-gray-300 hover:text-white font-semibold flex items-center gap-2 cursor-pointer transition-colors ml-auto">
            <Upload className="h-4 w-4" />
            <span>Upload QR Image</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Helpful Tips Card */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-4 text-xs space-y-2">
        <h3 className="font-bold text-white flex items-center gap-2">
          <QrCode className="h-4 w-4 text-accent-light" />
          <span>Quick Attendance Tips</span>
        </h3>
        <ul className="list-disc list-inside space-y-1 text-gray-400">
          <li>Hold your device steady with the QR code centered inside the frame.</li>
          <li>You can also scan the projected code directly with your normal phone camera (Google Lens or Apple Camera).</li>
          <li>Ensure you are logged into your assigned E-Cell account to register attendance.</li>
        </ul>
      </div>
    </div>
  );
}
