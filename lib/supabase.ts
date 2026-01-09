
import { createClient } from '@supabase/supabase-js';

/**
 * عند رفع المشروع على Netlify:
 * 1. اذهب إلى Site Configuration > Environment Variables.
 * 2. أضف VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY.
 */
// Fix: Use process.env as defined in vite.config.ts to avoid ImportMeta property 'env' errors
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://yjkuwwcgvpjlrchkhhsr.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'PLACEHOLDER_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
