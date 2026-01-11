
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Use '.' instead of process.cwd() to avoid TypeScript errors in environments with limited process types
  const env = loadEnv(mode, '.', '');
  
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
