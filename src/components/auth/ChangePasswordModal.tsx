import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  User,
  ShieldCheck,
} from 'lucide-react';
import Modal from '../ui/Modal';
import { useApp } from '../../context/AppContext';
import { UserAccount } from '../../types';
import { DEFAULT_PASSWORD } from '../../lib/demoData';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  fetchCloudVault,
  applyVaultToAccount,
  verifyAccountPassword,
} from '../../lib/credentialsVault';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** When provided (logged-in user), username is locked to this account. */
  currentUser?: UserAccount | null;
  /** Optional initial username when opened from the Login screen. */
  initialUsername?: string;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  initialUsername = '',
}) => {
  const { state, addToast, changeUserPassword } = useApp();

  const [username, setUsername] = useState(currentUser?.username || initialUsername);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setUsername(currentUser?.username || initialUsername || '');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrorMsg(null);
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
    }
  }, [isOpen, currentUser?.username, initialUsername]);

  const resolveAccount = async (cleanUsername: string): Promise<UserAccount | null> => {
    if (currentUser && currentUser.username.toLowerCase() === cleanUsername) {
      return currentUser;
    }

    const fromAccounts = state.userAccounts.find(
      (u) => u.username.toLowerCase() === cleanUsername
    );
    if (fromAccounts) return fromAccounts;

    const fromMembers = state.members.find(
      (m) =>
        (m.username && m.username.toLowerCase() === cleanUsername) ||
        (m.email && m.email.toLowerCase() === cleanUsername) ||
        m.name.toLowerCase().replace(/\s+/g, '.') === cleanUsername
    );
    if (fromMembers) {
      return {
        id: `user-${fromMembers.id}`,
        full_name: fromMembers.name,
        username: fromMembers.username || cleanUsername,
        role:
          fromMembers.role === 'Domain Lead'
            ? 'lead_admin'
            : fromMembers.role === 'Domain Co-Lead'
            ? 'co_lead'
            : fromMembers.role === 'President'
            ? 'president'
            : fromMembers.role === 'General Secretary'
            ? 'general_secretary'
            : fromMembers.role === 'Master Admin'
            ? 'master_admin'
            : 'member',
        domain: fromMembers.department,
        email: fromMembers.email,
        password: DEFAULT_PASSWORD,
        temp_password: DEFAULT_PASSWORD,
        status: fromMembers.status === 'inactive' ? 'disabled' : 'active',
        must_change_password: false,
        created_at: fromMembers.created_at || new Date().toISOString(),
      };
    }

    if (isSupabaseConfigured() && supabase) {
      const { data: cloudMembers } = await supabase.from('members').select('*');
      if (cloudMembers && cloudMembers.length > 0) {
        const directMatch = cloudMembers.find(
          (m: any) =>
            (m.username && m.username.toLowerCase() === cleanUsername) ||
            (m.email && m.email.toLowerCase() === cleanUsername) ||
            (m.name && m.name.toLowerCase().replace(/\s+/g, '.') === cleanUsername)
        );
        if (directMatch) {
          return {
            id: `user-${directMatch.id}`,
            full_name: directMatch.name,
            username: directMatch.username || cleanUsername,
            role:
              directMatch.role === 'Domain Lead'
                ? 'lead_admin'
                : directMatch.role === 'Domain Co-Lead'
                ? 'co_lead'
                : directMatch.role === 'President'
                ? 'president'
                : directMatch.role === 'General Secretary'
                ? 'general_secretary'
                : directMatch.role === 'Master Admin'
                ? 'master_admin'
                : 'member',
            domain: directMatch.department,
            email: directMatch.email,
            password: DEFAULT_PASSWORD,
            temp_password: DEFAULT_PASSWORD,
            status: directMatch.status === 'inactive' ? 'disabled' : 'active',
            must_change_password: false,
            created_at: directMatch.created_at || new Date().toISOString(),
          };
        }
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanUsername = username.toLowerCase().trim();
    if (!cleanUsername) {
      setErrorMsg('Please enter your username.');
      return;
    }

    const trimmedNew = newPassword.trim();
    if (trimmedNew.length < 6) {
      setErrorMsg('New password must be at least 6 characters long.');
      return;
    }

    if (trimmedNew.toLowerCase() === DEFAULT_PASSWORD.toLowerCase()) {
      setErrorMsg(`Please choose a personal password instead of the common default (${DEFAULT_PASSWORD}).`);
      return;
    }

    if (trimmedNew !== confirmPassword.trim()) {
      setErrorMsg('New password and confirmation do not match.');
      return;
    }

    if (trimmedNew === currentPassword) {
      setErrorMsg('New password must be different from your current password.');
      return;
    }

    setIsSaving(true);
    try {
      const account = await resolveAccount(cleanUsername);
      if (!account) {
        setErrorMsg(`No account found for "${cleanUsername}". Check your username.`);
        setIsSaving(false);
        return;
      }

      if (account.status === 'disabled') {
        setErrorMsg('This account is disabled. Contact the Master Admin.');
        setIsSaving(false);
        return;
      }

      // Fetch latest cloud vault so we always verify against the real active password
      const latestVault = await fetchCloudVault();
      const latestAccount = applyVaultToAccount(account, latestVault);

      if (!verifyAccountPassword(latestAccount, currentPassword)) {
        setErrorMsg('Current password is incorrect. Please check and try again.');
        setIsSaving(false);
        return;
      }

      const result = await changeUserPassword(latestAccount.username, trimmedNew, {
        updatedBy: latestAccount.full_name,
        isCustom: true,
        mustChange: false,
      });

      setIsSaving(false);

      if (!result.ok) {
        setErrorMsg(result.error || 'Could not update password. Please try again.');
        return;
      }

      addToast({
        type: 'success',
        title: 'Password Updated',
        message: result.cloudSynced
          ? 'Your new login password has been saved and synced across all devices.'
          : 'Your new login password has been updated.',
      });

      onClose();
    } catch (err) {
      console.error('Change password error:', err);
      setErrorMsg('An unexpected error occurred. Please check your connection and try again.');
      setIsSaving(false);
    }
  };

  const passwordsMatch = newPassword.length >= 6 && newPassword === confirmPassword;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Change Login Password" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 rounded-xl bg-accent-primary/10 border border-accent-primary/25 flex items-start gap-2.5">
          <ShieldCheck className="h-4 w-4 text-accent-light mt-0.5 flex-shrink-0" />
          <p className="text-xs text-gray-300 leading-relaxed">
            Set a personal password for your E-Cell account. Once changed, the old common password
            will no longer work for your login.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-status-absent/15 border border-status-absent/30 flex items-center gap-2 text-xs text-status-absent font-medium">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Username (locked when logged in, editable from Login screen) */}
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1.5">
            Account Username
          </label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              required
              disabled={!!currentUser}
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
              placeholder="e.g. firstname.lastname"
              className="w-full pl-10 pr-3 py-2.5 bg-dark-bg border border-dark-border rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-accent-primary font-mono disabled:opacity-70 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Current Password */}
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1.5">
            Current Password *
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type={showCurrent ? 'text' : 'password'}
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter your current password"
              className="w-full pl-10 pr-10 py-2.5 bg-dark-bg border border-dark-border rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-accent-primary font-mono"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white cursor-pointer"
              tabIndex={-1}
            >
              {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1.5">
            New Password *
          </label>
          <div className="relative">
            <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type={showNew ? 'text' : 'password'}
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full pl-10 pr-10 py-2.5 bg-dark-bg border border-dark-border rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-accent-primary font-mono"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white cursor-pointer"
              tabIndex={-1}
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Confirm New Password */}
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1.5">
            Confirm New Password *
          </label>
          <div className="relative">
            <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type={showConfirm ? 'text' : 'password'}
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              className="w-full pl-10 pr-10 py-2.5 bg-dark-bg border border-dark-border rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-accent-primary font-mono"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white cursor-pointer"
              tabIndex={-1}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {confirmPassword.length > 0 && (
            <p
              className={`text-[11px] mt-1 flex items-center gap-1 ${
                passwordsMatch ? 'text-status-success' : 'text-status-absent'
              }`}
            >
              {passwordsMatch ? (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Passwords match</span>
                </>
              ) : (
                <span>Passwords do not match</span>
              )}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-3 border-t border-dark-border">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-dark-bg border border-dark-border text-gray-300 hover:text-white text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-accent-primary hover:bg-blue-600 text-white font-bold text-xs shadow-lg shadow-blue-500/20 cursor-pointer disabled:opacity-50"
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>{isSaving ? 'Updating...' : 'Update Password'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
