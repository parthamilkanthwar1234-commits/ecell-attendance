import { useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, Shield } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Sidebar from './Sidebar';
import Toast from '../ui/Toast';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard Overview',
  '/leadership': 'Central Leadership Overview',
  '/members': 'Team Members Management',
  '/attendance/mark': 'Mark & Record Attendance',
  '/sessions': 'Meetings & Events Schedule',
  '/attendance/history': 'Attendance Audit History',
  '/analytics': 'Analytics & Statistical Reports',
  '/audit-logs': 'Attendance Audit Trail',
  '/users': 'User Account Management',
  '/my-domain': 'My Domain Workspace',
  '/settings': 'System Settings & Rules',
};

export default function Layout() {
  const { state, dispatch } = useApp();
  const location = useLocation();

  const pageTitle = useMemo(() => {
    if (pageTitles[location.pathname]) return pageTitles[location.pathname];
    if (location.pathname.startsWith('/sessions/')) return 'Session Details & MoM';
    const match = Object.entries(pageTitles).find(([path]) =>
      location.pathname.startsWith(path)
    );
    return match ? match[1] : 'E-Cell Attendance';
  }, [location.pathname]);

  const user = state.auth.user;

  return (
    <div className="flex h-screen bg-dark-bg text-white overflow-hidden">
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header bar */}
        <header className="flex items-center justify-between h-16 px-4 sm:px-6 border-b border-dark-border bg-dark-card flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-dark-hover transition-colors lg:hidden cursor-pointer"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h2 className="text-base sm:text-lg font-bold text-white truncate">
              {pageTitle}
            </h2>
          </div>

          {/* Right side user badge */}
          {user && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-dark-bg border border-dark-border">
                <div className="w-6 h-6 rounded-full bg-accent-primary/20 text-accent-light flex items-center justify-center font-bold text-[10px]">
                  {user.full_name.charAt(0)}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-bold text-white truncate max-w-[140px]">
                    {user.full_name}
                  </div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">
                    {user.role.replace('_', ' ')}
                  </div>
                </div>
              </div>
            </div>
          )}
        </header>

        {/* Scrollable page body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Global Toasts */}
      <Toast />
    </div>
  );
}
