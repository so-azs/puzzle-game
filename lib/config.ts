
/**
 * هذا الملف يعمل كطبقة عازلة للمفاتيح الحساسة.
 * لا تقم أبداً بكتابة المفاتيح هنا مباشرة.
 */

export const CONFIG = {
  GEMINI_API_KEY: process.env.API_KEY || '',
  SUPABASE_URL: process.env.VITE_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || '',
};

export const isConfigComplete = (): boolean => {
  return (
    CONFIG.GEMINI_API_KEY.length > 0 &&
    CONFIG.SUPABASE_URL.length > 0 &&
    CONFIG.SUPABASE_ANON_KEY.length > 0
  );
};

export const getMissingKeys = (): string[] => {
  const missing = [];
  if (!CONFIG.GEMINI_API_KEY) missing.push('Gemini API Key');
  if (!CONFIG.SUPABASE_URL) missing.push('Supabase URL');
  if (!CONFIG.SUPABASE_ANON_KEY) missing.push('Supabase Anon Key');
  return missing;
};
