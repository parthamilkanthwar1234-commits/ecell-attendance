import { useEffect, useMemo } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Crown,
  Users,
  ClipboardCheck,
  Calendar,
  History,
  BarChart3,
  Settings,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  Layers,
  X
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

export default function Sidebar() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (window.innerWidth < 1024) {
      dispatch({ type: 'SET_SIDEBAR', payload: false });
    }
  }, [location.pathname, dispatch]);

  const user = state.auth.user;

  // Build role-tailored navigation items
  // Note: General Secretary has identical rights to President
  const navItems = useMemo(() => {
    const items: NavItem[] = [];

    if (user?.role === 'master_admin') {
      items.push({ label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard });
      items.push({ label: 'Leadership Overview', path: '/leadership', icon: Crown });
      items.push({ label: 'Meetings & Events', path: '/sessions', icon: Calendar });
      items.push({ label: 'Mark Attendance', path: '/attendance/mark', icon: ClipboardCheck });
      items.push({ label: 'Team Members', path: '/members', icon: Users });
      items.push({ label: 'Attendance History', path: '/attendance/history', icon: History });
      items.push({ label: 'Analytics & Reports', path: '/analytics', icon: BarChart3 });
      items.push({ label: 'Audit Trail', path: '/audit-logs', icon: ShieldAlert });
      items.push({ label: 'User Management', path: '/users', icon: ShieldCheck });
      items.push({ label: 'Settings', path: '/settings', icon: Settings });
    } else if (user?.role === 'president' || user?.role === 'general_secretary') {
      // General Secretary & President central leadership
      items.push({ label: 'Leadership Overview', path: '/leadership', icon: Crown });
      items.push({ label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard });
      items.push({ label: 'Meetings & Events', path: '/sessions', icon: Calendar });
      items.push({ label: 'Team Members', path: '/members', icon: Users });
      items.push({ label: 'Attendance History', path: '/attendance/history', icon: History });
      items.push({ label: 'Analytics & Reports', path: '/analytics', icon: BarChart3 });
    } else if (user?.role === 'lead_admin') {
      items.push({ label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard });
      items.push({ label: 'Meetings & Events', path: '/sessions', icon: Calendar });
      items.push({ label: 'Mark Attendance', path: '/attendance/mark', icon: ClipboardCheck });
      items.push({ label: 'Team Members', path: '/members', icon: Users });
      items.push({ label: 'Attendance History', path: '/attendance/history', icon: History });
      items.push({ label: 'Analytics & Reports', path: '/analytics', icon: BarChart3 });
    } else {
      // Member
      items.push({ label: 'My Domain', path: '/my-domain', icon: Layers });
      items.push({ label: 'Meetings & Events', path: '/sessions', icon: Calendar });
      items.push({ label: 'Attendance History', path: '/attendance/history', icon: History });
    }

    return items;
  }, [user]);

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT' });
    navigate('/login');
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'master_admin':
        return 'bg-accent-primary/20 text-accent-light border-accent-primary/40';
      case 'president':
      case 'general_secretary':
        return 'bg-amber-500/20 text-status-late border-amber-500/40';
      case 'lead_admin':
        return 'bg-status-success/20 text-status-success border-status-success/40';
      default:
        return 'bg-dark-bg text-gray-400 border-dark-border';
    }
  };

  const getRoleTitle = (role?: string) => {
    switch (role) {
      case 'master_admin':
        return 'Master Admin';
      case 'president':
        return 'President';
      case 'general_secretary':
        return 'Gen Secretary';
      case 'lead_admin':
        return 'Lead Admin';
      default:
        return 'Member';
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {state.sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => dispatch({ type: 'SET_SIDEBAR', payload: false })}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col w-64 bg-dark-card border-r border-dark-border transition-transform duration-300 ease-in-out ${
          state.sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Logo & Title */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-dark-border">
          <div className="flex items-center gap-3">
            <img
              src="/logo.jpg"
              alt="E-Cell RSCOE"
              className="w-9 h-9 rounded-lg object-contain bg-black border border-dark-border shadow-sm"
            />
            <div>
              <h1 className="font-extrabold text-xs text-white tracking-wider">
                E-CELL RSCOE
              </h1>
              <p className="text-[10px] text-gray-400 tracking-tight">
                Attendance System
              </p>
            </div>
          </div>

          <button
            onClick={() => dispatch({ type: 'SET_SIDEBAR', payload: false })}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-dark-hover transition-colors lg:hidden cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-accent-primary text-white shadow-md shadow-blue-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-dark-hover'
                }`
              }
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Logged in User Bar */}
        {user && (
          <div className="p-3 border-t border-dark-border bg-dark-bg/40">
            <div className="p-2 rounded-xl bg-dark-card border border-dark-border flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-accent-primary/20 border border-accent-primary/30 flex items-center justify-center font-bold text-accent-light text-xs flex-shrink-0">
                  {user.full_name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">{user.full_name}</div>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold border uppercase tracking-wider inline-block ${getRoleBadge(
                      user.role
                    )}`}
                  >
                    {getRoleTitle(user.role)}
                  </span>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-gray-400 hover:text-status-absent hover:bg-status-absent/10 transition-colors cursor-pointer flex-shrink-0"
                title="Log Out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
