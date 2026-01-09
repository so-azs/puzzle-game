
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

/**
 * مكان وضع البيانات الحقيقية:
 * 1. انتقل إلى Settings > API في لوحة تحكم Supabase.
 * 2. انسخ Project URL وضعه مكان SUPABASE_URL.
 * 3. انسخ anon/public key وضعه مكان SUPABASE_ANON_KEY.
 * ملاحظة: في بيئة الإنتاج، يفضل استخدام متغيرات البيئة (.env).
 */
const supabaseUrl = 'https://yjkuwwcgvpjlrchkhhsr.supabase.co'; // تم وضع الرابط الخاص بك
const supabaseAnonKey = 'YOUR_PUBLIC_ANON_KEY_HERE'; // ضع مفتاح Public Key هنا

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
