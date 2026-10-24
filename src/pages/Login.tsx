import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  KeyRound,
  User,
  LogIn,
  Eye,
  EyeOff,
  Crown,
  Shield,
  Layers,
  ArrowRight
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CORE_LEADS, DEFAULT_PASSWORD } from '../lib/demoData';
import { UserAccount } from '../types';

export default function Login() {
  const { state, dispatch, addToast } = useApp();
  const navigate = useNavigate();

  const [username, setUsername] = useState('parth.amilkanthwar');
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Handle Standard Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const cleanUsername = username.toLowerCase().trim();

    setTimeout(() => {
      setIsLoading(false);

      const matchedUser = state.userAccounts.find(
        (u) => u.username.toLowerCase() === cleanUsername
      );

      if (!matchedUser) {
        addToast({
          type: 'error',
          title: 'Account Not Found',
          message: `No account found for "${cleanUsername}". Check the quick login list below.`,
        });
        return;
      }

      if (matchedUser.status === 'disabled') {
        addToast({
          type: 'error',
          title: 'Account Deactivated',
          message: 'This account has been disabled by the Master Admin.',
        });
        return;
      }

      completeLogin(matchedUser);
    }, 250);
  };

  // Complete Login and Redirect based on role
  const completeLogin = (account: UserAccount) => {
    dispatch({ type: 'LOGIN', payload: account });

    addToast({
      type: 'success',
      title: 'Authenticated',
      message: `Welcome, ${account.full_name} (${account.role.replace('_', ' ').toUpperCase()}).`,
    });

    // General Secretary & President both redirect to Leadership Overview
    if (account.role === 'president' || account.role === 'general_secretary') {
      navigate('/leadership');
    } else if (account.role === 'member') {
      navigate('/my-domain');
    } else {
      navigate('/dashboard');
    }
  };

  // Quick 1-Click Lead Selector
  const handleSelectLead = (leadUsername: string) => {
    const matched = state.userAccounts.find((u) => u.username === leadUsername);
    if (matched) {
      setUsername(matched.username);
      setPassword(DEFAULT_PASSWORD);
      completeLogin(matched);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg relative z-10 space-y-6">
        {/* Branding Title Header with official logo */}
        <div className="text-center space-y-2">
          <img
            src="/logo.jpg"
            alt="E-Cell RSCOE Logo"
            className="w-16 h-16 rounded-2xl mx-auto object-contain bg-black border border-dark-border shadow-xl p-1"
          />
          <div>
            <h1 className="text-2xl font-black text-white tracking-wider">
              E-CELL RSCOE
            </h1>
            <p className="text-xs text-gray-400 tracking-tight">
              Attendance & Operations Management · AY 2026–27
            </p>
          </div>
        </div>

        {/* Login Form Box */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Username (firstname.lastname)
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
                  placeholder="parth.amilkanthwar"
                  className="w-full pl-10 pr-3 py-2.5 bg-dark-bg border border-dark-border rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-accent-primary font-mono"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-300">Password</label>
                <span className="text-[10px] text-gray-500 font-mono">
                  Default: {DEFAULT_PASSWORD}
                </span>
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-dark-bg border border-dark-border rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-accent-primary font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-400">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded bg-dark-bg border-dark-border text-accent-primary focus:ring-0"
                />
                <span className="text-[11px]">Remember login session</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-accent-primary hover:bg-blue-600 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* ─── 1-CLICK PRE-CONFIGURED LOGIN SWITCHER ───────────────────────────── */}
          <div className="pt-4 border-t border-dark-border space-y-2.5">
            <span className="text-[10px] text-gray-400 block text-center uppercase tracking-wider font-bold">
              Core Committee Lead Logins (1-Click Switcher)
            </span>

            {/* Top 3 Executives: Master Admin, President, General Secretary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => handleSelectLead('parth.amilkanthwar')}
                className="p-2 rounded-xl bg-accent-primary/10 hover:bg-accent-primary/20 border border-accent-primary/40 text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white truncate">Parth</span>
                  <span className="text-[8px] px-1 rounded font-black bg-accent-primary text-white">
                    MASTER
                  </span>
                </div>
                <span className="text-[10px] text-accent-light font-mono block truncate">
                  Finance Lead
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectLead('sarthak.mehta')}
                className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white truncate">Sarthak</span>
                  <span className="text-[8px] px-1 rounded font-black bg-amber-500 text-black">
                    PRES
                  </span>
                </div>
                <span className="text-[10px] text-status-late font-mono block truncate">
                  President
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectLead('yashraj.ghate')}
                className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white truncate">Yashraj</span>
                  <span className="text-[8px] px-1 rounded font-black bg-amber-500 text-black">
                    GS
                  </span>
                </div>
                <span className="text-[10px] text-status-late font-mono block truncate">
                  Gen Secretary
                </span>
              </button>
            </div>

            {/* The 6 Domain Leads */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {CORE_LEADS.filter(
                (l) =>
                  l.username !== 'parth.amilkanthwar' &&
                  l.username !== 'sarthak.mehta' &&
                  l.username !== 'yashraj.ghate'
              ).map((lead) => (
                <button
                  key={lead.username}
                  type="button"
                  onClick={() => handleSelectLead(lead.username)}
                  className="p-2 rounded-lg bg-dark-bg hover:bg-dark-hover border border-dark-border text-left transition-colors cursor-pointer truncate"
                  title={`${lead.name} (${lead.domain})`}
                >
                  <div className="text-[11px] font-semibold text-white truncate">{lead.name}</div>
                  <div className="text-[9px] text-gray-500 truncate">{lead.domain.split('&')[0]}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
