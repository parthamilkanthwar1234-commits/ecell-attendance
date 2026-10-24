import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Default Supabase project credentials for E-Cell RSCOE Attendance System
export const DEFAULT_SUPABASE_URL = 'https://ukxjqofhutivodocndrh.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_jCH184q3nOD2Q7gPwkCl8Q_Q_6vlzAw';

const getEnvOrStorage = (key: string, storageKey: string, fallback: string): string => {
  try {
    const envVal = import.meta.env[key];
    if (envVal) return envVal;
    const stored = localStorage.getItem(storageKey);
    if (stored) return stored;
    return fallback;
  } catch {
    return fallback;
  }
};

const supabaseUrl = getEnvOrStorage('VITE_SUPABASE_URL', 'ecell_supabase_url', DEFAULT_SUPABASE_URL);
const supabaseAnonKey = getEnvOrStorage('VITE_SUPABASE_ANON_KEY', 'ecell_supabase_key', DEFAULT_SUPABASE_ANON_KEY);

export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('https://'));
};

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export const configureSupabaseKeys = (url: string, key: string) => {
  if (url && key) {
    localStorage.setItem('ecell_supabase_url', url.trim());
    localStorage.setItem('ecell_supabase_key', key.trim());
    window.location.reload();
  }
};

export const clearSupabaseKeys = () => {
  localStorage.removeItem('ecell_supabase_url');
  localStorage.removeItem('ecell_supabase_key');
  window.location.reload();
};
