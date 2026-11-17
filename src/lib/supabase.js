import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured =
  /^https?:\/\/.+/.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 20;

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 20 } },
    })
  : null;

export const ADMIN_PASSWORD = (import.meta.env.VITE_ADMIN_PASSWORD || '').trim() || 'guru123';
