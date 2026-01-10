
import { createClient } from '@supabase/supabase-js';
import { CONFIG } from './config.ts';

const supabaseUrl = CONFIG.SUPABASE_URL;
const supabaseAnonKey = CONFIG.SUPABASE_ANON_KEY;

// التحقق من صلاحية الإعدادات قبل محاولة الإنشاء
export const isSupabaseConfigured = 
  typeof supabaseUrl === 'string' && 
  supabaseUrl.length > 0 &&
  supabaseUrl.startsWith('http') && 
  typeof supabaseAnonKey === 'string' &&
  supabaseAnonKey.length > 0;

/**
 * نقوم بإنشاء العميل فقط إذا كانت البيانات صحيحة تماماً.
 * في حال عدم وجودها، نستخدم قيم وهمية صالحة هيكلياً لمنع الانهيار الفوري،
 * حيث ستقوم واجهة App.tsx بحظر الوصول الفعلي وعرض شاشة الإعدادات.
 */
const PLACEHOLDER_URL = 'https://placeholder-project.supabase.co';
const PLACEHOLDER_KEY = 'placeholder-key';

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : PLACEHOLDER_URL,
  isSupabaseConfigured ? supabaseAnonKey : PLACEHOLDER_KEY
);
