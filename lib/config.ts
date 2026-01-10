
/**
 * إدارة مركزية لمتغيرات البيئة.
 * في Vite، يتم استبدال "process.env.VAR" حرفياً أثناء عملية البناء.
 * استخدام الوصول الديناميكي مثل process.env[key] لا يعمل في المتصفح.
 */

export const CONFIG = {
  // نستخدم الوصول المباشر ليقوم Vite باستبدال القيم أثناء البناء
  GEMINI_API_KEY: process.env.API_KEY || '',
  SUPABASE_URL: process.env.VITE_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || '',
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
