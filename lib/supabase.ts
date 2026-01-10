
import { createClient } from '@supabase/supabase-js';
import { CONFIG } from './config.ts';

// تم إزالة القيم الافتراضية الصلبة لزيادة الأمان
const supabaseUrl = CONFIG.SUPABASE_URL;
const supabaseAnonKey = CONFIG.SUPABASE_ANON_KEY;

// التحقق من صحة البيانات قبل محاولة الاتصال
const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const isSupabaseConfigured = isValidUrl(supabaseUrl) && supabaseAnonKey.length > 0;

// إنشاء العميل فقط إذا كانت البيانات موجودة، وإلا نستخدم قيم فارغة لمنع الانهيار
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);
