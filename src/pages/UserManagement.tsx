import { useState, useMemo, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  KeyRound,
  RotateCcw,
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  Copy,
  Lock,
  Layers,
  Sparkles,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { UserAccount, UserRole, ECellDomain } from '../types';
import { formatDate, generateId } from '../lib/utils';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';

const DOMAINS_LIST: ECellDomain[] = [
  'Event Production & Curation',
  'Public Relations & Marketing',
  'Finance Management',
  'Graphics Design',
  'Technical & Data Management',
  'Content Development',
  'Social Media',
  'General E-Cell / Core Committee',
  'All Domains',
  'Unassigned',
];

export default function UserManagement() {
  const { state, dispatch, addToast, isMasterAdmin, syncFromCloud } = useApp();
  const { userAccounts, settings } = state;

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [isSyncing, setIsSyncing] = useState(false);

  // Auto-sync on mount
  useEffect(() => {
    syncFromCloud();
  }, [syncFromCloud]);

  // Modals
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [selectedUserForReset, setSelectedUserForReset] = useState<UserAccount | null>(null);
  const [tempPasswordDisplay, setTempPasswordDisplay] = useState<string | null>(null);

  // New User Form State
  const [newUser, setNewUser] = useState({
    full_name: '',
    username: '',
    email: '',
    role: 'lead_admin' as UserRole,
    domain: 'Event Production & Curation' as ECellDomain,
  });

  const filteredAccounts = useMemo(() => {
    return userAccounts.filter((account) => {
      const matchSearch =
        account.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (account.domain || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchRole = roleFilter === 'ALL' || account.role === roleFilter;

      return matchSearch && matchRole;
    });
  }, [userAccounts, searchTerm, roleFilter]);

  if (!isMasterAdmin()) {
    return (
      <div className="p-8 text-center bg-dark-card border border-dark-border rounded-2xl max-w-lg mx-auto mt-12 space-y-3">
        <Shield className="h-12 w-12 text-status-absent mx-auto" />
        <h2 className="text-lg font-bold text-white">Access Restricted</h2>
        <p className="text-xs text-gray-400">
          User Account Administration is restricted exclusively to Master Admin (Parth Amilkanthwar).
        </p>
      </div>
    );
  }

  // Handle Role Change
  const handleRoleChange = (targetUser: UserAccount, newRole: UserRole) => {
    if (!isMasterAdmin()) {
      addToast({ type: 'error', title: 'Unauthorized', message: 'Only Master Admin can modify roles.' });
      return;
    }

    if (targetUser.username === 'parth.amilkanthwar' && newRole !== 'master_admin') {
      addToast({
        type: 'error',
        title: 'Action Prohibited',
        message: 'The Master Admin account cannot be demoted or modified.',
      });
      return;
    }

    if (newRole === 'master_admin' && targetUser.username !== 'parth.amilkanthwar') {
      addToast({
        type: 'error',
        title: 'Action Prohibited',
        message: 'Master Admin privileges are strictly reserved for Parth Amilkanthwar.',
      });
      return;
    }

    const updated: UserAccount = {
      ...targetUser,
      role: newRole,
    };

    dispatch({ type: 'UPDATE_USER_ACCOUNT', payload: updated });

    dispatch({
      type: 'ADD_AUDIT_LOG',
      payload: {
        id: `audit-${Date.now()}`,
        actor_id: state.auth.user?.id || 'admin',
        actor_name: state.auth.user?.full_name || 'Parth Amilkanthwar',
        actor_role: 'master_admin',
        action_type: 'ROLE_CHANGED',
        entity_type: 'USER',
        entity_id: targetUser.id,
        member_name: targetUser.full_name,
        previous_value: targetUser.role,
        new_value: newRole,
        reason: `Role changed to ${newRole.toUpperCase()} by Master Admin`,
        timestamp: new Date().toISOString(),
      },
    });

    addToast({
      type: 'success',
      title: 'Role Updated',
      message: `${targetUser.full_name} is now ${newRole.toUpperCase()}.`,
    });
  };

  // Generate / Reset Temporary Password
  const handleResetPassword = (targetUser: UserAccount) => {
    const generatedPass = `RSCOE@${Math.random().toString(36).slice(-6).toUpperCase()}!`;

    const updated: UserAccount = {
      ...targetUser,
      temp_password: generatedPass,
      must_change_password: true,
    };

    dispatch({ type: 'UPDATE_USER_ACCOUNT', payload: updated });

    dispatch({
      type: 'ADD_AUDIT_LOG',
      payload: {
        id: `audit-${Date.now()}`,
        actor_id: state.auth.user?.id || 'admin',
        actor_name: 'Parth Amilkanthwar',
        actor_role: 'master_admin',
        action_type: 'PASSWORD_RESET',
        entity_type: 'USER',
        entity_id: targetUser.id,
        member_name: targetUser.full_name,
        new_value: 'Generated one-time temporary credential',
        timestamp: new Date().toISOString(),
      },
    });

    setTempPasswordDisplay(generatedPass);
    setSelectedUserForReset(targetUser);
  };

  // Create User
  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    const formattedUsername = newUser.username.toLowerCase().trim().replace(/\s+/g, '.');

    // Duplicate check
    if (userAccounts.some((u) => u.username === formattedUsername)) {
      addToast({ type: 'error', title: 'Username Taken', message: 'An account with this username already exists.' });
      return;
    }

    const tempPassword = `Ecell@${formattedUsername.split('.')[0] || 'Temp'}2026!`;

    const created: UserAccount = {
      id: generateId('user'),
      full_name: newUser.full_name,
      username: formattedUsername,
      role: newUser.role,
      domain: newUser.domain,
      email: newUser.email || `${formattedUsername}@ecell.jspmrscoe.in`,
      status: 'active',
      must_change_password: true,
      temp_password: tempPassword,
      created_at: new Date().toISOString(),
    };

    dispatch({ type: 'ADD_USER_ACCOUNT', payload: created });

    addToast({
      type: 'success',
      title: 'User Account Created',
      message: `Account created for ${newUser.full_name} (${formattedUsername}).`,
    });

    setIsAddUserModalOpen(false);
    setNewUser({
      full_name: '',
      username: '',
      email: '',
      role: 'lead_admin',
      domain: 'Event Production & Curation',
    });

    setTempPasswordDisplay(tempPassword);
    setSelectedUserForReset(created);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-accent-primary/10 text-accent-light border border-accent-primary/20">
              <Shield className="h-4 w-4" />
            </span>
            <span className="text-xs uppercase tracking-wider text-gray-400 font-bold">
              Account Provisioning & Security · Master Admin
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight mt-1">
            User Account Management
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Manage credentials, assign lead permissions, issue temporary passwords, and control member access
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={async () => {
              setIsSyncing(true);
              const ok = await syncFromCloud();
              setIsSyncing(false);
              addToast({
                type: ok ? 'success' : 'info',
                title: ok ? 'Cloud Synced' : 'Sync Notice',
                message: ok ? 'User accounts refreshed from Supabase Cloud.' : 'Running with local storage.',
              });
            }}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-dark-card hover:bg-dark-hover border border-dark-border text-gray-200 font-semibold text-xs transition-colors cursor-pointer"
            title="Fetch latest user accounts from Supabase Cloud"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-accent-light ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Sync Cloud</span>
          </button>

          <button
            onClick={() => setIsAddUserModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-primary hover:bg-blue-600 text-white font-semibold text-xs shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            <span>Provision New Account</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search accounts by name, username, domain..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-accent-primary"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary cursor-pointer w-full sm:w-auto"
          >
            <option value="ALL">All Roles ({userAccounts.length})</option>
            <option value="master_admin">Master Admin (Parth)</option>
            <option value="president">President (Sarthak)</option>
            <option value="lead_admin">Lead Admins (Domain Leads)</option>
            <option value="member">General Body Members</option>
          </select>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-dark-bg text-gray-400 uppercase tracking-wider border-b border-dark-border">
              <tr>
                <th className="p-3.5">Name & Username</th>
                <th className="p-3.5">Assigned Domain</th>
                <th className="p-3.5">Security Role</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Temporary Credential</th>
                <th className="p-3.5 text-right">Administrative Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {filteredAccounts.map((account) => {
                const isMasterParth = account.username === 'parth.amilkanthwar';

                return (
                  <tr key={account.id} className="hover:bg-dark-hover/40 transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>{account.full_name}</span>
                        {isMasterParth && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-accent-primary/20 text-accent-light font-black border border-accent-primary/40">
                            MASTER ADMIN
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400 font-mono">
                        @{account.username} · {account.email}
                      </div>
                    </td>

                    <td className="p-3.5 text-gray-300">
                      <span className="px-2 py-0.5 rounded-md bg-dark-bg border border-dark-border text-[11px]">
                        {account.domain}
                      </span>
                    </td>

                    <td className="p-3.5">
                      {isMasterParth ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-accent-primary/20 text-accent-light border border-accent-primary/40">
                          MASTER ADMIN
                        </span>
                      ) : (
                        <select
                          value={account.role}
                          onChange={(e) => handleRoleChange(account, e.target.value as UserRole)}
                          className="px-2.5 py-1 bg-dark-bg border border-dark-border rounded-lg text-[11px] text-white focus:outline-none focus:border-accent-primary cursor-pointer font-semibold"
                        >
                          <option value="president">President (Read-Only)</option>
                          <option value="lead_admin">Lead Admin</option>
                          <option value="member">Member</option>
                        </select>
                      )}
                    </td>

                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          account.status === 'active'
                            ? 'bg-status-success/15 text-status-success'
                            : 'bg-status-absent/15 text-status-absent'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            account.status === 'active' ? 'bg-status-success' : 'bg-status-absent'
                          }`}
                        />
                        {account.status.toUpperCase()}
                      </span>
                    </td>

                    <td className="p-3.5">
                      {account.temp_password ? (
                        <span className="font-mono text-[11px] text-gray-400 bg-dark-bg px-2 py-1 rounded border border-dark-border">
                          {account.temp_password}
                        </span>
                      ) : (
                        <span className="text-gray-500 text-[11px]">Password Set</span>
                      )}
                    </td>

                    <td className="p-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleResetPassword(account)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-dark-bg hover:bg-dark-hover border border-dark-border text-gray-300 text-[11px] font-semibold cursor-pointer"
                          title="Generate new temporary password"
                        >
                          <KeyRound className="h-3 w-3 text-accent-light" />
                          <span>Reset Credential</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Temporary Password Display Modal */}
      {selectedUserForReset && tempPasswordDisplay && (
        <Modal
          isOpen={!!tempPasswordDisplay}
          onClose={() => {
            setTempPasswordDisplay(null);
            setSelectedUserForReset(null);
          }}
          title="Temporary Credential Issued"
          size="md"
        >
          <div className="space-y-4">
            <p className="text-xs text-gray-300">
              A temporary password has been provisioned for{' '}
              <strong className="text-white">{selectedUserForReset.full_name}</strong> (@
              {selectedUserForReset.username}). Please distribute this securely:
            </p>

            <div className="p-4 bg-dark-bg rounded-xl border border-accent-primary/40 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-gray-400 block uppercase font-mono">
                  Temporary Password (One-Time)
                </span>
                <span className="text-lg font-black text-white font-mono tracking-wider">
                  {tempPasswordDisplay}
                </span>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(tempPasswordDisplay);
                  addToast({ type: 'success', title: 'Copied', message: 'Password copied to clipboard.' });
                }}
                className="p-2 rounded-lg bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-light cursor-pointer border border-accent-primary/30"
                title="Copy to clipboard"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>

            <p className="text-[11px] text-gray-500">
              The user will be required to change this temporary password upon first login.
            </p>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  setTempPasswordDisplay(null);
                  setSelectedUserForReset(null);
                }}
                className="px-4 py-1.5 bg-accent-primary text-white text-xs font-semibold rounded-lg"
              >
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Provision New Account Modal */}
      <Modal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        title="Provision Core Committee Account"
        size="md"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={newUser.full_name}
              onChange={(e) => {
                const name = e.target.value;
                setNewUser({
                  ...newUser,
                  full_name: name,
                  username: name.toLowerCase().trim().replace(/\s+/g, '.'),
                });
              }}
              placeholder="e.g. Yash Kulkarni"
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">
              Username (firstname.lastname) *
            </label>
            <input
              type="text"
              required
              value={newUser.username}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value.toLowerCase().trim() })}
              placeholder="yash.kulkarni"
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              placeholder="yash.kulkarni@ecell.jspmrscoe.in"
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Assigned Domain</label>
            <select
              value={newUser.domain}
              onChange={(e) => setNewUser({ ...newUser, domain: e.target.value as ECellDomain })}
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary cursor-pointer"
            >
              {DOMAINS_LIST.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Role</label>
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary cursor-pointer"
            >
              <option value="lead_admin">Lead Admin</option>
              <option value="president">President (Read-Only)</option>
              <option value="member">General Body Member</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-dark-border">
            <button
              type="button"
              onClick={() => setIsAddUserModalOpen(false)}
              className="px-4 py-2 bg-dark-bg border border-dark-border text-gray-300 text-xs rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-accent-primary hover:bg-blue-600 text-white font-semibold text-xs rounded-lg cursor-pointer"
            >
              Provision Account
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
