
/**
 * إدارة مركزية لمتغيرات البيئة.
 * يدعم التسميات المختلفة لضمان التوافق مع Netlify و Vite.
 */

const getEnv = (key: string): string => {
  // محاولة جلب القيمة من process.env (المحقونة عبر Vite define)
  const value = process.env[key];
  
  if (!value || value === 'undefined' || value === 'null' || value.trim() === '') {
    return '';
  }
  return value;
};

export const CONFIG = {
  // دعم API_KEY المباشر أو المسبوق بـ VITE_
  GEMINI_API_KEY: getEnv('API_KEY'),
  SUPABASE_URL: getEnv('VITE_SUPABASE_URL'),
  SUPABASE_ANON_KEY: getEnv('VITE_SUPABASE_ANON_KEY'),
};

export const isConfigComplete = (): boolean => {
  return (
    CONFIG.GEMINI_API_KEY.length > 10 &&
    CONFIG.SUPABASE_URL.startsWith('http') &&
    CONFIG.SUPABASE_ANON_KEY.length > 10
  );
};

export const getMissingKeys = (): string[] => {
  const missing = [];
  if (!CONFIG.GEMINI_API_KEY) missing.push('Gemini API Key (API_KEY)');
  if (!CONFIG.SUPABASE_URL) missing.push('Supabase URL (VITE_SUPABASE_URL)');
  if (!CONFIG.SUPABASE_ANON_KEY) missing.push('Supabase Anon Key (VITE_SUPABASE_ANON_KEY)');
  return missing;
};
