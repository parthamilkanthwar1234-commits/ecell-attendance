import { useEffect, useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Info,
  AlertTriangle,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { ToastMessage } from '../../types';

const iconMap: Record<
  ToastMessage['type'],
  React.ComponentType<{ className?: string }>
> = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const styleMap: Record<ToastMessage['type'], string> = {
  success: 'border-status-success/40 bg-status-success/10',
  error: 'border-status-absent/40 bg-status-absent/10',
  info: 'border-accent-primary/40 bg-accent-primary/10',
  warning: 'border-status-late/40 bg-status-late/10',
};

const iconColorMap: Record<ToastMessage['type'], string> = {
  success: 'text-status-success',
  error: 'text-status-absent',
  info: 'text-accent-light',
  warning: 'text-status-late',
};

interface ToastItemProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation on mount
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => onDismiss(toast.id), 200);
  };

  const Icon = iconMap[toast.type];

  return (
    <div
      className={`
        flex items-start gap-3 w-80 max-w-[calc(100vw-2rem)] p-4 rounded-xl border shadow-lg backdrop-blur-sm
        transition-all duration-200 ease-out
        ${styleMap[toast.type]}
        ${visible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'}
      `}
      role="alert"
    >
      <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${iconColorMap[toast.type]}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{toast.title}</p>
        {toast.message && (
          <p className="mt-1 text-xs text-gray-400">{toast.message}</p>
        )}
      </div>
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 p-0.5 rounded text-gray-500 hover:text-white transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function Toast() {
  const { state, dispatch } = useApp();

  const handleDismiss = (id: string) => {
    dispatch({ type: 'REMOVE_TOAST', payload: id });
  };

  if (state.toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-3 pointer-events-none">
      {state.toasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onDismiss={handleDismiss} />
        </div>
      ))}
    </div>
  );
}
