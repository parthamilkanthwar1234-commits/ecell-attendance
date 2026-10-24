import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  KeyRound,
  User,
  LogIn,
  Eye,
  EyeOff,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DEFAULT_PASSWORD } from '../lib/demoData';
import { UserAccount } from '../types';

export default function Login() {
  const { state, dispatch, addToast } = useApp();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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

      let matchedUser = state.userAccounts.find(
        (u) => u.username.toLowerCase() === cleanUsername
      );

      // If not yet in userAccounts, check if matching member exists in cloud-synced roster
      if (!matchedUser) {
        const matchedMember = state.members.find(
          (m) =>
            (m.username && m.username.toLowerCase() === cleanUsername) ||
            (m.email && m.email.toLowerCase() === cleanUsername)
        );

        if (matchedMember) {
          matchedUser = {
            id: `user-${matchedMember.id}`,
            full_name: matchedMember.name,
            username: matchedMember.username || cleanUsername,
            role: 'member',
            domain: matchedMember.department,
            email: matchedMember.email,
            password: DEFAULT_PASSWORD,
            temp_password: DEFAULT_PASSWORD,
            status: matchedMember.status === 'inactive' ? 'disabled' : 'active',
            must_change_password: false,
            created_at: matchedMember.created_at || new Date().toISOString(),
          };
        }
      }

      if (!matchedUser) {
        addToast({
          type: 'error',
          title: 'Account Not Found',
          message: `No active account found for "${cleanUsername}". Enter your assigned firstname.lastname.`,
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

      // Verify Password (strictly against user's assigned unique credentials)
      const validPasswords = [
        matchedUser.password,
        matchedUser.temp_password,
      ].filter(Boolean);

      if (!validPasswords.includes(password)) {
        addToast({
          type: 'error',
          title: 'Invalid Password',
          message: 'The password you entered is incorrect. Please verify and try again.',
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

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Branding Title Header with official logo */}
        <div className="text-center space-y-2">
          <img
            src="/logo.jpg"
            alt="E-Cell RSCOE Logo"
            className="w-16 h-16 rounded-2xl mx-auto object-contain bg-black border border-dark-border shadow-2xl p-1"
          />
          <div>
            <h1 className="text-2xl font-black text-white tracking-wider">
              E-CELL RSCOE
            </h1>
            <p className="text-xs text-gray-400 tracking-tight">
              Attendance & Operations Management Portal
            </p>
          </div>
        </div>

        {/* Login Form Box */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-dark-border">
            <Lock className="h-4 w-4 text-accent-light" />
            <h2 className="text-sm font-bold text-white">Sign In to Your Workspace</h2>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
                  placeholder="e.g. parth.amilkanthwar"
                  className="w-full pl-10 pr-3 py-2.5 bg-dark-bg border border-dark-border rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-accent-primary font-mono transition-colors"
                />
              </div>
              <span className="text-[10px] text-gray-500 mt-1 block">
                Standard format: <code className="text-gray-400">firstname.lastname</code>
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-10 py-2.5 bg-dark-bg border border-dark-border rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-accent-primary font-mono transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
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
              className="w-full py-2.5 px-4 rounded-xl bg-accent-primary hover:bg-blue-600 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
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

          {/* Security footnote */}
          <div className="pt-3 border-t border-dark-border flex items-center justify-center gap-2 text-[11px] text-gray-500">
            <ShieldCheck className="h-3.5 w-3.5 text-accent-light" />
            <span>Role-Based Access Protected · Master Admin & Domain Leads</span>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-gray-500">
          Entrepreneurship Cell · JSPM Rajarshi Shahu College of Engineering, Pune
        </p>
      </div>
    </div>
  );
}
