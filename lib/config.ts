
/**
 * هذا الملف هو المركز الوحيد لإدارة المفاتيح الحساسة.
 * يساعد في عزل البيئة البرمجية عن القيم الفعلية لزيادة الأمان.
 */

// دالة مساعدة لتنظيف القيم المستلمة من نظام البناء (Vite)
const getEnv = (key: string): string => {
  const value = process.env[key];
  // التحقق مما إذا كانت القيمة نصية صالحة وليست مجرد كلمة "undefined" أو "null" كإشارة نصية
  if (!value || value === 'undefined' || value === 'null') return '';
  return value;
};

export const CONFIG = {
  GEMINI_API_KEY: getEnv('API_KEY'),
  SUPABASE_URL: getEnv('VITE_SUPABASE_URL'),
  SUPABASE_ANON_KEY: getEnv('VITE_SUPABASE_ANON_KEY'),
};

export const isConfigComplete = (): boolean => {
  return (
    CONFIG.GEMINI_API_KEY.length > 5 && // مفتاح Gemini عادة أطول من 5 محارف
    CONFIG.SUPABASE_URL.startsWith('http') &&
    CONFIG.SUPABASE_ANON_KEY.length > 10
  );
};

export const getMissingKeys = (): string[] => {
  const missing = [];
  if (!CONFIG.GEMINI_API_KEY) missing.push('Gemini API Key (API_KEY)');
  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_URL.startsWith('http')) missing.push('Supabase URL');
  if (!CONFIG.SUPABASE_ANON_KEY) missing.push('Supabase Anon Key');
  return missing;
};
