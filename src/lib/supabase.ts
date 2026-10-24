import { createClient, SupabaseClient } from '@supabase/supabase-js';

const getEnvOrStorage = (key: string, storageKey: string): string => {
  try {
    const envVal = import.meta.env[key];
    if (envVal) return envVal;
    return localStorage.getItem(storageKey) || '';
  } catch {
    return '';
  }
};

const supabaseUrl = getEnvOrStorage('VITE_SUPABASE_URL', 'ecell_supabase_url');
const supabaseAnonKey = getEnvOrStorage('VITE_SUPABASE_ANON_KEY', 'ecell_supabase_key');

export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('https://'));
};

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Helper to save Supabase keys from the UI
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
