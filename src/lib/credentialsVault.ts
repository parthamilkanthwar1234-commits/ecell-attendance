import { UserAccount } from '../types';
import { DEFAULT_PASSWORD } from './demoData';
import { supabase, isSupabaseConfigured } from './supabase';

export const CREDENTIALS_VAULT_SESSION_ID = '__ECELL_CREDENTIALS_VAULT__';
const LOCAL_VAULT_KEY = 'ecell_credentials_vault_v1';

export interface CredentialEntry {
  password: string;
  updated_at: string;
  updated_by: string;
  is_custom: boolean;
  must_change_password?: boolean;
}

export type CredentialsVaultMap = Record<string, CredentialEntry>;

export function loadLocalVault(): CredentialsVaultMap {
  try {
    const raw = localStorage.getItem(LOCAL_VAULT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as CredentialsVaultMap;
  } catch (e) {
    console.warn('Could not load local credentials vault:', e);
  }
  return {};
}

export function saveLocalVault(vault: CredentialsVaultMap): void {
  try {
    localStorage.setItem(LOCAL_VAULT_KEY, JSON.stringify(vault));
  } catch (e) {
    console.warn('Could not save local credentials vault:', e);
  }
}

export function parseVaultFromSession(sessionRow: any): CredentialsVaultMap {
  if (!sessionRow || typeof sessionRow.description !== 'string') return {};
  try {
    const parsed = JSON.parse(sessionRow.description);
    if (parsed && parsed.__ECELL_VAULT__ && typeof parsed.__ECELL_VAULT__ === 'object') {
      return parsed.__ECELL_VAULT__ as CredentialsVaultMap;
    }
  } catch (e) {
    console.warn('Could not parse cloud credentials vault:', e);
  }
  return {};
}

export function mergeVaults(
  base: CredentialsVaultMap,
  incoming: CredentialsVaultMap
): CredentialsVaultMap {
  const merged: CredentialsVaultMap = { ...base };
  for (const [uname, entry] of Object.entries(incoming)) {
    const key = uname.toLowerCase().trim();
    const existing = merged[key];
    if (!existing) {
      merged[key] = entry;
    } else {
      const existingTime = new Date(existing.updated_at || 0).getTime();
      const incomingTime = new Date(entry.updated_at || 0).getTime();
      if (incomingTime >= existingTime) {
        merged[key] = entry;
      }
    }
  }
  return merged;
}

export async function fetchCloudVault(): Promise<CredentialsVaultMap> {
  const localVault = loadLocalVault();
  if (!isSupabaseConfigured() || !supabase) {
    return localVault;
  }

  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('id, description, updated_at')
      .eq('id', CREDENTIALS_VAULT_SESSION_ID)
      .maybeSingle();

    if (error) {
      console.warn('Cloud vault fetch notice:', error.message);
      return localVault;
    }

    if (data) {
      const cloudVault = parseVaultFromSession(data);
      const merged = mergeVaults(localVault, cloudVault);
      saveLocalVault(merged);
      return merged;
    }
  } catch (e) {
    console.warn('Cloud vault fetch error:', e);
  }

  return localVault;
}

export async function saveUserCredentialToCloud(
  username: string,
  entry: CredentialEntry
): Promise<{ vault: CredentialsVaultMap; cloudSynced: boolean; error?: string }> {
  const key = username.toLowerCase().trim();
  const latestVault = await fetchCloudVault();
  const updatedVault: CredentialsVaultMap = {
    ...latestVault,
    [key]: entry,
  };

  saveLocalVault(updatedVault);

  if (!isSupabaseConfigured() || !supabase) {
    return { vault: updatedVault, cloudSynced: false };
  }

  try {
    const now = new Date().toISOString();
    const { error } = await supabase.from('sessions').upsert([
      {
        id: CREDENTIALS_VAULT_SESSION_ID,
        name: '__SYSTEM_CREDENTIALS_VAULT__',
        session_type: 'Other',
        domain: 'Unassigned',
        date: '2000-01-01',
        start_time: '00:00',
        end_time: '00:00',
        location: 'System',
        description: JSON.stringify({ __ECELL_VAULT__: updatedVault }),
        status: 'Cancelled',
        created_by: 'system',
        created_by_name: 'System',
        created_at: now,
        updated_at: now,
        completed_at: null,
      },
    ]);

    if (error) {
      console.error('Cloud vault upsert error:', error);
      return { vault: updatedVault, cloudSynced: false, error: error.message };
    }

    return { vault: updatedVault, cloudSynced: true };
  } catch (e: any) {
    console.error('Cloud vault upsert exception:', e);
    return { vault: updatedVault, cloudSynced: false, error: e?.message || 'Cloud sync failed' };
  }
}

export function applyVaultToAccount(
  account: UserAccount,
  vault: CredentialsVaultMap
): UserAccount {
  const key = account.username.toLowerCase().trim();
  const entry = vault[key];
  if (!entry || !entry.password) return account;

  return {
    ...account,
    password: entry.password,
    temp_password: entry.password,
    must_change_password: !!entry.must_change_password,
    password_updated_at: entry.updated_at,
    password_updated_by: entry.updated_by,
    is_custom_password: entry.is_custom,
  };
}

/**
 * Strictly verify an entered password against a user account.
 * Once a user has a specific password or temp_password (such as Core Lead unique passwords,
 * user-changed custom passwords, or admin-reset passwords), the common DEFAULT_PASSWORD
 * is NO LONGER accepted.
 */
export function verifyAccountPassword(account: UserAccount, enteredPassword: string): boolean {
  const assignedPasswords = [account.password, account.temp_password].filter(
    (p): p is string => Boolean(p && p.length > 0)
  );

  if (assignedPasswords.length > 0) {
    return assignedPasswords.includes(enteredPassword);
  }

  return enteredPassword === DEFAULT_PASSWORD;
}
