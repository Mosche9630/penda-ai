import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Les variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont requises.');
}

// Global singleton pour éviter la récréation multiple côté client
const globalForSupabase = globalThis as unknown as {
  supabasePublic: SupabaseClient | undefined;
};

// Client Public (Pour le frontend / composants 'use client')
export const supabasePublic =
  globalForSupabase.supabasePublic ??
  createClient(supabaseUrl, supabaseAnonKey);

if (process.env.NODE_ENV !== 'production') {
  globalForSupabase.supabasePublic = supabasePublic;
}

// Client Admin (À utiliser uniquement dans app/api/ pour contourner les règles RLS)
const adminKey = supabaseServiceRoleKey || supabaseAnonKey;

export const supabaseAdmin = createClient(
  supabaseUrl,
  adminKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);