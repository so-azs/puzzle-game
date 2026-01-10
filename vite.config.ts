
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // تحميل كافة متغيرات البيئة المتاحة في النظام (Netlify يوفرها في process.env أثناء البناء)
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      sourcemap: false
    },
    // تعريف الثوابت التي سيتم استبدالها في الكود المصدري
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_API_KEY || ''),
      'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || env.SUPABASE_URL || ''),
      'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || ''),
    }
  };
});
