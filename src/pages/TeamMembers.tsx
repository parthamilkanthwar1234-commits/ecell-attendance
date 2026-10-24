import { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Pencil,
  Trash2,
  Mail,
  Phone,
  Calendar,
  Shield,
  Briefcase,
  History,
  FileSpreadsheet,
  Download,
  Filter,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Member, MemberRole, ECellDomain, UserAccount } from '../types';
import { formatDate, generateId, getStatusBgColor, getStatusLabel, exportToCSV } from '../lib/utils';
import { DEFAULT_PASSWORD } from '../lib/demoData';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';

const DOMAINS: ECellDomain[] = [
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

const ROLES: MemberRole[] = [
  'Master Admin',
  'President',
  'General Secretary',
  'Domain Lead',
  'Member',
];

export default function TeamMembers() {
  const {
    state,
    dispatch,
    addToast,
    getMemberAttendancePercentage,
    isMasterAdmin,
    isPresident,
    canEditMember,
    canDeleteMember,
    isLeadMember,
    canAddMemberToDomain,
  } = useApp();
  const { members, settings, auth } = state;
  const user = auth.user;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'att-desc' | 'att-asc'>('name-asc');

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [viewingMember, setViewingMember] = useState<Member | null>(null);

  // Form State
  const leadDomain: ECellDomain =
    user?.role === 'master_admin' || user?.role === 'president' || user?.role === 'general_secretary'
      ? 'Event Production & Curation'
      : (user?.domain as ECellDomain) || 'Event Production & Curation';

  const [formData, setFormData] = useState({
    name: '',
    member_id: '',
    email: '',
    phone: '',
    department: leadDomain,
    role: 'Member' as MemberRole,
    joining_date: new Date().toISOString().split('T')[0],
    status: 'active' as 'active' | 'inactive',
  });

  const handleOpenAdd = () => {
    setEditingMember(null);
    const nextNum = members.length + 1;
    const generatedId = `EC-${String(nextNum).padStart(3, '0')}`;
    setFormData({
      name: '',
      member_id: generatedId,
      email: '',
      phone: '',
      department: leadDomain,
      role: 'Member',
      joining_date: new Date().toISOString().split('T')[0],
      status: 'active',
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (m: Member, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEditMember(m)) {
      if (isLeadMember(m)) {
        addToast({
          type: 'error',
          title: 'Access Restricted',
          message: 'Only Master Admin (Parth Amilkanthwar) can edit Core Committee Lead profiles.',
        });
      } else {
        addToast({
          type: 'error',
          title: 'Access Restricted',
          message: `You can only edit members belonging to your own domain (${user?.domain}).`,
        });
      }
      return;
    }

    setEditingMember(m);
    setFormData({
      name: m.name,
      member_id: m.member_id,
      email: m.email,
      phone: m.phone,
      department: m.department,
      role: m.role,
      joining_date: m.joining_date,
      status: m.status,
    });
    setIsFormOpen(true);
  };

  const handleSaveMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      addToast({ type: 'error', title: 'Validation Error', message: 'Member name is required.' });
      return;
    }

    if (editingMember) {
      if (!canEditMember(editingMember)) {
        addToast({
          type: 'error',
          title: 'Permission Denied',
          message: 'Only Master Admin can modify Core Committee Lead profiles.',
        });
        return;
      }

      const assignedDomain: ECellDomain = isMasterAdmin()
        ? formData.department
        : (editingMember.department as ECellDomain);
      const assignedRole: MemberRole = isMasterAdmin() ? formData.role : editingMember.role;

      const updated: Member = {
        ...editingMember,
        ...formData,
        department: assignedDomain,
        role: assignedRole,
        updated_at: new Date().toISOString(),
      };
      dispatch({ type: 'UPDATE_MEMBER', payload: updated });
      addToast({ type: 'success', title: 'Member Updated', message: `${formData.name}'s profile saved.` });
    } else {
      // Adding a new member
      if (!canAddMemberToDomain(formData.department)) {
        addToast({
          type: 'error',
          title: 'Permission Denied',
          message: `You can only add members to your own domain (${user?.domain}).`,
        });
        return;
      }

      const assignedDomain = isMasterAdmin()
        ? formData.department
        : ((user?.domain as ECellDomain) || formData.department);
      const assignedRole: MemberRole = isMasterAdmin() ? formData.role : 'Member';

      const username = formData.name.toLowerCase().trim().replace(/\s+/g, '.');

      const newMember: Member = {
        id: generateId('member'),
        ...formData,
        department: assignedDomain,
        role: assignedRole,
        email: formData.email || `${username}@ecell.jspmrscoe.in`,
        username,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      dispatch({ type: 'ADD_MEMBER', payload: newMember });

      // Automatically create a user login account for the newly added member
      const newAccount: UserAccount = {
        id: generateId('user'),
        full_name: newMember.name,
        username,
        role: 'member',
        domain: newMember.department,
        email: newMember.email,
        password: DEFAULT_PASSWORD,
        status: 'active',
        must_change_password: false,
        temp_password: DEFAULT_PASSWORD,
        created_at: new Date().toISOString(),
      };
      dispatch({ type: 'ADD_USER_ACCOUNT', payload: newAccount });

      dispatch({
        type: 'ADD_AUDIT_LOG',
        payload: {
          id: `audit-${Date.now()}`,
          actor_id: user?.id || 'lead',
          actor_name: user?.full_name || 'Domain Lead',
          actor_role: user?.role || 'lead_admin',
          action_type: 'MEMBER_ADDED',
          entity_type: 'MEMBER',
          entity_id: newMember.id,
          member_name: newMember.name,
          new_value: `Added member ${newMember.name} to domain ${newMember.department}`,
          timestamp: new Date().toISOString(),
        },
      });

      addToast({
        type: 'success',
        title: 'Member Added Directly',
        message: `${formData.name} added to ${newMember.department} and reflected on the roster.`,
      });
    }

    setIsFormOpen(false);
  };

  const handleConfirmDelete = () => {
    if (!memberToDelete) return;
    if (!canDeleteMember(memberToDelete)) {
      addToast({
        type: 'error',
        title: 'Action Denied',
        message: 'You do not have permission to remove this profile. Core Leads can only be managed by Master Admin.',
      });
      setMemberToDelete(null);
      return;
    }
    dispatch({ type: 'DELETE_MEMBER', payload: memberToDelete.id });
    addToast({ type: 'info', title: 'Member Removed', message: `${memberToDelete.name} has been removed.` });
    setMemberToDelete(null);
  };

  // Export Team to CSV
  const handleExportTeam = () => {
    const data = filteredMembers.map((m) => {
      const att = getMemberAttendancePercentage(m.id);
      return {
        'Member ID': m.member_id,
        Name: m.name,
        Domain: m.department,
        Role: m.role,
        Email: m.email,
        Phone: m.phone,
        'Joining Date': m.joining_date,
        Status: m.status.toUpperCase(),
        'Attendance %': att !== null ? `${att}%` : 'N/A',
      };
    });

    exportToCSV(data, 'ecell_team_roster');
    addToast({
      type: 'success',
      title: 'Roster Exported',
      message: `Downloaded CSV for ${data.length} members.`,
    });
  };

  // Filtered members
  const filteredMembers = useMemo(() => {
    return members
      .filter((m) => {
        const matchesSearch =
          m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.member_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.email.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesDept = selectedDept === 'ALL' || m.department === selectedDept;
        const matchesRole = selectedRole === 'ALL' || m.role === selectedRole;

        return matchesSearch && matchesDept && matchesRole;
      })
      .sort((a, b) => {
        if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
        if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
        const attA = getMemberAttendancePercentage(a.id) ?? -1;
        const attB = getMemberAttendancePercentage(b.id) ?? -1;
        if (sortBy === 'att-desc') return attB - attA;
        if (sortBy === 'att-asc') return attA - attB;
        return 0;
      });
  }, [members, searchTerm, selectedDept, selectedRole, sortBy, getMemberAttendancePercentage]);

  // Member History for modal
  const memberHistory = useMemo(() => {
    if (!viewingMember) return [];
    return state.records
      .filter((r) => r.member_id === viewingMember.id)
      .map((r) => ({
        ...r,
        session: state.sessions.find((s) => s.id === r.session_id),
      }));
  }, [viewingMember, state.records, state.sessions]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Team Members</h1>
          <p className="text-sm text-gray-400 mt-1">
            Active team roster ({members.length} Members) · Leads can add team members directly to their vertical
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleExportTeam}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-dark-card hover:bg-dark-hover border border-dark-border text-gray-200 font-semibold text-xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-accent-light" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-primary hover:bg-blue-600 text-white font-semibold text-xs shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            <span>Add Member to Domain</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, ID, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-accent-primary"
            />
          </div>

          {/* Department Filter */}
          <div>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary cursor-pointer"
            >
              <option value="ALL">All Domains ({DOMAINS.length})</option>
              {DOMAINS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Role Filter */}
          <div>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary cursor-pointer"
            >
              <option value="ALL">All Roles</option>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary cursor-pointer"
            >
              <option value="name-asc">Sort: Name (A to Z)</option>
              <option value="name-desc">Sort: Name (Z to A)</option>
              <option value="att-desc">Sort: Attendance (High to Low)</option>
              <option value="att-asc">Sort: Attendance (Low to High)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Members Grid */}
      {filteredMembers.length === 0 ? (
        <div className="bg-dark-card border border-dark-border rounded-xl p-12 text-center">
          <Users className="h-8 w-8 text-gray-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">No members found</h3>
          <p className="text-xs text-gray-400 mt-1">Try adjusting your domain or role filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredMembers.map((member) => {
            const attPct = getMemberAttendancePercentage(member.id);
            const isLow = attPct !== null && attPct < settings.low_attendance_threshold;
            const isUnassigned = member.department === 'Unassigned';

            return (
              <div
                key={member.id}
                onClick={() => setViewingMember(member)}
                className="bg-dark-card border border-dark-border hover:border-accent-primary/50 rounded-xl p-5 transition-all cursor-pointer group flex flex-col justify-between shadow-sm"
              >
                <div>
                  {/* Top card bar */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-accent-primary/20 border border-accent-primary/30 flex items-center justify-center font-bold text-accent-light text-xs">
                        {member.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-sm text-white group-hover:text-accent-light transition-colors">
                            {member.name}
                          </h3>
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              member.status === 'active' ? 'bg-status-success' : 'bg-gray-500'
                            }`}
                          />
                        </div>
                        <p className="text-[11px] text-gray-400 font-mono">{member.member_id}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {canEditMember(member) ? (
                        <button
                          onClick={(e) => handleOpenEdit(member, e)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-dark-hover transition-colors cursor-pointer"
                          title="Edit profile"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      ) : isLeadMember(member) ? (
                        <span
                          className="p-1.5 text-gray-600 cursor-not-allowed inline-flex items-center"
                          title="Core Committee Lead profile — Master Admin edit rights only"
                        >
                          <Lock className="h-3.5 w-3.5" />
                        </span>
                      ) : null}

                      {canDeleteMember(member) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMemberToDelete(member);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-status-absent hover:bg-status-absent/10 transition-colors cursor-pointer"
                          title="Delete member"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Badges for Role & Domain */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-primary/10 text-accent-light border border-accent-primary/20 font-bold">
                      {member.role}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                        isUnassigned
                          ? 'bg-status-late/15 text-status-late border-status-late/30'
                          : 'bg-dark-bg text-gray-300 border-dark-border'
                      }`}
                    >
                      {member.department}
                    </span>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-1 text-[11px] text-gray-400 mb-3">
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="h-3 w-3 flex-shrink-0 text-gray-500" />
                      <span className="truncate">{member.email}</span>
                    </div>
                    {member.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3 flex-shrink-0 text-gray-500" />
                        <span>{member.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom stats footer */}
                <div className="pt-2.5 border-t border-dark-border flex items-center justify-between text-xs">
                  <span className="text-gray-500 text-[11px]">Attendance Rate</span>
                  <div className="flex items-center gap-1.5">
                    {isLow && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-status-absent/15 text-status-absent border border-status-absent/30">
                        Low
                      </span>
                    )}
                    <span
                      className={`font-bold ${
                        attPct === null
                          ? 'text-gray-400'
                          : attPct >= 75
                          ? 'text-status-success'
                          : attPct >= 50
                          ? 'text-status-late'
                          : 'text-status-absent'
                      }`}
                    >
                      {attPct !== null ? `${attPct}%` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Member Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={
          editingMember
            ? isLeadMember(editingMember)
              ? `Edit Lead Profile: ${editingMember.name}`
              : `Edit Member: ${editingMember.name}`
            : user?.role === 'lead_admin'
            ? `Add Member to ${user.domain}`
            : 'Add New Member'
        }
        size="lg"
      >
        <form onSubmit={handleSaveMember} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Atharva Kulkarni"
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Member ID</label>
              <input
                type="text"
                value={formData.member_id}
                onChange={(e) => setFormData({ ...formData, member_id: e.target.value })}
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">
                Domain Assignment *
              </label>
              <select
                value={formData.department}
                disabled={!isMasterAdmin() && !isPresident() && user?.role === 'lead_admin'}
                onChange={(e) => setFormData({ ...formData, department: e.target.value as ECellDomain })}
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary cursor-pointer font-semibold disabled:opacity-75"
              >
                {DOMAINS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              {!isMasterAdmin() && !isPresident() && user?.role === 'lead_admin' && (
                <span className="text-[10px] text-gray-500 mt-1 block">
                  Automatically assigned to your domain ({user.domain}).
                </span>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Role in E-Cell</label>
              <select
                value={formData.role}
                disabled={!isMasterAdmin()}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as MemberRole })}
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary cursor-pointer disabled:opacity-60"
              >
                <option value="Member">Member</option>
                {isMasterAdmin() && (
                  <>
                    <option value="Domain Lead">Domain Lead</option>
                    <option value="General Secretary">General Secretary</option>
                    <option value="President">President</option>
                  </>
                )}
              </select>
              {!isMasterAdmin() && (
                <span className="text-[10px] text-gray-500 mt-1 block">
                  Only Master Admin can assign Lead roles.
                </span>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="name@ecell.jspmrscoe.in"
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs text-white focus:outline-none focus:border-accent-primary"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-dark-border">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 bg-dark-bg border border-dark-border text-gray-300 text-xs rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-accent-primary hover:bg-blue-600 text-white font-semibold text-xs rounded-lg cursor-pointer shadow-lg shadow-blue-500/20"
            >
              {editingMember ? 'Save Changes' : 'Add to Domain Roster'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Dialog */}
      <ConfirmDialog
        isOpen={!!memberToDelete}
        onClose={() => setMemberToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Remove Member"
        message={`Are you sure you want to remove ${memberToDelete?.name}? Their attendance history will also be removed.`}
        confirmLabel="Remove"
        variant="danger"
      />

      {/* Member Profile Modal */}
      {viewingMember && (
        <Modal
          isOpen={!!viewingMember}
          onClose={() => setViewingMember(null)}
          title={`Profile: ${viewingMember.name}`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="p-4 bg-dark-bg rounded-xl border border-dark-border flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">{viewingMember.name}</h3>
                <p className="text-xs text-gray-400 font-mono">
                  {viewingMember.member_id} · {viewingMember.role}
                </p>
                <p className="text-xs text-accent-light font-semibold mt-1">
                  Domain: {viewingMember.department}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-500 block">Attendance</span>
                <span className="text-2xl font-black text-status-success">
                  {getMemberAttendancePercentage(viewingMember.id) ?? 'N/A'}%
                </span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-2">
                Session Attendance History ({memberHistory.length})
              </h4>
              <div className="max-h-60 overflow-y-auto border border-dark-border rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-dark-bg text-gray-400 uppercase sticky top-0">
                    <tr>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Session</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-border">
                    {memberHistory.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-gray-500">
                          No attendance records recorded yet.
                        </td>
                      </tr>
                    ) : (
                      memberHistory.map((r) => (
                        <tr key={r.id}>
                          <td className="p-2.5 text-gray-400">
                            {r.session ? formatDate(r.session.date) : '-'}
                          </td>
                          <td className="p-2.5 font-semibold text-white">
                            {r.session?.name || 'Session'}
                          </td>
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStatusBgColor(r.status)}`}>
                              {getStatusLabel(r.status)}
                            </span>
                          </td>
                          <td className="p-2.5 text-gray-400">{r.remarks || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
