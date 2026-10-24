import { useState } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  RotateCcw,
  Shield,
  Layers,
  Sliders,
  Building,
  CheckCircle2,
  Plus,
  Trash2,
  Database,
  Download
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AppSettings, ECellDomain } from '../types';
import {
  generateAllMembers,
  generateDemoSessions,
  generateAttendanceRecords,
  generateDefaultSettings
} from '../lib/demoData';

export default function Settings() {
  const { state, dispatch, addToast } = useApp();
  const { settings } = state;

  // Form state
  const [formData, setFormData] = useState<AppSettings>({
    ...settings,
  });

  const [newDomain, setNewDomain] = useState('');

  // Handle save
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: 'UPDATE_SETTINGS', payload: formData });
    addToast({
      type: 'success',
      title: 'Settings Saved',
      message: 'System configurations and rules updated successfully.',
    });
  };

  // Add Domain
  const handleAddDomain = () => {
    if (!newDomain.trim()) return;
    if (formData.departments.includes(newDomain.trim() as ECellDomain)) {
      addToast({ type: 'error', title: 'Error', message: 'Domain already exists.' });
      return;
    }
    setFormData({
      ...formData,
      departments: [...formData.departments, newDomain.trim() as ECellDomain],
    });
    setNewDomain('');
  };

  // Remove Domain
  const handleRemoveDomain = (dept: string) => {
    if (formData.departments.length <= 1) {
      addToast({ type: 'error', title: 'Error', message: 'At least one domain must remain.' });
      return;
    }
    setFormData({
      ...formData,
      departments: formData.departments.filter((d) => d !== dept),
    });
  };

  // Reset demo data
  const handleResetData = () => {
    if (
      window.confirm(
        'Are you sure you want to restore original demo data? Any custom records added will be reset.'
      )
    ) {
      const demoMembers = generateAllMembers();
      const demoSessions = generateDemoSessions();
      const demoRecords = generateAttendanceRecords();
      const defaultSettings = generateDefaultSettings();

      dispatch({ type: 'SET_MEMBERS', payload: demoMembers });
      dispatch({ type: 'SET_SESSIONS', payload: demoSessions });
      dispatch({ type: 'SAVE_ATTENDANCE', payload: { records: demoRecords, auditReason: 'System Reset' } });
      dispatch({ type: 'UPDATE_SETTINGS', payload: defaultSettings });
      setFormData(defaultSettings);

      addToast({
        type: 'info',
        title: 'Demo Data Reset',
        message: 'System has been restored to default state with 63 members.',
      });
    }
  };

  // Export entire DB backup
  const handleExportBackup = () => {
    const backupData = {
      members: state.members,
      sessions: state.sessions,
      records: state.records,
      settings: state.settings,
      exported_at: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ecell_attendance_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(link.href);

    addToast({
      type: 'success',
      title: 'Backup Downloaded',
      message: 'Full database snapshot exported.',
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">System Settings</h1>
          <p className="text-sm text-gray-400 mt-1">
            Configure organization identity, attendance threshold rules, domains, and data controls
          </p>
        </div>

        <button
          onClick={handleExportBackup}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-dark-card hover:bg-dark-hover text-gray-200 border border-dark-border text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Download className="h-4 w-4" />
          <span>Export JSON Backup</span>
        </button>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Organization Identity */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-dark-border">
            <Building className="h-5 w-5 text-accent-light" />
            <h2 className="text-base font-bold text-white">Organization Identity</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Organization Display Title
              </label>
              <input
                type="text"
                value={formData.org_name}
                onChange={(e) => setFormData({ ...formData, org_name: e.target.value })}
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-sm text-white focus:outline-none focus:border-accent-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                College / Cell Subtitle
              </label>
              <input
                type="text"
                value={formData.org_subtitle}
                onChange={(e) => setFormData({ ...formData, org_subtitle: e.target.value })}
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-sm text-white focus:outline-none focus:border-accent-primary"
              />
            </div>
          </div>
        </div>

        {/* Attendance Rules & Threshold */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-dark-border">
            <Sliders className="h-5 w-5 text-accent-light" />
            <h2 className="text-base font-bold text-white">Attendance Rules & Thresholds</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Low Attendance Alert Threshold (%): <span className="text-white font-bold">{formData.low_attendance_threshold}%</span>
              </label>
              <input
                type="range"
                min="50"
                max="90"
                step="5"
                value={formData.low_attendance_threshold}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    low_attendance_threshold: Number(e.target.value),
                  })
                }
                className="w-full mt-2 accent-accent-primary cursor-pointer"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Members falling below this percentage are flagged on the dashboard and reports. Default is 75%.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Default Home View
              </label>
              <select
                value={formData.default_view}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    default_view: e.target.value as 'dashboard' | 'attendance',
                  })
                }
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-sm text-white focus:outline-none focus:border-accent-primary cursor-pointer"
              >
                <option value="dashboard">Dashboard (Overview & Metrics)</option>
                <option value="attendance">Mark Attendance (Quick Entry)</option>
              </select>
              <p className="text-[11px] text-gray-500 mt-1">
                Initial screen shown when administrators log in.
              </p>
            </div>
          </div>
        </div>

        {/* Domain Management */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-dark-border">
            <Layers className="h-5 w-5 text-accent-light" />
            <h2 className="text-base font-bold text-white">E-Cell Domains / Verticals</h2>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add new domain (e.g. Corporate Relations)..."
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              className="flex-1 px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent-primary"
            />
            <button
              type="button"
              onClick={handleAddDomain}
              className="px-4 py-2 bg-accent-primary hover:bg-blue-600 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {formData.departments.map((dept) => (
              <span
                key={dept}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-bg border border-dark-border text-xs text-white"
              >
                <span>{dept}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveDomain(dept)}
                  className="text-gray-500 hover:text-status-absent transition-colors"
                  title="Remove domain"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Authorized Administrators */}
        <div className="bg-dark-card border border-dark-border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-dark-border">
            <Shield className="h-5 w-5 text-accent-light" />
            <h2 className="text-base font-bold text-white">Authorized Administrators</h2>
          </div>

          <div className="space-y-2">
            <div className="p-3 bg-dark-bg rounded-lg border border-dark-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-accent-primary/20 text-accent-light flex items-center justify-center font-bold text-xs">
                  AD
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Administrator (Superuser)</div>
                  <div className="text-[10px] text-gray-500">admin@ecell.jspmrscoe.in · Full Access</div>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-status-success/15 text-status-success font-semibold">
                ACTIVE
              </span>
            </div>
          </div>
        </div>

        {/* Save button bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-dark-border">
          <button
            type="button"
            onClick={handleResetData}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-status-absent/10 hover:bg-status-absent/20 text-status-absent border border-status-absent/30 text-xs font-semibold transition-colors cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reset Demo Data</span>
          </button>

          <button
            type="submit"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-accent-primary hover:bg-blue-600 text-white font-semibold text-sm shadow-lg shadow-blue-500/20 transition-colors cursor-pointer"
          >
            <Save className="h-4 w-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </form>
    </div>
  );
}
