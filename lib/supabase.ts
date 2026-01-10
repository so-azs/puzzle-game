
import { createClient } from '@supabase/supabase-js';
import { CONFIG } from './config.ts';

const supabaseUrl = CONFIG.SUPABASE_URL;
const supabaseAnonKey = CONFIG.SUPABASE_ANON_KEY;

// التحقق من صلاحية الإعدادات قبل محاولة الإنشاء
export const isSupabaseConfigured = 
  !!supabaseUrl && 
  supabaseUrl.startsWith('http') && 
  !!supabaseAnonKey;

/**
 * نقوم بإنشاء العميل فقط إذا كانت البيانات صحيحة.
 * في حال عدم وجودها، نعيد كائناً فارغاً مؤقتاً لأن App.tsx 
 * سيقوم بحظر واجهة المستخدم وعرض شاشة الإعدادات قبل استدعاء أي دالة.
 */
export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (null as any); 
