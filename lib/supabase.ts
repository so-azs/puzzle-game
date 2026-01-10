import { createClient } from '@supabase/supabase-js';

// Vite يقوم بحقن هذه المتغيرات عبر Define في vite.config.ts
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = supabaseUrl.length > 0 && supabaseAnonKey.length > 0;

// نستخدم محاولات حماية لمنع انهيار التطبيق عند الفشل في القراءة
export const supabase = createClient(
  supabaseUrl || 'https://yjkuwwcgvpjlrchkhhsr.supabase.co',
  supabaseAnonKey || 'sb_publishable_c3K5WwbYsjKLK0lpWaYnFw_YMZYWXuu'
);